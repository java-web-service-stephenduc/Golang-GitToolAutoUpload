package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"g-gitupload/config"
	"g-gitupload/git"
	"g-gitupload/github"
	"g-gitupload/history"
	"time"

	goruntime "runtime"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	pushMu     sync.Mutex
	pushCancel context.CancelFunc
)

// StartPush starts the git push workflow
func (a *App) StartPush(
	folderPath string,
	mode string,
	sessionVal, exVal, miniProjectVal, customRepoNameVal string,
	useDefaultCommit bool,
	customCommitMsg string,
) (err error) {
	pushMu.Lock()
	if pushCancel != nil {
		pushMu.Unlock()
		return errors.New("một tiến trình push đang chạy")
	}
	pushCtx, cancel := context.WithCancel(a.ctx)
	pushCancel = cancel
	pushMu.Unlock()

	defer func() {
		if err != nil {
			runtime.EventsEmit(a.ctx, "push_error", err.Error())
		}
		pushMu.Lock()
		pushCancel = nil
		pushMu.Unlock()
		cancel()
		goruntime.GC()
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
	cleanedPath := cleanPath(folderPath)
	if cleanedPath == "" {
		return errors.New("đường dẫn thư mục trống")
	}
	info, err := os.Stat(cleanedPath)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("thư mục không tồn tại: %s", cleanedPath)
	}

	// 2. Xác định tên Repository
	repoName, err := resolveRepoName(cfg, mode, sessionVal, exVal, miniProjectVal, customRepoNameVal)
	if err != nil {
		return err
	}

	// 3. Xác định Commit Message
	commitMsg, err := resolveCommitMsg(cfg, useDefaultCommit, customCommitMsg)
	if err != nil {
		return err
	}

	// 4. Tạo Repository trên GitHub
	owner := cfg.GithubUsername
	isOrg := cfg.HasOrganization()
	if isOrg {
		owner = cfg.GithubOrgName
	}

	runtime.EventsEmit(pushCtx, "git_log", "Đang tạo repository trên GitHub...")
	runtime.EventsEmit(pushCtx, "git_progress", 20)

	repoResp, err := github.CreateRepository(cfg.GithubToken, owner, repoName, isOrg, cfg.RepoPrivate)
	if err != nil {
		return fmt.Errorf("tạo repository thất bại: %w", err)
	}

	runtime.EventsEmit(pushCtx, "git_log", "Repository GitHub đã sẵn sàng.")
	runtime.EventsEmit(pushCtx, "git_progress", 40)

	remoteURL := fmt.Sprintf("https://%s@github.com/%s/%s.git", cfg.GithubToken, owner, repoName)

	// 5. Cấu hình Identity và Push
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
		uiPercent := 40 + int(float64(percent)*0.55)
		runtime.EventsEmit(pushCtx, "git_progress", uiPercent)
	}

	if err := git.PushHomework(pushCtx, cleanedPath, remoteURL, commitName, commitEmail, commitMsg, onLog, onProgress); err != nil {
		return err
	}

	runtime.EventsEmit(pushCtx, "git_progress", 100)
	runtime.EventsEmit(pushCtx, "git_log", fmt.Sprintf("Đẩy bài tập thành công! Link: %s", repoResp.HtmlUrl))

	// 6. Lưu lịch sử
	_ = history.SaveLastPushed(&history.PushedRepo{
		RepoName:  repoName,
		RepoUrl:   repoResp.HtmlUrl,
		PushedAt:  time.Now().Format(time.RFC3339),
		LocalPath: filepath.ToSlash(cleanedPath),
	})

	return nil
}

// CancelPush cancels the active push process
func (a *App) CancelPush() error {
	pushMu.Lock()
	defer pushMu.Unlock()
	if pushCancel != nil {
		pushCancel()
		pushCancel = nil
		return nil
	}
	return errors.New("không có tiến trình push nào đang chạy để hủy")
}

// --- helpers ---

func cleanPath(path string) string {
	p := strings.TrimSpace(path)
	if len(p) >= 2 && p[0] == '"' && p[len(p)-1] == '"' {
		p = p[1 : len(p)-1]
	}
	return strings.TrimSpace(p)
}

func resolveRepoName(cfg *config.AppConfig, mode, sessionVal, exVal, miniProjectVal, customRepoNameVal string) (string, error) {
	var repoName string
	switch mode {
	case "SESSION_EX":
		sessionNum, err1 := strconv.Atoi(strings.TrimSpace(sessionVal))
		exNum, err2 := strconv.Atoi(strings.TrimSpace(exVal))
		if err1 != nil || err2 != nil || sessionNum <= 0 || exNum <= 0 {
			return "", errors.New("Session và Exercise phải là số nguyên dương")
		}
		repoName = formatRepoName(cfg.NamingPattern, sessionNum, exNum)
	case "MINI_PROJECT":
		sessionNum, err1 := strconv.Atoi(strings.TrimSpace(sessionVal))
		if err1 != nil || sessionNum <= 0 {
			return "", errors.New("Session phải là số nguyên dương")
		}
		sanitized, err := sanitizeMiniProjectText(miniProjectVal)
		if err != nil {
			return "", err
		}
		repoName = fmt.Sprintf("session%02d-miniproject-%s", sessionNum, sanitized)
	case "CUSTOM_REPOSITORY":
		var err error
		repoName, err = sanitizeCustomRepositoryName(customRepoNameVal)
		if err != nil {
			return "", err
		}
	default:
		return "", fmt.Errorf("chế độ tải lên không hợp lệ: %s", mode)
	}
	if err := validateRepositoryName(repoName); err != nil {
		return "", err
	}
	return repoName, nil
}

func resolveCommitMsg(cfg *config.AppConfig, useDefault bool, customMsg string) (string, error) {
	if useDefault {
		if cfg.DefaultCommitMsg != "" {
			return cfg.DefaultCommitMsg, nil
		}
		return "init", nil
	}
	msg := strings.TrimSpace(customMsg)
	if msg == "" {
		return "", errors.New("commit message tùy chỉnh không được để trống")
	}
	return msg, nil
}

func formatRepoName(pattern string, sessionNum, exNum int) string {
	if strings.Contains(pattern, "%s") {
		return fmt.Sprintf(pattern, strconv.Itoa(sessionNum), strconv.Itoa(exNum))
	}
	return fmt.Sprintf(pattern, sessionNum, exNum)
}

func sanitizeMiniProjectText(text string) (string, error) {
	t := strings.TrimSpace(strings.ToLower(text))
	if t == "" {
		return "", errors.New("tên miniproject không được để trống")
	}
	re := regexp.MustCompile(`[^a-z0-9._-]+`)
	normalized := re.ReplaceAllString(t, "-")
	reDashes := regexp.MustCompile(`-+`)
	normalized = reDashes.ReplaceAllString(normalized, "-")
	normalized = strings.Trim(normalized, ".-")
	if normalized == "" {
		return "", errors.New("tên miniproject không hợp lệ sau khi chuẩn hóa")
	}
	return normalized, nil
}

func sanitizeCustomRepositoryName(name string) (string, error) {
	t := strings.TrimSpace(name)
	if t == "" {
		return "", errors.New("tên repository không được để trống")
	}
	return t, nil
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
