# Hướng Dẫn Tạo New Release Trên GitHub Cho G-GitUpload v1.4.0

Tài liệu này hướng dẫn chi tiết cách điền các thông tin khi tạo một **New Release** (Bản phát hành mới) trên trang GitHub cho dự án **G-GitUpload** (phiên bản v1.4.0).

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
* **Cách điền**: Gõ vào ô và tạo tag mới là `v1.4.0`.
* **Target**: Chọn nhánh `main` (mặc định).
* *Lưu ý*: Tuân theo chuẩn Semantic Versioning (`v[Major].[Minor].[Patch]`). Vì đây là bản phát hành nâng cấp toàn diện Trợ lý Stephen AI cùng cơ chế quản lý bảo mật repository, ta đặt là `v1.4.0`.

#### 📌 Release title (Tiêu đề bản phát hành)
* **Mẫu đề xuất**: 
  ```text
  G-GitUpload v1.4.0 - Trợ lý Stephen AI thông minh, Đơn giản hóa quản lý & Xóa Repository chẩn đoán quyền hạn
  ```

#### 📌 Release description (Mô tả chi tiết)
**Sao chép nội dung bên dưới và dán vào ô mô tả:**
```markdown
## 🚀 Bản phát hành nâng cấp G-GitUpload (v1.4.0)

Bản phát hành v1.4.0 tích hợp Trợ lý Stephen AI thông minh hơn, bổ sung các chức năng tương tác tiện lợi (Clear Chat, Copy câu hỏi khi hover), đơn giản hóa quy trình Xóa Repository bằng cách loại bỏ Delete Key và tự động chẩn đoán quyền Token qua API báo cáo.

---

### 🌟 1. Các Tính Năng Stephen AI & UI/UX Chat Mới:
* **Tính năng Clear Chat (Xóa lịch sử)**:
  - Thêm nút icon thùng rác tại header của chat panel. Một click sẽ dọn sạch toàn bộ cuộc hội thoại cũ và đưa Stephen về màn hình chào mừng ban đầu.
* **Sao chép câu hỏi khi Hover (Copy-on-hover)**:
  - Khi người dùng rê chuột lên câu hỏi của chính mình (Bạn), nút copy nhỏ sẽ xuất hiện. Nhấp vào nút sẽ sao chép văn bản vào clipboard kèm hiệu ứng phản hồi tích xanh (`check`) trong 2 giây.
* **Tự động chẩn đoán lỗi Push**:
  - Khi Git push gặp sự cố, bong bóng Stephen hiển thị cảnh báo badge chấm than đỏ (`alert-circle`). Khi mở panel chat, hệ thống tự động nhờ Stephen phân tích log lỗi và đưa ra giải pháp ngay lập tức. Badge tự biến mất khi chạy tiến trình push/clone mới.
* **Thông báo lỗi AI/API thân thiện**:
  - Bắt toàn bộ lỗi gọi API hoặc phản hồi rỗng từ OpenRouter và hiển thị thông báo cố định: *"Xin vui lòng hỏi lại, hoặc trợ lý đang bị quá tải, bạn hãy gửi lại câu hỏi."* dưới dạng tin nhắn lỗi kèm biểu tượng cảnh báo chấm than đỏ.
* **Sửa lỗi trích xuất Markdown Link**:
  - Tối ưu hóa Regex trích xuất URL thô để bỏ qua ký tự `*` và `)`. Khắc phục triệt để lỗi link nằm trong định dạng in đậm `**link**` bị hiển thị dính kèm ký tự `**` vào cuối đường dẫn.

---

### ⚙️ 2. Tái cấu trúc cài đặt & Quản lý Repository:
* **Cài đặt Switch Bật/Tắt tối giản**:
  - Ẩn các cấu hình API Key và AI Model phức tạp, mặc định lưu trữ OpenRouter ổn định.
  - Bổ sung 2 switch bật/tắt: **Stephen AI** và **Trợ lý Giọng nói**, mặc định bật và lưu trạng thái vào `localStorage`. UI tương ứng sẽ lập tức ẩn/hiện theo trạng thái switch.
* **Trợ lý giọng nói (Microphone)**:
  - Khi nhấn vào mic, hệ thống phát giọng nói cảnh báo đang phát triển qua loa, hiển thị Toast cảnh báo và tự động gửi tin nhắn giải thích chi tiết trong Stephen AI.
* **Xóa Repository Direct Confirm & Chẩn đoán quyền**:
  - Loại bỏ hoàn toàn trường nhập Delete Key trong Cài đặt cũng như yêu cầu nhập mật khẩu khi xóa repo.
  - Khi nhấn Xóa repo, hiển thị modal xác nhận đơn giản.
  - Trước khi xóa, ứng dụng tự động kiểm tra quyền hạn qua `GetTokenReport`. Nếu Token của người dùng thiếu quyền `delete_repo`, hệ thống sẽ chặn hành động và hiện Toast lỗi cảnh báo rõ ràng.
* **Chuẩn hóa thư viện Lucide Icons**:
  - Loại bỏ toàn bộ các emoji cũ trên giao diện Repo Detail, thay bằng hệ thống icon vector Lucide sắc nét, co giãn mượt mà theo kích thước cửa sổ.
```

---

## 💾 Hướng dẫn cài đặt
1. Tải file chạy phía dưới phần **Assets**: `g-gitupload.exe`.
2. Lưu file vào thư mục làm việc của bạn trên máy tính Windows.
3. Chạy trực tiếp file `g-gitupload.exe` (không cần cài đặt).

