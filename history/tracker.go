package history

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type PushedRepo struct {
	RepoName  string `json:"repo_name"`
	RepoUrl   string `json:"repo_url"`
	PushedAt  string `json:"pushed_at"`
	LocalPath string `json:"local_path"`
}

type History struct {
	LastPushed *PushedRepo `json:"last_pushed"`
}

func GetHistoryPath() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		appData = os.Getenv("USERPROFILE") // Fallback
	}
	dir := filepath.Join(appData, "GGitUpload")
	os.MkdirAll(dir, os.ModePerm)
	return filepath.Join(dir, "history.json")
}

func GetLastPushed() (*PushedRepo, error) {
	path := GetHistoryPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // Không có lịch sử
		}
		return nil, err
	}

	var hist History
	err = json.Unmarshal(data, &hist)
	if err != nil {
		return nil, err
	}

	return hist.LastPushed, nil
}

func SaveLastPushed(repo *PushedRepo) error {
	path := GetHistoryPath()
	hist := History{
		LastPushed: repo,
	}

	data, err := json.MarshalIndent(hist, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}
