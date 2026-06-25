# Kế hoạch tích hợp AI & Refactor G-GitUpload

## Mục tiêu
1. **Refactor** codebase theo MVC + Component để dễ maintain
2. **Tích hợp AI Chat** hướng dẫn người dùng, giải đáp lỗi push
3. **Voice Command** tự động push git bằng giọng nói
4. **Smart Directory** tìm đúng thư mục và tự động push

---

## Phase 0: Refactor (Đang thực hiện)

### Backend Go (MVC)
```
main.go              → Entry point (giữ nguyên)
app.go               → Core App struct, startup, binding gốc
push_service.go      → StartPush, CancelPush, formatRepoName, validate
clone_service.go     → StartClone, DetectIDEs, OpenInIDE
search_service.go    → SearchRepos, DeleteRepo, GetRepoContents, GetRepoReadme
system_service.go    → OpenBrowser, SelectDirectory, OpenDirectoryInExplorer, GetTokenReport
config/config.go     → Cấu hình (giữ nguyên)
git/runner.go        → Git operations (giữ nguyên)
github/client.go     → GitHub API (giữ nguyên)
history/tracker.go   → Lịch sử push (giữ nguyên)
```

### Frontend Vanilla JS (Component)
```
main.js                     → Entry point: khởi tạo, router tab, global events
services/
├── ConfigService.js        → Load/save settings, theme
├── PushService.js          → Push process, progress, console log
├── CloneService.js         → Clone process
├── SearchService.js        → Search repos, pagination, detail view
├── HistoryService.js       → Recent push widget
├── GitHubService.js        → Profile, IDE detection, report
├── VoiceService.js         → Web Speech API, voice → command
└── ChatService.js          → AI chat API calls, context collector
components/
├── Toast.js                → Toast notification
├── Modal.js                → Modal dialogs (success, delete confirm)
├── Console.js              → Console log panel
├── ProgressBar.js          → Progress bar
├── ProfileCard.js          → GitHub profile card
└── RepoCard.js             → Repository card rendering
views/
├── PushTab.js              → Push tab logic
├── CloneTab.js             → Clone tab logic
├── SearchTab.js            → Search tab logic
├── SettingsTab.js          → Settings tab logic
├── ReportTab.js            → Report/diagnostics tab
└── GuideTab.js             → Guide tab
```

---

## Phase 1: AI Chat

### Backend (Go)
| File | Binding | Mô tả |
|------|---------|-------|
| `ai_service.go` | `SendChatMessage(message, context string) (string, error)` | Gửi câu hỏi → OpenRouter API → trả lời |
| `ai_service.go` | `GetAppContext() (map[string]interface{}, error)` | Trả về trạng thái app hiện tại |
| `config/config.go` | Thêm field `AiApiKey`, `AiModel` | Lưu API key AI trong config |

### Frontend
| File | Mô tả |
|------|-------|
| `services/ChatService.js` | Gọi binding `SendChatMessage`, collect context |
| Thêm HTML + CSS trong index.html/style.css | Chat panel float bên phải |

### Kiến trúc Chat
```
[Chat input] → ChatService.send(text) → gọi backend SendChatMessage
                                         → backend gọi OpenRouter API
                                         → trả response → hiển thị
```

---

## Phase 2: Voice Command

### Frontend
| File | Mô tả |
|------|-------|
| `services/VoiceService.js` | `webkitSpeechRecognition` → parse transcript → gọi binding |
| Thêm nút mic trong index.html | Start/stop voice recognition |

### Cú pháp giọng nói
```
"push session 15 exercise 01"   → tự điền form + push
"clone repo <name>"              → clone repository
"search <query>"                 → tìm kiếm repo
"open settings"                  → chuyển tab settings
"help"                           → mở chat AI
```

### Backend
| File | Binding | Mô tả |
|------|---------|-------|
| `ai_service.go` | `ProcessVoiceCommand(transcript string) (VoiceResult, error)` | Parse transcript → action + params |

---

## Phase 3: Context-Aware AI

### Cơ chế
- Khi push lỗi, backend emit event `push_error`
- Frontend bắt event → tự động gửi context + lỗi tới AI
- AI trả lời nguyên nhân + cách khắc phục

### Context bao gồm
```json
{
  "lastError": "git push failed: ...",
  "config": { "github_username": "...", ... },
  "lastPushedRepo": { "repo_name": "...", "local_path": "..." },
  "gitAvailable": true,
  "isPushing": false,
  "mode": "SESSION_EX",
  "consoleLog": ["...", "..."]
}
```

---

## Phase 4: Smart Directory + Auto-Push

### Backend
| File | Binding | Mô tả |
|------|---------|-------|
| `ai_service.go` | `FindMatchingDirectory(sessionNum, exNum int) (string, error)` | Tìm thư mục phù hợp trên ổ đĩa |

### Cơ chế tìm kiếm
1. Kiểm tra `local_path` trong lịch sử push gần nhất
2. Quét các ổ đĩa tìm thư mục chứa pattern "sessionXX" hoặc "exXX"
3. Trả về đường dẫn tìm thấy (hoặc lỗi nếu không tìm thấy)

### Auto-Push flow
```
Voice/Text: "push session 15 ex 01"
    → FindMatchingDirectory(15, 1)
    → nếu tìm thấy → SelectDirectory trả về path → StartPush
    → nếu không → chat hỏi "thư mục nào?"
```

---

## Timeline đề xuất

| Phase | Nội dung | Thời gian |
|-------|----------|-----------|
| 0 | Refactor codebase | 2-3 ngày |
| 1 | AI Chat cơ bản | 2 ngày |
| 2 | Voice Command | 1-2 ngày |
| 3 | Context-Aware AI | 1 ngày |
| 4 | Smart Directory + Auto-Push | 1-2 ngày |
