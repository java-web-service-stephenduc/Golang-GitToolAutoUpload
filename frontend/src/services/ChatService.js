// Chat service - AI assistant
import { SendChatMessage, GetAppContext, GetRawGuideContent } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';

let isChatOpen = false;
let isLoading = false;
let chatHistory = [];
let projectGuideContent = '';

// System prompt for the AI assistant
const SYSTEM_PROMPT = `Bạn là trợ lý AI tên là Stephen của ứng dụng G-GitUpload - công cụ tự động push bài tập lên GitHub.

Nhiệm vụ của bạn chỉ giới hạn trong việc:
1. Hướng dẫn cách sử dụng ứng dụng G-GitUpload (push, clone, search, settings).
2. Giải thích lỗi git/github và cách khắc phục dựa trên nhật ký console hệ thống.
3. Hướng dẫn cấu hình GitHub Token, đặt tên repository, naming pattern.

QUY TẮC QUAN TRỌNG:
- Tên của bạn là Stephen. Luôn xưng tên là Stephen hoặc trợ lý Stephen khi trả lời.
- Khi người dùng hỏi "Ai phát triển công cụ này?", "Công cụ này do ai viết?", hoặc các câu hỏi tương tự về tác giả/nhà phát triển dự án, bạn phải trả lời chính xác rằng: Công cụ được phát triển bởi tác giả Stephen. Đồng thời cung cấp đầy đủ liên kết repository public và thông tin liên hệ sau ở định dạng Markdown:
  * Repo Link: https://github.com/java-web-service-stephenduc/Golang-GitToolAutoUpload
  * Tác giả: Stephen
  * Vai trò: Full-stack Developer (Rikkei, Vietnam)
  * Email: tranducanh31032006@gmail.com
  * Facebook: stephen.uc.2025
- Từ chối trả lời tất cả các câu hỏi không liên quan đến ứng dụng G-GitUpload, lập trình Git/GitHub, hoặc bài tập của dự án. Ví dụ, nếu người dùng hỏi về danh nhân, cầu thủ bóng đá ("Messi sinh năm bao nhiêu", "thời tiết hôm nay"), lịch sử, địa lý... hãy trả lời lịch sự rằng: "Stephen chỉ hỗ trợ các câu hỏi liên quan đến công cụ G-GitUpload và quy trình quản lý mã nguồn Git/GitHub. Vui lòng hỏi câu hỏi liên quan."
- Trả lời bằng tiếng Việt ngắn gọn, súc tích (2-4 câu).`;

export function toggleChatPanel() {
  isChatOpen = !isChatOpen;
  document.getElementById('chatPanel').classList.toggle('open', isChatOpen);
  document.getElementById('chatOverlay').classList.toggle('open', isChatOpen);
  if (isChatOpen) {
    document.getElementById('chatInput').focus();
  }
}

window.toggleChatPanel = toggleChatPanel;

let pendingErrorMsg = '';

export function handleAiFabClick() {
  if (pendingErrorMsg) {
    if (!isChatOpen) {
      toggleChatPanel();
    }
    
    const errorMsg = pendingErrorMsg;
    pendingErrorMsg = ''; // clear it
    
    const badge = document.getElementById('chatFabBadge');
    const tooltip = document.getElementById('chatFabTooltip');
    if (badge) badge.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    
    triggerDiagnostics(errorMsg);
  } else {
    toggleChatPanel();
  }
}

export function makeElementDraggable(container) {
  const handler = document.getElementById('chatToggleBtn');
  if (!handler) return;

  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let wasDragged = false;
  let startX = 0, startY = 0;

  handler.addEventListener('mousedown', dragMouseDown);
  
  handler.addEventListener('click', (e) => {
    if (wasDragged) {
      e.preventDefault();
      e.stopPropagation();
      wasDragged = false;
    } else {
      handleAiFabClick();
    }
  });

  function dragMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    
    pos3 = e.clientX;
    pos4 = e.clientY;
    startX = e.clientX;
    startY = e.clientY;
    wasDragged = false;
    
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
    handler.style.cursor = 'grabbing';
  }

  function elementDrag(e) {
    if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
      wasDragged = true;
    }

    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    let newTop = container.offsetTop - pos2;
    let newLeft = container.offsetLeft - pos1;

    // Boundaries
    const pad = 15;
    const maxTop = window.innerHeight - container.offsetHeight - pad;
    const maxLeft = window.innerWidth - container.offsetWidth - pad;

    if (newTop < pad) newTop = pad;
    if (newTop > maxTop) newTop = maxTop;
    if (newLeft < pad) newLeft = pad;
    if (newLeft > maxLeft) newLeft = maxLeft;

    container.style.top = newTop + "px";
    container.style.left = newLeft + "px";
    container.style.bottom = "auto";
    container.style.right = "auto";
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
    handler.style.cursor = 'grab';
  }
}

async function triggerDiagnostics(errorMsg) {
  addMessage(`Ứng dụng báo lỗi khi push: "${errorMsg}". Hãy chẩn đoán lỗi này giúp tôi.`, 'user');

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg assistant';
  loadingDiv.id = 'chat-loading-msg';
  loadingDiv.innerHTML = `
    <div class="chat-msg-label">AI</div>
    <div class="chat-msg-content">
      <div class="chat-typing"><span></span><span></span><span></span></div>
    </div>
  `;
  document.getElementById('chatMessages').appendChild(loadingDiv);
  scrollChat();

  isLoading = true;
  setSendButtonState(true);

  try {
    let contextSummary = '';
    try {
      const ctx = await GetAppContext();
      contextSummary = buildContextSummary(ctx);
    } catch {}

    const consoleEl = document.getElementById('console-output');
    const consoleLogs = consoleEl ? consoleEl.innerText.trim() : '';
    const cloneConsoleEl = document.getElementById('clone-console-output');
    const cloneConsoleLogs = cloneConsoleEl ? cloneConsoleEl.innerText.trim() : '';

    let logSummary = "";
    if (consoleLogs) {
      logSummary += `\n\nNhật ký Console Push:\n${consoleLogs.split('\n').slice(-30).join('\n')}`;
    }
    if (cloneConsoleLogs) {
      logSummary += `\n\nNhật ký Console Clone:\n${cloneConsoleLogs.split('\n').slice(-30).join('\n')}`;
    }

    if (!projectGuideContent) {
      try {
        projectGuideContent = await GetRawGuideContent();
      } catch {}
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (projectGuideContent) {
      messages.push({
        role: 'system',
        content: `Dưới đây là tài liệu hướng dẫn (HUONG_DAN.txt) của ứng dụng:\n\n${projectGuideContent}`
      });
    }

    messages.push({ 
      role: 'system', 
      content: `Bối cảnh hệ thống hiện tại:\n${contextSummary}${logSummary}` 
    });
    
    messages.push({ role: 'user', content: `Giải thích lỗi push này: "${errorMsg}" dựa trên nhật ký console trên.` });

    const response = await SendChatMessage(messages);
    removeLoading();

    if (response && response.content) {
      const content = response.content;
      const cleanContent = content.replace(/\n*<reasoning_tokens>\d+<\/reasoning_tokens>/, '');
      const reasoningMatch = content.match(/<reasoning_tokens>(\d+)<\/reasoning_tokens>/);
      const reasoningTokens = reasoningMatch ? parseInt(reasoningMatch[1]) : 0;

      addMessage(cleanContent, 'assistant', reasoningTokens);
      chatHistory.push({ role: 'user', content: `Lỗi push: ${errorMsg}` });
      chatHistory.push({ role: 'assistant', content: cleanContent });
    }
  } catch (err) {
    removeLoading();
    addMessage(`Lỗi: ${err.message || err}`, 'error');
  } finally {
    isLoading = false;
    setSendButtonState(false);
  }
}

export function setupChatInput() {
  const input = document.getElementById('chatInput');
  if (!input) return;

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  const container = document.getElementById('chatFabContainer');
  if (container) {
    makeElementDraggable(container);
  }

  setupPushErrorListener();
  setupChatResizer();
}

export async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isLoading) return;

  input.value = '';
  input.style.height = 'auto';

  // Add user message
  addMessage(text, 'user');

  // Show loading
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg assistant';
  loadingDiv.id = 'chat-loading-msg';
  loadingDiv.innerHTML = `
    <div class="chat-msg-label">AI</div>
    <div class="chat-msg-content">
      <div class="chat-typing"><span></span><span></span><span></span></div>
    </div>
  `;
  document.getElementById('chatMessages').appendChild(loadingDiv);
  scrollChat();

  isLoading = true;
  setSendButtonState(true);

  try {
    if (!projectGuideContent) {
      try {
        projectGuideContent = await GetRawGuideContent();
      } catch (err) {
        console.error('Không thể load tài liệu hướng dẫn:', err);
      }
    }

    // Build message history with system prompt
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (projectGuideContent) {
      messages.push({
        role: 'system',
        content: `Dưới đây là tài liệu hướng dẫn (HUONG_DAN.txt) của ứng dụng G-GitUpload. Khi người dùng hỏi về hướng dẫn sử dụng, cách hoạt động, các lỗi push/clone, cấu hình..., hãy dựa vào tài liệu này để trả lời chính xác nhất:\n\n${projectGuideContent}`
      });
    }

    messages.push(...chatHistory.slice(-20)); // Last 20 messages for context
    messages.push({ role: 'user', content: text });

    // Append app context and live console logs for awareness
    try {
      const ctx = await GetAppContext();
      const contextSummary = buildContextSummary(ctx);
      
      const consoleEl = document.getElementById('console-output');
      const consoleLogs = consoleEl ? consoleEl.innerText.trim() : '';
      const cloneConsoleEl = document.getElementById('clone-console-output');
      const cloneConsoleLogs = cloneConsoleEl ? cloneConsoleEl.innerText.trim() : '';

      let logSummary = "";
      if (consoleLogs) {
        logSummary += `\n\nNhật ký Console Push:\n${consoleLogs.split('\n').slice(-30).join('\n')}`;
      }
      if (cloneConsoleLogs) {
        logSummary += `\n\nNhật ký Console Clone:\n${cloneConsoleLogs.split('\n').slice(-30).join('\n')}`;
      }

      messages.push({ role: 'system', content: `Context hiện tại:\n${contextSummary}${logSummary}` });
    } catch { /* skip context if unavailable */ }

    const response = await SendChatMessage(messages);
    removeLoading();

    if (response && response.content) {
      const content = response.content;
      // Strip reasoning tokens if present
      const cleanContent = content.replace(/\n*<reasoning_tokens>\d+<\/reasoning_tokens>/, '');
      const reasoningMatch = content.match(/<reasoning_tokens>(\d+)<\/reasoning_tokens>/);
      const reasoningTokens = reasoningMatch ? parseInt(reasoningMatch[1]) : 0;

      addMessage(cleanContent, 'assistant', reasoningTokens);
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: cleanContent });
    }
  } catch (err) {
    removeLoading();
    addMessage(`Lỗi: ${err.message || err}`, 'error');
  } finally {
    isLoading = false;
    setSendButtonState(false);
  }
}

window.sendChatMessage = sendChatMessage;

export async function sendQuickQuery(query) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = query;
    await sendChatMessage();
  }
}
window.sendQuickQuery = sendQuickQuery;

function parseMarkdown(text) {
  // First escape HTML tags to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Headers: ### text, ## text, # text
  html = html.replace(/^### (.*$)/gim, '<h4 class="chat-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="chat-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="chat-h2">$1</h2>');

  // Bullet lists: - item, * item
  const lines = html.split('\n');
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const itemContent = line.substring(2);
      if (!inList) {
        lines[i] = '<ul class="chat-list"><li>' + itemContent + '</li>';
        inList = true;
      } else {
        lines[i] = '<li>' + itemContent + '</li>';
      }
    } else {
      if (inList) {
        lines[i - 1] = lines[i - 1] + '</ul>';
        inList = false;
      }
    }
  }
  if (inList) {
    lines[lines.length - 1] = lines[lines.length - 1] + '</ul>';
  }
  html = lines.join('\n');

  // Replace remaining new lines with <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

function addMessage(content, role, reasoningTokens = 0) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  const label = role === 'user' ? 'Bạn' : (role === 'error' ? 'Lỗi' : 'AI');
  const contentClass = role === 'error' ? '' : '';

  let reasoningHtml = '';
  if (reasoningTokens > 0) {
    reasoningHtml = `<div class="chat-reasoning">Reasoning: ${reasoningTokens} tokens</div>`;
  }

  // Parse markdown only for assistant, escape user/error messages
  const parsedContent = role === 'assistant' ? parseMarkdown(content) : escapeHtml(content);

  div.innerHTML = `
    <div class="chat-msg-label">${label}</div>
    <div class="chat-msg-content ${contentClass}">${parsedContent}</div>
    ${reasoningHtml}
  `;
  container.appendChild(div);
  scrollChat();
  return div;
}

function removeLoading() {
  const el = document.getElementById('chat-loading-msg');
  if (el) el.remove();
}

function setSendButtonState(loading) {
  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = loading;
}

function scrollChat() {
  const container = document.getElementById('chatMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

function buildContextSummary(ctx) {
  if (!ctx) return 'Không có thông tin.';
  const parts = [];
  if (ctx.config) {
    parts.push(`- GitHub: ${ctx.config.github_username || 'chưa cấu hình'}`);
    parts.push(`- Git available: ${ctx.git_available}`);
  }
  if (ctx.last_pushed_repo) {
    parts.push(`- Lần push cuối: ${ctx.last_pushed_repo.repo_name}`);
  }
  return parts.join('\n');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function setupPushErrorListener() {
  EventsOn('push_error', async (errorMsg) => {
    pendingErrorMsg = errorMsg;
    
    const badge = document.getElementById('chatFabBadge');
    const tooltip = document.getElementById('chatFabTooltip');
    
    if (badge) badge.style.display = 'flex';
    if (tooltip) {
      tooltip.style.display = 'block';
      setTimeout(() => {
        if (pendingErrorMsg === errorMsg) {
          tooltip.style.display = 'none';
        }
      }, 10000);
    }
  });
}

export function setupChatResizer() {
  const panel = document.getElementById('chatPanel');
  const resizer = document.getElementById('chatResizer');
  if (!panel || !resizer) return;

  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    let newWidth = window.innerWidth - e.clientX;
    const minWidth = 300;
    const maxWidth = window.innerWidth / 2;

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    panel.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}
