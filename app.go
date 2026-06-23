package main

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"g-gitupload/config"
	"g-gitupload/git"
	"g-gitupload/github"
	"g-gitupload/history"

	goruntime "runtime"

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

func (a *App) getRecentUploadDir() string {
	repo, err := history.GetLastPushed()
	if err != nil || repo == nil || repo.LocalPath == "" {
		return ""
	}
	
	path := filepath.Clean(repo.LocalPath)
	for {
		if path == "" || path == "." || path == filepath.Dir(path) {
			break
		}
		info, err := os.Stat(path)
		if err == nil && info.IsDir() {
			return path
		}
		path = filepath.Dir(path)
	}
	return ""
}

// SelectDirectory opens a directory dialog and returns the selected path
func (a *App) SelectDirectory() (string, error) {
	defaultDir := a.getRecentUploadDir()
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Chọn thư mục bài tập",
		DefaultDirectory: defaultDir,
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

type SearchReposResponse struct {
	Repos      []github.RepositoryInfo `json:"repos"`
	TotalCount int                     `json:"total_count"`
}

// SearchRepos searches GitHub repositories based on query and handles pagination & sorting
func (a *App) SearchRepos(query string, page, pageSize int, sortBy string) (*SearchReposResponse, error) {
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

	repos, totalCount, err := github.SearchRepositories(cfg.GithubToken, owner, query, isOrg, page, pageSize)
	if err != nil {
		return nil, err
	}

	github.SortRepositories(repos, sortBy)

	return &SearchReposResponse{
		Repos:      repos,
		TotalCount: totalCount,
	}, nil
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
		goruntime.GC() // Lập tức giải phóng bộ nhớ heap trở lại hệ điều hành sau khi hoàn thành tiến trình nặng
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
		commitMsg = cfg.DefaultCommitMsg
		if commitMsg == "" {
			commitMsg = "init"
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

	repoResp, err := github.CreateRepository(cfg.GithubToken, owner, repoName, isOrg, cfg.RepoPrivate)
	if err != nil {
		return fmt.Errorf("tạo repository thất bại: %w", err)
	}

	runtime.EventsEmit(pushCtx, "git_log", "Repository GitHub đã sẵn sàng.")
	runtime.EventsEmit(pushCtx, "git_progress", 40)

	// Xây dựng Remote URL có chèn token xác thực
	remoteURL := fmt.Sprintf("https://%s@github.com/%s/%s.git", cfg.GithubToken, owner, repoName)

	// 5. Cấu hình Identity và Push bài tập
	commitName := cfg.GithubUsername
	if cfg.GitCommitName != "" {
		commitName = cfg.GitCommitName
	}
	commitEmail := commitName + "@users.noreply.github.com"
	if cfg.GitCommitEmail != "" {
		commitEmail = cfg.GitCommitEmail
	}

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

// GetRepoLanguageStats returns the primary language of the repository and its usage percentage
func (a *App) GetRepoLanguageStats(repoName string) (string, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return "", err
	}
	if cfg.GithubToken == "" {
		return "", errors.New("chưa cài đặt GitHub Token")
	}

	owner := cfg.GithubUsername
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
	}

	return github.GetRepoLanguageStats(owner, repoName, cfg.GithubToken)
}

// GetRepoContents retrieves files and directories of the repository under the specified path
func (a *App) GetRepoContents(repoName, path string) ([]github.ContentInfo, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	if cfg.GithubToken == "" {
		return nil, errors.New("chưa cài đặt GitHub Token")
	}

	owner := cfg.GithubUsername
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
	}

	return github.GetRepoContents(owner, repoName, path, cfg.GithubToken)
}

// GetRepoReadme retrieves the HTML formatted README file of the repository
func (a *App) GetRepoReadme(repoName string) (string, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return "", err
	}
	if cfg.GithubToken == "" {
		return "", errors.New("chưa cài đặt GitHub Token")
	}

	owner := cfg.GithubUsername
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
	}

	return github.GetRepoReadme(owner, repoName, cfg.GithubToken)
}

// GetTokenReport returns diagnostics and reports on the current GitHub PAT
func (a *App) GetTokenReport() (*github.TokenReport, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	if cfg.GithubToken == "" {
		return nil, errors.New("chưa cài đặt GitHub Token trong Settings")
	}

	return github.GetTokenReport(cfg.GithubToken)
}

//go:embed HUONG_DAN.txt
var guideContent string

var appHttpClient = &http.Client{
	Timeout: 15 * time.Second,
}

// GetLocalGuideHTML renders HUONG_DAN.txt using GitHub's markdown API if possible
func (a *App) GetLocalGuideHTML() (string, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return "", err
	}
	var content string
	// Thử tải hướng dẫn từ nhánh main của repository online
	onlineURL := "https://raw.githubusercontent.com/java-web-service-stephenduc/Golang-GitToolAutoUpload/main/HUONG_DAN.txt"
	resp, err := appHttpClient.Get(onlineURL)
	if err == nil && resp.StatusCode == http.StatusOK {
		bodyBytes, err := io.ReadAll(resp.Body)
		if err == nil {
			content = string(bodyBytes)
		}
		resp.Body.Close()
	}

	// Nếu thất bại (404 hoặc mạng lỗi), thử nhánh master làm dự phòng
	if content == "" {
		onlineURL = "https://raw.githubusercontent.com/java-web-service-stephenduc/Golang-GitToolAutoUpload/master/HUONG_DAN.txt"
		resp, err = appHttpClient.Get(onlineURL)
		if err == nil && resp.StatusCode == http.StatusOK {
			bodyBytes, err := io.ReadAll(resp.Body)
			if err == nil {
				content = string(bodyBytes)
			}
			resp.Body.Close()
		}
	}

	// Nếu vẫn trống (offline hoặc lỗi mạng), đọc file cục bộ hoặc chuỗi nhúng mặc định
	if content == "" {
		data, err := os.ReadFile("HUONG_DAN.txt")
		if err != nil {
			content = guideContent
		} else {
			content = string(data)
		}
	}

	if cfg.GithubToken == "" {
		return "<pre style='white-space: pre-wrap; font-family: sans-serif; font-size: 13.5px; line-height: 1.6; color: var(--text-primary);'>" + content + "</pre>", nil
	}

	// Render via GitHub Markdown API
	url := "https://api.github.com/markdown"
	payload := map[string]string{
		"text": content,
		"mode": "gfm",
	}
	jsonBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.GithubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err = appHttpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("không thể render markdown: %s (Status: %d)", string(bodyBytes), resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(bodyBytes), nil
}

// GetMyRepos fetches the list of repositories from the user's account/organization
func (a *App) GetMyRepos() ([]github.RepositoryInfo, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	if cfg.GithubToken == "" {
		return nil, errors.New("chưa cài đặt GitHub Token")
	}

	owner := cfg.GithubUsername
	isOrg := false
	if cfg.HasOrganization() {
		owner = cfg.GithubOrgName
		isOrg = true
	}

	// Fetch up to 100 repositories
	repos, _, err := github.SearchRepositories(cfg.GithubToken, owner, "", isOrg, 1, 100)
	if err != nil {
		return nil, err
	}
	return repos, nil
}

// StartClone clones a repository and streams logs via Event
func (a *App) StartClone(repoURL, destFolder string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return err
	}

	targetURL := strings.TrimSpace(repoURL)
	if targetURL == "" {
		return errors.New("đường dẫn repository trống")
	}

	targetDest := strings.TrimSpace(destFolder)
	if targetDest == "" {
		return errors.New("thư mục lưu trữ trống")
	}

	// Inject token if it is a github HTTPS URL
	if strings.Contains(targetURL, "github.com") && cfg.GithubToken != "" {
		if strings.HasPrefix(targetURL, "https://") {
			targetURL = "https://" + cfg.GithubToken + "@" + strings.TrimPrefix(targetURL, "https://")
		}
	}

	runtime.EventsEmit(a.ctx, "clone_log", "Bắt đầu tiến trình clone...")
	runtime.EventsEmit(a.ctx, "clone_progress", 10)

	cmd := exec.Command("git", "clone", "--progress", targetURL, targetDest)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = cmd.Stdout // Redirect stderr to stdout to read both

	if err := cmd.Start(); err != nil {
		return err
	}

	runtime.EventsEmit(a.ctx, "clone_progress", 30)

	scanner := bufio.NewScanner(stdout)
	scanner.Split(git.SplitByNewlineOrCR)

	// Regex for progress parsing
	progressRegex := regexp.MustCompile(`(Receiving objects|Resolving deltas):\s+(\d+)%`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// Hide sensitive token
		if cfg.GithubToken != "" {
			line = strings.ReplaceAll(line, cfg.GithubToken, "******")
		}

		runtime.EventsEmit(a.ctx, "clone_log", line)

		// Extract progress percentage
		matches := progressRegex.FindStringSubmatch(line)
		if len(matches) > 2 {
			pct, _ := strconv.Atoi(matches[2])
			uiPct := 40 + int(float64(pct)*0.55)
			runtime.EventsEmit(a.ctx, "clone_progress", uiPct)
		}
	}

	err = cmd.Wait()
	if err != nil {
		runtime.EventsEmit(a.ctx, "clone_progress", 0)
		return fmt.Errorf("clone thất bại: %w", err)
	}

	runtime.EventsEmit(a.ctx, "clone_progress", 100)
	runtime.EventsEmit(a.ctx, "clone_log", "Đã clone repository thành công!")
	return nil
}

type IDEInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// DetectIDEs returns a list of detected IDEs on the system
func (a *App) DetectIDEs() []IDEInfo {
	var ides []IDEInfo

	// 1. VS Code
	vsCodePaths := []string{
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Microsoft VS Code", "Code.exe"),
		filepath.Join(os.Getenv("ProgramFiles"), "Microsoft VS Code", "Code.exe"),
	}
	for _, p := range vsCodePaths {
		if _, err := os.Stat(p); err == nil {
			ides = append(ides, IDEInfo{Name: "VS Code", Path: p})
			break
		}
	}
	// Fallback to "code" on PATH
	if !hasIDE(ides, "VS Code") {
		if runCommandSilently("code", "--version") == nil {
			ides = append(ides, IDEInfo{Name: "VS Code", Path: "code"})
		}
	}

	// 2. IntelliJ IDEA
	progFiles := os.Getenv("ProgramFiles")
	if progFiles != "" {
		jbDir := filepath.Join(progFiles, "JetBrains")
		if entries, err := os.ReadDir(jbDir); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					p := filepath.Join(jbDir, entry.Name(), "bin", "idea64.exe")
					if _, err := os.Stat(p); err == nil {
						ides = append(ides, IDEInfo{Name: "IntelliJ IDEA", Path: p})
						break
					}
				}
			}
		}
	}
	// JetBrains Toolbox
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData != "" {
		toolboxDir := filepath.Join(localAppData, "JetBrains", "Toolbox", "apps")
		for _, appSub := range []string{"IDEA-U", "IDEA-C"} {
			appDir := filepath.Join(toolboxDir, appSub)
			if entries, err := os.ReadDir(appDir); err == nil {
				for _, chEntry := range entries {
					if chEntry.IsDir() {
						chDir := filepath.Join(appDir, chEntry.Name())
						if buildEntries, err := os.ReadDir(chDir); err == nil {
							for _, buildEntry := range buildEntries {
								if buildEntry.IsDir() {
									p := filepath.Join(chDir, buildEntry.Name(), "bin", "idea64.exe")
									if _, err := os.Stat(p); err == nil {
										ides = append(ides, IDEInfo{Name: "IntelliJ IDEA", Path: p})
										break
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// 3. Cursor
	cursorPaths := []string{
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "cursor", "Cursor.exe"),
		filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local", "Programs", "cursor", "Cursor.exe"),
	}
	for _, p := range cursorPaths {
		if _, err := os.Stat(p); err == nil {
			ides = append(ides, IDEInfo{Name: "Cursor", Path: p})
			break
		}
	}
	if !hasIDE(ides, "Cursor") {
		if runCommandSilently("cursor", "--version") == nil {
			ides = append(ides, IDEInfo{Name: "Cursor", Path: "cursor"})
		}
	}

	// 4. Antigravity IDE
	antigravityPaths := []string{
		filepath.Join(os.Getenv("USERPROFILE"), ".gemini", "antigravity-ide", "Antigravity.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "antigravity-ide", "Antigravity.exe"),
	}
	for _, p := range antigravityPaths {
		if _, err := os.Stat(p); err == nil {
			ides = append(ides, IDEInfo{Name: "Antigravity", Path: p})
			break
		}
	}

	return ides
}

func hasIDE(list []IDEInfo, name string) bool {
	for _, id := range list {
		if id.Name == name {
			return true
		}
	}
	return false
}

// OpenInIDE launches the IDE pointing to the folderPath
func (a *App) OpenInIDE(idePath string, folderPath string) error {
	cmd := exec.Command(idePath, folderPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	return cmd.Start()
}

// OpenDirectoryInExplorer opens a folder in Windows Explorer
func (a *App) OpenDirectoryInExplorer(folderPath string) error {
	cmd := exec.Command("explorer.exe", filepath.Clean(folderPath))
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	return cmd.Start()
}

func runCommandSilently(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd.Run()
}

