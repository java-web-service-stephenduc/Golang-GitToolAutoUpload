// History service - recent pushed repo widget
import { GetLastPushedRepo, OpenBrowser } from '../../wailsjs/go/main/App';

export async function loadLastPushedRepo() {
  try {
    const repo = await GetLastPushedRepo();
    const textEl = document.getElementById('recent-repo-text');
    const openBtn = document.getElementById('btn-open-recent');
    const copyBtn = document.getElementById('btn-copy-recent');

    if (repo && repo.repo_name) {
      const date = new Date(repo.pushed_at);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      textEl.innerText = `${repo.repo_name} (${timeStr} - ${dateStr})`;

      openBtn.style.display = 'inline-block';
      openBtn.onclick = () => OpenBrowser(repo.repo_url);

      if (copyBtn) {
        copyBtn.style.display = 'inline-block';
        copyBtn.onclick = async () => {
          navigator.clipboard.writeText(repo.repo_url);
          copyBtn.innerText = 'Copied!';
          const { showToast } = await import('../components/Toast.js');
          showToast('Đã copy link repository gần đây nhất!', 'success');
          setTimeout(() => { copyBtn.innerText = 'Copy Link'; }, 2000);
        };
      }
    } else {
      textEl.innerText = 'Không có lịch sử đẩy bài gần đây.';
      openBtn.style.display = 'none';
      if (copyBtn) copyBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Lỗi lấy lịch sử repo gần nhất:', err);
  }
}
