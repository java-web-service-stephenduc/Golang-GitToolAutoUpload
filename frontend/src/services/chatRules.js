// chatRules.js - AI assistant rules & intent handling

export const GREETINGS = [
  "xin chào", "hello", "hi", "chào bạn", "chào stephen", "chào trợ lý", "chào",
  "chào anh", "chào em", "chào ad", "chào admin", "stephen ơi", "chào bạn nha",
  "helo", "hey", "chào trợ lý stephen"
];

export const OFF_TOPIC_KEYWORDS = [
  "messi", "ronaldo", "bóng đá", "thời tiết", "đá bóng", "cầu thủ",
  "danh nhân", "lịch sử", "địa lý", "ca sĩ", "diễn viên", "phim", "nhạc",
  "sinh năm bao nhiêu", "bao nhiêu tuổi", "ở đâu", "mấy giờ", "ngày mai",
  "ăn gì", "uống gì", "yêu", "thích", "ghét", "chửi", "game", "chơi game",
  "thủ tướng", "tổng thống", "chính trị", "giá vàng", "đô la"
];

export const RESPONSES = {
  greeting: "Chào bạn! Stephen ở đây để hỗ trợ bạn. Hôm nay bạn cần trợ giúp gì về công cụ G-GitUpload hay quy trình đẩy bài lên GitHub?",
  offTopic: "Stephen chỉ hỗ trợ các câu hỏi liên quan đến công cụ G-GitUpload và quy trình quản lý mã nguồn Git/GitHub. Vui lòng đặt câu hỏi liên quan.",
  voiceSupport: "Ứng dụng G-GitUpload có hỗ trợ giọng nói bằng AI! Bạn có thể nhấn vào biểu tượng Microphone (Trợ lý Giọng nói) trong ứng dụng để nhập liệu bằng giọng nói cho tin nhắn commit (commit message) hoặc mô tả, giúp việc nộp bài trở nên nhanh chóng hơn.",
  developer: "Công cụ G-GitUpload được phát triển bởi tác giả Stephen. Dưới đây là thông tin chi tiết:\n\n* **Repo Link**: https://github.com/java-web-service-stephenduc/Golang-GitToolAutoUpload\n* **Tác giả**: Stephen\n* **Vai trò**: Full-stack Developer (Rikkei, Vietnam)\n* **Email**: tranducanh31032006@gmail.com\n* **Facebook**: https://facebook.com/stephen.uc.2025"
};

// Helper to normalize string for matching
function normalizeText(text) {
  return text.toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "") // remove punctuation
    .replace(/\s+/g, " "); // collapse spaces
}

export function isGreeting(text) {
  const clean = normalizeText(text);
  return GREETINGS.some(g => clean === g || clean.startsWith(g + ' ') || clean.endsWith(' ' + g));
}

export function isOffTopic(text) {
  const clean = text.toLowerCase().trim();
  
  // If it matches git, github, code, or development-related, it is NOT off-topic
  const isDevRelated = [
    "git", "github", "code", "push", "clone", "repo", "commit", "pattern", 
    "g-gitupload", "stephen", "tác giả", "thiết kế", "phát triển", "viết", 
    "tài liệu", "hướng dẫn", "giọng nói", "mic", "lỗi", "chức năng", "sử dụng",
    "hoạt động", "nhà phát triển", "email", "facebook", "đẩy bài", "bài tập"
  ].some(k => clean.includes(k));
  
  if (isDevRelated) return false;
  
  // Otherwise check if it has off-topic keywords
  return OFF_TOPIC_KEYWORDS.some(k => clean.includes(k));
}

export function isVoiceQuery(text) {
  const clean = normalizeText(text);
  return (
    (clean.includes("giọng nói") || clean.includes("voice") || clean.includes("micro") || clean.includes("mic") || clean.includes("nói")) &&
    (clean.includes("hỗ trợ") || clean.includes("có không") || clean.includes("dùng thế nào") || clean.includes("chức năng") || clean.includes("tính năng"))
  );
}

export function isDeveloperQuery(text) {
  const clean = normalizeText(text);
  return (
    clean.includes("ai phát triển") || 
    clean.includes("ai viết") || 
    clean.includes("tác giả") || 
    clean.includes("nhà phát triển") || 
    clean.includes("thông tin người đăng") ||
    clean.includes("ai lam ra") ||
    clean.includes("ai tạo ra")
  );
}

export function parseUserCommand(text) {
  const clean = text.trim();
  
  // Match "clone <url>"
  const cloneMatch = clean.match(/^clone\s+(https?:\/\/[^\s]+)$/i);
  if (cloneMatch) {
    return { action: 'clone', url: cloneMatch[1] };
  }
  
  // Match "push <folder>"
  const pushMatch = clean.match(/^push\s+(.+)$/i);
  if (pushMatch) {
    return { action: 'push', folder: pushMatch[1] };
  } else if (clean.toLowerCase() === 'push') {
    return { action: 'push' };
  }
  
  return null;
}

export function parseAgentAction(responseText) {
  // Pattern: [AGENT_ACTION:clone:url=...:dest=...] or [AGENT_ACTION:push:folder=...]
  const cloneMatch = responseText.match(/\[AGENT_ACTION:clone:url=([^:\]]+)(?::dest=([^\]]+))?\]/);
  if (cloneMatch) {
    return {
      action: 'clone',
      url: cloneMatch[1].trim(),
      dest: cloneMatch[2] ? cloneMatch[2].trim() : ''
    };
  }
  
  const pushMatch = responseText.match(/\[AGENT_ACTION:push:folder=([^\]]+)\]/);
  if (pushMatch) {
    return {
      action: 'push',
      folder: pushMatch[1].trim()
    };
  }
  
  // Support simpler form: [AGENT_ACTION:push]
  if (responseText.includes('[AGENT_ACTION:push]')) {
    return {
      action: 'push',
      folder: ''
    };
  }
  
  return null;
}
