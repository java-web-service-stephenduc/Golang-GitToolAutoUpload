// Push service
import { StartPush, CancelPush, SelectDirectory } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import { updateProgressBar } from '../components/ProgressBar.js';
import { appendConsoleLog, clearConsole } from '../components/Console.js';
import { loadLastPushedRepo } from './HistoryService.js';

let selectedFolderPath = '';
let lastSuccessUrl = '';

export { selectedFolderPath, lastSuccessUrl };
export function getSelectedFolder() { return selectedFolderPath; }

export function setSelectedFolder(path) {
  selectedFolderPath = path;
  const el = document.getElementById('folder-path-display');
  if (el) el.innerText = path;
}

export function checkAndTriggerAutoPush() {
  import('./ConfigService.js').then(async ({ loadSettings }) => {
    const cfg = await loadSettings();
    if (cfg && cfg.auto_push) {
      appendConsoleLog('Chế độ Tự động Push được kích hoạt. Bắt đầu đẩy bài...', 'info');
      startPushProcess();
    }
  }).catch(err => console.error('Lỗi kiểm tra tự động push:', err));
}

export async function startPushProcess() {
  clearConsole();
  lastSuccessUrl = '';

  if (!selectedFolderPath) {
    appendConsoleLog('Lỗi: Vui lòng chọn hoặc kéo thả thư mục chứa bài tập.', 'error');
    const { showToast } = await import('../components/Toast.js');
    showToast('Vui lòng chọn thư mục bài tập!', 'error');
    return;
  }

  const mode = document.getElementById('mode-selector').value;
  const sessionVal = document.getElementById('session-num').value;
  const exVal = document.getElementById('ex-num').value;
  const miniProjectVal = document.getElementById('miniproject-text').value;
  const customRepoNameVal = document.getElementById('custom-repo-name').value;
  const useDefaultCommit = document.getElementById('toggle-default-commit').checked;
  const customCommitMsg = document.getElementById('custom-commit-msg').value;

  updateProgressBar(0, 'Đang chuẩn bị...');
  setBusyState(true);

  appendConsoleLog(`Khởi động tiến trình push. Thư mục: ${selectedFolderPath}`, 'info');

  try {
    await StartPush(
      selectedFolderPath, mode, sessionVal, exVal,
      miniProjectVal, customRepoNameVal, useDefaultCommit, customCommitMsg
    );
    updateProgressBar(100, 'Hoàn tất!');
    appendConsoleLog('Tiến trình hoàn thành thành công!', 'success');
    await loadLastPushedRepo();
    const { showToast } = await import('../components/Toast.js');
    showToast('Đẩy bài tập thành công!', 'success');
  } catch (err) {
    updateProgressBar(0, 'Thất bại');
    appendConsoleLog(`Lỗi tiến trình: ${err}`, 'error');
    const { showToast } = await import('../components/Toast.js');
    showToast(`Push thất bại: ${err}`, 'error');
  } finally {
    setBusyState(false);
  }
}

export async function cancelPushProcess() {
  appendConsoleLog('Đang gửi yêu cầu hủy tiến trình...', 'info');
  try {
    await CancelPush();
  } catch (err) {
    appendConsoleLog(`Lỗi khi hủy: ${err}`, 'error');
  }
}

export function setBusyState(busy) {
  const ids = ['btn-push', 'btn-cancel-push', 'mode-selector', 'session-num',
    'ex-num', 'miniproject-text', 'custom-repo-name', 'toggle-default-commit', 'custom-commit-msg'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = (id === 'btn-cancel-push') ? !busy : busy;
  });
}

export function setupPushEvents() {
  EventsOn('git_log', (msg) => {
    if (msg.includes('Đẩy bài tập thành công!')) {
      appendConsoleLog(msg, 'success');
      const match = msg.match(/https?:\/\/[^\s]+/);
      if (match) lastSuccessUrl = match[0];
    } else {
      appendConsoleLog(msg, 'info');
    }
  });

  EventsOn('git_progress', (percent) => {
    let statusText = 'Đang push code...';
    if (percent <= 20) statusText = 'Tạo repository...';
    else if (percent <= 40) statusText = 'Đồng bộ git...';
    else if (percent >= 95) statusText = 'Đang dọn dẹp...';
    updateProgressBar(percent, statusText);
  });
}

// Drag & Drop
export function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.path) {
        selectedFolderPath = file.path;
        document.getElementById('folder-path-display').innerText = selectedFolderPath;
        appendConsoleLog(`Đã chọn thư mục qua kéo thả: ${selectedFolderPath}`, 'info');
        checkAndTriggerAutoPush();
      } else {
        appendConsoleLog('Không thể lấy đường dẫn thư mục kéo thả.', 'error');
      }
    }
  });

  dropZone.addEventListener('click', async () => {
    try {
      const result = await SelectDirectory();
      if (result) {
        selectedFolderPath = result;
        document.getElementById('folder-path-display').innerText = selectedFolderPath;
        appendConsoleLog(`Đã chọn thư mục: ${selectedFolderPath}`, 'info');
        checkAndTriggerAutoPush();
      }
    } catch (err) {
      appendConsoleLog(`Lỗi chọn thư mục: ${err}`, 'error');
    }
  });
}

// Global HTML onclick callbacks
window.startPushProcess = startPushProcess;
window.cancelPushProcess = cancelPushProcess;
window.onModeChange = function () {
  const mode = document.getElementById('mode-selector').value;
  document.getElementById('session-group').style.display = (mode === 'SESSION_EX' || mode === 'MINI_PROJECT') ? 'flex' : 'none';
  document.getElementById('ex-group').style.display = mode === 'SESSION_EX' ? 'flex' : 'none';
  document.getElementById('miniproject-group').style.display = mode === 'MINI_PROJECT' ? 'flex' : 'none';
  document.getElementById('custom-repo-group').style.display = mode === 'CUSTOM_REPOSITORY' ? 'flex' : 'none';
};
window.onCommitToggle = function () {
  const useDefault = document.getElementById('toggle-default-commit').checked;
  document.getElementById('custom-commit-wrapper').style.display = useDefault ? 'none' : 'flex';
};
