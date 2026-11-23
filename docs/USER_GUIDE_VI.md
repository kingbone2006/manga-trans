# Hướng dẫn sử dụng MangaTrans

## Trạng thái bản hiện tại

Bản hiện tại là bản phát triển Mốc 1/khung Tauri. Các chức năng đã kiểm chứng gồm nhập ảnh, sắp xếp natural sort, nhúng ảnh vào project JSON, vùng chữ thủ công, undo/redo, preview và export PNG cơ bản.

Vision model, dịch AI, inpainting, provider cloud, local inference và GPU telemetry chưa được bật. Giao diện không giả lập các kết quả này.

## Chạy từ source

Yêu cầu Windows x64 đã kiểm chứng trong môi trường phát triển:

- Node.js và npm để build frontend.
- Rust stable/MSVC để build backend.
- WebView2 để chạy ứng dụng Tauri Windows.

```powershell
npm install
npm run build
npm run tauri dev
```

Nếu chỉ muốn chạy giao diện web:

```powershell
npm run dev
```

## Quy trình cơ bản

1. Nhập ảnh PNG, JPEG hoặc WebP.
2. Ảnh được nhúng vào project dưới dạng data URL; ảnh nguồn không bị sửa.
3. Chọn trang và bấm `+ Thêm vùng chữ`.
4. Chọn vùng trên preview để chỉnh nội dung nhận diện, bản dịch, vị trí, cỡ chữ, màu chữ và trạng thái.
5. Dùng `Hoàn tác` hoặc `Làm lại` khi cần.
6. Bấm `Lưu` để tải file `.mangatrans`.
7. Dùng `Mở project` để mở lại project.
8. `Xuất trang` tạo PNG preview mới, không ghi đè ảnh nguồn.

## Model local

Backend Tauri có command tạo và quét thư mục model. Bản hiện tại chỉ lập chỉ mục file `.gguf` và `.mmproj`; chưa load model, chưa thực hiện inference và không tự tải model.

Khi tính năng quản lý model hoàn thiện, chỉ tải model từ nguồn chính thức và kiểm tra license/model card của revision cụ thể:

- [Qwen3-VL-4B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF)
- [Qwen3-VL-8B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF)

Dung lượng file tải xuống không phải cam kết VRAM khi chạy.

## Provider và quyền riêng tư

Mở `AI/Provider` để cấu hình 9Router, LM Studio hoặc endpoint OpenAI-compatible tùy chỉnh. Có thể chọn chiến lược online-first + local fallback, chỉ online, chỉ local hoặc hỏi trước khi chuyển.

- API key nhập ở ô password và chỉ giữ trong bộ nhớ phiên; project chỉ lưu `hasApiKey`, không lưu giá trị key.
- Endpoint cloud phải có consent riêng trước khi request. Local endpoint không cần cloud consent.
- Provider client có phân loại lỗi auth/rate-limit/temporary/payload/timeout và retry giới hạn; lỗi API key không tự fallback.
- Chưa tự động gọi provider khi mở ứng dụng. Vision pipeline thật chỉ được chạy khi model/provider đã được xác minh hỗ trợ vision.

Các lớp provider/pipeline đã có mock tests, nhưng chưa kiểm thử API thật và không dùng API trả phí.

- [9Router](https://9router.com)
- [LM Studio](https://lmstudio.ai/download)
- [LM Studio OpenAI-compatible API](https://lmstudio.ai/docs/developer/openai-compat)

- [9Router](https://9router.com)
- [LM Studio](https://lmstudio.ai/download)
- [LM Studio OpenAI-compatible API](https://lmstudio.ai/docs/developer/openai-compat)

## Quyền riêng tư và giới hạn

- Không gửi ảnh ra ngoài trong bản hiện tại.
- Không đưa API key, model weights hoặc project riêng vào Git.
- Data URL làm file project lớn; định dạng phát hành cần chuyển sang container media có manifest và giới hạn kích thước.
- Export hiện là renderer canvas cơ bản, chưa làm sạch nền/inpainting.
