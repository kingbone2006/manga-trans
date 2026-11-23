# Hướng dẫn sử dụng MangaTrans

MangaTrans là phần mềm desktop chuyên dụng giúp dịch truyện tranh theo từng trang, kết hợp thị giác máy tính (AI vision) và dịch theo ngữ cảnh xuyên suốt chương.

## 1. Yêu cầu hệ thống và cài đặt

- Hệ điều hành: Windows 10/11 x64.
- Runtime: Microsoft Edge WebView2 (có sẵn trên hầu hết các bản Windows 10/11).
- Nếu sử dụng bản Installer: Chạy file `MangaTrans_0.1.0_x64-setup.exe` để cài đặt vào hệ thống.
- Nếu sử dụng bản Portable: Giải nén `MangaTrans-Portable-Windows-x64.zip` vào bất kỳ thư mục nào và chạy `manga-trans.exe` (không cần quyền admin).

## 2. Quy trình làm việc cơ bản

### Bước 1: Tạo dự án và nhập ảnh
1. Mở ứng dụng, bấm **Nhập ảnh** (chọn từng file PNG/JPEG/WebP) hoặc **Nhập folder** để tải cả chương truyện.
2. Thứ tự trang được nhận diện và sắp xếp tự động theo quy tắc natural sort (`001`, `01`, `2`, `10`).
3. Nếu mở folder ảnh cho dự án chưa đặt tên, ứng dụng sẽ hỏi bạn có muốn đổi tên dự án theo tên folder hay không.

### Bước 2: Cấu hình AI Provider
Bấm **AI/Provider** trên thanh công cụ để chọn hình thức chạy AI:
- **9Router online:** Nhập Base URL và API key (API key chỉ được lưu trong bộ nhớ phiên, không ghi vào project). Cần tích chọn đồng ý gửi dữ liệu lên cloud (Cloud Consent).
- **LM Studio local:** Dành cho người dùng tự chạy server LM Studio trên máy (ví dụ `http://127.0.0.1:1234/v1`).
- **Model local tích hợp:** Xem hướng dẫn tải cặp file GGUF + mmproj ở phần Quản lý Model Local.
Bấm nút **Kiểm tra provider** để xác nhận kết nối trước khi bắt đầu.

### Bước 3: Bắt đầu dịch (Start dịch)
1. Bấm nút **Start dịch** trên thanh công cụ.
2. Pipeline sẽ tự động thực hiện 2 giai đoạn:
   - **Giai đoạn 1 (Vision):** Model nhìn trực tiếp ảnh toàn trang, phát hiện vị trí các bong bóng thoại (bounding box), đọc văn bản gốc (`sourceText`) và nhận diện ngôn ngữ.
   - **Giai đoạn 2 (Dịch ngữ cảnh):** Dịch văn bản sang ngôn ngữ đích đã chọn (`vi`, `en`, `ja`,...), áp dụng glossary (thuật ngữ/tên riêng), hồ sơ nhân vật và tóm tắt cốt truyện.
3. Giao diện không bị khóa trong quá trình dịch; bạn có thể chuyển trang để xem các trang đã hoàn tất trước.

### Bước 4: Duyệt và chỉnh sửa trên Canvas
1. Xem trước bản dịch trực tiếp trên ảnh với overlay bán trong suốt.
2. Bấm vào một vùng chữ để chỉnh sửa:
   - Sửa nội dung đọc được hoặc bản dịch.
   - Chỉnh kích thước, vị trí, cỡ chữ, màu sắc và viền chữ.
   - Panel bên phải hiển thị cảnh báo dàn chữ (tràn khung, chữ quá nhỏ, tương phản kém).
3. Đánh dấu trạng thái vùng thành `Đã duyệt (approved)` khi đã hài lòng. Khi chạy lại pipeline, các vùng đã duyệt được bảo vệ tuyệt đối và không bị ghi đè.

### Bước 5: Hàng chờ sửa (Repair Queue)
1. Bấm **Công cụ project** và chọn tab **Hàng chờ sửa**.
2. Chọn loại lỗi cần sửa (Preset) như: *Tràn khung, Đọc sai/bỏ sót chữ, Bỏ sót vùng thoại, Dịch chưa tự nhiên, Sai thứ tự đọc, Sai giọng nhân vật, Sai tên/người nói, Sót chữ/lỗi nền, Mở rộng bong bóng, Sai cỡ/kiểu chữ* hoặc nhập *Prompt tùy chỉnh*.
3. Bấm **+ Thêm vào hàng chờ sửa** và bấm **Start sửa**.
4. Kết quả sửa luôn trở về trạng thái `Cần duyệt` để bạn kiểm tra lại trước khi bấm **Duyệt (Approve)**.
5. Mỗi job sửa gắn với ID ổn định và kiểm tra revision của trang để tránh xung đột nếu trang bị chỉnh sửa song song.

### Bước 6: Xuất ảnh (Export)
1. Khi quá trình dịch kết thúc và có ít nhất một trang có kết quả, nút **Xuất đã duyệt** sẽ sáng lên.
2. Bấm nút để chọn thư mục cha.
3. MangaTrans sẽ tự động tạo thư mục con theo tên dự án và mã ngôn ngữ đích (ví dụ `Truyen_Test vi`).
4. Tên file được đặt tự động theo template cấu hình (mặc định `{page:000}.{ext}`). Quá trình xuất ảnh thực hiện qua staging tạm thời để đảm bảo không ghi đè hoặc làm hỏng ảnh nguồn.

## 3. Quản lý Model Local (Qwen3-VL GGUF)

1. Bấm **Model local** trên thanh công cụ.
2. Bấm **Mở thư mục models** để mở thư mục lưu trữ model trên máy của bạn.
3. Tải cặp file gồm:
   - File LLM trọng số (ví dụ `Qwen3-VL-4B-Instruct-Q4_K_M.gguf`)
   - File Vision Encoder (ví dụ `mmproj-Qwen3-VL-4B-Instruct-Q8_0.gguf`)
   từ trang chính thức trên Hugging Face:
   - [Qwen3-VL-4B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF)
   - [Qwen3-VL-8B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF)
4. Chép cả 2 file vào thư mục `models`. Ứng dụng sẽ tự động quét và nhận diện cặp model theo thời gian thực.
5. Chọn model và bấm **Load** để sử dụng.

## 4. Giám sát GPU theo thời gian thực (Windows DXGI)

Bấm **GPU Telemetry** trên thanh công cụ để mở bảng giám sát phần cứng:
- Đọc thông số GPU thực tế từ Windows DXGI.
- Hiển thị tên adapter, VRAM dedicated, VRAM shared, budget và mức dùng bộ nhớ hiện tại.
- Các cảm biến phần cứng (nhiệt độ, công suất, quạt) phụ thuộc driver độc quyền của hãng và được báo rõ ràng là "Không khả dụng" khi chưa tích hợp, cam kết không hiển thị thông số giả.

## 5. Định dạng tệp dự án `.mangatrans`

- Mỗi dự án được lưu thành một tệp `.mangatrans` chuẩn hóa (container ZIP chứa `manifest.json`, `project.json` và media nhúng).
- Hỗ trợ lưu nguyên tử (atomic save): ghi vào file tạm, sao lưu thành `.bak` rồi mới cập nhật, giúp an toàn tuyệt đối ngay cả khi máy bị tắt đột ngột.
- Dự án lưu đầy đủ thứ tự trang, các vùng chữ, bản dịch, thiết lập dàn chữ, glossary, hồ sơ nhân vật, hàng chờ sửa và lịch sử xuất file.

