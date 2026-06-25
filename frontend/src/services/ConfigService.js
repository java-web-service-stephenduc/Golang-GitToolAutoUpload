// Config service
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

let themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = 'dark';

export { currentTheme };

export function applyAssistantToggles(botChat, voiceChat) {
  const fab = document.getElementById('chatFabContainer');
  if (fab) {
    fab.style.display = botChat ? 'flex' : 'none';
  }
  const voiceBtn = document.getElementById('voiceToggleBtn');
  if (voiceBtn) {
    voiceBtn.style.display = voiceChat ? 'flex' : 'none';
  }
}

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
      
      // Default to the provided OpenRouter API Key and Model Name if empty
      document.getElementById('setting-ai-key').value = cfg.ai_api_key || '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';
      document.getElementById('setting-ai-model').value = cfg.ai_model || 'openai/gpt-oss-120b:free';

      // Load toggles from localStorage (default to true)
      const botChatEnabled = localStorage.getItem('bot_chat_enabled') !== 'false';
      const voiceChatEnabled = localStorage.getItem('voice_chat_enabled') !== 'false';
      document.getElementById('setting-bot-chat-enabled').checked = botChatEnabled;
      document.getElementById('setting-voice-chat-enabled').checked = voiceChatEnabled;

      window.__cachedDeleteKey = cfg.delete_key || '';

      applyThemeSetting(cfg.theme_mode || 'dark');
      checkConnectionStatus(cfg);
      applyAssistantToggles(botChatEnabled, voiceChatEnabled);

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
  
  // Use inputs or correct default values if empty
  const aiKey = document.getElementById('setting-ai-key').value.trim() || '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';
  const aiModel = document.getElementById('setting-ai-model').value.trim() || 'openai/gpt-oss-120b:free';

  // Toggles
  const botChat = document.getElementById('setting-bot-chat-enabled').checked;
  const voiceChat = document.getElementById('setting-voice-chat-enabled').checked;

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
      ai_model: aiModel,
    });
    
    // Save toggles to localStorage
    localStorage.setItem('bot_chat_enabled', botChat ? 'true' : 'false');
    localStorage.setItem('voice_chat_enabled', voiceChat ? 'true' : 'false');
    applyAssistantToggles(botChat, voiceChat);

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

window.onBotChatToggle = function () {
  const checked = document.getElementById('setting-bot-chat-enabled').checked;
  const fab = document.getElementById('chatFabContainer');
  if (fab) fab.style.display = checked ? 'flex' : 'none';
};

window.onVoiceChatToggle = function () {
  const checked = document.getElementById('setting-voice-chat-enabled').checked;
  const voiceBtn = document.getElementById('voiceToggleBtn');
  if (voiceBtn) voiceBtn.style.display = checked ? 'flex' : 'none';
};
