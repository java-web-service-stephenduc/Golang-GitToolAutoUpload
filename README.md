# G-GitUpload - Tài Liệu Dự Án & Hướng Dẫn Sử Dụng

> [!NOTE]
> **Thông báo cập nhật: Phiên bản v1.4.0 (Bản phát hành chính thức)**
> Bản cập nhật **v1.4.0** chính thức phát hành, tích hợp thêm Trợ lý Stephen AI thông minh (hỗ trợ Clear Chat, Copy khi hover, Auto-diagnose lỗi push), Ẩn AI credentials trong Cài đặt và bổ sung Switch Bật/Tắt Trợ lý/Giọng nói, Đơn giản hóa xóa repository chỉ bằng một click confirm kết hợp kiểm tra quyền hạn tự động qua `GetTokenReport`, và chuyển đổi toàn bộ icon sang thư viện Lucide. Chi tiết xem tại tài liệu hướng dẫn phát hành [RELEASE_GUIDE.md](file:///f:/CNTT/Build/JavaToolGitAutoUpload/g-gitupload/RELEASE_GUIDE.md).

Dự án **G-GitUpload** là ứng dụng desktop hỗ trợ tự động hóa quy trình tạo repository trên GitHub, đẩy (push) mã nguồn bài tập từ máy cục bộ lên đám mây, và sao chép (clone) repository về máy kết hợp mở nhanh bằng các IDE phổ biến. Dự án được phát triển bằng ngôn ngữ **Go (Golang)** cho Backend và **HTML/CSS/JS (Vanilla)** cho Frontend thông qua framework **Wails**.

---

## 1. Chức Năng Phát Triển (Developer Features)

Đối với các lập trình viên phát triển và bảo trì dự án, ứng dụng được trang bị các tính năng kỹ thuật sau:

*   **Kiến trúc liên kết Wails Bindings**: Cho phép gọi trực tiếp các hàm xử lý hệ thống của Go từ Javascript thông qua cầu nối IPC hiệu năng cao, giảm thiểu boilerplate code.
*   **Cơ chế Hủy Tiến Trình (Cancelable Context)**: Sử dụng `context.Context` tích hợp sâu với `os/exec.CommandContext`. Khi người dùng yêu cầu hủy, toàn bộ tiến trình dòng lệnh `git` đang chạy ngầm sẽ lập tức bị chấm dứt một cách an toàn và dọn dẹp tài nguyên hệ thống.
*   **Stephen AI Agent & Chat Rules**:
    *   Tích hợp bộ quy tắc phân loại intent tĩnh để phản hồi tức thì các lời chào, từ chối câu hỏi ngoài lề, thông tin nhà phát triển, và thông tin hỗ trợ giọng nói mà không tiêu tốn API token.
    *   Cú pháp thẻ lệnh Agent `[AGENT_ACTION:...]` cho phép AI hướng dẫn và kích hoạt trực tiếp tiến trình clone/push ngay trong giao diện chat.
    *   Cải tiến biểu thức chính quy (regular expression) phân tích URL thô nhằm loại trừ ký tự `*` và `)` giúp render liên kết nằm trong phần in đậm markdown không bị lỗi dính kèm ký tự `**` vào link.
*   **Stream Log & Trích Xuất Tiến Độ Thực Thời**: 
    *   Tự động gộp luồng Stdout và Stderr của câu lệnh để phân tích dữ liệu.
    *   Sử dụng cơ chế quét nâng cao `SplitByNewlineOrCR` để phát hiện và xử lý ký tự carriage return (`\r`) được tạo ra bởi lệnh `git push --progress` và `git clone --progress`. Nhờ đó, ứng dụng trích xuất chính xác tiến độ phần trăm (%) từ dòng log gửi sự kiện cập nhật giao diện trong thời gian thực.
*   **Cấu Hình Phân Tầng Nâng Cao**: 
    *   Ưu tiên lưu trữ cài đặt người dùng tại đường dẫn hệ thống `%APPDATA%/GGitUpload/config.json`.
    *   Tự động chuyển đổi và nạp cấu hình dự phòng từ file `.env` ở thư mục hiện tại của ứng dụng thông qua bộ phân tích cú pháp thủ công (manual parser) viết bằng Go, không cần cài đặt thêm thư viện bên ngoài.
*   **Mã Hóa Token Trong Log**: Bộ lọc thông tin nhạy cảm tự động phát hiện và ẩn Token cá nhân (PAT) trước khi in ra bảng Console giám sát log của người dùng.
*   **Tối ưu hóa tài nguyên mạng (HTTP Connection Pooling)**: Sử dụng một thực thể `http.Client` dùng chung ở mức package để tái sử dụng kết nối TCP (Keep-Alive), tránh lãng phí socket hệ thống và tăng tốc độ kết nối GitHub API.
*   **Giải phóng bộ nhớ chủ động**: Tự động gọi trình dọn rác hệ thống `runtime.GC()` ngay sau khi kết thúc chuỗi tiến trình push để trả lại bộ nhớ Heap dư thừa cho Windows ngay lập tức.
*   **Khóa tiến trình duy nhất (Single Instance Lock)**: Sử dụng Named Mutex của Windows (`CreateMutexW`) thông qua gói `syscall` của Go để ngăn chặn chạy nhiều tiến trình cùng lúc, kết hợp gọi trực tiếp `MessageBoxW` để đưa ra thông báo cảnh báo cực kỳ gọn nhẹ trước khi Wails engine khởi động.
*   **Nhúng tài liệu hướng dẫn (Go Embed)**: Sử dụng `//go:embed HUONG_DAN.txt` để nhúng tài liệu hướng dẫn sử dụng tiếng Việt trực tiếp vào file thực thi tại thời điểm biên dịch, đảm bảo tài liệu hoạt động độc lập ngay cả khi offline.
*   **Quét và phát hiện IDE chạy ngầm**: Sử dụng cấu hình ẩn cửa sổ dòng lệnh (`HideWindow: true` và `CreationFlags: 0x08000000`) để chạy ngầm hoàn toàn các lệnh kiểm tra phiên bản IDE, tránh nháy cửa sổ CMD đen gây khó chịu cho người dùng.
*   **Trình chặn liên kết toàn cục (Global Link Interceptor)**: Lắng nghe sự kiện click trên toàn ứng dụng, tự động chuyển hướng các liên kết ngoài (`http://`, `https://`) mở trực tiếp trên trình duyệt Web mặc định của hệ điều hành.

---

## 2. Chức Năng Cho Người Dùng Cuối (End-User Features)

Người dùng cuối có thể thực hiện toàn bộ các thao tác quản lý và tự động hóa sau trên giao diện được sắp xếp theo trình tự hành vi tự nhiên:

*   **Sắp xếp Sidebar Tabs khoa học**: Giao diện được thiết kế theo luồng hành vi sử dụng của người học: **Đẩy bài tập** -> **Sao chép Repo (Clone)** -> **Tìm kiếm Repo** -> **Báo cáo GitHub** -> **Cách hoạt động (Hướng dẫn)** -> **Cài đặt**.
*   **Trợ Lý Stephen AI Thông Minh (Stephen AI Assistant) [MỚI]**:
    *   **Nút Clear Chat**: Cho phép xóa toàn bộ lịch sử trò chuyện và đưa khung chat trở về trạng thái chào mừng ban đầu bằng một click vào nút icon thùng rác ở header.
    *   **Tính năng Copy khi Hover**: Khi di chuột qua tin nhắn của chính mình (Bạn), một nút copy nhỏ sẽ xuất hiện. Nhấp vào nút sẽ sao chép tin nhắn vào clipboard kèm hiệu ứng tích xanh lá (`check`) trong 2 giây để xác nhận.
    *   **Tự động chẩn đoán lỗi**: Khi xảy ra lỗi push, bong bóng Stephen sẽ nhấp nháy badge đỏ có dấu chấm than tròn (`alert-circle`). Khi mở khung chat lên, Stephen tự động phân tích và đưa ra giải pháp khắc phục. Badge lỗi sẽ tự động biến mất khi người dùng chạy tiến trình mới.
    *   **Xử lý lỗi AI/API thân thiện**: Trong trường hợp API lỗi hoặc AI trả về rỗng, thay vì in ra log lỗi thô sơ, Stephen hiển thị thông báo cố định: *"Xin vui lòng hỏi lại, hoặc trợ lý đang bị quá tải, bạn hãy gửi lại câu hỏi."* kèm biểu tượng cảnh báo chấm than đỏ.
    *   **Tương tác kéo giãn (Resizer)**: Người dùng có thể kéo góc rộng của bảng chat mở rộng sang ngang lên đến tối đa 1/2 màn hình.
*   **Trang Cài Đặt và Voice Chat Tối Giản [MỚI]**:
    *   Ẩn cấu hình API Key và AI Model phức tạp, mặc định sử dụng OpenRouter.
    *   Thêm Switch **Bật/Tắt Trợ lý Stephen AI** và **Bật/Tắt Trợ lý Giọng nói**, mặc định bật và lưu trạng thái vào `localStorage`. UI của các tính năng này sẽ ẩn/hiện ngay lập tức khi người dùng thao tác gạt switch.
    *   **Trợ lý giọng nói (Microphone)**: Phát âm thanh câu cảnh báo tính năng đang phát triển qua loa máy tính, hiển thị Toast thông báo và tự động gửi tin nhắn giải thích vào Stephen AI.
*   **Đẩy bài tập tự động (Push Code)**:
    *   Kéo trực tiếp một thư mục bài tập từ Windows File Explorer thả vào vùng nhận diện trên giao diện, hoặc click trực tiếp để chọn thư mục.
    *   Hỗ trợ 3 chế độ đặt tên repository tự động: *Session + Exercise*, *Session + Miniproject*, hoặc *Custom Repository*.
    *   Tùy chọn commit message mẫu hoặc tùy chỉnh (mặc định ban đầu là `init`).
    *   Tự động dọn dẹp thư mục `.git` cục bộ sau khi đẩy code xong để tránh chiếm dụng tài nguyên.
*   **Sao chép Repository (Clone)**:
    *   Tự động tải danh sách các repository của tài khoản/tổ chức để clone chỉ bằng một click trong menu thả xuống.
    *   Hỗ trợ nhập link clone HTTPS thủ công cho các repository bên ngoài.
    *   Chọn vị trí lưu trữ trên đĩa cục bộ.
    *   **Tích hợp IDE Launcher**: Khi clone thành công, ứng dụng tự động kiểm tra hệ thống và hiện các nút mở nhanh thư mục bài tập vừa tải về qua các công cụ lập trình được cài đặt trên máy (**VS Code**, **IntelliJ**, **Cursor**, **Antigravity**) hoặc mở thư mục trực tiếp bằng Windows Explorer.
*   **Tìm kiếm & Quản lý Repository**:
    *   Tìm kiếm và lọc repository phân trang trực tiếp phía máy chủ GitHub API (12 repo/trang).
    *   Dropdown sắp xếp linh hoạt: Mặc định, Trống lên đầu (EMPTY repos first), Mới lên đầu.
    *   Nhãn trạng thái chuẩn xác: **[EMPTY]** (repo trống) và **[NEW]** (repo hoạt động trong 24 giờ qua).
    *   Trình duyệt File Explorer và xem README.md trực tiếp trên ứng dụng với giao diện được chuẩn hóa hoàn toàn bằng các icon Lucide hiện đại thay thế cho các emoji cũ.
    *   **Đơn giản hóa Xóa Repository**:
        *   Loại bỏ hoàn toàn Delete Repository Key khỏi cấu hình cài đặt. Khi người dùng click nút Xóa repository, modal confirm đơn giản sẽ hiện lên.
        *   Tích hợp chẩn đoán quyền hạn: Trước khi thực thi xóa repo trên GitHub, ứng dụng tự động gọi `GetTokenReport()`. Nếu Token thiếu quyền `delete_repo`, hệ thống sẽ chặn hành động và hiện Toast lỗi chi tiết.
*   **Báo cáo & Chẩn đoán kết nối**:
    *   Xem phân tích chi tiết các quyền (Scopes) của token PAT, rate limit còn lại của tài khoản GitHub, và dung lượng đĩa sử dụng đám mây.
*   **Tab hướng dẫn sử dụng "Cách hoạt động"**:
    *   Tự động phân tách tài liệu hướng dẫn tiếng Việt `HUONG_DAN.txt` thành nhiều phần nhỏ dựa trên các tiêu đề.
    *   Giao diện thiết kế theo **Thanh Tabs nằm ngang** gọn gàng. Người dùng có thể click từng tab để xem nhanh hướng dẫn tương ứng (Tổng quan, Lấy token, Thiết lập, Đẩy bài tập, Sao chép Repo, Báo cáo...).
*   **Trang Cài đặt nâng cao**:
    *   Thiết lập token GitHub PAT, username, organization, naming pattern, delete key, cấu hình git commit author (name/email), theme giao diện (Sáng/Tối/Hệ thống), và commit message mặc định.

---

## 3. Quy Trình Biên Dịch (Build) File Thực Thi (.exe)

Mở cửa sổ PowerShell hoặc Command Prompt tại thư mục gốc của dự án `g-gitupload` và chạy lệnh sau để biên dịch:

```powershell
$env:PATH="C:\Program Files\Go\bin;C:\Users\trand\go\bin;" + $env:PATH
wails build -clean -platform windows/amd64 -ldflags "-s -w -H=windowsgui"
```

*   `-clean`: Dọn dẹp các thư mục build cũ.
*   `-ldflags "-s -w"`: Loại bỏ thông tin gỡ lỗi để giảm dung lượng file exe (file xuất ra chỉ khoảng ~10-12 MB).
*   `-ldflags "-H=windowsgui"`: Ẩn hoàn toàn cửa sổ dòng lệnh đen (CMD) chạy nền khi khởi chạy ứng dụng GUI.

File exe sau khi build xong sẽ nằm tại: `g-gitupload/build/bin/g-gitupload.exe`.
