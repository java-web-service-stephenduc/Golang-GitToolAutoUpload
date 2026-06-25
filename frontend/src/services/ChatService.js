// Chat service - AI assistant
import { SendChatMessage, GetAppContext, GetRawGuideContent } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import { 
  isGreeting, isOffTopic, isVoiceQuery, isDeveloperQuery, 
  parseUserCommand, parseAgentAction, RESPONSES 
} from './chatRules.js';

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
4. Hỗ trợ người dùng tự động thực hiện tiến trình clone hoặc push mã nguồn khi được yêu cầu.

QUY TẮC QUAN TRỌNG:
- Tên của bạn là Stephen. Luôn xưng tên là Stephen hoặc trợ lý Stephen khi trả lời.
- Khi người dùng muốn hoặc ra lệnh cho bạn sao chép (clone) một repository nào đó, bạn hãy trả lời lịch sự xác nhận việc thực thi và BẮT BUỘC chèn thêm thẻ hành động ở cuối câu trả lời dạng: [AGENT_ACTION:clone:url=<repo_url>] (Ví dụ: [AGENT_ACTION:clone:url=https://github.com/user/repo.git]).
- Khi người dùng muốn hoặc ra lệnh cho bạn đẩy bài tập/push code, bạn hãy trả lời lịch sự xác nhận việc thực thi và BẮT BUỘC chèn thêm thẻ hành động ở cuối câu trả lời dạng: [AGENT_ACTION:push] hoặc [AGENT_ACTION:push:folder=<folder_path>] nếu họ có nhắc đến đường dẫn thư mục.
- Khi người dùng hỏi "Ai phát triển công cụ này?", "Công cụ này do ai viết?", hoặc các câu hỏi tương tự về tác giả/nhà phát triển dự án, bạn phải trả lời chính xác rằng: Công cụ được phát triển bởi tác giả Stephen. Đồng thời cung cấp đầy đủ liên kết repository public và thông tin liên hệ sau ở định dạng Markdown:
  * Repo Link: https://github.com/java-web-service-stephenduc/Golang-GitToolAutoUpload
  * Tác giả: Stephen
  * Vai trò: Full-stack Developer (Rikkei, Vietnam)
  * Email: tranducanh31032006@gmail.com
  * Facebook: https://facebook.com/stephen.uc.2025
- Khi người dùng muốn bạn xóa (delete) repository hoặc hỏi cách xóa: Hãy trả lời rằng ứng dụng hỗ trợ nút Xóa (Delete) trực tiếp ở danh sách tìm kiếm repository (tab Tìm kiếm), thao tác này sẽ kích hoạt modal xác nhận đơn giản không cần nhập mật khẩu/khóa (delete key) gì cả. Stephen không thể tự động xóa repository qua API chat được mà người dùng cần nhấn trực tiếp nút Xóa trên UI.
- Từ chối trả lời tất cả các câu hỏi không liên quan đến ứng dụng G-GitUpload, lập trình Git/GitHub, hoặc bài tập của dự án. Ví dụ, nếu người dùng hỏi về danh nhân, cầu thủ bóng đá ("Messi sinh năm bao nhiêu", "thời tiết hôm nay"), lịch sử, địa lý... hãy trả lời lịch sự rằng: "Stephen chỉ hỗ trợ các câu hỏi liên quan đến công cụ G-GitUpload và quy trình quản lý mã nguồn Git/GitHub. Vui lòng hỏi câu hỏi liên quan."
- Trả lời bằng tiếng Việt ngắn gọn, súc tích (2-4 câu).`;

let pendingErrorMsg = '';

export function clearPendingError() {
  pendingErrorMsg = '';
  const badge = document.getElementById('chatFabBadge');
  const tooltip = document.getElementById('chatFabTooltip');
  if (badge) badge.style.display = 'none';
  if (tooltip) tooltip.style.display = 'none';
}

export function toggleChatPanel() {
  isChatOpen = !isChatOpen;
  document.getElementById('chatPanel').classList.toggle('open', isChatOpen);
  document.getElementById('chatOverlay').classList.toggle('open', isChatOpen);
  
  if (isChatOpen) {
    document.getElementById('chatInput').focus();
    
    // Auto-diagnose if there is a pending error message when chat opens
    if (pendingErrorMsg) {
      const errorMsg = pendingErrorMsg;
      clearPendingError();
      triggerDiagnostics(errorMsg);
    }
  }
}

window.toggleChatPanel = toggleChatPanel;

export function handleAiFabClick() {
  toggleChatPanel();
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
    <div class="chat-msg-label">Stephen</div>
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

    if (response && response.content && response.content.trim() !== '') {
      const content = response.content;
      const cleanContent = content.replace(/\n*<reasoning_tokens>\d+<\/reasoning_tokens>/, '');
      const reasoningMatch = content.match(/<reasoning_tokens>(\d+)<\/reasoning_tokens>/);
      const reasoningTokens = reasoningMatch ? parseInt(reasoningMatch[1]) : 0;

      addMessage(cleanContent, 'assistant', reasoningTokens);
      chatHistory.push({ role: 'user', content: `Lỗi push: ${errorMsg}` });
      chatHistory.push({ role: 'assistant', content: cleanContent });
    } else {
      throw new Error("Không có câu trả lời.");
    }
  } catch (err) {
    console.error("Diagnostics error:", err);
    removeLoading();
    addMessage(`Xin vui lòng hỏi lại, hoặc trợ lý đang bị quá tải, bạn hãy gửi lại câu hỏi.`, 'error');
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

  // 0. Check for pending push confirmation
  if (window.__pendingAgentPushFolder) {
    const cleanText = text.toLowerCase().trim();
    if (cleanText === 'bắt đầu' || cleanText === 'push' || cleanText === 'ok' || cleanText === 'tiếp tục' || cleanText === 'xác nhận') {
      const folder = window.__pendingAgentPushFolder;
      window.__pendingAgentPushFolder = null; // clear state
      executePushWithCurrentUiValues(folder);
      return;
    }
  }

  // 1. Check direct user commands
  const userCmd = parseUserCommand(text);
  if (userCmd) {
    if (userCmd.action === 'clone') {
      runAgentClone(userCmd.url);
      return;
    } else if (userCmd.action === 'push') {
      runAgentPush(userCmd.folder);
      return;
    }
  }

  // 2. Check static rules
  if (isGreeting(text)) {
    addMessage(RESPONSES.greeting, 'assistant');
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: RESPONSES.greeting });
    return;
  }
  
  if (isOffTopic(text)) {
    addMessage(RESPONSES.offTopic, 'assistant');
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: RESPONSES.offTopic });
    return;
  }

  if (isDeveloperQuery(text)) {
    addMessage(RESPONSES.developer, 'assistant');
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: RESPONSES.developer });
    return;
  }

  if (isVoiceQuery(text)) {
    addMessage(RESPONSES.voiceSupport, 'assistant');
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: RESPONSES.voiceSupport });
    return;
  }

  // Show loading
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg assistant';
  loadingDiv.id = 'chat-loading-msg';
  loadingDiv.innerHTML = `
    <div class="chat-msg-label">Stephen</div>
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

    if (response && response.content && response.content.trim() !== '') {
      const content = response.content;
      // Strip reasoning tokens if present
      const cleanContent = content.replace(/\n*<reasoning_tokens>\d+<\/reasoning_tokens>/, '');
      const reasoningMatch = content.match(/<reasoning_tokens>(\d+)<\/reasoning_tokens>/);
      const reasoningTokens = reasoningMatch ? parseInt(reasoningMatch[1]) : 0;

      // Check for agent actions
      const agentAction = parseAgentAction(cleanContent);
      if (agentAction) {
        const displayContent = cleanContent.replace(/\[AGENT_ACTION:[^\]]+\]/g, '').trim();
        addMessage(displayContent, 'assistant', reasoningTokens);
        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: displayContent });

        if (agentAction.action === 'clone') {
          runAgentClone(agentAction.url, agentAction.dest);
        } else if (agentAction.action === 'push') {
          runAgentPush(agentAction.folder);
        }
      } else {
        addMessage(cleanContent, 'assistant', reasoningTokens);
        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: cleanContent });
      }
    } else {
      throw new Error("Không có câu trả lời.");
    }
  } catch (err) {
    console.error("Chat error:", err);
    removeLoading();
    addMessage(`Xin vui lòng hỏi lại, hoặc trợ lý đang bị quá tải, bạn hãy gửi lại câu hỏi.`, 'error');
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

export async function runAgentClone(repoUrl, destPath = '') {
  addMessage("🤖 **Stephen Agent**: Bắt đầu chuẩn bị tiến trình clone...", "assistant");
  
  let targetPath = destPath;
  if (!targetPath) {
    targetPath = document.getElementById('clone-dest-path')?.value || '';
  }
  
  if (!targetPath) {
    addMessage("🤖 **Stephen Agent**: Chưa chọn thư mục lưu trữ. Đang mở hộp thoại chọn thư mục...", "assistant");
    try {
      const { SelectDirectory } = await import('../../wailsjs/go/main/App');
      targetPath = await SelectDirectory();
      if (!targetPath) {
        addMessage("❌ **Lỗi**: Bạn đã hủy chọn thư mục. Không thể tiến hành clone.", "error");
        return;
      }
      const destInput = document.getElementById('clone-dest-path');
      if (destInput) destInput.value = targetPath;
    } catch (err) {
      addMessage(`❌ **Lỗi chọn thư mục**: ${err}`, "error");
      return;
    }
  }
  
  let repoName = '';
  const m = repoUrl.match(/\/([^/]+)\.git$/);
  repoName = m ? m[1] : repoUrl.split('/').pop();
  repoName = repoName.replace(/[^a-zA-Z0-9._-]/g, '');
  const finalFolderPath = targetPath.replace(/\\/g, '/') + '/' + repoName;

  addMessage(`🤖 **Stephen Agent**: Bắt đầu clone \`${repoUrl}\` vào thư mục \`${finalFolderPath}\`...`, "assistant");
  
  const logDiv = addMessage("⌛ **Tiến trình clone**:<br><code style=\"font-size:11px; display:block; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px; font-family:monospace; white-space:pre-wrap;\">Đang kết nối...</code>", "assistant");
  const logContentEl = logDiv.querySelector('.chat-msg-content');
  
  let logs = [];
  const updateLogs = (msg) => {
    logs.push(msg);
    if (logs.length > 8) logs.shift();
    logContentEl.innerHTML = `⌛ **Tiến trình clone**:<br><code style="font-size:11px; display:block; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px; font-family:monospace; white-space:pre-wrap;">${logs.join('\n')}</code>`;
    scrollChat();
  };
  
  const { EventsOn } = await import('../../wailsjs/runtime/runtime.js');
  const removeLogListener = EventsOn('clone_log', (msg) => {
    updateLogs(msg);
  });
  
  try {
    const { StartClone } = await import('../../wailsjs/go/main/App');
    await StartClone(repoUrl, finalFolderPath);
    removeLogListener();
    logContentEl.innerHTML = `✅ **Clone thành công!**<br>Đã tải về thư mục: \`${finalFolderPath}\``;
    if (window.switchTab) window.switchTab('clone-tab');
  } catch (err) {
    removeLogListener();
    logContentEl.innerHTML = `❌ **Clone thất bại!**<br>Lỗi: <span style="color:var(--accent-red);">${err}</span>`;
  }
}

export async function runAgentPush(folderPath = '') {
  let targetPath = folderPath;
  if (!targetPath) {
    targetPath = document.getElementById('folder-path-display')?.innerText || '';
    if (targetPath.includes("Kéo & thả") || targetPath.includes("Click để chọn")) {
      targetPath = '';
    }
  }
  
  if (!targetPath) {
    addMessage("🤖 **Stephen Agent**: Chưa chọn thư mục nộp bài. Đang mở hộp thoại chọn thư mục...", "assistant");
    try {
      const { SelectDirectory } = await import('../../wailsjs/go/main/App');
      targetPath = await SelectDirectory();
      if (!targetPath) {
        addMessage("❌ **Lỗi**: Bạn đã hủy chọn thư mục. Không thể tiến hành push.", "error");
        return;
      }
    } catch (err) {
      addMessage(`❌ **Lỗi chọn thư mục**: ${err}`, "error");
      return;
    }
  }

  // Switch to push tab and set path
  if (window.switchTab) window.switchTab('push-tab');
  
  const { setSelectedFolder } = await import('./PushService.js');
  setSelectedFolder(targetPath);

  addMessage(`🤖 **Stephen Agent**: Đã chọn thư mục: \`${targetPath}\` và chuyển sang tab **Đẩy bài tập**.
Vui lòng **chọn chế độ upload và điền các thông tin** (số buổi, bài tập hoặc tên repository) trực tiếp trên giao diện tab Đẩy bài tập.
Khi điền xong, hãy gõ **"bắt đầu"** / **"push"** (hoặc nhấn nút **Bắt đầu Push** trên màn hình) để tôi tiến hành đẩy code theo cấu hình bạn chọn.`, "assistant");
  
  window.__pendingAgentPushFolder = targetPath;
}

export async function executePushWithCurrentUiValues(targetPath) {
  const mode = document.getElementById('mode-selector')?.value || 'SESSION_EX';
  const sessionVal = document.getElementById('session-num')?.value || '';
  const exVal = document.getElementById('ex-num')?.value || '';
  const miniProjectVal = document.getElementById('miniproject-text')?.value || '';
  const customRepoName = document.getElementById('custom-repo-name')?.value || '';
  const useDefaultCommit = document.getElementById('toggle-default-commit')?.checked ?? true;
  const customCommitMsg = document.getElementById('custom-commit-msg')?.value || 'Automated commit by Stephen AI Agent';

  // Validation
  if (mode === 'SESSION_EX') {
    if (!sessionVal || !exVal) {
      addMessage("❌ **Lỗi**: Vui lòng điền số Session và Exercise trên giao diện tab Đẩy bài tập trước khi xác nhận push.", "error");
      window.__pendingAgentPushFolder = targetPath; // restore state
      return;
    }
  } else if (mode === 'MINI_PROJECT') {
    if (!sessionVal || !miniProjectVal) {
      addMessage("❌ **Lỗi**: Vui lòng điền số Session và tên Miniproject trên giao diện tab Đẩy bài tập trước khi xác nhận push.", "error");
      window.__pendingAgentPushFolder = targetPath;
      return;
    }
  } else if (mode === 'CUSTOM_REPOSITORY') {
    if (!customRepoName) {
      addMessage("❌ **Lỗi**: Vui lòng điền tên Repository tùy chỉnh trên giao diện tab Đẩy bài tập trước khi xác nhận push.", "error");
      window.__pendingAgentPushFolder = targetPath;
      return;
    }
  }

  addMessage(`🤖 **Stephen Agent**: Đang bắt đầu tiến trình đẩy bài lên GitHub với cấu hình đã điền...`, "assistant");
  
  const logDiv = addMessage("⌛ **Tiến trình push**:<br><code style=\"font-size:11px; display:block; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px; font-family:monospace; white-space:pre-wrap;\">Đang kết nối...</code>", "assistant");
  const logContentEl = logDiv.querySelector('.chat-msg-content');
  
  let logs = [];
  const updateLogs = (msg) => {
    logs.push(msg);
    if (logs.length > 8) logs.shift();
    logContentEl.innerHTML = `⌛ **Tiến trình push**:<br><code style="font-size:11px; display:block; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px; font-family:monospace; white-space:pre-wrap;">${logs.join('\n')}</code>`;
    scrollChat();
  };
  
  const { EventsOn } = await import('../../wailsjs/runtime/runtime.js');
  const removeLogListener = EventsOn('git_log', (msg) => {
    updateLogs(msg);
  });
  
  try {
    const { StartPush } = await import('../../wailsjs/go/main/App');
    await StartPush(
      targetPath, mode, sessionVal, exVal,
      miniProjectVal, customRepoName, useDefaultCommit, customCommitMsg
    );
    removeLogListener();
    logContentEl.innerHTML = `✅ **Push thành công!**<br>Mã nguồn đã được đẩy lên GitHub thành công.`;
    if (window.switchTab) window.switchTab('push-tab');
  } catch (err) {
    removeLogListener();
    logContentEl.innerHTML = `❌ **Push thất bại!**<br>Lỗi: <span style="color:var(--accent-red);">${err}</span>`;
  }
}

function parseMarkdown(text) {
  // First escape HTML tags to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Markdown links: [Text](URL)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" class="chat-link" target="_blank">$1</a>');

  // Raw URLs: match http/https URL that is not preceded by href=" or href='
  html = html.replace(/(^|[^"'])(https?:\/\/[^\s<>\)\*]+)/g, (match, prefix, url) => {
    if (prefix.trim().endsWith('href=') || prefix.trim().endsWith('src=')) {
      return match;
    }
    return prefix + `<a href="${url}" class="chat-link" target="_blank">${url}</a>`;
  });

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

export function addMessage(content, role, reasoningTokens = 0) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  const label = role === 'user' ? 'Bạn' : (role === 'error' ? '<i data-lucide="alert-circle" style="width:16px;height:16px;color:var(--accent-red);stroke-width:2.5;display:inline-block;vertical-align:middle;"></i>' : 'Stephen');
  const contentClass = role === 'error' ? '' : '';

  let reasoningHtml = '';
  if (reasoningTokens > 0) {
    reasoningHtml = `<div class="chat-reasoning">Reasoning: ${reasoningTokens} tokens</div>`;
  }

  // Parse markdown only for assistant, escape user/error messages
  const parsedContent = role === 'assistant' ? parseMarkdown(content) : escapeHtml(content);

  if (role === 'user') {
    div.innerHTML = `
      <div class="chat-msg-label">${label}</div>
      <div class="chat-msg-content-wrapper">
        <div class="chat-msg-content ${contentClass}">${parsedContent}</div>
        <button class="chat-copy-btn" title="Sao chép câu hỏi">
          <i data-lucide="copy"></i>
        </button>
      </div>
      ${reasoningHtml}
    `;

    const copyBtn = div.querySelector('.chat-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          const icon = copyBtn.querySelector('i');
          if (icon) {
            icon.setAttribute('data-lucide', 'check');
            copyBtn.style.color = '#22c55e';
            if (window.lucide) window.lucide.createIcons();
            
            setTimeout(() => {
              icon.setAttribute('data-lucide', 'copy');
              copyBtn.style.color = '';
              if (window.lucide) window.lucide.createIcons();
            }, 2000);
          }
        }).catch(err => {
          console.error('Failed to copy text:', err);
        });
      });
    }
  } else {
    div.innerHTML = `
      <div class="chat-msg-label">${label}</div>
      <div class="chat-msg-content ${contentClass}">${parsedContent}</div>
      ${reasoningHtml}
    `;
  }

  container.appendChild(div);
  if (window.lucide) window.lucide.createIcons();
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

export function clearChatHistory() {
  chatHistory = [];
  pendingErrorMsg = '';
  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = `
      <div class="chat-msg assistant">
          <div class="chat-msg-label">Stephen</div>
          <div class="chat-msg-content">Chào bạn! Tôi là Stephen - trợ lý của G-GitUpload. Bạn có thể chọn nhanh một câu hỏi bên dưới hoặc tự nhập câu hỏi:</div>
          <div class="chat-quick-actions">
              <button class="quick-action-btn" onclick="sendQuickQuery('Xem hướng dẫn sử dụng')">📖 Hướng dẫn sử dụng</button>
              <button class="quick-action-btn" onclick="sendQuickQuery('Cách push bài tập lên GitHub')">🚀 Cách push bài tập</button>
              <button class="quick-action-btn" onclick="sendQuickQuery('Giải thích về Naming Pattern')">⚙️ Naming Pattern</button>
              <button class="quick-action-btn" onclick="sendQuickQuery('Làm sao để clone repo?')">📥 Cách clone repo</button>
              <button class="quick-action-btn" onclick="sendQuickQuery('Công cụ này do ai phát triển?')">👤 Tác giả phát triển?</button>
          </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
window.clearChatHistory = clearChatHistory;
