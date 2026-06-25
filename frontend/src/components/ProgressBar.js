// Progress bar component
export function updateProgressBar(percent, text) {
  const bar = document.getElementById('progress-bar');
  const pct = document.getElementById('progress-percent');
  const status = document.getElementById('progress-text');
  if (bar) bar.style.width = `${percent}%`;
  if (pct) pct.innerText = `${percent}%`;
  if (status && text) status.innerText = text;
}

export function updateCloneProgressBar(percent, text) {
  const bar = document.getElementById('clone-progress-bar');
  const pct = document.getElementById('clone-progress-percent');
  const status = document.getElementById('clone-progress-text');
  if (bar) bar.style.width = `${percent}%`;
  if (pct) pct.innerText = `${percent}%`;
  if (status && text) status.innerText = text;
}
