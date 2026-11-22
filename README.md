# MangaTrans

MangaTrans là ứng dụng desktop định hướng hỗ trợ dịch truyện tranh theo từng trang, giữ ngữ cảnh chương và cho phép người dùng kiểm tra bản dịch trước khi xuất ảnh.

## Trạng thái hiện tại

Đây là vertical slice của Mốc 1, chưa phải bản phát hành hoàn chỉnh. Hiện đã có:

- Giao diện React + TypeScript + Vite bằng tiếng Việt.
- Nhập nhiều ảnh PNG, JPEG hoặc WebP và sắp xếp natural sort (`1`, `01`, `2`, `10`).
- Danh sách thumbnail, chọn trang, zoom preview và bật/tắt overlay.
- Tạo vùng chữ thủ công, chỉnh tọa độ, nội dung nhận diện, bản dịch và trạng thái duyệt.
- Lưu/mở project dạng `.mangatrans` với format version 1.
- Test tự động cho natural sort và serialize/parse project.

Chưa triển khai: backend Tauri/Rust native, vision model/OCR-free reading, dịch AI, provider 9Router/LM Studio, pipeline batch, hàng chờ sửa, inpainting, export ảnh, model local/GPU telemetry, onboarding và đóng gói installer/portable. Các nút chưa có backend được vô hiệu hóa, không giả lập kết quả AI.

## Yêu cầu phát triển

- Node.js 20 trở lên
- npm

## Chạy local

```bash
npm install
npm run dev
```

Kiểm tra production:

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

Ảnh nhập hiện dùng object URL của phiên trình duyệt. Vì vậy file project slice chưa nhúng dữ liệu ảnh; đây là giới hạn tạm thời cần được thay bằng container project native trước khi phát hành.

## Định hướng tiếp theo

- Scaffold Tauri 2 và chuyển thao tác file/project sang Rust với ghi atomic và media nhúng.
- Thêm export staging an toàn và template tên file.
- Xây adapter provider có mock test trước khi kết nối dịch vụ thật.
- Thêm vision pipeline, queue/progress và persistence đầy đủ theo đặc tả dự án.

Không đưa API key, model weights hoặc dữ liệu project riêng tư vào repository. Model local nếu được tích hợp sẽ nằm ngoài Git và phải tải từ nguồn chính thức sau khi người dùng xác nhận.
