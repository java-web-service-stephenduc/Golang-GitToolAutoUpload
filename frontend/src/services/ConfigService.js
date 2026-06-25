// Config service
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

let themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = 'dark';

export { currentTheme };

export async function loadSettings() {
  try {
    const cfg = await GetSettings();
    if (cfg) {
      document.getElementById('setting-token').value = cfg.github_token || '';
      document.getElementById('setting-username').value = cfg.github_username || '';
      document.getElementById('setting-org').value = cfg.github_org_name || '';
      document.getElementById('setting-pattern').value = cfg.naming_pattern || 'session%s-ex%s-homework';
      document.getElementById('setting-delete-key').value = cfg.delete_key || '';
      document.getElementById('setting-theme').value = cfg.theme_mode || 'dark';
      document.getElementById('setting-commit-name').value = cfg.git_commit_name || '';
      document.getElementById('setting-commit-email').value = cfg.git_commit_email || '';
      document.getElementById('setting-repo-private').value = cfg.repo_private ? 'true' : 'false';
      document.getElementById('setting-auto-push').checked = cfg.auto_push || false;
      document.getElementById('setting-default-commit-msg').value = cfg.default_commit_msg || 'init';
      document.getElementById('setting-ai-key').value = cfg.ai_api_key || '';
      document.getElementById('setting-ai-model').value = cfg.ai_model || '';

      window.__cachedDeleteKey = cfg.delete_key || '';

      applyThemeSetting(cfg.theme_mode || 'dark');
      checkConnectionStatus(cfg);
      const { loadGitHubProfile } = await import('../components/ProfileCard.js');
      loadGitHubProfile();
      return cfg;
    }
  } catch (err) {
    console.error('Lỗi tải cài đặt:', err);
  }
  return null;
}

export async function saveSettings() {
  const token = document.getElementById('setting-token').value.trim();
  const username = document.getElementById('setting-username').value.trim();
  const org = document.getElementById('setting-org').value.trim();
  const pattern = document.getElementById('setting-pattern').value.trim();
  const deleteKey = document.getElementById('setting-delete-key').value.trim();
  const theme = document.getElementById('setting-theme').value;
  const commitName = document.getElementById('setting-commit-name').value.trim();
  const commitEmail = document.getElementById('setting-commit-email').value.trim();
  const repoPrivate = document.getElementById('setting-repo-private').value === 'true';
  const autoPush = document.getElementById('setting-auto-push').checked;
  const defaultCommitMsg = document.getElementById('setting-default-commit-msg').value.trim();
  const aiKey = document.getElementById('setting-ai-key').value.trim();
  const aiModel = document.getElementById('setting-ai-model').value.trim();

  if (!token || !username) {
    showSettingsMessage('Token và Username không được để trống.', false);
    return;
  }

  try {
    await SaveSettings({
      github_token: token,
      github_username: username,
      github_org_name: org,
      naming_pattern: pattern || 'session%s-ex%s-homework',
      delete_key: deleteKey,
      theme_mode: theme,
      git_commit_name: commitName,
      git_commit_email: commitEmail,
      repo_private: repoPrivate,
      auto_push: autoPush,
      default_commit_msg: defaultCommitMsg || 'init',
      ai_api_key: aiKey,
      ai_model: aiModel || 'openai/gpt-4o-mini:free',
    });
    window.__cachedDeleteKey = deleteKey;
    applyThemeSetting(theme);
    checkConnectionStatus({ github_token: token, github_username: username, github_org_name: org });
    const { loadGitHubProfile } = await import('../components/ProfileCard.js');
    loadGitHubProfile();
    showSettingsMessage('Đã lưu cài đặt thành công!', true);
  } catch (err) {
    showSettingsMessage(`Lỗi lưu cài đặt: ${err}`, false);
  }
}

export async function autoSaveTheme(theme) {
  applyThemeSetting(theme);
  try {
    const cfg = await GetSettings();
    if (cfg) {
      cfg.theme_mode = theme;
      await SaveSettings(cfg);
      const { showToast } = await import('../components/Toast.js');
      showToast('Đã tự động cập nhật và lưu giao diện!', 'success');
    }
  } catch (err) {
    console.error('Lỗi tự động lưu giao diện:', err);
  }
}

export function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }
}

export function applyThemeSetting(mode) {
  currentTheme = mode || 'dark';
  if (currentTheme === 'system') {
    applyTheme(themeMediaQuery.matches ? 'dark' : 'light');
  } else {
    applyTheme(currentTheme);
  }
}

export function setupThemeSystem() {
  themeMediaQuery.addEventListener('change', (e) => {
    if (currentTheme === 'system') applyTheme(e.matches ? 'dark' : 'light');
  });
}

export function checkConnectionStatus(cfg) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('connection-status');
  if (cfg && cfg.github_token && cfg.github_username) {
    dot.className = 'status-dot green';
    const owner = cfg.github_org_name || cfg.github_username;
    text.innerText = `Connected as ${owner}`;
  } else {
    dot.className = 'status-dot red';
    text.innerText = 'Chưa cấu hình API';
  }
}

function showSettingsMessage(msg, isSuccess) {
  const el = document.getElementById('settings-status-msg');
  el.innerText = msg;
  el.className = `status-message ${isSuccess ? 'success' : 'error'}`;
  setTimeout(() => { el.innerText = ''; }, 4000);
}

// Global callbacks for HTML onclick
window.saveSettings = saveSettings;
window.onThemeChange = async function () {
  const theme = document.getElementById('setting-theme').value;
  await autoSaveTheme(theme);
};
window.toggleTokenVisibility = function () {
  const el = document.getElementById('setting-token');
  el.type = el.type === 'password' ? 'text' : 'password';
};
window.toggleDeleteKeyVisibility = function () {
  const el = document.getElementById('setting-delete-key');
  el.type = el.type === 'password' ? 'text' : 'password';
};

window.toggleAiKeyVisibility = function () {
  const el = document.getElementById('setting-ai-key');
  el.type = el.type === 'password' ? 'text' : 'password';
};
