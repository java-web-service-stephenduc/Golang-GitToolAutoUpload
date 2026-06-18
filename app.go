package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"sync"
	"time"

	"g-gitupload/config"
	"g-gitupload/git"
	"g-gitupload/github"
	"g-gitupload/history"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	cancelPush context.CancelFunc
	pushMu     sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetSettings loads configuration settings
func (a *App) GetSettings() (*config.AppConfig, error) {
	return config.LoadConfig()
}

// SaveSettings saves configuration settings
func (a *App) SaveSettings(cfg *config.AppConfig) error {
	return config.SaveConfig(cfg)
}

// GetLastPushedRepo retrieves the last pushed repository information
func (a *App) GetLastPushedRepo() (*history.PushedRepo, error) {
	return history.GetLastPushed()
}

// OpenBrowser opens a URL in the user's default browser
func (a *App) OpenBrowser(url string) error {
	var cmd *exec.Cmd
	cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	return cmd.Run()
}

// SelectDirectory opens a directory dialog and returns the selected path
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Chọn thư mục bài tập",
	})
}

// GetGitHubProfile fetches the profile data of the configured GitHub account
func (a *App) GetGitHubProfile() (*github.GitHubProfile, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	if cfg.GithubToken == "" {
		return nil, errors.New("chưa cấu hình token")
	}
	return github.GetGitHubProfile(cfg.GithubToken)
}

// SearchRepos searches GitHub repositories based on query (paginated, 100 items limit from GitHub)
func (a *App) SearchRepos(query string) ([]github.RepositoryInfo, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	if cfg.GithubToken == "" {
		return nil, errors.New("chưa cài đặt GitHub Token trong Settings")
	}

	owner := cfg.GithubUsername
	isOrg := false
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
		isOrg = true
	}

	// Fetch page 1 (up to 100 repositories)
	repos, err := github.ListRepositories(cfg.GithubToken, owner, isOrg, 1)
	if err != nil {
		return nil, err
	}

	// Filter repositories in Go backend
	var filtered []github.RepositoryInfo
	normalizedQuery := strings.TrimSpace(strings.ToLower(query))
	for _, repo := range repos {
		if normalizedQuery == "" || strings.Contains(strings.ToLower(repo.Name), normalizedQuery) {
			filtered = append(filtered, repo)
		}
	}

	return filtered, nil
}

// DeleteRepo deletes a repository from GitHub
func (a *App) DeleteRepo(repoName string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return err
	}
	if cfg.GithubToken == "" {
		return errors.New("chưa cài đặt GitHub Token")
	}

	owner := cfg.GithubUsername
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
	}

	return github.DeleteRepository(owner, repoName, cfg.GithubToken)
}

// StartPush starts the git push workflow
func (a *App) StartPush(
	folderPath string,
	mode string,
	sessionVal, exVal, miniProjectVal, customRepoNameVal string,
	useDefaultCommit bool,
	customCommitMsg string,
) error {
	a.pushMu.Lock()
	if a.cancelPush != nil {
		a.pushMu.Unlock()
		return errors.New("một tiến trình push đang chạy")
	}
	pushCtx, pushCancel := context.WithCancel(a.ctx)
	a.cancelPush = pushCancel
	a.pushMu.Unlock()

	defer func() {
		a.pushMu.Lock()
		a.cancelPush = nil
		a.pushMu.Unlock()
		pushCancel()
	}()

	// 1. Kiểm tra cấu hình và Git
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("không thể tải cấu hình: %w", err)
	}
	if cfg.GithubToken == "" || cfg.GithubUsername == "" {
		return errors.New("vui lòng cài đặt GitHub Token và Username trong Settings")
	}
	if !git.CheckGitAvailable() {
		return errors.New("hệ thống chưa cài đặt Git hoặc chưa cấu hình biến môi trường PATH")
	}

	// Validate & normalize directory
	cleanedPath := strings.TrimSpace(folderPath)
	if len(cleanedPath) >= 2 && cleanedPath[0] == '"' && cleanedPath[len(cleanedPath)-1] == '"' {
		cleanedPath = cleanedPath[1 : len(cleanedPath)-1]
	}
	cleanedPath = strings.TrimSpace(cleanedPath)
	if cleanedPath == "" {
		return errors.New("đường dẫn thư mục trống")
	}
	info, err := os.Stat(cleanedPath)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("thư mục không tồn tại: %s", cleanedPath)
	}

	// 2. Xác định tên Repository
	var repoName string
	owner := cfg.GithubUsername
	isOrg := false
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
		isOrg = true
	}

	switch mode {
	case "SESSION_EX":
		sessionNum, err1 := strconv.Atoi(strings.TrimSpace(sessionVal))
		exNum, err2 := strconv.Atoi(strings.TrimSpace(exVal))
		if err1 != nil || err2 != nil || sessionNum <= 0 || exNum <= 0 {
			return errors.New("Session và Exercise phải là số nguyên dương")
		}
		repoName = formatRepoName(cfg.NamingPattern, sessionNum, exNum)
	case "MINI_PROJECT":
		sessionNum, err1 := strconv.Atoi(strings.TrimSpace(sessionVal))
		if err1 != nil || sessionNum <= 0 {
			return errors.New("Session phải là số nguyên dương")
		}
		sanitizedMiniProject, err := sanitizeMiniProjectText(miniProjectVal)
		if err != nil {
			return err
		}
		repoName = fmt.Sprintf("session%02d-miniproject-%s", sessionNum, sanitizedMiniProject)
	case "CUSTOM_REPOSITORY":
		repoName, err = sanitizeCustomRepositoryName(customRepoNameVal)
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("chế độ tải lên không hợp lệ: %s", mode)
	}

	// Kiểm tra tính hợp lệ tên repo chung
	if err := validateRepositoryName(repoName); err != nil {
		return err
	}

	// 3. Xác định Commit Message
	var commitMsg string
	if useDefaultCommit {
		switch mode {
		case "SESSION_EX":
			commitMsg = fmt.Sprintf("Upload bài tập: Session %s - Exercise %s", sessionVal, exVal)
		case "MINI_PROJECT":
			commitMsg = fmt.Sprintf("Upload bài tập: Session %s - Miniproject %s", sessionVal, miniProjectVal)
		case "CUSTOM_REPOSITORY":
			commitMsg = fmt.Sprintf("Upload repository: %s", repoName)
		}
	} else {
		commitMsg = strings.TrimSpace(customCommitMsg)
		if commitMsg == "" {
			return errors.New("commit message tùy chỉnh không được để trống")
		}
	}

	// 4. Tạo Repository trên GitHub
	runtime.EventsEmit(pushCtx, "git_log", "Đang tạo repository trên GitHub...")
	runtime.EventsEmit(pushCtx, "git_progress", 20)

	repoResp, err := github.CreatePublicRepository(cfg.GithubToken, owner, repoName, isOrg)
	if err != nil {
		return fmt.Errorf("tạo repository thất bại: %w", err)
	}

	runtime.EventsEmit(pushCtx, "git_log", "Repository GitHub đã sẵn sàng.")
	runtime.EventsEmit(pushCtx, "git_progress", 40)

	// Xây dựng Remote URL có chèn token xác thực
	remoteURL := fmt.Sprintf("https://%s@github.com/%s/%s.git", cfg.GithubToken, owner, repoName)

	// 5. Cấu hình Identity và Push bài tập
	commitName := cfg.GithubUsername
	commitEmail := commitName + "@users.noreply.github.com"

	runtime.EventsEmit(pushCtx, "git_log", "Bắt đầu đẩy mã nguồn lên remote...")

	onLog := func(line string) {
		runtime.EventsEmit(pushCtx, "git_log", line)
	}
	onProgress := func(percent int) {
		// Map 0-100% của git push sang 40-95% trên UI
		uiPercent := 40 + int(float64(percent)*0.55)
		runtime.EventsEmit(pushCtx, "git_progress", uiPercent)
	}

	err = git.PushHomework(pushCtx, cleanedPath, remoteURL, commitName, commitEmail, commitMsg, onLog, onProgress)
	if err != nil {
		return err
	}

	runtime.EventsEmit(pushCtx, "git_progress", 100)
	runtime.EventsEmit(pushCtx, "git_log", fmt.Sprintf("Đẩy bài tập thành công! Link: %s", repoResp.HtmlUrl))

	// 6. Lưu lịch sử push gần nhất
	historyRepo := &history.PushedRepo{
		RepoName:  repoName,
		RepoUrl:   repoResp.HtmlUrl,
		PushedAt:  time.Now().Format(time.RFC3339),
		LocalPath: filepath.ToSlash(cleanedPath),
	}
	_ = history.SaveLastPushed(historyRepo)

	return nil
}

// CancelPush cancels the active push process
func (a *App) CancelPush() error {
	a.pushMu.Lock()
	defer a.pushMu.Unlock()
	if a.cancelPush != nil {
		a.cancelPush()
		a.cancelPush = nil
		return nil
	}
	return errors.New("không có tiến trình push nào đang chạy để hủy")
}

// formatRepoName handles formatting naming patterns with both string (%s) and integer (%d) verbs
func formatRepoName(pattern string, sessionNum, exNum int) string {
	if strings.Contains(pattern, "%s") {
		return fmt.Sprintf(pattern, strconv.Itoa(sessionNum), strconv.Itoa(exNum))
	}
	return fmt.Sprintf(pattern, sessionNum, exNum)
}

func sanitizeMiniProjectText(miniProjectText string) (string, error) {
	text := strings.TrimSpace(strings.ToLower(miniProjectText))
	if text == "" {
		return "", errors.New("tên miniproject không được để trống")
	}

	// Thay thế ký tự không hợp lệ bằng dấu gạch ngang
	re := regexp.MustCompile(`[^a-z0-9._-]+`)
	normalized := re.ReplaceAllString(text, "-")

	// Thay thế chuỗi nhiều dấu gạch ngang liên tiếp
	reDashes := regexp.MustCompile(`-+`)
	normalized = reDashes.ReplaceAllString(normalized, "-")

	// Loại bỏ dấu chấm, gạch ngang ở đầu và cuối
	normalized = strings.Trim(normalized, ".-")

	if normalized == "" {
		return "", errors.New("tên miniproject không hợp lệ sau khi chuẩn hóa")
	}

	return normalized, nil
}

func sanitizeCustomRepositoryName(repositoryName string) (string, error) {
	text := strings.TrimSpace(repositoryName)
	if text == "" {
		return "", errors.New("tên repository không được để trống")
	}
	return text, nil
}

func validateRepositoryName(name string) error {
	if len(name) > 100 {
		return errors.New("tên repository chỉ được tối đa 100 ký tự")
	}
	re := regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
	if !re.MatchString(name) {
		return errors.New("tên repository chỉ được gồm chữ, số, '.', '_' hoặc '-'")
	}
	if strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".") ||
		strings.HasPrefix(name, "-") || strings.HasSuffix(name, "-") {
		return errors.New("tên repository không được bắt đầu hoặc kết thúc bằng '.' hoặc '-'")
	}
	if strings.Contains(name, "..") {
		return errors.New("tên repository không được chứa '..'")
	}
	return nil
}
