# Báo cáo kiểm thử MangaTrans

## Phiên bản

- Source version: `0.1.0`
- Môi trường: Windows x64, Node.js 26.10.0, npm 12.1.0, Rust 1.100.0, Cargo 1.100.0, target `x86_64-pc-windows-msvc`
- GPU/model/provider thật: chưa kiểm thử; không dùng API trả phí và không tải model weights.

## Kết quả

| Nhóm | Lệnh/kiểm tra | Kết quả |
|---|---|---|
| Frontend typecheck | `npx tsc -b --pretty false` | PASS |
| Frontend unit tests | `npm test -- --run` | PASS, 4 tests |
| Frontend production build | `npm run build` | PASS |
| Rust check | `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| Rust unit tests | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS, 1 test |
| Tauri UI/MCP | Không có MCP desktop trong môi trường | NOT RUN |
| Windows clean installer | Chưa có VM Windows sạch | NOT RUN |
| Vision/provider thật | Chưa được bật | NOT RUN |
| GPU telemetry thật | Chưa có adapter/runtime đã xác minh | NOT RUN |

## Đã xác minh

- Project format version 1 parse/serialize.
- Natural sort cho tên trang có số và zero-padding.
- Chuẩn hóa tên file Windows cơ bản.
- Rust command `save_project_atomic` tạo file tạm, backup trước khi thay thế và rename công bố.
- Rust command quét `.gguf`/`.mmproj` không tự load.
- Capability backend báo rõ vision/inpainting/GPU telemetry chưa hỗ trợ.

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
