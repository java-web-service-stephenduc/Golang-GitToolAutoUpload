package github

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Shared HTTP client to reuse connections and avoid socket churn
var httpClient = &http.Client{
	Timeout: 15 * time.Second,
}

type RepositoryInfo struct {
	Name    string `json:"name"`
	HtmlUrl string `json:"html_url"`
	Size    int    `json:"size"`
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

// CreatePublicRepository tạo một repository public mới.
// Nếu repo đã tồn tại, nó sẽ kiểm tra xem repo có trống (empty) không để tái sử dụng.
func CreatePublicRepository(token, owner, repoName string, isOrg bool) (*RepositoryResponse, error) {
	var url string
	if isOrg {
		url = fmt.Sprintf("https://api.github.com/orgs/%s/repos", owner)
	} else {
		url = "https://api.github.com/user/repos"
	}

	payload := createRepoPayload{
		Name:    repoName,
		Private: false,
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
	AvatarUrl   string `json:"avatar_url"`
	Name        string `json:"name"`
	Bio         string `json:"bio"`
	Followers   int    `json:"followers"`
	PublicRepos int    `json:"public_repos"`
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
