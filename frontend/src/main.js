// Main entry point - imports and orchestrates all modules
import './style.css';
import './app.css';

import { setupConsoleAutoScroll } from './components/Console.js';
import { setupDragAndDrop, setupPushEvents, setSelectedFolder } from './services/PushService.js';
import { setupCloneEvents } from './services/CloneService.js';
import { loadSettings, setupThemeSystem } from './services/ConfigService.js';
import { loadLastPushedRepo } from './services/HistoryService.js';
import { searchRepositories } from './services/SearchService.js';
import { setupChatInput } from './services/ChatService.js';
import { OpenBrowser } from '../wailsjs/go/main/App';
import './services/VoiceService.js';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadLastPushedRepo();
  setupDragAndDrop();
  setupConsoleAutoScroll();
  setupThemeSystem();
  setupGlobalLinkInterceptor();

  // Bind backend streaming events
  setupPushEvents();
  setupCloneEvents();

  // Init chat input
  setupChatInput();

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// Tab routing
window.switchTab = async function (tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');

  const navMap = {
    'push-tab': 'nav-push',
    'clone-tab': 'nav-clone',
    'search-tab': 'nav-search',
    'settings-tab': 'nav-settings',
    'report-tab': 'nav-report',
    'guide-tab': 'nav-guide',
  };
  const navId = navMap[tabId];
  if (navId) document.getElementById(navId).classList.add('active');

  // Lazy load tab data
  switch (tabId) {
    case 'push-tab': {
      const { loadLastPushedRepo } = await import('./services/HistoryService.js');
      loadLastPushedRepo();
      break;
    }
    case 'clone-tab': {
      const { loadGitHubReposForClone } = await import('./services/CloneService.js');
      loadGitHubReposForClone();
      break;
    }
    case 'search-tab': {
      document.getElementById('repo-detail-view').style.display = 'none';
      document.getElementById('search-list-view').style.display = 'block';
      searchRepositories();
      break;
    }
    case 'settings-tab':
      break;
    case 'report-tab': {
      const { loadReportTab } = await import('./services/GitHubService.js');
      loadReportTab();
      break;
    }
    case 'guide-tab': {
      const { loadGuideTab } = await import('./views/GuideTab.js');
      loadGuideTab();
      break;
    }
  }
};

function setupGlobalLinkInterceptor() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a');
    if (target && target.href) {
      const href = target.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault();
        OpenBrowser(href);
      }
    }
  });
}
