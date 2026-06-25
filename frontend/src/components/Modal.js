// Success Modal
let modalHtml = null;

export function showSuccessPopup(url) {
  const modal = document.getElementById('success-modal');
  const urlDisplay = document.getElementById('success-modal-url');
  const copyBtn = document.getElementById('success-modal-copy-btn');
  const openBtn = document.getElementById('success-modal-open-btn');

  if (!modal || !urlDisplay) return;

  urlDisplay.innerText = url;
  modal.style.display = 'flex';

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(url);
    copyBtn.innerText = 'Copied!';
    window.showToast('Đã copy link repository vào clipboard!', 'success');
    setTimeout(() => { copyBtn.innerText = 'Copy Link'; }, 2000);
  };

  openBtn.onclick = async () => {
    const { OpenBrowser } = await import('../../wailsjs/go/main/App');
    OpenBrowser(url);
  };
}

export function closeSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) modal.style.display = 'none';
}

window.closeSuccessModal = closeSuccessModal;
