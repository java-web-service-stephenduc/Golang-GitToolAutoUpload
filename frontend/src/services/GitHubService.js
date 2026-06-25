// GitHub service - report tab
import { GetTokenReport } from '../../wailsjs/go/main/App';

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function loadReportTab() {
  const loading = document.getElementById('report-loading');
  const dataContainer = document.getElementById('report-data');

  loading.style.display = 'block';
  dataContainer.style.display = 'none';

  try {
    const r = await GetTokenReport();
    loading.style.display = 'none';
    dataContainer.style.display = 'grid';

    dataContainer.innerHTML = `
      <div class="glass-card report-card-item">
        <h3>Quyền hạn Token (Scopes)</h3>
        <div class="scope-status-list">
          <div class="scope-status-item">
            <span class="status-icon ${r.has_repo_scope ? 'green' : 'red'}">${r.has_repo_scope ? '✓' : '✗'}</span>
            <div class="scope-desc"><strong>repo</strong><span>Quyền tạo và truy cập kho lưu trữ (Bắt buộc)</span></div>
          </div>
          <div class="scope-status-item">
            <span class="status-icon ${r.has_delete_scope ? 'green' : 'yellow'}">${r.has_delete_scope ? '✓' : '⚠'}</span>
            <div class="scope-desc"><strong>delete_repo</strong><span>Quyền xóa kho lưu trữ (Cần cho tính năng Xóa)</span></div>
          </div>
          <div class="scope-status-item">
            <span class="status-icon ${r.has_org_scope ? 'green' : 'info'}">${r.has_org_scope ? '✓' : 'ℹ'}</span>
            <div class="scope-desc"><strong>admin:org / write:org</strong><span>Quyền quản lý tổ chức (Tùy chọn)</span></div>
          </div>
        </div>
        <div class="raw-scopes">
          <strong>Danh sách Scope hiện tại:</strong>
          <code>${r.scopes.join(', ') || 'không có scope'}</code>
        </div>
      </div>
      <div class="glass-card report-card-item">
        <h3>Giới hạn API GitHub</h3>
        <div class="rate-limit-display">
          <div class="rate-limit-circle">
            <span class="rate-val">${r.rate_remaining} / ${r.rate_limit}</span>
            <span class="rate-lbl">Còn lại</span>
          </div>
          <div class="rate-details">
            <p><strong>Thời gian Reset:</strong> ${r.rate_reset}</p>
            <p>Token cá nhân (PAT) được hưởng 5,000 yêu cầu mỗi giờ để đảm bảo hoạt động mượt mà.</p>
          </div>
        </div>
      </div>
      <div class="glass-card report-card-item" style="grid-column: 1 / -1;">
        <h3>Thông tin Tài khoản & Kho lưu trữ</h3>
        <div class="stats-grid">
          <div class="stat-box"><span class="stat-num">${r.public_repos}</span><span class="stat-lbl">Public Repos</span></div>
          <div class="stat-box"><span class="stat-num">${r.private_repos}</span><span class="stat-lbl">Private Repos</span></div>
          <div class="stat-box"><span class="stat-num">${formatBytes(r.disk_usage * 1024)}</span><span class="stat-lbl">Dung lượng đã dùng</span></div>
          <div class="stat-box"><span class="stat-num" style="text-transform: capitalize;">${r.plan_name || 'Free'}</span><span class="stat-lbl">Gói dịch vụ</span></div>
          <div class="stat-box"><span class="stat-num">${r.two_factor_authentication ? 'Đã bật' : 'Chưa bật'}</span><span class="stat-lbl">Xác thực 2FA</span></div>
        </div>
      </div>
    `;
  } catch (err) {
    loading.style.display = 'none';
    dataContainer.style.display = 'block';
    dataContainer.innerHTML = `<div style="color: var(--accent-red); text-align: center; padding: 20px;">Lỗi tải báo cáo chẩn đoán: ${err}</div>`;
  }
}

window.loadReportTab = loadReportTab;
