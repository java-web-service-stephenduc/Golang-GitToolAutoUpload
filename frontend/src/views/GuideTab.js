// Guide tab view
import { GetLocalGuideHTML } from '../../wailsjs/go/main/App';

export async function loadGuideTab() {
  const contentEl = document.getElementById('guide-tab-content');
  contentEl.innerHTML = '<span style="color: var(--text-secondary);">Đang tải tài liệu hướng dẫn sử dụng...</span>';

  try {
    const html = await GetLocalGuideHTML();
    if (html) {
      renderGuideSections(html);
    } else {
      contentEl.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Tài liệu hướng dẫn trống.</div>';
    }
  } catch (err) {
    contentEl.innerHTML = `<div style="color: var(--accent-red);">Lỗi tải tài liệu: ${err}</div>`;
  }
}

function renderGuideSections(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const sections = [];
  let currentSection = { title: 'Tổng quan', content: document.createElement('div') };
  sections.push(currentSection);

  Array.from(tempDiv.childNodes).forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2') {
      currentSection = {
        title: node.innerText.replace(/^\d+\.\s*/, ''),
        content: document.createElement('div'),
      };
      sections.push(currentSection);
    } else {
      currentSection.content.appendChild(node.cloneNode(true));
    }
  });

  const container = document.getElementById('guide-tab-content');
  container.innerHTML = '';

  const menu = document.createElement('div');
  menu.className = 'guide-sub-menu';

  const contentPane = document.createElement('div');
  contentPane.className = 'guide-sub-content readme-content';
  contentPane.style.userSelect = 'text';

  sections.forEach((sec, idx) => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.innerText = sec.title;
    if (idx === 0) {
      btn.classList.add('active');
      contentPane.appendChild(sec.content);
    }
    btn.onclick = () => {
      menu.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      contentPane.innerHTML = '';
      contentPane.appendChild(sec.content);
    };
    menu.appendChild(btn);
  });

  container.appendChild(menu);
  container.appendChild(contentPane);
}

window.loadGuideTab = loadGuideTab;
