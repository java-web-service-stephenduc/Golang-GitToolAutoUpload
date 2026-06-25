// Console log component
let autoScroll = true;

export function setupConsoleAutoScroll() {
  const el = document.getElementById('console-output');
  if (!el) return;
  el.addEventListener('scroll', () => {
    const threshold = 15;
    autoScroll = (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
  });
}

export function appendConsoleLog(msg, type = 'info') {
  const el = document.getElementById('console-output');
  if (!el) return;
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.innerText = msg;
  el.appendChild(line);
  if (autoScroll) el.scrollTop = el.scrollHeight;
}

export function appendCloneConsoleLog(msg, type = 'info') {
  const el = document.getElementById('clone-console-output');
  if (!el) return;
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.innerText = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

export function clearConsole() {
  const el = document.getElementById('console-output');
  if (el) el.innerHTML = '';
}

export function clearCloneConsole() {
  const el = document.getElementById('clone-console-output');
  if (el) el.innerHTML = '';
}

window.clearConsole = clearConsole;
window.clearCloneConsole = clearCloneConsole;
