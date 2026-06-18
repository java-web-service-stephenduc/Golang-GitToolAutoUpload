# G-GitUpload - Tài Liệu Dự Án & Hướng Dẫn Sử Dụng

Dự án **G-GitUpload** là ứng dụng desktop hỗ trợ tự động hóa quy trình tạo repository trên GitHub và đẩy (push) mã nguồn bài tập từ máy cục bộ lên đám mây. Dự án được phát triển bằng ngôn ngữ **Go (Golang)** cho Backend và **HTML/CSS/JS (Vanilla)** cho Frontend thông qua framework **Wails**.

---

## 1. Chức Năng Phát Triển (Developer Features)

Đối với các lập trình viên phát triển và bảo trì dự án, ứng dụng được trang bị các tính năng kỹ thuật sau:

*   **Kiến trúc liên kết Wails Bindings**: Cho phép gọi trực tiếp các hàm xử lý hệ thống của Go từ Javascript thông qua cầu nối IPC hiệu năng cao, giảm thiểu boilerplate code.
*   **Cơ chế Hủy Tiến Trình (Cancelable Context)**: Sử dụng `context.Context` tích hợp sâu với `os/exec.CommandContext`. Khi người dùng yêu cầu hủy, toàn bộ tiến trình dòng lệnh `git` đang chạy ngầm sẽ lập tức bị chấm dứt một cách an toàn và dọn dẹp tài nguyên hệ thống.
*   **Stream Log & Trích Xuất Tiến Độ Thực Thời**: 
    *   Tự động gộp luồng Stdout và Stderr của câu lệnh để phân tích dữ liệu.
    *   Sử dụng cơ chế quét nâng cao `SplitByNewlineOrCR` để phát hiện và xử lý ký tự carriage return (`\r`) được tạo ra bởi lệnh `git push --progress`. Nhờ đó, ứng dụng trích xuất chính xác tiến độ phần trăm (%) từ dòng log `Writing objects: XX%` và gửi sự kiện cập nhật giao diện trong thời gian thực.
*   **Cấu Hình Phân Tầng Nâng Cao**: 
    *   Ưu tiên lưu trữ cài đặt người dùng tại đường dẫn hệ thống `%APPDATA%/GGitUpload/config.json`.
    *   Tự động chuyển đổi và nạp cấu hình dự phòng từ file `.env` ở thư mục hiện tại của ứng dụng thông qua bộ phân tích cú pháp thủ công (manual parser) viết bằng Go, không cần cài đặt thêm thư viện bên ngoài.
*   **Mã Hóa Token Trong Log**: Bộ lọc thông tin nhạy cảm tự động phát hiện và ẩn Token cá nhân (PAT) trước khi in ra bảng Console giám sát log của người dùng.
*   **Tối ưu hóa tài nguyên mạng (HTTP Connection Pooling)**: Sử dụng một thực thể `http.Client` dùng chung ở mức package để tái sử dụng kết nối TCP (Keep-Alive), tránh lãng phí socket hệ thống và tăng tốc độ kết nối GitHub API.
*   **Giải phóng bộ nhớ chủ động**: Tự động gọi trình dọn rác hệ thống `runtime.GC()` ngay sau khi kết thúc chuỗi tiến trình push để trả lại bộ nhớ Heap dư thừa cho Windows ngay lập tức.
*   **Khóa tiến trình duy nhất (Single Instance Lock)**: Sử dụng Named Mutex của Windows (`CreateMutexW`) thông qua gói `syscall` của Go để ngăn chặn chạy nhiều tiến trình cùng lúc, kết hợp gọi trực tiếp `MessageBoxW` để đưa ra thông báo cảnh báo cực kỳ gọn nhẹ trước khi Wails engine khởi động.

---

## 2. Chức Năng Cho Người Dùng Cuối (End-User Features)

Người dùng cuối có thể thực hiện toàn bộ các thao tác quản lý và tự động hóa sau trên giao diện:

*   **Kéo thả thư mục tiện lợi**: Kéo trực tiếp một thư mục bài tập từ Windows File Explorer thả vào vùng nhận diện trên giao diện, hoặc click trực tiếp để mở hộp thoại chọn thư mục chuẩn của Windows.
*   **Hỗ trợ 3 Chế Độ Đẩy Bài Tập**:
    1.  *Session + Exercise (Mặc định)*: Tạo repository tự động format theo số buổi và số bài tập dựa trên cấu hình mẫu (ví dụ: `session15-ex01-homework`).
    2.  *Session + Miniproject*: Đặt tên repository dạng miniproject với cơ chế chuẩn hóa chuỗi tự động (chuyển chữ thường, thay khoảng trắng/ký tự đặc biệt thành dấu gạch ngang `-`).
    3.  *Custom Repository*: Đặt tên repository tùy chọn theo nhu cầu cá nhân.
*   **Tùy Chọn Commit Message Linh Hoạt**:
    *   *Default*: Sử dụng thông báo commit mẫu sinh tự động theo số Session/Exercise tương ứng.
    *   *Custom*: Nhập thông báo commit tùy ý (hỗ trợ nhập tiếng Việt có dấu hoàn chỉnh không lo lỗi bảng mã Font).
*   **Trình Giám Sát Console & Progress Bar**: Xem chi tiết từng bước thực thi lệnh Git (`git init`, `git add`, `git commit`...) thông qua màn hình Console giả lập và thanh tiến trình chạy mượt mà.
*   **Hủy Tiến Trình Nhanh**: Nút **Hủy (Cancel)** được kích hoạt trong suốt quá trình đẩy mã nguồn, cho phép dừng đẩy code lập tức nếu phát hiện chọn sai thư mục hoặc mạng chập chờn.
*   **Widget Lưu Lịch Sử Đẩy Gần Nhất**: Hiển thị tên repo, thời gian thực hiện thành công và đường dẫn thư mục cục bộ của lần đẩy gần nhất. Click trực tiếp để mở nhanh liên kết repository trên trình duyệt Web mặc định.
*   **Tìm kiếm & Xóa Repo Tiện Lợi**:
    *   Tìm kiếm danh sách repository trên tài khoản/tổ chức cá nhân.
    *   Sao chép nhanh liên kết URL clone.
    *   Xóa repository GitHub trực tiếp từ phần mềm thông qua xác nhận bảo mật bằng **Delete Key** đã thiết lập trước.
*   **Trang Cài Đặt Trực Quan**: Cấu hình token GitHub PAT, username, organization, mẫu đặt tên repo, và khóa xác thực xóa repo ngay trên giao diện mà không cần sửa file cấu hình thủ công.
*   **Đồng bộ Giao diện Hệ thống**: Hỗ trợ theme Sáng/Tối (Light/Dark mode) và tự động đồng bộ theo chủ đề màu sắc của hệ điều hành Windows.
*   **Phân trang Tìm kiếm Repo**: Giới hạn tối đa hiển thị 12 repository mỗi trang kèm theo các nút điều hướng trực quan.
*   **Bảo mật Khóa Xác nhận**: Ẩn các trường thông tin nhạy cảm như token GitHub và Delete Key dưới dạng password trong Settings UI.
*   **Tích hợp Hồ sơ GitHub**: Hiển thị avatar cá nhân, followers và số lượng repository công khai trực tiếp trên thanh Sidebar.
*   **Chạy ngầm không nháy CMD**: Tích hợp các thuộc tính ẩn cửa sổ dòng lệnh cho tất cả các tiến trình Git CLI và trình duyệt, loại bỏ hoàn toàn hiện tượng cửa sổ CMD đen xuất hiện đột ngột gây gián đoạn.
*   **Tự động dọn dẹp thư mục cục bộ (Auto Cleanup)**: Tự động dọn dẹp và xóa sạch thư mục `.git` tạm thời được tạo ra trong thư mục bài tập ngay khi tiến trình đẩy mã nguồn kết thúc (sử dụng cơ chế trì hoãn `defer` chạy trong mọi tình huống thành công hay thất bại/hủy). Giúp thư mục bài tập của học viên luôn sạch sẽ, không bị rác và không chiếm dụng dung lượng đĩa cục bộ.
*   **Ngăn chặn treo tiến trình và tiến trình mồ côi**: Tích hợp cấu hình `gc.auto 0` ngăn Git tự động chạy ngầm trình dọn rác (có thể gây khóa thư mục hoặc chạy vô hạn trong nền), kết hợp biến môi trường `GIT_TERMINAL_PROMPT=0` để chấm dứt nhanh tiến trình nếu xảy ra lỗi xác thực.
*   **Ngăn khởi chạy nhiều cửa sổ (Single Instance Enforcement)**: Giới hạn chỉ cho phép duy nhất một cửa sổ ứng dụng hoạt động trên Windows. Khi khởi chạy bản sao thứ hai, ứng dụng lập tức hiển thị thông báo hộp thoại Warning: "Ứng dụng G-GitUpload đang chạy ngầm hoặc đã được mở ở một cửa sổ khác. Chỉ cho phép chạy một cửa sổ duy nhất" và tự động tắt bản sao mới để tránh xung đột cấu hình.

---

## 3. Tính Năng Trong Tương Lai (Future Roadmap)

*   **Đẩy Bài Tập Hàng Loạt (Queue & Batch Upload)**: Cho phép chọn nhiều thư mục và hàng đợi đẩy mã nguồn tự động lần lượt lên các repo riêng biệt.
*   **Hỗ trợ Đa Nền Tảng Git**: Mở rộng khả năng tạo và đẩy code lên GitLab và Bitbucket.
*   **Phát Hiện Bài Tập Chưa Hoàn Thành**: Tự động phân tích cấu trúc các thư mục bài tập để cảnh báo cho học viên những bài chưa đẩy lên GitHub.

---

## 4. Hướng Dẫn Build File Thực Thi (.exe) Trên Windows

Để biên dịch mã nguồn thành file thực thi nhỏ gọn chạy trên môi trường Windows, thực hiện theo các bước sau:

### Yêu Cầu Môi Trường
1.  **Go Compiler**: Cài đặt Go (Khuyến nghị phiên bản 1.21 trở lên).
2.  **Node.js & npm**: Cài đặt để quản lý và build asset frontend.
3.  **Wails CLI**: Cài đặt công cụ wails bằng lệnh:
    ```powershell
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```
    *(Lưu ý: Đảm bảo thư mục `$GOPATH/bin` hoặc `C:\Users\<Tên_User>\go\bin` đã được cấu hình trong biến môi trường `PATH` của Windows).*

### Quy Trình Biên Dịch (Build)
Mở cửa sổ PowerShell hoặc Command Prompt tại thư mục gốc của dự án `g-gitupload` và chạy lệnh sau:

```powershell
wails build -clean -platform windows/amd64 -ldflags "-s -w -H=windowsgui"
```

**Giải thích các tham số trong lệnh build:**
*   `-clean`: Dọn dẹp các thư mục build cũ để đảm bảo không bị xung đột tài nguyên.
*   `-platform windows/amd64`: Chỉ định biên dịch cho hệ điều hành Windows 64-bit.
*   `-ldflags "-s -w"`: Loại bỏ thông tin gỡ lỗi (debug symbols) và bảng ký hiệu để giảm tối đa dung lượng file exe.
*   `-ldflags "-H=windowsgui"`: Biên dịch dưới dạng ứng dụng GUI Windows thuần túy. Điều này giúp khi người dùng click đúp chạy file `.exe` sẽ **không** hiển thị cửa sổ dòng lệnh đen (CMD) chạy nền.

### Kết Quả Đầu Ara
Sau khi lệnh chạy hoàn tất thành công, file thực thi sẽ nằm tại:
`g-gitupload/build/bin/g-gitupload.exe`

Dung lượng file sau khi tối ưu chỉ khoảng **10 MB đến 11 MB**, vô cùng gọn nhẹ và khởi động tức thì.
