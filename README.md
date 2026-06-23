# G-GitUpload - Tài Liệu Dự Án & Hướng Dẫn Sử Dụng

> [!NOTE]
> **Thông báo cập nhật: Phiên bản v1.3.0 (Bản phát hành chính thức)**
> Bản cập nhật **v1.3.0** chính thức phát hành, tích hợp thêm tính năng Sao chép Repo (Clone) thông minh, IDE Launcher chạy ẩn hoàn toàn, cải tiến toàn diện giao diện Tabs Hướng dẫn nằm ngang, Modal xác nhận xóa an toàn bằng Delete Key, và đồng bộ tự động lưu cấu hình Theme. Chi tiết xem tại tài liệu hướng dẫn phát hành [RELEASE_GUIDE.md](file:///f:/CNTT/Build/JavaToolGitAutoUpload/g-gitupload/RELEASE_GUIDE.md).

Dự án **G-GitUpload** là ứng dụng desktop hỗ trợ tự động hóa quy trình tạo repository trên GitHub, đẩy (push) mã nguồn bài tập từ máy cục bộ lên đám mây, và sao chép (clone) repository về máy kết hợp mở nhanh bằng các IDE phổ biến. Dự án được phát triển bằng ngôn ngữ **Go (Golang)** cho Backend và **HTML/CSS/JS (Vanilla)** cho Frontend thông qua framework **Wails**.

---

## 1. Chức Năng Phát Triển (Developer Features)

Đối với các lập trình viên phát triển và bảo trì dự án, ứng dụng được trang bị các tính năng kỹ thuật sau:

*   **Kiến trúc liên kết Wails Bindings**: Cho phép gọi trực tiếp các hàm xử lý hệ thống của Go từ Javascript thông qua cầu nối IPC hiệu năng cao, giảm thiểu boilerplate code.
*   **Cơ chế Hủy Tiến Trình (Cancelable Context)**: Sử dụng `context.Context` tích hợp sâu với `os/exec.CommandContext`. Khi người dùng yêu cầu hủy, toàn bộ tiến trình dòng lệnh `git` đang chạy ngầm sẽ lập tức bị chấm dứt một cách an toàn và dọn dẹp tài nguyên hệ thống.
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
*   **Tải tài liệu trực tuyến linh hoạt**: Tự động kết nối tải file `HUONG_DAN.txt` trực tuyến từ repository GitHub gốc (`java-web-service-stephenduc/Golang-GitToolAutoUpload`) qua các nhánh `main` và `master`. Nếu thất bại, hệ thống tự động fall back về file nhúng cục bộ.
*   **Quét và phát hiện IDE chạy ngầm**: Sử dụng cấu hình ẩn cửa sổ dòng lệnh (`HideWindow: true` và `CreationFlags: 0x08000000`) để chạy ngầm hoàn toàn các lệnh kiểm tra phiên bản IDE, tránh nháy cửa sổ CMD đen gây khó chịu cho người dùng.
*   **Trình chặn liên kết toàn cục (Global Link Interceptor)**: Lắng nghe sự kiện click trên toàn ứng dụng, tự động chuyển hướng các liên kết ngoài (`http://`, `https://`) mở trực tiếp trên trình duyệt Web mặc định của hệ điều hành.

---

## 2. Chức Năng Cho Người Dùng Cuối (End-User Features)

Người dùng cuối có thể thực hiện toàn bộ các thao tác quản lý và tự động hóa sau trên giao diện được sắp xếp theo trình tự hành vi tự nhiên:

*   **Sắp xếp Sidebar Tabs khoa học**: Giao diện được thiết kế theo luồng hành vi sử dụng của người học: **Đẩy bài tập** -> **Sao chép Repo (Clone)** -> **Tìm kiếm Repo** -> **Báo cáo GitHub** -> **Cách hoạt động (Hướng dẫn)** -> **Cài đặt**.
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
    *   Tìm kiếm và lọc repository phân trang trực tiếp phía máy chủ GitHub API (12 repo/trang), đảm bảo tính ổn định và tốc độ tối đa.
    *   Hỗ trợ đếm chính xác tổng số repository cho cả tài khoản cá nhân và tài khoản tổ chức (Organization).
    *   Dropdown sắp xếp linh hoạt: Mặc định (theo cập nhật của GitHub), Trống lên đầu (EMPTY repos first), Mới lên đầu.
    *   Nhãn trạng thái chuẩn xác: **[EMPTY]** (repo trống, default_branch chưa khởi tạo) và **[NEW]** (repo có hoạt động trong 24 giờ qua).
    *   Trình duyệt File Explorer và xem README.md trực tiếp trên ứng dụng với chiều cao khung hình cố định (max-height) chống tràn giao diện.
    *   **Logic nút Tìm kiếm / Xóa thông minh**: Chỉ khi người dùng bấm nút tìm kiếm (hoặc ấn `Enter`), nút hành động mới chuyển sang nút "Xóa" để dọn sạch kết quả.
    *   **Modal xác nhận xóa tùy chỉnh**: Thay thế hộp thoại prompt thô sơ của trình duyệt bằng Modal giao diện đẹp mắt, yêu cầu nhập Delete Key đã thiết lập để xác nhận xóa an toàn.
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
