package github

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Shared HTTP client to reuse connections and avoid socket churn
var httpClient = &http.Client{
	Timeout: 15 * time.Second,
}

type RepositoryInfo struct {
	Name            string `json:"name"`
	HtmlUrl         string `json:"html_url"`
	Size            int    `json:"size"`
	Description     string `json:"description"`
	StargazersCount int    `json:"stargazers_count"`
	ForksCount      int    `json:"forks_count"`
	WatchersCount   int    `json:"watchers_count"`
	Private         bool   `json:"private"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
	PushedAt        string `json:"pushed_at"`
	DefaultBranch   string `json:"default_branch"`
}

func (r *RepositoryInfo) IsEmpty() bool {
	return r.Size == 0
}

type RepositoryResponse struct {
	Name    string `json:"name"`
	HtmlUrl string `json:"html_url"`
}

type createRepoPayload struct {
	Name    string `json:"name"`
	Private bool   `json:"private"`
}

type githubErrorResponse struct {
	Message string `json:"message"`
}

// GetRepository lấy thông tin chi tiết một repository
func GetRepository(owner, repoName, token string) (*RepositoryInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repoName)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var repo RepositoryInfo
		if err := json.NewDecoder(resp.Body).Decode(&repo); err != nil {
			return nil, err
		}
		return &repo, nil
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("GitHub token không hợp lệ hoặc thiếu quyền đọc repository")
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Repo không tồn tại
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	return nil, fmt.Errorf("đọc repository thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
}

// CreateRepository tạo một repository mới (hỗ trợ tùy chọn Private/Public).
// Nếu repo đã tồn tại, nó sẽ kiểm tra xem repo có trống (empty) không để tái sử dụng.
func CreateRepository(token, owner, repoName string, isOrg bool, private bool) (*RepositoryResponse, error) {
	var url string
	if isOrg {
		url = fmt.Sprintf("https://api.github.com/orgs/%s/repos", owner)
	} else {
		url = "https://api.github.com/user/repos"
	}

	payload := createRepoPayload{
		Name:    repoName,
		Private: private,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusCreated {
		var result RepositoryResponse
		if err := json.Unmarshal(bodyBytes, &result); err != nil {
			return nil, err
		}
		return &result, nil
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("Token GitHub không hợp lệ hoặc thiếu quyền tạo repository")
	}

	if resp.StatusCode == http.StatusUnprocessableEntity { // 422: Already exists
		errMsg := extractErrorMessage(bodyBytes)
		if strings.Contains(strings.ToLower(errMsg), "already exists") {
			// Repo đã tồn tại, kiểm tra xem có trống không
			repoInfo, err := GetRepository(owner, repoName, token)
			if err != nil {
				return nil, err
			}
			if repoInfo != nil {
				if repoInfo.IsEmpty() {
					return &RepositoryResponse{
						Name:    repoInfo.Name,
						HtmlUrl: repoInfo.HtmlUrl,
					}, nil
				}
				return nil, fmt.Errorf("Repository đã tồn tại và đã có dữ liệu")
			}
		}
		return nil, fmt.Errorf("tạo repository thất bại: %s", errMsg)
	}

	return nil, fmt.Errorf("tạo repository thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
}

// ListRepositories lấy danh sách các repository của owner (cá nhân hoặc tổ chức)
func ListRepositories(token, owner string, isOrg bool, page int) ([]RepositoryInfo, error) {
	var url string
	if isOrg {
		url = fmt.Sprintf("https://api.github.com/orgs/%s/repos?per_page=100&sort=updated&page=%d", owner, page)
	} else {
		url = fmt.Sprintf("https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner&page=%d", page)
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusOK {
		var repos []RepositoryInfo
		if err := json.Unmarshal(bodyBytes, &repos); err != nil {
			return nil, err
		}
		return repos, nil
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("GitHub token không hợp lệ hoặc thiếu quyền")
	}

	return nil, fmt.Errorf("lấy danh sách repository thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
}

// DeleteRepository xóa một repository trên GitHub
func DeleteRepository(owner, repoName, token string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repoName)
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil
	}

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("GitHub token sai hoặc thiếu quyền xóa repository")
	}

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("Repository không tồn tại hoặc không thuộc tài khoản hiện tại")
	}

	return fmt.Errorf("xóa repository thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
}

func extractErrorMessage(body []byte) string {
	var errResp githubErrorResponse
	if err := json.Unmarshal(body, &errResp); err == nil && errResp.Message != "" {
		return errResp.Message
	}
	if len(body) == 0 {
		return "Không có chi tiết lỗi từ GitHub API"
	}
	return string(body)
}

type GitHubProfile struct {
	AvatarUrl    string `json:"avatar_url"`
	Name         string `json:"name"`
	Bio          string `json:"bio"`
	Followers    int    `json:"followers"`
	PublicRepos  int    `json:"public_repos"`
	PrivateRepos int    `json:"total_private_repos"`
}

// GetGitHubProfile lấy thông tin cá nhân của chủ tài khoản token
func GetGitHubProfile(token string) (*GitHubProfile, error) {
	url := "https://api.github.com/user"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusOK {
		var profile GitHubProfile
		if err := json.Unmarshal(bodyBytes, &profile); err != nil {
			return nil, err
		}
		return &profile, nil
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("GitHub token không hợp lệ")
	}

	return nil, fmt.Errorf("đọc hồ sơ cá nhân thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
}

// ContentInfo đại diện cho tệp tin/thư mục trong repository
type ContentInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"` // "file" hoặc "dir"
	Size        int64  `json:"size"`
	DownloadUrl string `json:"download_url"`
}

// GetRepoContents lấy danh sách file/thư mục tại đường dẫn chỉ định
func GetRepoContents(owner, repoName, path, token string) ([]ContentInfo, error) {
	path = strings.Trim(path, "/")
	var url string
	if path == "" {
		url = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents", owner, repoName)
	} else {
		url = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", owner, repoName, path)
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Repo trống hoặc không tồn tại path
	}

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("đọc thư mục thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	if len(bodyBytes) > 0 && bodyBytes[0] == '{' {
		var single ContentInfo
		if err := json.Unmarshal(bodyBytes, &single); err != nil {
			return nil, err
		}
		return []ContentInfo{single}, nil
	}

	var contents []ContentInfo
	if err := json.Unmarshal(bodyBytes, &contents); err != nil {
		return nil, err
	}

	return contents, nil
}

// GetRepoReadme lấy file README.md đã render sẵn HTML từ GitHub
func GetRepoReadme(owner, repoName, token string) (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/readme", owner, repoName)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.html")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", nil // Không có file README.md
	}

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("đọc README thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	return string(bodyBytes), nil
}

// GetRepoLanguageStats lấy ngôn ngữ có tỷ lệ bytes cao nhất
func GetRepoLanguageStats(owner, repoName, token string) (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/languages", owner, repoName)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "N/A", nil
	}

	var languages map[string]int
	if err := json.NewDecoder(resp.Body).Decode(&languages); err != nil {
		return "N/A", nil
	}

	if len(languages) == 0 {
		return "N/A", nil
	}

	total := 0
	maxVal := -1
	maxLang := ""
	for lang, val := range languages {
		total += val
		if val > maxVal {
			maxVal = val
			maxLang = lang
		}
	}

	if total == 0 {
		return "N/A", nil
	}

	pct := (float64(maxVal) / float64(total)) * 100
	return fmt.Sprintf("%s (%.1f%%)", maxLang, pct), nil
}

// TokenReport đại diện thông tin chuẩn đoán Token & tài khoản GitHub
type TokenReport struct {
	Scopes          []string `json:"scopes"`
	RateLimit       int      `json:"rate_limit"`
	RateRemaining   int      `json:"rate_remaining"`
	RateReset       string   `json:"rate_reset"`
	PublicRepos     int      `json:"public_repos"`
	PrivateRepos    int      `json:"private_repos"`
	DiskUsage       int      `json:"disk_usage"`
	PlanName        string   `json:"plan_name"`
	TwoFactor       bool     `json:"two_factor_authentication"`
	HasRepoScope    bool     `json:"has_repo_scope"`
	HasDeleteScope  bool     `json:"has_delete_scope"`
	HasOrgScope     bool     `json:"has_org_scope"`
	Username        string   `json:"username"`
	AvatarUrl       string   `json:"avatar_url"`
	Email           string   `json:"email"`
}

// GetTokenReport lấy thông tin chẩn đoán API token GitHub
func GetTokenReport(token string) (*TokenReport, error) {
	url := "https://api.github.com/user"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("đọc báo cáo thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	scopesHeader := resp.Header.Get("X-OAuth-Scopes")
	var scopes []string
	if scopesHeader != "" {
		parts := strings.Split(scopesHeader, ",")
		for _, p := range parts {
			scopes = append(scopes, strings.TrimSpace(p))
		}
	}

	rateLimitHeader := resp.Header.Get("X-RateLimit-Limit")
	rateRemainingHeader := resp.Header.Get("X-RateLimit-Remaining")
	rateResetHeader := resp.Header.Get("X-RateLimit-Reset")

	limit, _ := strconv.Atoi(rateLimitHeader)
	remaining, _ := strconv.Atoi(rateRemainingHeader)
	resetSec, _ := strconv.ParseInt(rateResetHeader, 10, 64)
	resetTimeStr := ""
	if resetSec > 0 {
		resetTimeStr = time.Unix(resetSec, 0).Format("15:04:05")
	}

	var raw struct {
		Login        string `json:"login"`
		AvatarUrl    string `json:"avatar_url"`
		Email        string `json:"email"`
		PublicRepos  int    `json:"public_repos"`
		PrivateRepos int    `json:"total_private_repos"`
		DiskUsage    int    `json:"disk_usage"`
		TwoFactor    bool   `json:"two_factor_authentication"`
		Plan         struct {
			Name string `json:"name"`
		} `json:"plan"`
	}

	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		return nil, err
	}

	hasRepo := false
	hasDelete := false
	hasOrg := false
	for _, s := range scopes {
		if s == "repo" {
			hasRepo = true
		}
		if s == "delete_repo" {
			hasDelete = true
		}
		if s == "admin:org" || s == "write:org" || s == "read:org" {
			hasOrg = true
		}
	}

	report := &TokenReport{
		Scopes:          scopes,
		RateLimit:       limit,
		RateRemaining:   remaining,
		RateReset:       resetTimeStr,
		PublicRepos:     raw.PublicRepos,
		PrivateRepos:    raw.PrivateRepos,
		DiskUsage:       raw.DiskUsage,
		PlanName:        raw.Plan.Name,
		TwoFactor:       raw.TwoFactor,
		HasRepoScope:    hasRepo,
		HasDeleteScope:  hasDelete,
		HasOrgScope:     hasOrg,
		Username:        raw.Login,
		AvatarUrl:       raw.AvatarUrl,
		Email:           raw.Email,
	}

	return report, nil
}

// SortRepositories sắp xếp danh sách các repo theo các tiêu chí: "empty", "new", hoặc mặc định.
func SortRepositories(repos []RepositoryInfo, sortBy string) {
	switch sortBy {
	case "empty":
		// EMPTY repos first (DefaultBranch == "")
		sort.SliceStable(repos, func(i, j int) bool {
			iEmpty := repos[i].DefaultBranch == ""
			jEmpty := repos[j].DefaultBranch == ""
			if iEmpty && !jEmpty {
				return true
			}
			if !iEmpty && jEmpty {
				return false
			}
			// Fallback: order by PushedAt descending
			return repos[i].PushedAt > repos[j].PushedAt
		})
	case "new":
		// NEW repos first (pushed_at descending)
		sort.SliceStable(repos, func(i, j int) bool {
			return repos[i].PushedAt > repos[j].PushedAt
		})
	default:
		// Mặc định: giữ nguyên sắp xếp của GitHub
	}
}

// SearchRepositories thực hiện tìm kiếm / danh sách repository phân trang động.
func SearchRepositories(token, owner, query string, isOrg bool, page, pageSize int) ([]RepositoryInfo, int, error) {
	var url string
	var isSearchAPI = false
	trimmedQuery := strings.TrimSpace(query)

	if trimmedQuery != "" {
		isSearchAPI = true
		scopeSpec := "user"
		if isOrg {
			scopeSpec = "org"
		}
		url = fmt.Sprintf("https://api.github.com/search/repositories?q=%s+%s:%s&per_page=%d&page=%d&sort=updated",
			strings.ReplaceAll(trimmedQuery, " ", "+"), scopeSpec, owner, pageSize, page)
	} else {
		if isOrg {
			url = fmt.Sprintf("https://api.github.com/orgs/%s/repos?per_page=%d&sort=updated&page=%d", owner, pageSize, page)
		} else {
			url = fmt.Sprintf("https://api.github.com/user/repos?per_page=%d&sort=updated&affiliation=owner&page=%d", pageSize, page)
		}
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("tìm kiếm repository thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	if isSearchAPI {
		var searchResult struct {
			TotalCount int              `json:"total_count"`
			Items      []RepositoryInfo `json:"items"`
		}
		if err := json.Unmarshal(bodyBytes, &searchResult); err != nil {
			return nil, 0, err
		}
		return searchResult.Items, searchResult.TotalCount, nil
	} else {
		var repos []RepositoryInfo
		if err := json.Unmarshal(bodyBytes, &repos); err != nil {
			return nil, 0, err
		}

		totalCount := len(repos)
		if isOrg {
			orgUrl := fmt.Sprintf("https://api.github.com/orgs/%s", owner)
			reqOrg, err := http.NewRequest("GET", orgUrl, nil)
			if err == nil {
				reqOrg.Header.Set("Authorization", "Bearer "+token)
				reqOrg.Header.Set("Accept", "application/vnd.github+json")
				respOrg, err := httpClient.Do(reqOrg)
				if err == nil {
					defer respOrg.Body.Close()
					var orgData struct {
						PublicRepos  int `json:"public_repos"`
						PrivateRepos int `json:"total_private_repos"`
					}
					if json.NewDecoder(respOrg.Body).Decode(&orgData) == nil {
						totalCount = orgData.PublicRepos + orgData.PrivateRepos
					}
				}
			}
		} else {
			profile, err := GetGitHubProfile(token)
			if err == nil && profile != nil {
				totalCount = profile.PublicRepos + profile.PrivateRepos
			}
		}

		return repos, totalCount, nil
	}
}

// FileContentInfo đại diện cho tệp tin chi tiết với nội dung mã hóa Base64
type FileContentInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	SHA      string `json:"sha"`
	Size     int64  `json:"size"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

// GetRepoFile lấy nội dung tệp tin chi tiết dưới dạng Base64 và thông tin SHA từ GitHub
func GetRepoFile(owner, repoName, path, token string) (*FileContentInfo, error) {
	path = strings.Trim(path, "/")
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", owner, repoName, path)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("lấy nội dung file thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	var fileInfo FileContentInfo
	if err := json.Unmarshal(bodyBytes, &fileInfo); err != nil {
		return nil, err
	}

	return &fileInfo, nil
}

// updateFilePayload đại diện cho payload tải lên cập nhật file GitHub
type updateFilePayload struct {
	Message string `json:"message"`
	Content string `json:"content"` // Base64 encoded
	SHA     string `json:"sha"`
}

// UpdateRepoFile thực hiện commit ghi đè nội dung file lên GitHub
func UpdateRepoFile(owner, repoName, path, contentBase64, sha, commitMsg, token string) error {
	path = strings.Trim(path, "/")
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", owner, repoName, path)

	payload := updateFilePayload{
		Message: commitMsg,
		Content: contentBase64,
		SHA:     sha,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("cập nhật file thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	return nil
}

// GetRepoLanguages lấy danh sách tất cả ngôn ngữ và dung lượng bytes sử dụng
func GetRepoLanguages(owner, repoName, token string) (map[string]int, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/languages", owner, repoName)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến GitHub API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("lấy danh sách ngôn ngữ thất bại: %s (Status: %d)", extractErrorMessage(bodyBytes), resp.StatusCode)
	}

	var languages map[string]int
	if err := json.NewDecoder(resp.Body).Decode(&languages); err != nil {
		return nil, err
	}

	return languages, nil
}

