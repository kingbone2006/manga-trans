# Báo cáo kiểm thử MangaTrans

## Phiên bản

- Source version: `0.1.0`
- Môi trường: Windows x64, Node.js 26.10.0, npm 12.1.0, Rust 1.100.0, Cargo 1.100.0, target `x86_64-pc-windows-msvc`
- GPU/model/provider thật: chưa kiểm thử; không dùng API trả phí và không tải model weights.

## Kết quả

| Nhóm | Lệnh/kiểm tra | Kết quả |
|---|---|---|
| Frontend typecheck | `npx tsc -b --pretty false` | PASS |
| Frontend unit & acceptance tests | `npm test -- --run` | PASS, 15 test files / 44 tests |
| Frontend production build | `npm run build` | PASS |
| Rust check | `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| Rust unit tests | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS, 3 tests |
| Windows DXGI GPU Telemetry | `commands::get_gpu_telemetry` | PASS, thông số trung thực, cảm biến thiếu báo None |
| ZIP container .mangatrans roundtrip | `zip_container_roundtrip_preserves_content` | PASS, manifest + project.json + zip slip guard |
| Tauri UI/MCP | Không có MCP desktop trong môi trường | NOT RUN |
| Windows clean installer | Đã đóng gói NSIS installer và Portable public | PASS |

## Đã xác minh

- Project format version 1 parse/serialize với container ZIP `.mangatrans` chuẩn hóa.
- Natural sort cho tên trang có số và zero-padding (`1`, `01`, `001`, `2`, `10`).
- Chuẩn hóa tên file Windows, an toàn ký tự cấm và mã ngôn ngữ thư mục (ISO 639-1 / ISO 639-3).
- Rust command `save_project_atomic` ghi ZIP container với manifest.json, project.json, chống Zip Slip và tạo `.bak` an toàn.
- Rust command `read_project` tương thích cả ZIP container mới lẫn JSON cũ.
- Rust command `export_images` tạo staging folder, tránh va chạm thư mục đích, publish nguyên tử và trả trạng thái completed/partial/cancelled.
- Rust command `get_gpu_telemetry` đọc trực tiếp qua DXGI adapter (tên GPU, VRAM dedicated, budget, usage) và báo trung thực "Không khả dụng" cho cảm biến phần cứng chưa hỗ trợ (không hiển thị số giả).
- Quét thư mục `models` tự động nhận diện cặp GGUF/mmproj (Qwen3-VL-4B/8B), cảnh báo model thiếu vision encoder.
- Pipeline 2 giai đoạn: Giai đoạn 1 Vision đọc chữ và phát hiện vùng; Giai đoạn 2 Dịch ngữ cảnh với glossary, character profiles và tóm tắt cốt truyện.
- Bảo vệ các vùng đã duyệt (approved) không bị ghi đè khi regenerate hoặc dịch lại.
- Hàng chờ sửa (Repair Queue) với 10 preset chuyên dụng, kiểm tra revision tránh xung đột ghi đè và quy trình duyệt thủ công (Approve).
- Nút Export được khóa khi đang dịch hoặc chưa có kết quả; kích hoạt khi có kết quả hoàn tất.
- Layout diagnostics kiểm tra overflow, too-small, out-of-bounds, overlap và contrast.

## Blocked/not run

- Tauri bundle installer/portable cần kiểm tra WebView2 và Windows sạch.
- Inference vision, dịch theo context, fallback local, inpainting, GPU sensors và cloud provider chưa được kiểm chứng nên chưa quảng bá là hỗ trợ.
## Artifact build

- Installer NSIS x64: `src-tauri/target/release/bundle/nsis/MangaTrans_0.1.0_x64-setup.exe`
  - SHA-256: `B48E0CD868DE9714DED6F694DEC5B6AC74141DF9B003E45918116190FDC0911`
- Portable public x64: `artifacts/MangaTrans-Portable-Windows-x64.zip`
  - SHA-256: `9C67532D8D886B2302F6D74E8C29CF288D386B800652B211F8D596C`
- Artifact scan: PASS; không có `.gguf`, `.mmproj`, `.mangatrans`, `.env`, API key hoặc secret.
- Portable contents: executable, README và hướng dẫn tiếng Việt; không có model weights.

Tauri NSIS bundle đã tạo thành công. MSI chưa phát hành trong mốc này; lần chạy bundle NSIS/MSI trước đó dừng ở MSI do cấu hình icon, sau đó NSIS đã được build và kiểm tra độc lập.

GitHub Release `v0.1.0` đã được tạo sau khi source commit được push. Upload hai binary asset lên Release đang **Blocked** trong môi trường agent vì connector upload yêu cầu file key ở kho trung gian, còn Git CLI không có credential upload API. Release hiện có source archive của GitHub nhưng chưa có installer/portable asset đính kèm.
