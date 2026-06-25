package main

import (
	"errors"

	"g-gitupload/config"
	"g-gitupload/github"
)

// SearchReposResponse holds search results with pagination info
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

// GetRepoFile retrieves a file's info and base64 content
func (a *App) GetRepoFile(repoName, path string) (*github.FileContentInfo, error) {
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

	return github.GetRepoFile(owner, repoName, path, cfg.GithubToken)
}

// UpdateRepoFile commits changes to a file
func (a *App) UpdateRepoFile(repoName, path, contentBase64, sha, commitMsg string) error {
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

	return github.UpdateRepoFile(owner, repoName, path, contentBase64, sha, commitMsg, cfg.GithubToken)
}

// GetRepoLanguages returns all languages used in the repository
func (a *App) GetRepoLanguages(repoName string) (map[string]int, error) {
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

	return github.GetRepoLanguages(owner, repoName, cfg.GithubToken)
}

