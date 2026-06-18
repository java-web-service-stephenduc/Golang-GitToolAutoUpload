# Hướng Dẫn Tạo New Release Trên GitHub Cho G-GitUpload v1.2.0

Tài liệu này hướng dẫn chi tiết cách điền các thông tin khi tạo một **New Release** (Bản phát hành mới) trên trang GitHub cho dự án **G-GitUpload** (phiên bản v1.2.0).

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
* **Cách điền**: Gõ vào ô và tạo tag mới là `v1.2.0`.
* **Target**: Chọn nhánh `main` (mặc định).
* *Lưu ý*: Nên tuân theo chuẩn Semantic Versioning (`v[Major].[Minor].[Patch]`). Vì đây là bản cập nhật cải tiến hiệu năng và tài nguyên hệ thống triệt để từ v1.1.0, ta đặt là `v1.2.0`.

#### 📌 Release title (Tiêu đề bản phát hành)
> Tiêu đề ngắn gọn hiển thị nổi bật trên trang release.
* **Mẫu đề xuất**: 
  ```text
  G-GitUpload v1.2.0 - Tối ưu hóa hiệu năng & Giải phóng tài nguyên triệt để
  ```

#### 📌 Release description (Mô tả chi tiết)
> Liệt kê các tính năng mới, cải tiến và sửa lỗi trong phiên bản này. Bạn có thể sử dụng mẫu Markdown dưới đây:

**Sao chép nội dung bên dưới và dán vào ô mô tả:**
```markdown
## 🚀 Tính năng mới & Tối ưu hóa hiệu năng hệ thống (v1.2.0)

Bản phát hành v1.2.0 tập trung cải thiện triệt để hiệu năng, dọn dẹp các tài nguyên dư thừa của Git và tối ưu hóa bộ nhớ RAM/Socket trên Windows khi thực thi quá trình đẩy mã nguồn.

### 🌟 Các thay đổi và tối ưu nổi bật:
* **Tự động dọn dẹp thư mục cục bộ (Auto Disk Cleanup)**:
  - Tích hợp khối lệnh trì hoãn (`defer`) chạy trong mọi tình huống (thành công, lỗi hoặc người dùng bấm Hủy) để tự động xóa sạch thư mục `.git` tạm thời được tạo ra trong thư mục bài tập của học viên.
  - Giải phóng dung lượng đĩa cứng cục bộ ngay lập tức và giữ cho thư mục làm việc của bạn luôn gọn gàng, không bị chứa file rác hay metadata Git không cần thiết.
* **Ngăn chặn tiến trình Git chạy ngầm (Zero Zombie Processes)**:
  - Tự động cấu hình `gc.auto 0` cho repository ngay sau khi khởi tạo. Tránh hoàn toàn việc Git tự kích hoạt bộ dọn rác chạy ngầm và khóa thư mục hoặc chạy vô hạn sau khi phần mềm đã đóng.
* **Chống treo ứng dụng khi lỗi xác thực (Fail-Fast execution)**:
  - Truyền biến môi trường `GIT_TERMINAL_PROMPT=0` vào tất cả các lệnh Git. Nếu Token GitHub của bạn hết hạn hoặc sai, tiến trình push sẽ thất bại và dừng lại ngay lập tức thay vì bị treo vô hạn chờ nhập liệu ở chế độ nền.
* **Tối ưu hóa tài nguyên mạng (HTTP Connection Pooling)**:
  - Chuyển đổi toàn bộ các hàm gọi GitHub API REST v3 sang một thực thể `http.Client` dùng chung duy nhất (ở mức Package).
  - Tái sử dụng kết nối TCP thông qua cơ chế Keep-Alive giúp giảm thiểu thời gian bắt tay (handshake), loại bỏ hiện tượng tràn cổng (socket churn / `TIME_WAIT` states) trên Windows.
* **Giải phóng bộ nhớ Heap lập tức (Active Memory Release)**:
  - Kích hoạt cơ chế giải phóng bộ nhớ chủ động `runtime.GC()` của Go ngay khi luồng đẩy code trả kết quả về UI.
  - Lập tức dọn dẹp các vùng đệm lưu trữ log, trả lại dung lượng bộ nhớ RAM rỗi về cho hệ điều hành Windows.
* **Ngăn chặn chạy song song nhiều tiến trình (Single Instance Protection)**:
  - Sử dụng khóa Named Mutex hệ thống của Windows để phát hiện nếu ứng dụng đã được khởi chạy.
  - Khi phát hiện bản sao thứ hai chạy song song, ứng dụng hiển thị hộp thoại cảnh báo: "Ứng dụng G-GitUpload đang chạy ngầm hoặc đã được mở ở một cửa sổ khác. Chỉ cho phép chạy một cửa sổ duy nhất" và tự động tắt bản sao đó ngay lập tức, ngăn ngừa xung đột dữ liệu cấu hình.

---

## 💾 Hướng dẫn cài đặt
1. Tải file chạy phía dưới phần **Assets**: `g-gitupload.exe`.
2. Lưu file vào thư mục làm việc của bạn trên máy tính Windows.
3. Chạy trực tiếp file `g-gitupload.exe` (không cần cài đặt).
```

---

### 3. Đính Kèm File Chạy (Assets)

Đây là bước quan trọng nhất để người dùng có thể tải file `.exe` về dùng ngay:

1. Cuộn xuống phần **Attach binaries by dropping them here or selecting them**.
2. Kéo thả file chạy đã được build từ máy tính của bạn:
   * Đường dẫn file trên máy của bạn: `g-gitupload/build/bin/g-gitupload.exe`
3. Chờ file upload lên hoàn tất (sẽ xuất hiện tên tệp kèm dung lượng khoảng 10MB - 11MB).

---

### 4. Hoàn Tất Xuất Bản

1. Tích chọn **Set as the latest release** (Thiết lập làm bản phát hành mới nhất).
2. Nhấp vào nút màu xanh **Publish release**.

Chúc mừng! Bản phát hành mới với hiệu năng tối ưu của bạn đã sẵn sàng cho mọi người tải về.
