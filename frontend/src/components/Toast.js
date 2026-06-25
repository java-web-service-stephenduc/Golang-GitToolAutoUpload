// Toast notification system
let container = null;

function ensureContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info') {
  const c = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast-item glass-card ${type}`;

  const icons = {
    success: `<i data-lucide="check-circle" class="toast-icon success"></i>`,
    error: `<i data-lucide="alert-circle" class="toast-icon error"></i>`,
    info: `<i data-lucide="info" class="toast-icon info"></i>`,
  };

  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span class="toast-message">${message}</span>
    <button class="toast-close-btn">&times;</button>
  `;

  c.appendChild(toast);
  if (window.lucide) {
    window.lucide.createIcons();
  }

  toast.querySelector('.toast-close-btn').onclick = () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  };

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

window.showToast = showToast;
