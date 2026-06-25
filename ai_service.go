package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"g-gitupload/config"
	"g-gitupload/git"
	"g-gitupload/github"
	"g-gitupload/history"
)

// ChatMessage represents a single message in the chat conversation
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the payload sent to OpenRouter API
type ChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

// ChatResponse is the response from OpenRouter API
type ChatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Usage *struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"usage,omitempty"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

const defaultAiModel = "openai/gpt-4o-mini:free"
const openRouterURL = "https://openrouter.ai/api/v1/chat/completions"

var aiHttpClient = &http.Client{
	Timeout: 60 * time.Second,
}

// SendChatMessage sends a chat message to the AI and returns the response
func (a *App) SendChatMessage(messages []ChatMessage) (*ChatMessage, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("không thể tải cấu hình: %w", err)
	}

	apiKey := cfg.AiApiKey
	if apiKey == "" {
		return nil, errors.New("chưa cấu hình AI API Key trong Cài đặt")
	}

	model := cfg.AiModel
	if model == "" {
		model = defaultAiModel
	}

	reqBody := ChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   false,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", openRouterURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/GGitUpload")
	req.Header.Set("X-Title", "G-GitUpload")

	resp, err := aiHttpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kết nối đến AI service thất bại: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(bodyBytes, &errResp) == nil && errResp.Error != nil {
			return nil, fmt.Errorf("AI API lỗi: %s", errResp.Error.Message)
		}
		return nil, fmt.Errorf("AI API lỗi (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result ChatResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, err
	}

	if result.Error != nil {
		return nil, fmt.Errorf("AI API lỗi: %s", result.Error.Message)
	}

	if len(result.Choices) == 0 {
		return nil, errors.New("AI không trả về kết quả")
	}

	msg := result.Choices[0].Message
	if result.Usage != nil && result.Usage.ReasoningTokens > 0 {
		// Append reasoning info as a suffix (could be parsed on frontend)
		msg.Content += fmt.Sprintf("\n\n<reasoning_tokens>%d</reasoning_tokens>", result.Usage.ReasoningTokens)
	}

	return &msg, nil
}

// AppContext provides contextual information about the current app state
type AppContext struct {
	Config         *config.AppConfig  `json:"config"`
	LastPushedRepo *history.PushedRepo `json:"last_pushed_repo"`
	GitAvailable   bool                `json:"git_available"`
	GitHubProfile  *github.GitHubProfile `json:"github_profile,omitempty"`
	Platform       string              `json:"platform"`
}

// GetAppContext returns current application state for context-aware AI
func (a *App) GetAppContext() (*AppContext, error) {
	cfg, err := config.LoadConfig()
	if err != nil {
		cfg = &config.AppConfig{}
	}

	repo, _ := history.GetLastPushed()

	var profile *github.GitHubProfile
	if cfg.GithubToken != "" {
		p, err := github.GetGitHubProfile(cfg.GithubToken)
		if err == nil {
			profile = p
		}
	}

	return &AppContext{
		Config:         cfg,
		LastPushedRepo: repo,
		GitAvailable:   git.CheckGitAvailable(),
		GitHubProfile:  profile,
		Platform:       "windows",
	}, nil
}

// VoiceResult is the representation of parsed voice command action
type VoiceResult struct {
	Action   string            `json:"action"`   // "push", "clone", "search", "navigate", "help", "unknown"
	Params   map[string]string `json:"params"`   // e.g. {"session": "15", "ex": "01"}, {"query": "something"}, {"tab": "settings-tab"}
	Response string            `json:"response"` // Vietnamese response confirmation
}

func parseVoiceCommandRules(transcript string) *VoiceResult {
	t := strings.ToLower(strings.TrimSpace(transcript))
	if t == "" {
		return nil
	}

	// 1. Help / AI
	helpRegex := regexp.MustCompile(`(?i)(?:trợ giúp|hỏi ai|mở chat|help|open chat|trợ lý|ai assistant)`)
	if helpRegex.MatchString(t) {
		return &VoiceResult{
			Action:   "help",
			Params:   make(map[string]string),
			Response: "Đã mở cửa sổ trợ lý AI.",
		}
	}

	// 2. Navigate / Switch Tab
	// Settings: mở cài đặt, chuyển cài đặt, open settings, go to settings, tab cài đặt
	settingsRegex := regexp.MustCompile(`(?i)(?:mở|chuyển|go to|open|tab)\s+(?:cài đặt|cấu hình|thiết lập|settings)`)
	if settingsRegex.MatchString(t) || t == "settings" || t == "cài đặt" {
		return &VoiceResult{
			Action:   "navigate",
			Params:   map[string]string{"tab": "settings-tab"},
			Response: "Đã chuyển sang tab Cài đặt.",
		}
	}
	// Push: mở đẩy bài, chuyển đẩy bài, open push, go to push, tab đẩy bài
	pushTabRegex := regexp.MustCompile(`(?i)(?:mở|chuyển|go to|open|tab)\s+(?:đẩy bài|đẩy code|push)`)
	if pushTabRegex.MatchString(t) || t == "push" || t == "đẩy bài" {
		return &VoiceResult{
			Action:   "navigate",
			Params:   map[string]string{"tab": "push-tab"},
			Response: "Đã chuyển sang tab Đẩy bài tập.",
		}
	}
	// Clone: mở sao chép, chuyển sao chép, open clone, go to clone, tab clone
	cloneRegex := regexp.MustCompile(`(?i)(?:mở|chuyển|go to|open|tab)\s+(?:sao chép|clone)`)
	if cloneRegex.MatchString(t) || t == "clone" || t == "sao chép" {
		return &VoiceResult{
			Action:   "navigate",
			Params:   map[string]string{"tab": "clone-tab"},
			Response: "Đã chuyển sang tab Sao chép Repo.",
		}
	}
	// Search: mở tìm kiếm, chuyển tìm kiếm, open search, go to search, tab tìm kiếm
	searchTabRegex := regexp.MustCompile(`(?i)(?:mở|chuyển|go to|open|tab)\s+(?:tìm kiếm|search)`)
	if searchTabRegex.MatchString(t) || t == "search" || t == "tìm kiếm" {
		return &VoiceResult{
			Action:   "navigate",
			Params:   map[string]string{"tab": "search-tab"},
			Response: "Đã chuyển sang tab Tìm kiếm.",
		}
	}
	// Report: mở báo cáo, chuyển báo cáo, open report, go to report, tab báo cáo
	reportRegex := regexp.MustCompile(`(?i)(?:mở|chuyển|go to|open|tab)\s+(?:báo cáo|report)`)
	if reportRegex.MatchString(t) || t == "report" || t == "báo cáo" {
		return &VoiceResult{
			Action:   "navigate",
			Params:   map[string]string{"tab": "report-tab"},
			Response: "Đã chuyển sang tab Báo cáo GitHub.",
		}
	}
	// Guide: mở hướng dẫn, chuyển hướng dẫn, open guide, go to guide, tab hướng dẫn
	guideRegex := regexp.MustCompile(`(?i)(?:mở|chuyển|go to|open|tab)\s+(?:hướng dẫn|guide|cách hoạt động)`)
	if guideRegex.MatchString(t) || t == "guide" || t == "hướng dẫn" {
		return &VoiceResult{
			Action:   "navigate",
			Params:   map[string]string{"tab": "guide-tab"},
			Response: "Đã chuyển sang tab Hướng dẫn.",
		}
	}

	// 3. Search action: tìm kiếm repo abc, tìm repo xyz, search abc
	searchRegex := regexp.MustCompile(`(?i)(?:tìm kiếm|tìm|search)(?:\s+repo|\s+repository)?\s+(.+)`)
	if matches := searchRegex.FindStringSubmatch(t); len(matches) > 1 {
		q := strings.TrimSpace(matches[1])
		return &VoiceResult{
			Action:   "search",
			Params:   map[string]string{"query": q},
			Response: fmt.Sprintf("Đang tìm kiếm repository '%s'...", q),
		}
	}

	// 4. Clone action: sao chép repo abc, clone repo xyz
	cloneActionRegex := regexp.MustCompile(`(?i)(?:sao chép|clone)(?:\s+repo|\s+repository)?\s+(.+)`)
	if matches := cloneActionRegex.FindStringSubmatch(t); len(matches) > 1 {
		r := strings.TrimSpace(matches[1])
		return &VoiceResult{
			Action:   "clone",
			Params:   map[string]string{"repo": r},
			Response: fmt.Sprintf("Đang chuyển sang tab clone cho repository '%s'.", r),
		}
	}

	// 5. Push action
	// Pattern 1: push session 15 ex 01 / đẩy bài buổi 15 bài 1
	// Matches: session/buổi/buoi/s/b [num] and ex/bài/bai/e/ex/exercise [num]
	pushP1 := regexp.MustCompile(`(?i)(?:push|đẩy|gửi)(?:\s+bài(?:\s+tập)?)?\s+(?:buổi|session|buoi|s|b)\s+(\d+)\s+(?:bài|ex|exercise|bai|e)\s+(\d+)`)
	if matches := pushP1.FindStringSubmatch(t); len(matches) > 2 {
		return &VoiceResult{
			Action: "push",
			Params: map[string]string{
				"session": matches[1],
				"ex":      matches[2],
			},
			Response: fmt.Sprintf("Đã tìm thấy lệnh đẩy bài: Session %s, Exercise %s.", matches[1], matches[2]),
		}
	}

	// Pattern 2: push ex 01 session 15 / đẩy bài 1 buổi 15
	pushP2 := regexp.MustCompile(`(?i)(?:push|đẩy|gửi)(?:\s+bài(?:\s+tập)?)?\s+(?:bài|ex|exercise|bai|e)\s+(\d+)\s+(?:buổi|session|buoi|s|b)\s+(\d+)`)
	if matches := pushP2.FindStringSubmatch(t); len(matches) > 2 {
		return &VoiceResult{
			Action: "push",
			Params: map[string]string{
				"session": matches[2],
				"ex":      matches[1],
			},
			Response: fmt.Sprintf("Đã tìm thấy lệnh đẩy bài: Session %s, Exercise %s.", matches[2], matches[1]),
		}
	}

	// Pattern 3: push buổi 15 / push session 15
	pushP3 := regexp.MustCompile(`(?i)(?:push|đẩy|gửi)(?:\s+bài(?:\s+tập)?)?\s+(?:buổi|session|buoi|s|b)\s+(\d+)`)
	if matches := pushP3.FindStringSubmatch(t); len(matches) > 1 {
		return &VoiceResult{
			Action: "push",
			Params: map[string]string{
				"session": matches[1],
				"ex":      "1", // Default to exercise 1
			},
			Response: fmt.Sprintf("Nhận diện lệnh đẩy bài Session %s. Mặc định Bài tập 1.", matches[1]),
		}
	}

	return nil
}

// ProcessVoiceCommand parses voice command transcript to action and parameters
func (a *App) ProcessVoiceCommand(transcript string) (*VoiceResult, error) {
	// 1. Try local rules first
	if result := parseVoiceCommandRules(transcript); result != nil {
		return result, nil
	}

	// 2. Try using LLM if local rules failed and API key is set
	cfg, err := config.LoadConfig()
	if err == nil && cfg.AiApiKey != "" {
		systemPrompt := `Bạn là trợ lý phân tích lệnh giọng nói tiếng Việt/Anh sang cấu trúc JSON cho app G-GitUpload.
Hãy dịch transcript của người dùng sang cấu trúc JSON sau:
{
  "action": "push" | "clone" | "search" | "navigate" | "help" | "unknown",
  "params": {
    "session": "số buổi" (chỉ điền khi action là push),
    "ex": "số bài tập" (chỉ điền khi action là push),
    "repo": "tên/link repo" (chỉ điền khi action là clone),
    "query": "từ khóa" (chỉ điền khi action là search),
    "tab": "push-tab" | "clone-tab" | "search-tab" | "settings-tab" | "report-tab" | "guide-tab" (chỉ điền khi action là navigate)
  },
  "response": "phản hồi thân thiện bằng tiếng Việt xác nhận hành động"
}

Một số ví dụ:
- "đi đến phần cài đặt" -> action: "navigate", params: {"tab": "settings-tab"}
- "clone github.com/user/repo" -> action: "clone", params: {"repo": "github.com/user/repo"}
- "đẩy bài buổi mười sáu bài hai" -> action: "push", params: {"session": "16", "ex": "2"}
- "tìm kiếm project java" -> action: "search", params: {"query": "project java"}

Hãy phản hồi DUY NHẤT một chuỗi JSON hợp lệ, không bọc trong markdown block, không thêm text khác.`

		messages := []ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: transcript},
		}

		respMsg, err := a.SendChatMessage(messages)
		if err == nil && respMsg != nil {
			// Strip reasoning tokens if added by SendChatMessage
			cleanContent := respMsg.Content
			if idx := strings.Index(cleanContent, "<reasoning_tokens>"); idx != -1 {
				cleanContent = cleanContent[:idx]
			}
			cleanContent = strings.TrimSpace(cleanContent)
			// Strip markdown backticks if returned
			cleanContent = strings.TrimPrefix(cleanContent, "```json")
			cleanContent = strings.TrimPrefix(cleanContent, "```")
			cleanContent = strings.TrimSuffix(cleanContent, "```")
			cleanContent = strings.TrimSpace(cleanContent)

			var aiResult VoiceResult
			if json.Unmarshal([]byte(cleanContent), &aiResult) == nil {
				if aiResult.Action != "" {
					return &aiResult, nil
				}
			}
		}
	}

	// 3. Fallback if both rules and AI fail
	return &VoiceResult{
		Action:   "unknown",
		Params:   make(map[string]string),
		Response: "Không rõ lệnh. Bạn có thể nói: 'mở cài đặt', 'đẩy bài buổi 15 bài 1', 'tìm kiếm [tên]'...",
	}, nil
}

// FindMatchingDirectory scans directories recursively near the last pushed directory to find a matching session/ex
func (a *App) FindMatchingDirectory(sessionNum, exNum int) (string, error) {
	repo, err := history.GetLastPushed()
	var baseDirs []string

	if err == nil && repo != nil && repo.LocalPath != "" {
		cleanP := filepath.Clean(repo.LocalPath)
		// Try parent and grandparent of the last pushed path
		parent := filepath.Dir(cleanP)
		if parent != "" && parent != "." {
			baseDirs = append(baseDirs, parent)
			grandparent := filepath.Dir(parent)
			if grandparent != "" && grandparent != "." {
				baseDirs = append(baseDirs, grandparent)
			}
		}
	}

	// Fallback/additional search locations
	userHome, err := os.UserHomeDir()
	if err == nil {
		baseDirs = append(baseDirs, filepath.Join(userHome, "Desktop"))
		baseDirs = append(baseDirs, filepath.Join(userHome, "Documents"))
	}

	// Scan each base directory
	for _, baseDir := range baseDirs {
		// Verify directory exists
		info, err := os.Stat(baseDir)
		if err != nil || !info.IsDir() {
			continue
		}

		// Look for session folder
		sessionPath, found := findSessionFolder(baseDir, sessionNum)
		if found {
			// Look for exercise folder inside session folder
			exPath, foundEx := findExFolder(sessionPath, exNum)
			if foundEx {
				return filepath.ToSlash(exPath), nil
			}
		}
	}

	return "", errors.New("không tìm thấy thư mục phù hợp")
}

func findSessionFolder(baseDir string, sessionNum int) (string, bool) {
	files, err := os.ReadDir(baseDir)
	if err != nil {
		return "", false
	}

	// Normalize target string patterns
	numStr := strconv.Itoa(sessionNum)
	padNumStr := fmt.Sprintf("%02d", sessionNum)

	// Check direct children of baseDir (usually session folders are direct children)
	for _, f := range files {
		if !f.IsDir() {
			continue
		}
		name := strings.ToLower(f.Name())
		// Match patterns like "session15", "session 15", "buoi 15", "buoi15", "s15", "session-15"
		if strings.Contains(name, "session"+numStr) || strings.Contains(name, "session "+numStr) ||
			strings.Contains(name, "session-"+numStr) || strings.Contains(name, "session"+padNumStr) ||
			strings.Contains(name, "session "+padNumStr) || strings.Contains(name, "session-"+padNumStr) ||
			strings.Contains(name, "buoi"+numStr) || strings.Contains(name, "buoi "+numStr) ||
			strings.Contains(name, "buoi-"+numStr) || strings.Contains(name, "buoi"+padNumStr) ||
			strings.Contains(name, "buoi "+padNumStr) || strings.Contains(name, "buoi-"+padNumStr) ||
			strings.Contains(name, "buổi "+numStr) || strings.Contains(name, "buổi "+padNumStr) ||
			name == numStr || name == padNumStr {
			return filepath.Join(baseDir, f.Name()), true
		}
	}

	// Search 1 level deeper if not found
	for _, f := range files {
		if !f.IsDir() {
			continue
		}
		subDir := filepath.Join(baseDir, f.Name())
		subFiles, err := os.ReadDir(subDir)
		if err != nil {
			continue
		}
		for _, sf := range subFiles {
			if !sf.IsDir() {
				continue
			}
			name := strings.ToLower(sf.Name())
			if strings.Contains(name, "session"+numStr) || strings.Contains(name, "session "+numStr) ||
				strings.Contains(name, "session-"+numStr) || strings.Contains(name, "session"+padNumStr) ||
				strings.Contains(name, "session "+padNumStr) || strings.Contains(name, "session-"+padNumStr) ||
				strings.Contains(name, "buoi"+numStr) || strings.Contains(name, "buoi "+numStr) ||
				strings.Contains(name, "buoi-"+numStr) || strings.Contains(name, "buoi"+padNumStr) ||
				strings.Contains(name, "buoi "+padNumStr) || strings.Contains(name, "buoi-"+padNumStr) ||
				strings.Contains(name, "buổi "+numStr) || strings.Contains(name, "buổi "+padNumStr) {
				return filepath.Join(subDir, sf.Name()), true
			}
		}
	}

	return "", false
}

func findExFolder(sessionDir string, exNum int) (string, bool) {
	files, err := os.ReadDir(sessionDir)
	if err != nil {
		return "", false
	}

	numStr := strconv.Itoa(exNum)
	padNumStr := fmt.Sprintf("%02d", exNum)

	for _, f := range files {
		if !f.IsDir() {
			continue
		}
		name := strings.ToLower(f.Name())
		// Match patterns like "ex01", "ex 01", "exercise 01", "bai 1", "bai01", "bài 1", "ex1"
		if strings.Contains(name, "ex"+numStr) || strings.Contains(name, "ex "+numStr) ||
			strings.Contains(name, "ex-"+numStr) || strings.Contains(name, "ex"+padNumStr) ||
			strings.Contains(name, "ex "+padNumStr) || strings.Contains(name, "ex-"+padNumStr) ||
			strings.Contains(name, "exercise"+numStr) || strings.Contains(name, "exercise "+numStr) ||
			strings.Contains(name, "exercise-"+numStr) || strings.Contains(name, "exercise"+padNumStr) ||
			strings.Contains(name, "exercise "+padNumStr) || strings.Contains(name, "exercise-"+padNumStr) ||
			strings.Contains(name, "bai"+numStr) || strings.Contains(name, "bai "+numStr) ||
			strings.Contains(name, "bai-"+numStr) || strings.Contains(name, "bai"+padNumStr) ||
			strings.Contains(name, "bai "+padNumStr) || strings.Contains(name, "bai-"+padNumStr) ||
			strings.Contains(name, "bài"+numStr) || strings.Contains(name, "bài "+numStr) ||
			strings.Contains(name, "bài-"+numStr) || strings.Contains(name, "bài"+padNumStr) ||
			strings.Contains(name, "bài "+padNumStr) || strings.Contains(name, "bài-"+padNumStr) ||
			name == numStr || name == padNumStr {
			return filepath.Join(sessionDir, f.Name()), true
		}
	}

	return "", false
}
