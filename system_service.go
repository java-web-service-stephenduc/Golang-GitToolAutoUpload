package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"g-gitupload/config"
	"g-gitupload/github"
	"g-gitupload/history"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	return cmd.Run()
}

// SelectDirectory opens a directory dialog and returns the selected path
func (a *App) SelectDirectory() (string, error) {
	defaultDir := a.getRecentUploadDir()
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Chọn thư mục bài tập",
		DefaultDirectory: defaultDir,
	})
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

// GetLocalGuideHTML renders HUONG_DAN.txt using GitHub's markdown API if possible
func (a *App) GetLocalGuideHTML() (string, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return "", err
	}

	var content string

	// Try online sources first
	onlineURLs := []string{
		"https://raw.githubusercontent.com/java-web-service-stephenduc/Golang-GitToolAutoUpload/main/HUONG_DAN.txt",
		"https://raw.githubusercontent.com/java-web-service-stephenduc/Golang-GitToolAutoUpload/master/HUONG_DAN.txt",
	}
	for _, url := range onlineURLs {
		resp, err := appHttpClient.Get(url)
		if err == nil && resp.StatusCode == http.StatusOK {
			bodyBytes, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr == nil {
				content = string(bodyBytes)
				break
			}
		}
		if resp != nil {
			resp.Body.Close()
		}
	}

	// Fallback to local file
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
	payload := map[string]string{"text": content, "mode": "gfm"}
	jsonBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.GithubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := appHttpClient.Do(req)
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

	repos, _, err := github.SearchRepositories(cfg.GithubToken, owner, "", isOrg, 1, 100)
	if err != nil {
		return nil, err
	}
	return repos, nil
}

func runCommandSilently(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	return cmd.Run()
}

var appHttpClient = &http.Client{
	Timeout: 15 * time.Second,
}

// GetRawGuideContent returns the raw content of HUONG_DAN.txt
func (a *App) GetRawGuideContent() (string, error) {
	data, err := os.ReadFile("HUONG_DAN.txt")
	if err != nil {
		return guideContent, nil // Fallback to embedded guideContent
	}
	return string(data), nil
}
