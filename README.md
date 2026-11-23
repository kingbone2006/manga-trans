# MangaTrans

MangaTrans là ứng dụng desktop định hướng hỗ trợ dịch truyện tranh theo từng trang, giữ ngữ cảnh chương và cho phép người dùng kiểm tra bản dịch trước khi xuất ảnh.

## Trạng thái hiện tại

Đây là vertical slice của Mốc 1, chưa phải bản phát hành hoàn chỉnh. Hiện đã có:

- Giao diện React + TypeScript + Vite bằng tiếng Việt.
- Nhập nhiều ảnh PNG, JPEG hoặc WebP và sắp xếp natural sort (`1`, `01`, `2`, `10`).
- Danh sách thumbnail, chọn trang, zoom preview và bật/tắt overlay.
- Tạo nhiều vùng chữ thủ công, chọn đúng vùng trên canvas, chỉnh tọa độ, nội dung nhận diện, bản dịch, cỡ/màu chữ và trạng thái duyệt.
- Ảnh nguồn được chuyển thành data URL và nhúng trong project để file `.mangatrans` không phụ thuộc object URL của phiên trình duyệt.
- Undo/redo cho các thay đổi project.
- Preview bản dịch thủ công trên overlay và export PNG preview của trang hiện tại; không ghi đè ảnh nguồn.
- Chuẩn hóa tên file Windows và mã ngôn ngữ thư mục cơ bản.
- Schema project có strategy/provider/context/glossary/character profiles/repair jobs tương thích ngược.
- Provider policy và OpenAI-compatible client có consent cloud, phân loại lỗi, Retry-After và retry giới hạn; chỉ mock-test, chưa tự gọi API thật.
- Pipeline state machine có pause/resume/cancel/retry, chống chạy trùng và repair job chờ trang.
- Test tự động cho persistence, provider policy, bounded retry, pipeline state và tên export.

Đã có thêm scaffold Tauri 2/Rust với atomic project write, backup, model-folder scan và Windows NSIS build. Chưa triển khai: vision model/OCR-free reading, dịch AI, provider 9Router/LM Studio, pipeline batch, hàng chờ sửa, inpainting, model local inference, GPU telemetry, onboarding đầy đủ và kiểm thử Windows sạch. Các capability AI chưa có backend được báo rõ, không giả lập kết quả.

## Yêu cầu phát triển

- Node.js 20 trở lên
- npm

## Chạy local

```bash
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal. Có thể kiểm tra production bằng:

```bash
npm test
npm run build
npm run preview
```

## Sử dụng vertical slice

1. Bấm `Nhập ảnh` và chọn một hoặc nhiều ảnh trang.
2. Chọn trang trong sidebar; thứ tự được sắp bằng natural sort.
3. Bấm `+ Thêm vùng chữ` để tạo vùng thủ công.
4. Nhập nội dung nhận diện và bản dịch ở panel bên phải; vùng mới mặc định là `Cần duyệt`.
5. Bấm `Lưu` để tải xuống file `.mangatrans`, hoặc dùng `Mở project` để khôi phục dữ liệu.

Ảnh nguồn hiện được nhúng trực tiếp trong JSON dưới dạng data URL. Đây là giải pháp persistence của vertical slice; bản phát hành cần chuyển sang container `.mangatrans` có manifest/media nén, kiểm tra kích thước và ghi atomic bằng backend Rust.

## Định hướng tiếp theo

- Scaffold Tauri 2 và chuyển thao tác file/project sang Rust với ghi atomic và media nhúng.
- Thêm export staging an toàn và template tên file.
- Xây adapter provider có mock test trước khi kết nối dịch vụ thật.
- Thêm vision pipeline, queue/progress và persistence đầy đủ theo `PROMPT_AI_MANGA_TRANSLATOR.md`.

Không đưa API key, model weights hoặc dữ liệu project riêng tư vào repository. Model local nếu được tích hợp sẽ nằm ngoài Git và phải tải từ nguồn chính thức sau khi người dùng xác nhận.
