// Repo card component
import { GetRepoLanguageStats, OpenBrowser } from '../../wailsjs/go/main/App';

export function createRepoCard(repo, onDetail, onDelete) {
  const card = document.createElement('div');
  card.className = 'repo-card glass-card';

  const header = document.createElement('div');
  header.className = 'repo-card-header';

  const title = document.createElement('span');
  title.className = 'repo-card-title';
  title.innerText = repo.name;
  title.style.cursor = 'pointer';
  title.onclick = (e) => { e.preventDefault(); onDetail(repo); };
  header.appendChild(title);

  const tagInfo = getRepoTag(repo);
  if (tagInfo) {
    const tag = document.createElement('span');
    tag.className = tagInfo.className;
    tag.innerText = tagInfo.text;
    header.appendChild(tag);
  }
  card.appendChild(header);

  const langBadge = document.createElement('span');
  langBadge.className = 'repo-lang-badge';
  langBadge.id = `lang-badge-${repo.name}`;
  langBadge.innerText = 'Loading...';
  card.appendChild(langBadge);

  GetRepoLanguageStats(repo.name).then(lang => {
    const el = document.getElementById(`lang-badge-${repo.name}`);
    if (el) el.innerText = lang || 'N/A';
  }).catch(() => {
    const el = document.getElementById(`lang-badge-${repo.name}`);
    if (el) el.innerText = 'N/A';
  });

  const url = document.createElement('a');
  url.className = 'repo-card-url';
  url.href = '#';
  url.innerText = repo.html_url;
  url.onclick = (e) => { e.preventDefault(); onDetail(repo); };
  card.appendChild(url);

  const actions = document.createElement('div');
  actions.className = 'repo-card-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary';
  copyBtn.innerText = 'Copy Link';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(repo.html_url);
    copyBtn.innerText = 'Copied!';
    setTimeout(() => { copyBtn.innerText = 'Copy Link'; }, 2000);
  };

  const detailBtn = document.createElement('button');
  detailBtn.className = 'btn-secondary';
  detailBtn.innerText = 'Chi tiết';
  detailBtn.onclick = () => onDetail(repo);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger';
  deleteBtn.innerText = 'Xóa';
  deleteBtn.onclick = () => onDelete(repo.name);

  actions.appendChild(copyBtn);
  actions.appendChild(detailBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}

function getRepoTag(repo) {
  if (!repo.default_branch) {
    return { text: 'EMPTY', className: 'repo-tag empty-tag' };
  }
  const pushedAt = repo.pushed_at ? new Date(repo.pushed_at) : null;
  if (pushedAt) {
    const diffHours = (new Date() - pushedAt) / (1000 * 60 * 60);
    if (diffHours < 24) {
      return { text: 'NEW', className: 'repo-tag new-tag' };
    }
  }
  return null;
}
