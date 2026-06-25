// Search service
import { SearchRepos, DeleteRepo, GetRepoContents, GetRepoReadme, OpenBrowser, GetRepoFile, UpdateRepoFile, GetRepoLanguages } from '../../wailsjs/go/main/App';
import { createRepoCard } from '../components/RepoCard.js';
import { showToast } from '../components/Toast.js';
import { appendConsoleLog } from '../components/Console.js';

let searchResults = [];
let searchCurrentPage = 0;
let searchTotalCount = 0;
const searchPageSize = 12;
let activeRepo = null;
let repoExplorerPath = '';

export { searchResults, searchCurrentPage, searchTotalCount, activeRepo, repoExplorerPath };

export async function searchRepositories(goToPage = 0) {
  searchCurrentPage = goToPage;
  const query = document.getElementById('search-query').value.trim();
  const sortBy = document.getElementById('search-sort').value;
  const container = document.getElementById('repo-list-container');
  container.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: var(--text-secondary);'>Đang tìm kiếm...</div>";
  document.getElementById('pagination-controls').style.display = 'none';

  const actionBtn = document.getElementById('btn-search-action');
  actionBtn.innerText = query ? 'Xóa' : 'Tìm kiếm';

  try {
    const result = await SearchRepos(query, searchCurrentPage + 1, searchPageSize, sortBy);
    searchResults = result.repos || [];
    searchTotalCount = result.total_count || 0;
    renderRepositories();
  } catch (err) {
    container.innerHTML = `<div style='grid-column: 1/-1; text-align: center; color: var(--accent-red);'>Lỗi tìm kiếm: ${err}</div>`;
  }
}

export function handleSearchAction() {
  const actionBtn = document.getElementById('btn-search-action');
  if (actionBtn.innerText === 'Xóa' || actionBtn.innerText === 'Clear') {
    document.getElementById('search-query').value = '';
    actionBtn.innerText = 'Tìm kiếm';
    searchRepositories(0);
  } else {
    searchRepositories(0);
  }
}

export function prevSearchPage() {
  if (searchCurrentPage > 0) searchRepositories(searchCurrentPage - 1);
}

export function nextSearchPage() {
  const totalPages = Math.ceil(searchTotalCount / searchPageSize);
  if (searchCurrentPage < totalPages - 1) searchRepositories(searchCurrentPage + 1);
}

function renderRepositories() {
  const container = document.getElementById('repo-list-container');
  container.innerHTML = '';

  if (searchResults.length === 0) {
    container.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: var(--text-muted);'>Không tìm thấy repository nào.</div>";
    document.getElementById('pagination-controls').style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(searchTotalCount / searchPageSize);
  searchResults.forEach(repo => {
    container.appendChild(createRepoCard(repo, enterRepoDetail, confirmAndDeleteRepo));
  });

  const pagControls = document.getElementById('pagination-controls');
  if (searchTotalCount > searchPageSize) {
    pagControls.style.display = 'flex';
    document.getElementById('page-info').innerText = `Trang ${searchCurrentPage + 1} / ${totalPages} (${searchTotalCount} repo)`;
    document.getElementById('btn-prev-page').disabled = (searchCurrentPage === 0);
    document.getElementById('btn-next-page').disabled = (searchCurrentPage >= totalPages - 1);
  } else {
    pagControls.style.display = 'none';
  }
}

// --- Detail View ---
export function enterRepoDetail(repo) {
  activeRepo = repo;
  repoExplorerPath = '';

  document.getElementById('search-list-view').style.display = 'none';
  document.getElementById('repo-detail-view').style.display = 'block';

  document.getElementById('detail-repo-name').innerText = repo.name;
  document.getElementById('detail-repo-visibility').innerText = repo.private ? 'Private' : 'Public';
  document.getElementById('detail-repo-visibility').className = repo.private ? 'repo-tag private-tag' : 'repo-tag';
  document.getElementById('detail-repo-desc').innerText = repo.description || 'Không có mô tả.';
  document.getElementById('detail-repo-stars').innerText = `⭐ ${repo.stargazers_count || 0} stars`;
  document.getElementById('detail-repo-forks').innerText = `🍴 ${repo.forks_count || 0} forks`;
  document.getElementById('detail-repo-watchers').innerText = `👁 ${repo.watchers_count || 0} watchers`;
  document.getElementById('detail-repo-size').innerText = `📦 ${formatBytes(repo.size * 1024)}`;

  document.getElementById('btn-open-in-github').onclick = () => OpenBrowser(repo.html_url);

  closeFileEditor();
  loadRepoLanguages();

  loadRepoFiles();
  loadRepoReadme();
}

export function hideRepoDetail() {
  document.getElementById('repo-detail-view').style.display = 'none';
  document.getElementById('search-list-view').style.display = 'block';
  activeRepo = null;
}

async function loadRepoFiles() {
  const tbody = document.getElementById('files-table-body');
  const pathDisplay = document.getElementById('explorer-current-path');
  pathDisplay.innerText = repoExplorerPath === '' ? 'root' : `root / ${repoExplorerPath}`;
  tbody.innerHTML = "<tr><td colspan='3' style='text-align: center; color: var(--text-secondary);'>Đang tải danh sách tập tin...</td></tr>";

  try {
    const contents = await GetRepoContents(activeRepo.name, repoExplorerPath);
    tbody.innerHTML = '';

    if (repoExplorerPath !== '') {
      const tr = document.createElement('tr');
      tr.className = 'clickable';
      tr.onclick = () => {
        const parts = repoExplorerPath.split('/');
        parts.pop();
        repoExplorerPath = parts.join('/');
        loadRepoFiles();
      };
      tr.innerHTML = `
        <td style="font-weight: bold; color: var(--accent-blue);">
          <i data-lucide="chevron-left" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle;"></i>.. (Thư mục cha)
        </td>
        <td style="color: var(--text-muted);">dir</td>
        <td style="text-align: right; color: var(--text-muted);">-</td>
      `;
      tbody.appendChild(tr);
    }

    if (!contents || contents.length === 0) {
      tbody.innerHTML += "<tr><td colspan='3' style='text-align: center; color: var(--text-muted);'>Thư mục này trống.</td></tr>";
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    contents.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    contents.forEach(item => {
      const tr = document.createElement('tr');
      const isDir = item.type === 'dir';
      tr.className = 'clickable';
      tr.onclick = () => {
        if (isDir) {
          repoExplorerPath = repoExplorerPath === '' ? item.name : `${repoExplorerPath}/${item.name}`;
          loadRepoFiles();
        } else {
          openFileEditor(item.path);
        }
      };

      const icon = isDir
        ? `<i data-lucide="folder" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;color:var(--accent-purple);"></i>`
        : `<i data-lucide="file-text" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;color:var(--text-secondary);"></i>`;

      tr.innerHTML = `
        <td>${icon} ${item.name}</td>
        <td style="color: var(--text-secondary);">${item.type}</td>
        <td style="text-align: right; color: var(--text-secondary);">${isDir ? '-' : formatBytes(item.size)}</td>
      `;
      tbody.appendChild(tr);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan='3' style='text-align: center; color: var(--accent-red);'>Lỗi tải danh sách tập tin: ${err}</td></tr>`;
  }
}

async function loadRepoReadme() {
  const readmeContent = document.getElementById('detail-readme-content');
  readmeContent.innerHTML = '<span style="color: var(--text-secondary);">Đang tải README.md...</span>';

  try {
    const html = await GetRepoReadme(activeRepo.name);
    readmeContent.innerHTML = html || '<div style="color: var(--text-muted); text-align: center;">Không có tệp README.md.</div>';
  } catch (err) {
    readmeContent.innerHTML = `<div style="color: var(--accent-red);">Lỗi tải README.md: ${err}</div>`;
  }
}

// --- Delete ---
export async function confirmAndDeleteRepo(name) {
  if (!window.__cachedDeleteKey) {
    showToast('Chưa thiết lập Delete Key trong mục Cài đặt!', 'error');
    window.switchTab('settings-tab');
    return;
  }

  const modal = document.getElementById('delete-confirm-modal');
  document.getElementById('delete-confirm-repo-name').innerText = name;
  document.getElementById('delete-confirm-input').value = '';
  modal.style.display = 'flex';
  document.getElementById('delete-confirm-input').focus();

  document.getElementById('btn-confirm-delete-action').onclick = async () => {
    const enteredKey = document.getElementById('delete-confirm-input').value;
    if (enteredKey.trim() !== window.__cachedDeleteKey.trim()) {
      showToast('Delete Key không khớp! Không thể xóa repository.', 'error');
      return;
    }
    modal.style.display = 'none';
    try {
      appendConsoleLog(`Đang gửi yêu cầu xóa repository: ${name}...`, 'info');
      await DeleteRepo(name);
      showToast(`Đã xóa thành công repository '${name}' khỏi GitHub.`, 'success');
      searchRepositories(searchCurrentPage);
    } catch (err) {
      showToast(`Xóa repository thất bại: ${err}`, 'error');
    }
  };
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

let currentEditingFileSha = '';
let currentEditingFilePath = '';

const langColors = {
  'Go': '#00ADD8',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'JavaScript': '#f1e05a',
  'Java': '#b07219',
  'Python': '#3572A5',
  'C++': '#f34b7d',
  'C#': '#178600',
  'PHP': '#4F5D95',
  'TypeScript': '#3178c6',
  'Shell': '#89e051'
};

export async function loadRepoLanguages() {
  const bar = document.getElementById('repo-lang-bar');
  const list = document.getElementById('repo-lang-list');
  if (!bar || !list) return;

  bar.innerHTML = '';
  list.innerHTML = 'Đang tải thông tin ngôn ngữ...';

  try {
    const languages = await GetRepoLanguages(activeRepo.name);
    bar.innerHTML = '';
    list.innerHTML = '';

    if (!languages || Object.keys(languages).length === 0) {
      list.innerHTML = '<span style="color: var(--text-muted);">Không phát hiện ngôn ngữ.</span>';
      return;
    }

    let total = 0;
    for (const lang in languages) {
      total += languages[lang];
    }

    if (total === 0) {
      list.innerHTML = '<span style="color: var(--text-muted);">Không phát hiện ngôn ngữ.</span>';
      return;
    }

    const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([lang, bytes]) => {
      const pct = ((bytes / total) * 100).toFixed(1);
      const color = langColors[lang] || '#8b949e';

      const segment = document.createElement('div');
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.title = `${lang}: ${pct}%`;
      bar.appendChild(segment);

      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color};"></span>
          <span style="font-weight: 500; color: var(--text-primary);">${lang}</span>
        </div>
        <span style="color: var(--text-muted); font-size: 11px;">${pct}%</span>
      `;
      list.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    list.innerHTML = `<span style="color: var(--accent-red);">Lỗi: ${err}</span>`;
  }
}

export async function openFileEditor(path) {
  const editorContainer = document.getElementById('file-editor-container');
  const readmeContainer = document.getElementById('detail-readme-container');
  const explorerCard = document.querySelector('.file-explorer-card');
  const editorText = document.getElementById('editor-text-content');
  const editorName = document.getElementById('editor-file-name');
  const commitInput = document.getElementById('editor-commit-msg');

  editorName.innerText = `Đang tải: ${path}...`;
  editorText.value = 'Đang tải nội dung file từ GitHub...';
  commitInput.value = `Update ${path.split('/').pop()}`;

  editorContainer.style.display = 'flex';
  explorerCard.style.display = 'none';
  if (readmeContainer) readmeContainer.style.display = 'none';

  try {
    const fileDetail = await GetRepoFile(activeRepo.name, path);
    currentEditingFileSha = fileDetail.sha;
    currentEditingFilePath = path;

    editorName.innerText = path;
    try {
      const decoded = decodeURIComponent(atob(fileDetail.content.replace(/\s/g, '')).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      editorText.value = decoded;
    } catch (e) {
      editorText.value = atob(fileDetail.content);
    }
  } catch (err) {
    showToast(`Không thể đọc file: ${err}`, 'error');
    closeFileEditor();
  }
}

export function closeFileEditor() {
  const editorContainer = document.getElementById('file-editor-container');
  const explorerCard = document.querySelector('.file-explorer-card');
  const readmeContainer = document.getElementById('detail-readme-container');

  if (editorContainer) editorContainer.style.display = 'none';
  if (explorerCard) explorerCard.style.display = 'flex';
  if (readmeContainer) readmeContainer.style.display = 'block';
}

export async function saveFileContent() {
  const text = document.getElementById('editor-text-content').value;
  const commitMsg = document.getElementById('editor-commit-msg').value.trim() || `Update ${currentEditingFilePath.split('/').pop()}`;
  const saveBtn = document.getElementById('btn-save-file');

  saveBtn.disabled = true;
  saveBtn.innerText = 'Đang lưu...';

  try {
    const utf8Bytes = new TextEncoder().encode(text);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
    }
    const contentBase64 = btoa(binary);

    await UpdateRepoFile(activeRepo.name, currentEditingFilePath, contentBase64, currentEditingFileSha, commitMsg);
    showToast('Lưu và commit thành công!', 'success');
    closeFileEditor();
    loadRepoFiles();
    loadRepoReadme();
  } catch (err) {
    showToast(`Không thể lưu file: ${err}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = 'Lưu & Commit';
  }
}

// Global callbacks
window.searchRepositories = searchRepositories;
window.handleSearchAction = handleSearchAction;
window.handleSearchKeyUp = function (e) { if (e.key === 'Enter') searchRepositories(0); };
window.prevSearchPage = prevSearchPage;
window.nextSearchPage = nextSearchPage;
window.enterRepoDetail = enterRepoDetail;
window.hideRepoDetail = hideRepoDetail;
window.confirmAndDeleteRepo = confirmAndDeleteRepo;
window.closeFileEditor = closeFileEditor;
window.saveFileContent = saveFileContent;
window.openFileEditor = openFileEditor;
window.loadRepoLanguages = loadRepoLanguages;
window.closeDeleteConfirmModal = function () {
  document.getElementById('delete-confirm-modal').style.display = 'none';
};
window.toggleDeleteConfirmVisibility = function () {
  const el = document.getElementById('delete-confirm-input');
  el.type = el.type === 'password' ? 'text' : 'password';
};
