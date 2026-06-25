// Clone service
import { StartClone, DetectIDEs, OpenInIDE, OpenDirectoryInExplorer, GetMyRepos, SelectDirectory } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import { updateCloneProgressBar } from '../components/ProgressBar.js';
import { appendCloneConsoleLog, clearCloneConsole } from '../components/Console.js';

let cloneSelectedFolderPath = '';
let cloneSourceType = 'github';

export { cloneSelectedFolderPath, cloneSourceType };

export function setCloneSource(type) {
  cloneSourceType = type;
  document.getElementById('btn-clone-src-github').classList.toggle('active', type === 'github');
  document.getElementById('btn-clone-src-custom').classList.toggle('active', type === 'custom');
  document.getElementById('clone-github-group').style.display = type === 'github' ? 'flex' : 'none';
  document.getElementById('clone-custom-group').style.display = type === 'custom' ? 'flex' : 'none';
}

export async function loadGitHubReposForClone() {
  const selectEl = document.getElementById('clone-repo-select');
  selectEl.innerHTML = "<option value=''>-- Đang tải danh sách repo --</option>";
  try {
    const repos = await GetMyRepos();
    selectEl.innerHTML = '';
    if (!repos || repos.length === 0) {
      selectEl.innerHTML = "<option value=''>Không tìm thấy repository nào</option>";
      return;
    }
    repos.forEach(repo => {
      const opt = document.createElement('option');
      opt.value = repo.html_url;
      opt.innerText = `${repo.name} (${repo.private ? 'Private' : 'Public'})`;
      selectEl.appendChild(opt);
    });
  } catch (err) {
    console.error('Lỗi tải danh sách repo cho clone:', err);
    selectEl.innerHTML = `<option value=''>Lỗi tải danh sách: ${err}</option>`;
  }
}

export async function selectCloneDestination() {
  try {
    const path = await SelectDirectory();
    if (path) {
      cloneSelectedFolderPath = path;
      document.getElementById('clone-dest-path').value = cloneSelectedFolderPath;
      appendCloneConsoleLog(`Đã chọn thư mục lưu trữ: ${cloneSelectedFolderPath}`, 'info');
    }
  } catch (err) {
    appendCloneConsoleLog(`Lỗi chọn thư mục: ${err}`, 'error');
  }
}

export async function startCloneProcess() {
  clearCloneConsole();
  document.getElementById('clone-success-ide-actions').style.display = 'none';

  try {
    const { clearPendingError } = await import('./ChatService.js');
    clearPendingError();
  } catch (err) {}

  const sourceType = cloneSourceType;
  let repoURL = sourceType === 'github'
    ? document.getElementById('clone-repo-select').value
    : document.getElementById('clone-repo-url').value.trim();

  if (!repoURL) {
    const { showToast } = await import('../components/Toast.js');
    showToast('Vui lòng chọn repository!', 'error');
    appendCloneConsoleLog('Lỗi: Chưa chọn repository để clone.', 'error');
    return;
  }

  if (!cloneSelectedFolderPath) {
    const { showToast } = await import('../components/Toast.js');
    showToast('Vui lòng chọn thư mục lưu trữ!', 'error');
    appendCloneConsoleLog('Lỗi: Chưa chọn thư mục lưu trữ.', 'error');
    return;
  }

  let repoName = '';
  const m = repoURL.match(/\/([^/]+)\.git$/);
  repoName = m ? m[1] : repoURL.split('/').pop();
  repoName = repoName.replace(/[^a-zA-Z0-9._-]/g, '');

  const targetFolderPath = cloneSelectedFolderPath + '/' + repoName;

  updateCloneProgressBar(0, 'Đang chuẩn bị...');
  setCloneBusyState(true);
  appendCloneConsoleLog(`Khởi động tiến trình clone. Link: ${repoURL}`, 'info');
  appendCloneConsoleLog(`Thư mục đích: ${targetFolderPath}`, 'info');

  try {
    await StartClone(repoURL, targetFolderPath);
    updateCloneProgressBar(100, 'Hoàn tất!');
    const { showToast } = await import('../components/Toast.js');
    showToast('Clone repository thành công!', 'success');
    runIDEDetection(targetFolderPath);
  } catch (err) {
    updateCloneProgressBar(0, 'Thất bại');
    appendCloneConsoleLog(`Lỗi tiến trình clone: ${err}`, 'error');
    const { showToast } = await import('../components/Toast.js');
    showToast(`Clone thất bại: ${err}`, 'error');
  } finally {
    setCloneBusyState(false);
  }
}

export function cancelCloneProcess() {}

function setCloneBusyState(busy) {
  document.getElementById('btn-clone-start').disabled = busy;
  document.getElementById('clone-repo-select').disabled = busy;
  document.getElementById('clone-repo-url').disabled = busy;
  document.querySelectorAll('.segment-btn').forEach(b => b.disabled = busy);
}

async function runIDEDetection(folderPath) {
  const container = document.getElementById('ide-buttons-container');
  const panel = document.getElementById('clone-success-ide-actions');
  container.innerHTML = '';

  try {
    const ides = await DetectIDEs();

    const explorerBtn = document.createElement('button');
    explorerBtn.className = 'ide-btn explorer';
    explorerBtn.innerHTML = `
      <i data-lucide="folder" style="width:16px;height:16px;margin-right:6px;display:inline-block;vertical-align:middle;"></i>
      Mở Thư Mục
    `;
    explorerBtn.onclick = () => OpenDirectoryInExplorer(folderPath);
    container.appendChild(explorerBtn);

    if (ides && ides.length > 0) {
      ides.forEach(ide => {
        const btn = document.createElement('button');
        let ideClass = 'vscode';
        if (ide.name === 'IntelliJ IDEA') ideClass = 'intellij';
        else if (ide.name === 'Cursor') ideClass = 'cursor-ide';
        else if (ide.name === 'Antigravity') ideClass = 'antigravity';

        btn.className = `ide-btn ${ideClass}`;
        btn.innerHTML = `
          <i data-lucide="code" style="width:16px;height:16px;margin-right:6px;display:inline-block;vertical-align:middle;"></i>
          Mở bằng ${ide.name}
        `;
        btn.onclick = async () => {
          try {
            await OpenInIDE(ide.path, folderPath);
            const { showToast } = await import('../components/Toast.js');
            showToast(`Đã mở dự án bằng ${ide.name}`, 'success');
          } catch (err) {
            const { showToast } = await import('../components/Toast.js');
            showToast(`Không thể mở IDE: ${err}`, 'error');
          }
        };
        container.appendChild(btn);
      });
    }
    panel.style.display = 'block';
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Lỗi phát hiện IDE:', err);
  }
}

export function setupCloneEvents() {
  EventsOn('clone_log', (msg) => appendCloneConsoleLog(msg, 'info'));
  EventsOn('clone_progress', (percent) => {
    let statusText = 'Đang tải dữ liệu...';
    if (percent <= 20) statusText = 'Đang kết nối...';
    else if (percent >= 95) statusText = 'Giải nén dữ liệu...';
    updateCloneProgressBar(percent, statusText);
  });
}

window.setCloneSource = setCloneSource;
window.loadGitHubReposForClone = loadGitHubReposForClone;
window.selectCloneDestination = selectCloneDestination;
window.startCloneProcess = startCloneProcess;
window.cancelCloneProcess = cancelCloneProcess;
