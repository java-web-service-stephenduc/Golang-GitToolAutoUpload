package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"

	"g-gitupload/config"
	"g-gitupload/git"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// IDEInfo represents a detected IDE on the system
type IDEInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
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
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		return err
	}

	runtime.EventsEmit(a.ctx, "clone_progress", 30)

	scanner := bufio.NewScanner(stdout)
	scanner.Split(git.SplitByNewlineOrCR)

	progressRegex := regexp.MustCompile(`(Receiving objects|Resolving deltas):\s+(\d+)%`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if cfg.GithubToken != "" {
			line = strings.ReplaceAll(line, cfg.GithubToken, "******")
		}
		runtime.EventsEmit(a.ctx, "clone_log", line)

		matches := progressRegex.FindStringSubmatch(line)
		if len(matches) > 2 {
			pct, _ := strconv.Atoi(matches[2])
			uiPct := 40 + int(float64(pct)*0.55)
			runtime.EventsEmit(a.ctx, "clone_progress", uiPct)
		}
	}

	if err := cmd.Wait(); err != nil {
		runtime.EventsEmit(a.ctx, "clone_progress", 0)
		return fmt.Errorf("clone thất bại: %w", err)
	}

	runtime.EventsEmit(a.ctx, "clone_progress", 100)
	runtime.EventsEmit(a.ctx, "clone_log", "Đã clone repository thành công!")
	return nil
}

// DetectIDEs returns a list of detected IDEs on the system
func (a *App) DetectIDEs() []IDEInfo {
	var ides []IDEInfo

	// VS Code
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
	if !hasIDE(ides, "VS Code") {
		if runCommandSilently("code", "--version") == nil {
			ides = append(ides, IDEInfo{Name: "VS Code", Path: "code"})
		}
	}

	// IntelliJ IDEA (Program Files)
	if progFiles := os.Getenv("ProgramFiles"); progFiles != "" {
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
	// IntelliJ IDEA (Toolbox)
	if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
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

	// Cursor
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

	// Antigravity IDE
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

func hasIDE(list []IDEInfo, name string) bool {
	for _, id := range list {
		if id.Name == name {
			return true
		}
	}
	return false
}


