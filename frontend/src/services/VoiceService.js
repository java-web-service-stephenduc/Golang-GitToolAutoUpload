import { showToast } from '../components/Toast.js';
import { toggleChatPanel, addMessage } from './ChatService.js';

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
  const msg = "Tính năng này đang trong quá trình phát triển, bạn có thể nhờ trợ lý Stephen của công cụ này hỗ trợ.";
  
  // 1. Show Toast
  showToast(msg, 'info');
  
  // 2. Speak out loud
  speak(msg);
  
  // 3. Open chat and display message
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) {
    if (!chatPanel.classList.contains('open')) {
      toggleChatPanel();
    }
    addMessage(msg, 'assistant');
  }
}

window.toggleVoiceRecognition = toggleVoiceRecognition;
