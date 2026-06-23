# Hướng Dẫn Tạo New Release Trên GitHub Cho G-GitUpload v1.3.0

Tài liệu này hướng dẫn chi tiết cách điền các thông tin khi tạo một **New Release** (Bản phát hành mới) trên trang GitHub cho dự án **G-GitUpload** (phiên bản v1.3.0).

---

## Các Bước Thực Hiện Trên GitHub

### 1. Truy cập trang Releases
1. Trên trang kho lưu trữ GitHub của bạn, nhìn sang cột bên phải và nhấp vào mục **Releases** (hoặc truy cập trực tiếp bằng cách thêm `/releases` vào cuối URL repo).
2. Nhấp vào nút **Draft a new release**.

---

### 2. Điền Thông Tin Release

Dưới đây là cách điền chi tiết cho từng trường thông tin:

#### 📌 Choose a tag (Chọn hoặc tạo Tag)
> **Tag** là nhãn đánh dấu phiên bản mã nguồn của bạn tại thời điểm đó.
* **Cách điền**: Gõ vào ô và tạo tag mới là `v1.3.0`.
* **Target**: Chọn nhánh `main` (mặc định).
* *Lưu ý*: Nên tuân theo chuẩn Semantic Versioning (`v[Major].[Minor].[Patch]`). Vì đây là bản phát hành tích hợp toàn bộ các tính năng cốt lõi và tối ưu hóa hệ thống từ các đợt phát triển trước đến nay, ta đặt là `v1.3.0`.

#### 📌 Release title (Tiêu đề bản phát hành)
> Tiêu đề ngắn gọn hiển thị nổi bật trên trang release.
* **Mẫu đề xuất**: 
  ```text
  G-GitUpload v1.3.0 - Bản phát hành chính thức: Tích hợp Clone Repository, Tự động hóa IDE & Tối ưu hóa Hệ thống Toàn diện
  ```

#### 📌 Release description (Mô tả chi tiết)
> Liệt kê toàn bộ các tính năng mới, cải tiến, tối ưu hóa hệ thống và sửa lỗi trong phiên bản này. Bạn có thể sử dụng mẫu Markdown dưới đây:

**Sao chép nội dung bên dưới và dán vào ô mô tả:**
```markdown
## 🚀 Bản phát hành chính thức G-GitUpload (v1.3.0)

Bản phát hành v1.3.0 là cột mốc quan trọng tích hợp toàn bộ các tính năng tự động hóa quy trình đẩy (push) code bài tập, sao chép (clone) repository, quản lý repo trực quan, cùng các cơ chế tối ưu hóa tài nguyên và hiệu năng hệ thống triệt để trên Windows.

---

### 🌟 1. Các Tính Năng Người Dùng Mới & Cải Tiến UI/UX:
* **Tab Sao chép Repo (Clone Repository) [MỚI]**:
  - Hỗ trợ tải trực tiếp repository từ tài khoản cá nhân/tổ chức qua menu dropdown tự động hoặc nhập URL HTTPS thủ công.
  - Sử dụng thanh trượt phân đoạn (Segmented Control) thay thế cho radio buttons truyền thống giúp giao diện mượt mà, không bị vỡ bố cục hay chớp tắt màn hình khi thao tác.
  - Ghi nhận và stream trực quan tiến độ tải về (%) theo thời gian thực cùng log console.
  - **IDE Launcher Tích Hợp**: Sau khi clone thành công, hệ thống tự động quét ngầm (không hiển thị cửa sổ CMD đen) để phát hiện các công cụ lập trình có sẵn trên máy (**VS Code**, **IntelliJ IDEA**, **Cursor**, **Antigravity**) và cung cấp nút bấm mở dự án tức thì hoặc mở thư mục qua Windows Explorer.
* **Tab Hướng Dẫn "Cách Hoạt Động" Mới**:
  - Tải tự động tài liệu hướng dẫn tiếng Việt từ repository gốc trực tuyến (tự động fallback về file nhúng cục bộ trong ứng dụng nếu không có mạng).
  - Tự động phân tích và chia nhỏ tài liệu hướng dẫn thành cấu trúc **Thanh Tabs nằm ngang** gọn gàng, trực quan.
* **Modal Xác Nhận Xóa Repository Tùy Chỉnh**:
  - Loại bỏ hoàn toàn hộp thoại prompt của trình duyệt WebView. Thay vào đó là một Modal giao diện đẹp mắt, an toàn, chỉ yêu cầu người dùng nhập đúng `Delete Key` đã cấu hình để xác thực hành động xóa.
* **Nút Tìm Kiếm / Xóa Thông Minh**:
  - Ô nhập tìm kiếm tích hợp nút hành động thông minh: Khi người dùng bấm Tìm kiếm hoặc ấn `Enter`, nút mới chuyển sang trạng thái "Xóa" để hỗ trợ dọn sạch ô nhập và danh sách kết quả nhanh chóng.
* **Phân Trang Tìm Kiếm Phía Máy Chủ GitHub API**:
  - Sửa lỗi giới hạn 100 repo khi hiển thị danh sách trống. Phân trang được đẩy trực tiếp lên GitHub API (12 repo/trang) và hỗ trợ đếm chính xác số lượng repo của cả tài khoản cá nhân lẫn tổ chức (Organization).
* **Mở Liên Kết Ngoài Bằng Trình Duyệt Hệ Thống**:
  - Trình chặn liên kết toàn cục đảm bảo toàn bộ liên kết `http`/`https` trong ứng dụng tự động được mở bằng trình duyệt Web mặc định của Windows thay vì chạy trong Wails webview.
* **Tự Động Lưu Theme**:
  - Lựa chọn Theme (Sáng/Tối/Hệ thống) trong cài đặt sẽ lập tức được lưu trữ vào cấu hình và áp dụng ngay mà không cần bấm nút Lưu thủ công.

---

### ⚙️ 2. Các Cải Tiến & Tối Ưu Hóa Hệ Thống Triệt Để:
* **Tự Động Dọn Dẹp Thư Mục Cục Bộ (Auto Disk Cleanup)**:
  - Tích hợp khối lệnh trì hoãn (`defer`) chạy trong mọi tình huống (thành công, lỗi hoặc người dùng bấm Hủy) để tự động xóa sạch thư mục `.git` tạm thời được tạo ra trong thư mục bài tập của học viên, giải phóng dung lượng đĩa lập tức.
* **Ngăn Chặn Tiến Trình Git Chạy Ngầm (Zero Zombie Processes)**:
  - Tự động cấu hình `gc.auto 0` cho repository ngay sau khi khởi tạo. Tránh hoàn toàn việc Git tự kích hoạt bộ dọn rác chạy ngầm và khóa thư mục hoặc chạy vô hạn sau khi phần mềm đã đóng.
* **Chống Treo Ứng Dụng Khi Lỗi Xác Thực (Fail-Fast execution)**:
  - Truyền biến môi trường `GIT_TERMINAL_PROMPT=0` vào tất cả các lệnh Git để tiến trình push/clone thất bại và dừng lại ngay lập tức thay vì bị treo vô hạn chờ nhập liệu ở chế độ nền.
* **Tối Ưu Hóa Tài Nguyên Mạng (HTTP Connection Pooling)**:
  - Sử dụng thực thể `http.Client` dùng chung ở mức package để tái sử dụng kết nối TCP (Keep-Alive), tránh lãng phí socket hệ thống và tăng tốc độ kết nối GitHub API.
* **Giải Phóng Bộ Nhớ Chủ Động (Active Memory Release)**:
  - Tự động gọi trình dọn rác hệ thống `runtime.GC()` ngay sau khi kết thúc chuỗi tiến trình push/clone để trả lại bộ nhớ RAM rỗi cho Windows ngay lập tức.
* **Khóa Tiến Trình Duy Nhất (Single Instance Lock)**:
  - Sử dụng Named Mutex của Windows (`CreateMutexW`) để ngăn chặn chạy nhiều cửa sổ ứng dụng G-GitUpload song song, tránh xung đột dữ liệu cấu hình.
```

---

## 💾 Hướng dẫn cài đặt
1. Tải file chạy phía dưới phần **Assets**: `g-gitupload.exe`.
2. Lưu file vào thư mục làm việc của bạn trên máy tính Windows.
3. Chạy trực tiếp file `g-gitupload.exe` (không cần cài đặt).
