import { ProcessVoiceCommand, FindMatchingDirectory } from '../../wailsjs/go/main/App';
import { showToast } from '../components/Toast.js';
import { appendConsoleLog } from '../components/Console.js';
import { setSelectedFolder } from './PushService.js';
import { searchRepositories } from './SearchService.js';
import { toggleChatPanel } from './ChatService.js';

let recognition = null;
let isListening = false;

export function speak(text) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    window.speechSynthesis.speak(utterance);
  }
}

export function toggleVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Trình duyệt của bạn không hỗ trợ Nhận diện Giọng nói.', 'error');
    return;
  }

  const btn = document.getElementById('voiceToggleBtn');
  if (!btn) return;

  if (isListening) {
    stopListening();
  } else {
    startListening(SpeechRecognition, btn);
  }
}

function startListening(SpeechRecognition, btn) {
  recognition = new SpeechRecognition();
  recognition.lang = 'vi-VN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    btn.classList.add('listening');
    btn.querySelector('span').innerText = 'Đang nghe...';
    appendConsoleLog('Đang lắng nghe giọng nói của bạn...', 'info');
    speak('Tôi đang lắng nghe...');
  };

  recognition.onerror = (e) => {
    console.error('Lỗi nhận diện giọng nói:', e.error);
    if (e.error === 'no-speech') {
      showToast('Không phát hiện tiếng nói.', 'error');
    } else {
      showToast(`Lỗi giọng nói: ${e.error}`, 'error');
    }
    stopListening();
  };

  recognition.onend = () => {
    stopListening();
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    appendConsoleLog(`Bạn nói: "${transcript}"`, 'info');
    
    try {
      const result = await ProcessVoiceCommand(transcript);
      if (result) {
        handleVoiceActionResult(result);
      }
    } catch (err) {
      appendConsoleLog(`Lỗi xử lý lệnh giọng nói: ${err}`, 'error');
      showToast('Xử lý lệnh giọng nói thất bại', 'error');
    }
  };

  recognition.start();
}

function stopListening() {
  isListening = false;
  const btn = document.getElementById('voiceToggleBtn');
  if (btn) {
    btn.classList.remove('listening');
    btn.querySelector('span').innerText = 'Trợ lý Giọng nói';
  }
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
    recognition = null;
  }
}

async function handleVoiceActionResult(result) {
  const { action, params, response } = result;
  
  if (response) {
    speak(response);
    showToast(response, 'success');
  }

  switch (action) {
    case 'navigate':
      if (params && params.tab) {
        window.switchTab(params.tab);
      }
      break;

    case 'search':
      if (params && params.query) {
        window.switchTab('search-tab');
        const searchInput = document.getElementById('search-query');
        if (searchInput) {
          searchInput.value = params.query;
          searchRepositories(0); // Trigger search
        }
      }
      break;

    case 'clone':
      if (params && params.repo) {
        window.switchTab('clone-tab');
        // If custom source is chosen
        const segmentCustom = document.getElementById('btn-clone-src-custom');
        if (segmentCustom) {
          segmentCustom.click(); // Switch segment to custom URL
        }
        const urlInput = document.getElementById('clone-repo-url');
        if (urlInput) {
          urlInput.value = params.repo;
        }
      }
      break;

    case 'help':
      toggleChatPanel();
      break;

    case 'push':
      if (params && params.session) {
        window.switchTab('push-tab');
        
        // Fill session and exercise
        const sessionInput = document.getElementById('session-num');
        const exInput = document.getElementById('ex-num');
        if (sessionInput) sessionInput.value = params.session;
        if (exInput) exInput.value = params.ex || '1';

        // Trigger onModeChange to display the fields properly
        const modeSelector = document.getElementById('mode-selector');
        if (modeSelector) {
          modeSelector.value = 'SESSION_EX';
          window.onModeChange();
        }

        // Call backend FindMatchingDirectory to locate folder (Phase 4)
        appendConsoleLog(`Đang tìm thư mục cho Session ${params.session} Exercise ${params.ex || '1'}...`, 'info');
        try {
          const sNum = parseInt(params.session);
          const eNum = parseInt(params.ex || '1');
          
          const path = await FindMatchingDirectory(sNum, eNum);
          if (path) {
            setSelectedFolder(path);
            appendConsoleLog(`Định vị được thư mục bài tập tại: ${path}`, 'success');
            speak('Đã định vị được thư mục bài tập và chuẩn bị đẩy bài.');
            
            // Trigger push process after delay to allow GUI state to settle
            setTimeout(() => {
              appendConsoleLog('Bắt đầu tự động đẩy bài lên GitHub...', 'info');
              window.startPushProcess();
            }, 1000);
          }
        } catch (err) {
          const errorMsg = `Không tìm thấy thư mục phù hợp cho Session ${params.session} Bài ${params.ex || '1'}. Vui lòng chọn thủ công.`;
          appendConsoleLog(errorMsg, 'error');
          speak('Tôi không tìm thấy thư mục phù hợp cho buổi học này. Vui lòng chọn thủ công.');
          showToast(errorMsg, 'error');
        }
      }
      break;

    default:
      appendConsoleLog(`Lệnh không xác định: Action: ${action}`, 'error');
      break;
  }
}

window.toggleVoiceRecognition = toggleVoiceRecognition;
