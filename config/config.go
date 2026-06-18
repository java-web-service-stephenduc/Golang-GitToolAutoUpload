package config

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type AppConfig struct {
	GithubToken    string `json:"github_token"`
	GithubUsername string `json:"github_username"`
	GithubOrgName  string `json:"github_org_name"`
	NamingPattern  string `json:"naming_pattern"`
	DeleteKey      string `json:"delete_key"`
	ThemeMode      string `json:"theme_mode"`
}

func (c *AppConfig) HasOrganization() bool {
	return strings.TrimSpace(c.GithubOrgName) != ""
}

func GetConfigPath() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		appData = os.Getenv("USERPROFILE") // Fallback
	}
	dir := filepath.Join(appData, "GGitUpload")
	os.MkdirAll(dir, os.ModePerm)
	return filepath.Join(dir, "config.json")
}

func LoadConfig() (*AppConfig, error) {
	path := GetConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		// Thử đọc file .env dự phòng cùng thư mục app
		return loadFromEnv()
	}
	var cfg AppConfig
	err = json.Unmarshal(data, &cfg)
	if err != nil {
		return loadFromEnv()
	}
	// Cung cấp giá trị mặc định nếu thiếu
	if cfg.NamingPattern == "" {
		cfg.NamingPattern = "session%s-ex%s-homework"
	}
	if cfg.ThemeMode == "" {
		cfg.ThemeMode = "dark"
	}
	return &cfg, nil
}

func SaveConfig(cfg *AppConfig) error {
	path := GetConfigPath()
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func loadFromEnv() (*AppConfig, error) {
	cfg := &AppConfig{
		NamingPattern: "session%s-ex%s-homework",
		ThemeMode:     "dark",
	}

	// Đọc từ file .env ở thư mục hiện tại hoặc cùng thư mục executable
	envPaths := []string{".env"}
	execPath, err := os.Executable()
	if err == nil {
		envPaths = append(envPaths, filepath.Join(filepath.Dir(execPath), ".env"))
	}

	var file *os.File
	for _, p := range envPaths {
		f, err := os.Open(p)
		if err == nil {
			file = f
			defer f.Close()
			break
		}
	}

	if file == nil {
		return cfg, nil
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// Loại bỏ dấu nháy bọc quanh giá trị nếu có
		if len(val) >= 2 && ((strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) || 
			(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'"))) {
			val = val[1 : len(val)-1]
		}

		switch key {
		case "GITHUB_TOKEN":
			cfg.GithubToken = val
		case "GITHUB_USERNAME":
			cfg.GithubUsername = val
		case "GITHUB_ORG_NAME":
			cfg.GithubOrgName = val
		case "NAMING_PATTERN":
			cfg.NamingPattern = val
		case "DELETE_REPOSITORY_KEY":
			cfg.DeleteKey = val
		}
	}

	return cfg, nil
}
