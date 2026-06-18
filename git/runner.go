package git

import (
	"bufio"
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
)

// CheckGitAvailable kiểm tra xem Git đã được cài đặt và cấu hình trong PATH chưa
func CheckGitAvailable() bool {
	cmd := exec.Command("git", "--version")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd.Run() == nil
}

// SplitByNewlineOrCR splits scanner input by '\n', '\r\n', or '\r'
func SplitByNewlineOrCR(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	for i := 0; i < len(data); i++ {
		if data[i] == '\n' {
			return i + 1, data[0:i], nil
		}
		if data[i] == '\r' {
			if i+1 < len(data) && data[i+1] == '\n' {
				return i + 2, data[0:i], nil
			}
			return i + 1, data[0:i], nil
		}
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil
}

// runSingleCommand executes a git command and feeds logs line by line
func runSingleCommand(ctx context.Context, dir string, onLog func(string), onProgress func(int), name string, args ...string) error {
	// Ghi log câu lệnh chuẩn bị chạy (ẩn thông tin token nhạy cảm)
	maskedArgs := make([]string, len(args))
	tokenRegex := regexp.MustCompile(`https://[^@\s"]+@github\.com`)
	for i, arg := range args {
		maskedArgs[i] = tokenRegex.ReplaceAllString(arg, "https://***@github.com")
	}
	if onLog != nil {
		onLog(fmt.Sprintf(">> git %s", strings.Join(maskedArgs, " ")))
	}

	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		return err
	}

	scanner := bufio.NewScanner(stdout)
	scanner.Split(SplitByNewlineOrCR)
	re := regexp.MustCompile(`Writing objects:\s+(\d+)%`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		
		// Gửi log về giao diện (ẩn token)
		maskedLine := tokenRegex.ReplaceAllString(line, "https://***@github.com")
		if onLog != nil {
			onLog(maskedLine)
		}

		// Trích xuất phần trăm tiến độ
		if onProgress != nil {
			matches := re.FindStringSubmatch(line)
			if len(matches) > 1 {
				percent, _ := strconv.Atoi(matches[1])
				onProgress(percent)
			}
		}
	}

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("lệnh thất bại với lỗi: %w", err)
	}
	return nil
}

// PushHomework thực thi toàn bộ chuỗi lệnh Git
func PushHomework(
	ctx context.Context, 
	folderPath, repoURL, commitName, commitEmail, commitMsg string, 
	onLog func(string), 
	onProgress func(int),
) error {
	if !CheckGitAvailable() {
		return errors.New("hệ thống chưa cài đặt Git hoặc chưa cấu hình biến môi trường PATH")
	}

	gitDir := filepath.Join(folderPath, ".git")

	// Đảm bảo dọn dẹp thư mục .git cục bộ sau khi hoàn thành (thành công, thất bại, hoặc bị hủy)
	defer func() {
		if err := os.RemoveAll(gitDir); err != nil {
			if onLog != nil {
				onLog(fmt.Sprintf("Cảnh báo dọn dẹp thư mục .git sau khi push: %v", err))
			}
		} else {
			if onLog != nil {
				onLog("Đã giải phóng tài nguyên và dọn dẹp thư mục .git cục bộ thành công.")
			}
		}
	}()

	// 1. Dọn dẹp thư mục .git cũ nếu có
	if err := os.RemoveAll(gitDir); err != nil {
		if onLog != nil {
			onLog(fmt.Sprintf("Cảnh báo xóa thư mục .git cũ: %v", err))
		}
	}

	// 2. Chạy git init
	if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "init"); err != nil {
		return fmt.Errorf("git init thất bại: %w", err)
	}

	// 2.5 Cấu hình tắt tự động GC để tránh các tiến trình chạy ngầm khóa thư mục
	if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "config", "gc.auto", "0"); err != nil {
		if onLog != nil {
			onLog(fmt.Sprintf("Cảnh báo cấu hình gc.auto: %v", err))
		}
	}

	// 3. Cấu hình local git user name/email nếu được chỉ định
	if commitName != "" {
		if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "config", "user.name", commitName); err != nil {
			return fmt.Errorf("cấu hình user.name thất bại: %w", err)
		}
	}
	if commitEmail != "" {
		if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "config", "user.email", commitEmail); err != nil {
			return fmt.Errorf("cấu hình user.email thất bại: %w", err)
		}
	}

	// Đảm bảo .env được bỏ qua trước khi chạy git add để tránh push secrets lên GitHub
	if err := ensureEnvIgnored(folderPath); err != nil {
		if onLog != nil {
			onLog(fmt.Sprintf("Cảnh báo cấu hình .gitignore: %v", err))
		}
	}

	// 4. Chạy git add
	if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "add", "."); err != nil {
		return fmt.Errorf("git add thất bại: %w", err)
	}

	// 5. Chạy git commit
	if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "commit", "--allow-empty", "-m", commitMsg); err != nil {
		return fmt.Errorf("git commit thất bại: %w", err)
	}

	// 6. Chạy git branch -M main
	if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "branch", "-M", "main"); err != nil {
		return fmt.Errorf("git branch thất bại: %w", err)
	}

	// 7. Chạy git remote add origin
	if err := runSingleCommand(ctx, folderPath, onLog, nil, "git", "remote", "add", "origin", repoURL); err != nil {
		return fmt.Errorf("git remote add origin thất bại: %w", err)
	}

	// 8. Chạy git push --progress --force
	if err := runSingleCommand(ctx, folderPath, onLog, onProgress, "git", "push", "-u", "origin", "main", "--force", "--progress"); err != nil {
		return fmt.Errorf("git push thất bại: %w", err)
	}

	return nil
}

// ensureEnvIgnored đảm bảo file .env nằm trong .gitignore để tránh đẩy token lên GitHub
func ensureEnvIgnored(dir string) error {
	gitignorePath := filepath.Join(dir, ".gitignore")

	// Nếu .gitignore chưa tồn tại, tạo mới và ghi ".env"
	if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
		return os.WriteFile(gitignorePath, []byte(".env\n"), 0644)
	}

	// Đọc nội dung .gitignore hiện có
	content, err := os.ReadFile(gitignorePath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	hasEnv := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == ".env" || strings.HasPrefix(trimmed, ".env ") || strings.HasPrefix(trimmed, ".env/") {
			hasEnv = true
			break
		}
	}

	if !hasEnv {
		// Mở file ở chế độ ghi tiếp (append)
		f, err := os.OpenFile(gitignorePath, os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		defer f.Close()

		// Đảm bảo có dòng mới nếu file chưa kết thúc bằng dòng mới
		if len(content) > 0 && content[len(content)-1] != '\n' {
			if _, err := f.WriteString("\n"); err != nil {
				return err
			}
		}
		if _, err := f.WriteString(".env\n"); err != nil {
			return err
		}
	}

	return nil
}

