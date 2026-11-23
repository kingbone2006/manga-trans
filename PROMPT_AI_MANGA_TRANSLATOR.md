# Đặc tả và prompt cho AI agent: Phần mềm dịch truyện tranh bằng AI

> Sao chép nội dung trong tài liệu này và giao cho AI agent lập kế hoạch, xây dựng phần mềm. Agent cần đọc toàn bộ đặc tả, kiểm tra môi trường và hiện trạng dự án trước khi sửa code.

## 1. Mục tiêu

Xây dựng ứng dụng desktop đa nền tảng giúp dịch truyện tranh theo từng trang, có xét ngữ cảnh xuyên suốt chương truyện. Người dùng có thể xem, sửa vùng chữ và bản dịch trên ảnh preview; chỉnh cách dàn chữ; duyệt thủ công hoặc tự động xử lý theo cấu hình.

Ưu tiên chất lượng bản dịch, quyền kiểm soát của người dùng, khả năng chạy local và thiết kế theo từng giai đoạn. Không tuyên bố hỗ trợ một GPU/backend nếu chưa kiểm chứng trên phần cứng tương ứng.

## 2. Công nghệ và định hướng kiến trúc

- **Ứng dụng desktop:** Rust với Tauri 2 làm backend/desktop shell.
- **Giao diện:** React + TypeScript + Tailwind CSS + shadcn/ui. shadcn/ui là bộ component cho frontend web, không phải thư viện giao diện Rust; dùng trong frontend được Tauri đóng gói.
- **Backend Rust:** quản lý dự án, tệp, hàng đợi công việc, trạng thái tiến trình, gọi các dịch vụ vision/AI, lưu cấu hình và giao tiếp an toàn với frontend.
- **Giao tiếp frontend/backend:** Tauri commands/events; truyền tiến độ theo từng trang và từng công đoạn.
- **Tệp dự án:** mỗi phiên làm việc được lưu thành một tệp project riêng có phần mở rộng đề xuất là `.mangatrans` (tên có thể đổi trước khi phát hành). Đây là định dạng project gốc để mở lại và tiếp tục làm việc, không chỉ là file xuất ảnh.
- **Cấu trúc project:** dùng container có phiên bản định dạng (ví dụ ZIP có manifest và metadata JSON/SQLite), chứa cấu hình dự án, thứ tự trang, quy tắc sắp xếp/template tên file, tên/path ảnh gốc, tên chuẩn hóa dự kiến, vùng chữ, nội dung vision model nhận diện, bản dịch, hồ sơ nhân vật, ngữ cảnh, bố cục, trạng thái duyệt, hàng chờ sửa và lịch sử phiên bản. Ảnh nguồn được nhúng mặc định để project dễ di chuyển; có thể bổ sung chế độ liên kết file ngoài để giảm dung lượng, kèm chức năng tìm/relink khi đường dẫn thay đổi.
- Khi mở project, kiểm tra định dạng/phiên bản, đường dẫn và kích thước các thành phần; không giải nén tùy tiện ra ngoài thư mục làm việc của ứng dụng.
- Ảnh nguồn không bị sửa; ảnh đầu ra/preview đã duyệt được lưu thành phiên bản riêng trong project hoặc xuất ra ngoài. Không đóng gói API key, model weights hoặc cache tạm vào project.
- Tự lưu an toàn: ghi vào tệp tạm rồi thay thế nguyên tử, tạo bản sao lưu/khôi phục sau sự cố và hỗ trợ nâng cấp schema project có kiểm soát.
- Tách các giao diện provider/model khỏi pipeline dịch để có thể thay backend mà không viết lại UI.
- Giữ bí mật API key trong kho lưu trữ bảo mật của hệ điều hành nếu khả dụng; không ghi key vào log, dự án hoặc file cấu hình xuất ra.

## 3. Đối tượng và quy trình sử dụng chính

1. Tạo project mới hoặc mở tệp `.mangatrans` có sẵn; chọn ngôn ngữ đích. Ngôn ngữ nguồn được AI vision tự nhận diện mặc định; người dùng có thể chọn thủ công hoặc sửa kết quả nhận diện khi cần.
2. Thêm ảnh trang hoặc mở folder ảnh; đề xuất thứ tự trang, cho phép sắp xếp lại, xoay hoặc loại bỏ trang.
3. Nếu project mới/đang chưa đặt tên, hỏi người dùng có muốn đổi tên project theo tên folder ảnh vừa mở hay không.
4. Chọn chiến lược dịch (online-first + local fallback, chỉ online, chỉ local hoặc hỏi trước khi chuyển), cấu hình 9Router/LM Studio/model local; bấm **Start dịch** để bắt đầu pipeline và theo dõi tiến độ.
5. Trong khi pipeline chạy, tự do mở các trang đã có preview và tiếp tục thêm yêu cầu sửa vào hàng chờ sửa riêng.
6. Duyệt từng trang ở chế độ song song hoặc so sánh ảnh gốc/preview; chọn một vùng để xem/sửa văn bản, bản dịch, vị trí và kiểu chữ.
7. Sửa vùng AI phát hiện sai hoặc tự vẽ/thêm vùng bị bỏ sót; xóa vùng giả.
8. Chọn cách vừa chữ: giữ nguyên bong bóng/khung, hoặc yêu cầu tạo thêm nền/hộp thoại (tùy khả năng inpainting và có preview riêng).
9. Chấp nhận từng vùng, từng trang hoặc tự động chấp nhận theo ngưỡng/cấu hình.
10. Khi pipeline dịch kết thúc, dùng nút **Export/Xuất** để chọn thư mục đích; ứng dụng tự tạo thư mục con theo tên project và mã ngôn ngữ đích (ví dụ `Tên truyện vi`) rồi xuất ảnh đã dịch theo template. Có thể bổ sung xuất CBZ để đọc cả chương.

## 4. Tính năng bắt buộc

### 4.1 Quản lý dự án và ảnh

- Tạo, mở, lưu, đổi tên và đóng dự án; khôi phục trạng thái sau khi khởi động lại.
- Khi nhập folder ảnh vào project mới/chưa lưu tên, hỏi **Đổi tên project thành “[tên folder]”?** với nút **Có/Không**. **Có** cập nhật tên hiển thị và tên project `.mangatrans` gợi ý; **Không** giữ nguyên. Với project đã lưu, không tự đổi tên/di chuyển tệp project: yêu cầu xác nhận riêng hoặc dùng **Save As**.
- Dùng định dạng project riêng `.mangatrans`; hỗ trợ Save, Save As, mở gần đây, xác nhận khi đóng nếu còn thay đổi chưa lưu và đăng ký mở project bằng ứng dụng khi hệ điều hành hỗ trợ.
- Project lưu được toàn bộ trạng thái cần thiết để tiếp tục làm việc: trang đang chọn, thứ tự trang, vùng chữ, nội dung vision model nhận diện/ngôn ngữ nguồn, bản dịch, hồ sơ nhân vật/ngữ cảnh, thiết lập dàn chữ, trạng thái duyệt, hàng chờ sửa và lịch sử phiên bản.
- Nhúng ảnh nguồn vào project theo mặc định để di chuyển chỉ cần một tệp; nếu có chế độ liên kết ảnh ngoài, phải báo rõ, phát hiện file bị thiếu và hỗ trợ relink.
- Cho nhập cả folder ảnh; lưu tên file/path gốc cùng thứ tự trang và tên xuất dự kiến trong project để không mất ánh xạ từ ảnh nguồn sang kết quả.
- Tự lưu và lưu thủ công không được làm hỏng project khi ứng dụng bị đóng đột ngột; báo lỗi rõ nếu project lỗi, phiên bản không hỗ trợ hoặc thiếu media.
- Nhập ảnh phổ biến như PNG, JPEG và WebP; giữ nguyên ảnh nguồn.
- Hiển thị danh sách thumbnail, thứ tự trang, trạng thái công việc và lỗi cụ thể.
- Hỗ trợ zoom, pan, fit-to-screen và chuyển trang; thao tác chuột/bàn phím cơ bản.
- Tự lưu thay đổi và có undo/redo cho thao tác chỉnh vùng và bản dịch.
- Lưu lịch sử phiên bản cho bản dịch và bố cục; cho phép xem lại hoặc khôi phục mà không ảnh hưởng ảnh nguồn.
- Cảnh báo khi thiếu dung lượng, ảnh lỗi hoặc định dạng không hỗ trợ.

### 4.2 Nhận diện và chỉnh sửa vùng chữ

- Không dùng OCR engine độc lập làm pipeline mặc định. Dùng model AI có vision input để nhìn trực tiếp ảnh/trang hoặc crop của vùng chữ, phát hiện vùng, đọc nội dung và dùng ngữ cảnh hình ảnh; nếu model/provider không hỗ trợ ảnh thì báo không tương thích, không âm thầm fallback sang OCR engine.
- Khi cần, kết hợp ảnh toàn trang để giữ ngữ cảnh với crop độ phân giải cao của từng panel/vùng chữ để model đọc được chữ nhỏ; trả về vùng/bounding box cùng nội dung nhận diện theo định dạng có kiểm tra. Tiền xử lý ảnh/crop được phép, nhưng không chuyển sang OCR engine riêng.
- Đánh dấu các vùng AI nhận diện bằng overlay màu bán trong suốt; phân biệt loại vùng (ví dụ thoại, lời dẫn, hiệu ứng âm thanh, chữ khác) bằng màu/nhãn dễ hiểu.
- Cho phép bật/tắt overlay và chỉnh opacity; không làm thay đổi ảnh gốc.
- Tạo vùng mới bằng hình chữ nhật hoặc polygon; di chuyển, đổi kích thước, xoay, chỉnh điểm và xóa vùng.
- Với mỗi vùng, hiển thị nội dung vision model đọc được từ ảnh, bản dịch, độ tin cậy, ngôn ngữ nguồn suy đoán và trạng thái xử lý.
- Cho phép sửa nội dung model đọc được trước khi dịch; cung cấp cách đánh dấu vùng không phải chữ để tránh xử lý nhầm.
- Hỗ trợ vùng chữ dọc/ngang và thứ tự đọc; người dùng có thể sửa thứ tự khi AI đoán sai và liên kết vùng thoại với nhân vật khi biết người nói.
- Nhận diện ngôn ngữ nguồn theo từng vùng chữ khi có thể vì một trang có thể chứa nhiều ngôn ngữ; cho phép ghi đè ở cấp vùng, trang hoặc dự án.
- Không âm thầm bỏ qua vùng có độ tin cậy thấp; cảnh báo và đưa vào danh sách cần duyệt.

### 4.3 Dịch theo ngữ cảnh

- Dịch từng trang nhưng duy trì ngữ cảnh xuyên suốt chương. Có thể dùng tóm tắt cốt truyện và các sự kiện gần đây để giữ mạch truyện mà không phải gửi lại toàn bộ nội dung trước đó mỗi lần.
- Có glossary/từ điển tên nhân vật, địa danh, thuật ngữ, đại từ/xưng hô và quy tắc phong cách; người dùng có thể sửa.
- Có hồ sơ nhân vật gồm tên, đại từ/xưng hô, quan hệ với nhân vật khác và đặc điểm lời thoại; người dùng kiểm tra/sửa được và có thể tắt tính năng này.
- Tóm tắt ngữ cảnh do AI tạo phải có thể xem, sửa, làm mới hoặc xóa; không tự đưa suy đoán chưa được xác nhận thành dữ kiện cốt truyện.
- Có thể cung cấp ghi chú ngữ cảnh ngắn và các bản dịch liên quan cho model, nhưng cho phép tắt/chỉnh nội dung gửi lên dịch vụ bên ngoài.
- Người dùng chỉ bắt buộc chọn ngôn ngữ đích. Tự động nhận diện ngôn ngữ nguồn mặc định; cho phép người dùng chọn thủ công ngôn ngữ nguồn ở cấp dự án/trang/vùng hoặc sửa kết quả AI nhận diện.
- Hiển thị ngôn ngữ nguồn đã nhận diện và độ tin cậy theo vùng nếu có; nếu nhận diện không chắc chắn, cảnh báo và cho phép người dùng xác nhận/chọn lại trước khi dịch.
- Cấu hình ngôn ngữ đích, văn phong, mức độ tự nhiên và quy tắc giữ tên riêng.
- Khi câu mơ hồ hoặc có nhiều cách dịch hợp lý, có thể đề xuất một số phương án kèm diễn giải ngắn và độ dài dự kiến; người dùng chọn phương án hoặc tự sửa.
- Bảo toàn ý nghĩa, giọng nhân vật và quan hệ xưng hô; nếu vision model không đọc chắc nội dung thì phải đánh dấu cần duyệt thay vì đoán như thể chính xác.
- Cho phép tạo lại bản dịch của một vùng hoặc trang mà không làm mất chỉnh sửa ở các vùng khác; hỏi trước khi ghi đè nội dung người dùng đã sửa.
- Hiển thị riêng nội dung vision model nhận diện và bản dịch; không coi đầu ra AI là chính xác tuyệt đối.

### 4.4 Dàn chữ và xử lý ảnh

- Preview kết quả đặt chữ trực tiếp lên ảnh, cập nhật khi người dùng sửa bản dịch hoặc kiểu chữ.
- Tùy chỉnh font, cỡ chữ, màu, viền, căn lề, khoảng cách dòng, hướng chữ, lề trong và vị trí.
- Chế độ **Giữ nguyên vùng**: tự xuống dòng/điều chỉnh cỡ chữ trong giới hạn đặt trước; cảnh báo nếu vẫn tràn.
- Chế độ **Ưu tiên vừa khung**: tối ưu câu dịch ngắn gọn nhưng phải giữ nghĩa; không tự động xóa ý quan trọng.
- Chế độ **Mở rộng vùng**: tùy chọn riêng, dùng inpainting để nới bong bóng/vùng nền nếu backend hỗ trợ; luôn tạo preview mới, bảo toàn ảnh nguồn và yêu cầu người dùng duyệt trước khi thay thế/xuất.
- Cho phép xử lý chữ ngoài bong bóng như hiệu ứng âm thanh; hỗ trợ tùy chọn xóa chữ gốc/inpainting và phục hồi nền. Nếu không có backend phù hợp, báo rõ thay vì giả lập thành công.
- Phát hiện nguy cơ tràn, chữ quá nhỏ, tương phản kém hoặc vùng dịch chồng lấn; cho người dùng sửa thủ công.

### 4.5 Chế độ duyệt và tiến trình

- Nút **Start dịch** bắt đầu pipeline cho project/folder đã chọn, hiển thị tiến độ tổng và tiến độ theo trang/công đoạn; không khóa UI trong lúc chạy.
- Người dùng được chuyển trang và xem preview của trang đã có kết quả trong lúc các trang khác tiếp tục chạy. Trang chưa tới lượt phải hiện trạng thái chờ/đang xử lý, không hiển thị kết quả cũ như mới.
- Chế độ thủ công: người dùng duyệt/chấp nhận từng vùng hoặc từng trang.
- Chế độ tự động: chỉ tự chấp nhận khi đạt các điều kiện do người dùng cấu hình; các vùng bất thường vẫn cần duyệt. Không dựa riêng vào điểm tin cậy thô của model nếu provider không cung cấp điểm số có ý nghĩa/đã hiệu chuẩn.
- Chế độ batch: xếp hàng nhiều trang, tạm dừng/tiếp tục/hủy; tránh chạy trùng cùng một tác vụ. Hàng chờ dịch và hàng chờ sửa phải phân biệt rõ.
- Preview cập nhật theo từng giai đoạn: vision model phân tích/phát hiện vùng/đọc chữ, dịch, xử lý nền, dàn chữ.
- Hiển thị tiến độ tổng và tiến độ trang; trạng thái rõ ràng (đang chờ/đang chạy/thành công/cần duyệt/thất bại).
- Có danh sách vùng/trang cần duyệt, nêu rõ lý do như vision model đọc chữ hoặc nhận diện ngôn ngữ chưa chắc, bản dịch quá dài, chồng lấn, chữ quá nhỏ, nền xóa chưa tốt hoặc chưa xác định được người nói; chọn mục sẽ mở đúng trang/vùng để sửa.
- Lỗi có nguyên nhân và cách xử lý gợi ý; có thể retry một công đoạn mà không chạy lại toàn bộ pipeline.
- Nút **Export/Xuất** luôn có vị trí nhất quán trên thanh công cụ nhưng bị vô hiệu hóa khi pipeline còn job đang chạy hoặc chưa có kết quả dịch; tooltip nêu lý do. Khi pipeline đã kết thúc và có ít nhất một kết quả, bật nút kể cả khi một số trang thất bại hoặc còn chờ duyệt; nếu tất cả trang đều thất bại/không có kết quả thì không cho export.
- Bấm **Export/Xuất** mở hộp thoại chọn thư mục đích (thư mục cha); hiển thị trước đường dẫn hoàn chỉnh và tự tạo thư mục con `<tên project> <mã ngôn ngữ đích>`, ví dụ `Tên truyện vi`. Dùng mã ISO 639-1 viết thường (`vi`, `en`, `ja`); với biến thể vùng dùng mã ngôn ngữ chính (ví dụ `pt-BR` dùng `pt`) trừ khi người dùng sửa tên; ngôn ngữ không có mã ISO 639-1 dùng mã ISO 639-3 viết thường.
- Xuất các ảnh đã dàn chữ/được chọn theo thứ tự trang và template tên file đầu ra của project; không sửa ảnh nguồn hoặc ghi đè file nguồn. Trong chế độ duyệt thủ công, mặc định chỉ chọn trang đã duyệt; hiển thị số trang chưa duyệt và cho người dùng duyệt tiếp hoặc chọn bao gồm các trang đó một cách tường minh.
- Nếu thư mục đích đã tồn tại, không ghi đè/ghép file âm thầm; gợi ý tên thư mục mới có hậu tố (ví dụ `(2)`) hoặc cho người dùng chọn thư mục khác. Export lại sau khi sửa bản dịch mặc định tạo thư mục mới, không thay đổi bản export trước; đánh dấu đường dẫn export cũ là bản trước đó và hiển thị bản mới nhất.
- Ghi file vào thư mục staging tạm rồi công bố thư mục đích sau khi hoàn tất. Nếu người dùng hủy hoặc lỗi toàn bộ, dọn staging và giữ nguyên các bản export cũ; nếu chỉ một số trang lỗi, vẫn có thể công bố các file thành công nhưng phải báo đây là export một phần, nêu trang lỗi và không báo thành công toàn bộ.
- Hiển thị tiến độ export, hỗ trợ hủy, và báo chính xác đường dẫn, số file thành công/thất bại sau khi hoàn tất. Lưu lịch sử lần export (thời điểm, đường dẫn, ngôn ngữ, các trang đã xuất và trạng thái) trong project để người dùng nhận ra bản export đã cũ sau khi chỉnh sửa.

### 4.6 Hướng dẫn người dùng mới

- Lần mở đầu hiển thị wizard theo từng bước, có thanh tiến trình, nút quay lại, bỏ qua và tiếp tục sau; không bắt người dùng cấu hình mọi thứ mới được mở ứng dụng.
- Các bước onboarding gợi ý:
  1. Chào mừng, giải thích ngắn app làm gì và cho chọn **Tạo project**, **Mở project** hoặc **Xem demo**.
  2. Chọn cách dùng AI: **online-first + local fallback**, **9Router online**, **LM Studio**, **model offline tích hợp**, hoặc **Để sau**.
  3. Hướng dẫn đúng theo lựa chọn: địa chỉ server, model/route, API key nếu endpoint yêu cầu, nút hiện/ẩn key, lưu an toàn và **Kiểm tra kết nối**.
  4. Nếu chọn local hoặc local fallback, dò GPU/VRAM, giải thích đề xuất model theo tài nguyên, dung lượng tải và license; cho phép quét thư mục `models`, chọn model dự phòng và quyết định giữ model đã Load hay hỏi/nạp khi fallback.
  5. Chọn ngôn ngữ đích (bắt buộc trước khi dịch); giải thích ngôn ngữ nguồn được tự nhận diện và cách ghi đè khi cần.
  6. Chọn tùy chọn cơ bản: thư mục project/đầu ra, chế độ duyệt thủ công hay tự động (mặc định thủ công), quyền riêng tư và xác nhận trước khi gửi ảnh lên cloud.
  7. Cho chạy một **demo offline** với project/ảnh mẫu synthetic hoặc có license phù hợp; ghi rõ nội dung demo không phải bản dịch do model thật tạo ra.
  8. Hiển thị checklist hoàn tất và nút mở hướng dẫn nhanh về nhập trang, nhận diện vùng, chỉnh dịch, vừa chữ, lưu `.mangatrans` và xuất ảnh.
- Có menu **Trợ giúp / Bắt đầu nhanh** để mở lại onboarding, hướng dẫn theo ngữ cảnh và phần xử lý lỗi; người dùng có thể tắt các gợi ý đã biết.
- Mỗi trường cấu hình có mô tả dễ hiểu, giá trị ví dụ, nút kiểm tra và lỗi kèm cách khắc phục. Không yêu cầu người dùng biết thuật ngữ kỹ thuật nếu có thể tự phát hiện cấu hình.
- Link API key phải dẫn tới tài liệu/trang chính thức của 9Router hoặc nhà cung cấp được chọn; giải thích có thể cần tài khoản, billing/quota và không bao giờ yêu cầu mật khẩu tài khoản.
- Có thể bổ sung video YouTube hướng dẫn, nhưng chỉ dùng liên kết đã được kiểm duyệt, ghi rõ kênh/nguồn và đánh dấu nội dung bên ngoài; ưu tiên link chính thức và cho phép tiếp tục mà không mở video.
- Không hiển thị, ghi log hoặc lưu API key dạng plaintext; thông tin bí mật được nhập qua ô password và lưu bằng kho bảo mật hệ điều hành nếu khả dụng. Nếu môi trường portable không có kho bảo mật, giải thích rõ lựa chọn an toàn thay vì âm thầm lưu key không mã hóa.

### 4.7 Sắp xếp trang và chuẩn hóa tên file

- Khi mở folder, lập danh sách ảnh kèm tên file gốc, phần số/chapter trích được, kích thước và metadata có ích; hiển thị preview thứ tự và tên file đầu ra trước khi áp dụng.
- Ưu tiên nguồn có độ tin cậy cao theo thứ tự: thứ tự người dùng đã khóa/sắp xếp thủ công; quy tắc số trang/tên file bằng regex và natural sort; vision model đọc số trang in trên ảnh; cuối cùng mới dùng VLM để suy luận thứ tự theo panel, chiều đọc và tính liên tục tình tiết.
- Với tên đơn giản như `1.jpg`, `01.jpg`, `001.jpg`, dùng quy tắc số/natural sort và bỏ zero-padding để tạo số trang chuẩn; không gọi model AI khi quy tắc xác định được thứ tự chắc chắn.
- Chỉ dùng AI vision để đọc số trang hoặc suy luận thứ tự khi tên file không đủ manh mối; cung cấp các ảnh liên quan theo nhóm, giải thích căn cứ (số trang nhìn thấy, tên file, dấu hiệu nội dung) và độ tin cậy. Nếu có nhiều thứ tự hợp lý hoặc không đủ căn cứ, hiển thị danh sách cần người dùng xác nhận/kéo thả; tuyệt đối không âm thầm đổi thứ tự đã được người dùng khóa.
- Nếu suy luận thứ tự cần gửi ảnh lên cloud, thông báo và xin xác nhận riêng theo quy tắc quyền riêng tư; ưu tiên xử lý local khi người dùng đã chọn chế độ offline.
- Phát hiện trường hợp trùng số trang, thiếu số, nhiều chapter trong cùng folder, cover/trang phụ hoặc tên file không giải nghĩa được; hỏi người dùng trước khi gộp/sắp xếp tự động.
- Sau khi có thứ tự, gán số trang ổn định trong project; cho chọn bắt đầu từ `0` hoặc `1`, độ rộng/padding (`0`, `00`, `000`) và có thể khóa thứ tự để lần mở sau không tự đổi.
- Có template riêng cho tên ảnh đầu ra, ví dụ `{index}.{ext}`, `{page:000}.{ext}`, `{project}_ch{chapter:000}_p{page:000}.{ext}`. Quy ước: `{index}` là vị trí zero-based, `{page}` là số trang one-based; cho người dùng chọn start index, padding, tên chapter và phần mở rộng.
- Hỗ trợ biến tối thiểu `{project}`, `{chapter}`, `{index}`, `{page}`, `{source_name}`, `{lang}` và `{ext}`; cho preview kết quả thật trên mọi trang, lưu nhiều preset template theo project/toàn ứng dụng và cho quay về mặc định.
- Có template/quy tắc tùy chỉnh cho xử lý tên đầu vào (regex tách chapter/page, bỏ tiền tố/hậu tố, quy tắc sắp xếp) và tên đầu ra; preset nhanh cho mẫu phổ biến, có test/preview rule trước khi áp dụng.
- Tên thư mục export mặc định là `<tên project> <mã ngôn ngữ đích>` trong thư mục cha người dùng chọn, ví dụ `Tên truyện vi`; làm sạch tên theo quy tắc Windows và cho xem/sửa tên trước khi tạo. Tên file bên trong tiếp tục theo template đầu ra đã cấu hình.
- Mặc định không đổi tên hoặc ghi đè ảnh trên folder nguồn. Lưu tên gốc, thứ tự chuẩn hóa và tên đầu ra trong project; xuất ra thư mục riêng. Nếu người dùng chủ động yêu cầu đổi tên file nguồn, phải preview bảng old name → new name, chặn va chạm/ghi đè và yêu cầu xác nhận; có cơ chế rollback/log mapping.
- Chuẩn hóa tên an toàn cho Windows: xử lý ký tự cấm, dấu chấm/khoảng trắng cuối tên, tên reserved, độ dài đường dẫn và Unicode; phát hiện tên trùng trước khi export, không tự ghi đè.

### 4.8 Hàng chờ sửa và sửa lặp theo từng trang

- Có tab riêng **Hàng chờ sửa**. Từ bất kỳ trang preview nào, người dùng chọn lỗi, tô/vẽ vùng cần xử lý trên ảnh hoặc chọn vùng chữ đã detect, nhập ghi chú tùy chọn rồi bấm **Thêm vào hàng chờ sửa**.
- Có các preset prompt/lỗi thường gặp, có thể xem trước và chỉnh trước khi thêm hàng:
  - **Tràn khỏi bong bóng/khung:** viết lại ngắn gọn để vừa vùng, giữ nguyên ý, giọng và quan hệ xưng hô; giữ nguyên kích thước khung trừ khi chọn mở rộng.
  - **Đọc chữ sai/bỏ sót chữ:** dùng vision model đọc lại riêng vùng đã tô, cập nhật nội dung nhận diện, rồi dịch lại vùng đó.
  - **Bỏ sót vùng thoại/hiệu ứng âm thanh:** phân tích vùng đã tô để thêm vùng chữ mới, đọc và dịch mà không làm mất các vùng đã có.
  - **Dịch chưa tự nhiên/sai nghĩa:** dịch lại tự nhiên hơn theo ngữ cảnh, hồ sơ nhân vật và glossary; không sửa các vùng khác.
  - **Sai thứ tự đọc/nhầm vùng thoại:** sắp lại thứ tự đọc hoặc liên kết đúng vùng với nhân vật; yêu cầu xác nhận nếu người nói chưa rõ.
  - **Sai giọng nhân vật:** viết lại theo hồ sơ/cách nói của nhân vật nhưng giữ nguyên nghĩa và mức độ cảm xúc.
  - **Sai tên/người nói/xưng hô:** dùng hồ sơ nhân vật và vùng liên quan để hiệu chỉnh; báo nếu chưa xác định được người nói.
  - **Chữ gốc còn sót/nền bị lỗi:** làm sạch hoặc inpaint vùng được đánh dấu nếu backend hỗ trợ.
  - **Mở rộng bong bóng/vùng:** đề xuất inpaint phần được chọn để tạo thêm chỗ; tạo preview riêng và không tự thay ảnh nguồn.
  - **Sai vị trí/cỡ/kiểu chữ:** chỉnh vị trí, xuống dòng, cỡ chữ hoặc style trong vùng được chọn mà không dịch lại nội dung nếu không cần.
  - Có nút **Prompt tùy chỉnh** để người dùng nhập chỉ dẫn riêng; hiển thị prompt cuối cùng và dữ liệu/vùng ảnh gửi cho model trước khi gửi.
- Mỗi yêu cầu sửa là một job gắn với ID ổn định của trang và vùng, không dựa riêng vào tên file hay vị trí hiện thời. Lưu loại lỗi, mask/vùng tô, prompt, phiên bản đầu vào, trạng thái, lỗi và phiên bản kết quả.
- Bảng hàng chờ hiển thị thumbnail, số/tên trang, vùng tô, preset/custom prompt, trạng thái (chờ trang dịch xong/đang chờ/đang sửa/cần duyệt/đã duyệt/thất bại/đã hủy), tiến độ và thông báo lỗi. Cho sửa prompt, đổi thứ tự ưu tiên, tạm dừng/tiếp tục/hủy và retry.
- Có thể thêm job sửa trong lúc dịch chính vẫn chạy. Nếu trang chưa có bản dịch đầu vào ổn định, job chờ trang đó hoàn tất; các job cùng một vùng chạy tuần tự hoặc được hỏi cách gộp để tránh đè nhau.
- Nút **Start sửa** chạy các job trong tab hàng chờ sửa. Sau mỗi job, cập nhật preview/kết quả của đúng trang và vùng trong project; không chèn thành trang mới, không đổi thứ tự trang, không đổi tên nguồn và không sửa trang khác.
- Kết quả sửa tạo phiên bản mới, giữ bản trước để so sánh/khôi phục. Nếu có chỉnh sửa mới trong khi job chạy, phát hiện xung đột và yêu cầu rebase/giữ bản người dùng; không để kết quả cũ âm thầm ghi đè.
- Ở chế độ **duyệt thủ công**, kết quả sửa luôn về trạng thái **Cần duyệt**. Người dùng có thể tiếp tục tô vùng/đổi preset/sửa custom prompt và thêm job khác nhiều lần; chỉ khi bấm **Approve/Duyệt** mới đánh dấu phiên bản hiện tại đã duyệt.
- Ở chế độ tự động, job sửa chỉ tự duyệt nếu người dùng đã bật rõ tùy chọn đó và kết quả đạt các điều kiện auto-approve; mặc định job do người dùng chủ động tạo vẫn cần duyệt.
- Áp dụng quy tắc quyền riêng tư giống pipeline chính: job dùng cloud phải hiển thị vùng ảnh/prompt gửi đi và có xác nhận theo cấu hình; không tự gửi dữ liệu chưa được đồng ý.

## 5. Kết nối AI và model local

### 5.1 Các loại provider

- Tích hợp online trực tiếp với 9Router qua API tương thích OpenAI; người dùng cấu hình base URL, API key và model/route tại 9Router. Các provider khác do người dùng tự kết nối/định tuyến bên trong 9Router; ứng dụng không cần tích hợp SDK riêng cho từng nhà cung cấp. Tham khảo [9Router](https://9router.com).
- Tích hợp LM Studio qua API tương thích OpenAI để dùng server/model do người dùng chạy trên máy hoặc endpoint mà họ cấu hình. Tham khảo [tài liệu OpenAI-compatible API của LM Studio](https://lmstudio.ai/docs/developer/openai-compat).
- Cho chọn chiến lược theo project: **Online-first + local fallback**, **Chỉ online**, **Chỉ local** hoặc **Hỏi trước khi chuyển**. Mặc định không tự gửi ảnh lên cloud cho tới khi người dùng chọn online và xác nhận.
- Không mặc định endpoint tương thích OpenAI là local: phân biệt theo base URL/cấu hình và hiển thị rõ khi dữ liệu được gửi tới dịch vụ từ xa.
- Phân biệt rõ API cloud, server local (ví dụ LM Studio) và runtime chạy model trực tiếp trong ứng dụng; đây là các cách triển khai khác nhau, không gộp thành một chế độ "local" mơ hồ.
- Ngoài LM Studio, hỗ trợ runtime offline chạy trực tiếp trong ứng dụng để tải model vào GPU; không yêu cầu người dùng cài server riêng cho chế độ này.
- Mỗi provider khai báo rõ hỗ trợ văn bản, ảnh/vision, streaming, giới hạn context và khả năng inpainting; UI không hiển thị tính năng không được hỗ trợ.
- Cho phép kiểm tra kết nối và gửi yêu cầu thử nghiệm tối thiểu trước khi dùng cho dự án.

### 5.2 Ưu tiên online, tối ưu request và fallback local

- Với chế độ **Online-first + local fallback**, dùng route vision đã chọn trong 9Router làm chính; local vision model do người dùng chọn là phương án dự phòng. Không coi 9Router có thể bỏ giới hạn/quota của provider upstream.
- Tối ưu số request trước khi gửi:
  - Xử lý theo từng trang, không gửi cả chương/album cùng lúc.
  - Khi model hỗ trợ, dùng một yêu cầu vision cho toàn trang để lấy ngữ cảnh, đọc các vùng và đề xuất bản dịch; không gửi lại ảnh toàn trang riêng cho từng bong bóng.
  - Chỉ gửi crop độ phân giải cao cho vùng model đọc chưa chắc hoặc người dùng yêu cầu sửa; với job sửa, gửi vùng tô/crop và ngữ cảnh tối thiểu thay vì toàn bộ trang/chương nếu provider cho phép.
  - Dùng ảnh toàn trang để hiểu bố cục và crop từ ảnh gốc để đọc chữ nhỏ; resize/compress chỉ trong giới hạn giữ được độ đọc.
  - Cache cục bộ theo hash ảnh/vùng + model/route/revision + prompt/template + cấu hình liên quan; chỉ tái sử dụng khi đầu vào khớp, không cache lỗi tạm thời/response thất bại, cho phép xóa cache và không lưu credentials trong cache.
  - Gửi context dưới dạng tóm tắt/glossary cần thiết thay vì tải lên lại các trang trước.
- Có hạn mức do người dùng đặt: tối đa số trang/request cloud mỗi project, ngân sách nếu provider báo được, số lần retry và mức song song. Hiển thị số request/ảnh gửi, chi phí khi API cung cấp, và cảnh báo trước khi chạm ngưỡng.
- Tôn trọng `Retry-After` và rate limit; áp dụng backoff có giới hạn và circuit breaker. Với 429 chỉ chờ/retry trong giới hạn người dùng đặt; nếu quota bị chặn hoặc thời gian chờ vượt giới hạn thì mở circuit breaker cho route đó trong lần chạy hiện tại. Khi circuit breaker mở, không gửi thêm request lên route đó; job đang chờ theo chính sách fallback đã chọn sẽ chuyển local hoặc tạm dừng để hỏi người dùng. Không retry liên tục, nhân bản request song song hoặc đổi provider/account để né quota.
- Chỉ tự fallback với các lỗi kỹ thuật được cấu hình như quota/rate limit, route không hỗ trợ vision, payload vượt giới hạn sau tối đa một lần tối ưu ảnh hoặc lỗi dịch vụ tạm thời. Lỗi API key/cấu hình phải dừng và hướng dẫn sửa; từ chối chính sách/nội dung không được tự động né bằng fallback.
- Với timeout mà không rõ provider đã nhận/xử lý request hay chưa, không gửi lại cùng request lên cloud theo kiểu mù quáng; dùng idempotency key nếu endpoint hỗ trợ, nếu không thì đánh dấu kết quả cloud chưa xác định và chỉ chuyển sang local theo chính sách đã chọn, đồng thời cảnh báo request cloud có thể đã được tính phí.
- Khi provider giới hạn hoặc từ chối request vì lý do kỹ thuật, chuyển đúng job/trang thất bại sang local; không chạy lại các trang cloud đã thành công. Gắn nhãn kết quả theo provider/model, giữ nguyên page ID/thứ tự và ghi lịch sử job.
- Nếu lỗi provider không phân loại được hoặc không cho biết có thể fallback an toàn hay không, tạm dừng và hỏi người dùng thay vì retry/fallback vô hạn.
- Trong queue và lịch sử, hiển thị route/model đã dùng cho từng job, số lần thử, nguyên nhân fallback và trạng thái local fallback; không gộp thành trạng thái "thành công" mà giấu việc chuyển model.
- Nếu model local dự phòng chưa Load hoặc không đủ VRAM, dừng job và hỏi người dùng **Load model**, **Chờ**, **Bỏ qua** hoặc **Hủy**; chỉ tự Load khi người dùng bật trước tùy chọn này và đã thấy ước lượng bộ nhớ/thời gian.
- Cung cấp chế độ **Hỏi trước khi chuyển** và thông báo rõ nguyên nhân mỗi lần chuyển. Không âm thầm gửi ảnh ra cloud hoặc thay đổi chiến lược đã chọn.
- Khi provider route không hỗ trợ ảnh/vision, phát hiện ở bước kiểm tra khả năng trước khi chạy; yêu cầu chọn route khác hoặc local, không chờ gửi ảnh rồi lặp request lỗi.

### 5.3 Local inference và GPU

- Thiết kế adapter để có thể tích hợp runtime phù hợp (ví dụ llama.cpp hoặc runtime khác sau khi xác minh tính khả thi trên hệ điều hành mục tiêu).
- Kiểm tra riêng khả năng hỗ trợ NVIDIA và AMD theo backend, driver, hệ điều hành và định dạng model. Có thể cung cấp CPU fallback nếu hiệu năng chấp nhận được.
- Không giả định VRAM là tài nguyên duy nhất: ước lượng bộ nhớ cần cho trọng số, context/KV cache, độ phân giải ảnh, runtime và bộ nhớ hệ thống.
- Đọc thông tin GPU/VRAM khi khả dụng; nếu không đọc được, cho phép nhập thủ công và giải thích giới hạn của ước lượng.
- Đưa ra danh sách model đề xuất theo tài nguyên và tính năng vision/đọc chữ/dịch, kèm định lượng ước tính, chất lượng tương đối và cảnh báo tương thích. Ví dụ, GPU 6 GB thường cần model nhỏ/quantized hoặc CPU/hybrid; không hard-code rằng một model cụ thể chắc chắn chạy được.
- Cho phép người dùng chọn model khác, quantization, giới hạn context và mức dùng GPU; kiểm tra tương thích trước khi tải/chạy.
- Mặc định đề xuất model theo VRAM trống thực tế, không chỉ theo dung lượng VRAM danh định; tính cả màn hình/ứng dụng khác, kích thước ảnh, context/KV cache, vision encoder, runtime và bộ nhớ dự phòng.
- Với VRAM 6–8 GB, đề xuất `Qwen3-VL-4B-Instruct-GGUF` ở quantization `Q4_K_M` cùng vision encoder `mmproj` `Q8_0`. Đây là vision-language model có thể nhìn ảnh/đọc chữ đa ngôn ngữ; file LLM khoảng 2.50 GB và mmproj khoảng 0.45 GB. Đây là dung lượng tải xuống, không phải tổng VRAM đảm bảo khi chạy.
- Với VRAM 10–16 GB, đề xuất `Qwen3-VL-8B-Instruct-GGUF` ở `Q4_K_M` cùng mmproj `Q8_0`. Theo Hugging Face, file LLM khoảng 5.03 GB và mmproj khoảng 0.75 GB. Bắt đầu với context vừa phải; ở card 10 GB, chỉ chọn model này nếu kiểm tra bộ nhớ khả dụng cho thấy còn đủ chỗ, nếu không đề xuất model 4B hoặc hybrid CPU/GPU.
- Trên 16 GB, tiếp tục đề xuất model 8B này làm mặc định; cho phép người dùng tải/chọn model lớn hơn, nhưng không tự tải hoặc coi model lớn hơn là bắt buộc.
- Trong khoảng 8–10 GB hoặc khi VRAM đang bị ứng dụng khác sử dụng, mặc định giữ model 4B; chỉ cho phép thử model 8B sau bước kiểm tra khả năng nạp, có thể từ chối rõ ràng hoặc dùng CPU offload.
- Các tên model và dung lượng chỉ là cấu hình khởi đầu cần kiểm thử thực tế trên NVIDIA/AMD và runtime mục tiêu. Không tuyên bố mọi card cùng mức VRAM đều chạy được giống nhau.
- Tải model chỉ khi người dùng chủ động xác nhận; hiển thị dung lượng, nguồn, license, checksum nếu có, tiến độ, hủy và xóa model.
- Đề xuất nguồn model đã kiểm tra: [Qwen3-VL-4B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF) và [Qwen3-VL-8B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF). Model card ghi license Apache-2.0; vẫn phải đọc lại license/model card của đúng revision trước khi tải.
- Tôn trọng license model và điều khoản dịch vụ. Không tải/chạy tệp không rõ nguồn hoặc thực thi nội dung model như mã.
- Thông báo rõ khi sử dụng cloud và dữ liệu/ảnh nào sẽ được gửi ra ngoài. Chế độ offline phải không phát sinh yêu cầu mạng ngoài ý muốn.
- Trước khi gửi ảnh/nội dung lên cloud, thông báo phạm vi dữ liệu sẽ gửi và xin xác nhận phù hợp; nếu có thể, cho phép giới hạn gửi theo trang/vùng và đặt cảnh báo hoặc giới hạn chi phí.

### 5.4 Thư viện model và nạp/eject

- Có thư mục `models` riêng của ứng dụng và cho phép người dùng chọn thêm thư mục model.
- Trong màn hình quản lý model local, hiển thị đường dẫn thư mục model đang dùng và nút **Mở thư mục models** để mở đúng thư mục đó trong Windows Explorer; nếu chưa tồn tại thì tạo thư mục mặc định trước khi mở. Nếu người dùng cấu hình thư mục model tùy chỉnh, nút phải mở thư mục đang hoạt động đó, không mở nhầm thư mục mặc định.
- Thư mục model ở portable nên nằm tại `models` cạnh ứng dụng nếu đường dẫn portable có quyền ghi; nếu không, dùng đường dẫn dữ liệu người dùng có thể ghi và hiển thị rõ đường dẫn thực tế. Không thất bại im lặng hoặc yêu cầu quyền admin chỉ để mở thư mục.
- Hướng dẫn rõ người dùng tải đúng file model và vision encoder `mmproj` từ nguồn Hugging Face chính thức, rồi chép/copy các file vào thư mục đã mở; ứng dụng tự quét, nhận diện cặp file và cập nhật trạng thái theo thời gian thực. Nút mở thư mục không tự tải hoặc Load model.
- Theo dõi thư mục model theo thời gian thực; khi người dùng thêm/xóa/đổi tên file, cập nhật danh mục mà không cần khởi động lại ứng dụng.
- Chỉ tự nhận diện và lập chỉ mục file; không tự tải hoặc nạp model vào GPU. Hiển thị tên, định dạng, quantization, kích thước, năng lực vision, nguồn và trạng thái tương thích khi đọc được.
- Phiên bản đầu hỗ trợ một định dạng/runtime đã kiểm chứng (ưu tiên GGUF với llama.cpp); file không tương thích phải hiện lý do, không giả làm model dùng được.
- Với VLM GGUF như Qwen3-VL, nhận diện cặp file trọng số LLM và `mmproj` vision encoder tương ứng; chỉ báo sẵn sàng khi đủ các file cần thiết. Hỗ trợ model chia nhiều shard nếu runtime yêu cầu.
- Người dùng chọn model trong danh mục rồi bấm **Load** để nạp; hiển thị tiến độ, VRAM sử dụng và lỗi cụ thể. Không tự chuyển model đang chạy nếu chưa được xác nhận.
- Nút **Eject/Unload** yêu cầu runtime giải phóng model khỏi GPU; cập nhật trạng thái sau khi runtime xác nhận và báo lỗi nếu giải phóng thất bại.
- Không cho xóa/di chuyển file model đang được nạp; yêu cầu eject trước. Không tự xóa file model khi eject.
- Tải model tùy chọn từ nguồn đã xác minh phải có xác nhận, dung lượng, license, checksum nếu có, khả năng hủy và kiểm tra file sau tải. Không tự tải model từ link không rõ nguồn.

### 5.5 Giám sát GPU theo thời gian thực

- Có bảng **GPU** trong ứng dụng, nhận diện nhiều adapter nếu máy có nhiều GPU và cho chọn GPU đang dùng cho model.
- Hiển thị các chỉ số khi phần cứng/driver cung cấp:
  - Mức sử dụng GPU (%), phân biệt mức sử dụng toàn GPU và mức của tiến trình ứng dụng nếu đọc được.
  - VRAM đã dùng/tổng, còn trống và mức dùng của tiến trình/model nếu đọc được; phân biệt bộ nhớ dedicated với shared/system memory.
  - Công suất hiện tại (W), giới hạn công suất nếu driver cung cấp.
  - Nhiệt độ GPU (°C); nhiệt hotspot và nhiệt VRAM là chỉ số tùy model card.
  - Xung GPU, tốc độ quạt (RPM/%), CPU/RAM hệ thống là thông tin bổ sung nếu đọc được.
- Trên Windows, ưu tiên GPU Engine Performance Counters qua PDH khi có để đọc mức sử dụng theo adapter/engine/tiến trình; dùng DXGI `QueryVideoMemoryInfo` cho budget và mức dùng bộ nhớ của tiến trình; dùng API hãng cho cảm biến. Có thể tham khảo [Microsoft DXGI](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_4/nf-dxgi1_4-idxgiadapter3-queryvideomemoryinfo), [NVIDIA NVML](https://docs.nvidia.com/deploy/nvml-api/latest/index.html) và [AMD ADLX](https://gpuopen.com/adlx/).
- Không giả định Windows API phổ thông cung cấp mọi cảm biến cho mọi card; công suất/nhiệt độ/quạt phụ thuộc GPU, driver và API hãng. Chỉ số không đọc được phải hiện **Không hỗ trợ/Không khả dụng**, không thay bằng số ước tính nhưng ghi như số đo thật.
- Cập nhật theo chu kỳ cấu hình hợp lý (mặc định khoảng 1–2 giây), hiển thị thời điểm cập nhật/nguồn dữ liệu và biểu đồ lịch sử ngắn trong phiên. Có thể tắt cập nhật liên tục để giảm overhead.
- Khi nạp model, hiển thị VRAM đang dùng và ước lượng bộ nhớ cần thêm; cảnh báo nếu thiếu budget hoặc VRAM trống. Sau khi nạp/eject, cập nhật chỉ số và trạng thái model.
- Chế độ giám sát chỉ đọc. Không tự ép xung, đổi power limit, chỉnh quạt hoặc yêu cầu quyền quản trị chỉ để hiển thị telemetry.

## 6. Giao diện

- Giao diện desktop hiện đại, nhất quán theo shadcn/ui, có chế độ sáng/tối và hỗ trợ localization; ưu tiên tiếng Việt ban đầu.
- Bố cục gợi ý:
  - Thanh trên: dự án, lưu, hoàn tác, nút Export/Xuất (luôn hiển thị; chỉ bật khi có kết quả và không còn job dịch đang chạy), chọn provider/model.
  - Thanh bên: danh sách trang và trạng thái.
  - Khu vực chính: canvas ảnh có overlay và preview.
  - Có thể so sánh ảnh gốc và ảnh dịch cạnh nhau, bằng thanh kéo hoặc nhấp nháy.
  - Panel bên cạnh: nội dung vision model nhận diện, bản dịch, glossary, thiết lập vùng và kiểu chữ.
  - Thanh dưới: tiến trình pipeline, cảnh báo và điều khiển batch.
  - Khu vực GPU: mức sử dụng, VRAM, công suất, nhiệt độ và trạng thái cảm biến; có thể thu gọn.
  - Có tab **Trang/Preview** và tab **Hàng chờ sửa**; giữ vị trí trang hiện tại khi chuyển tab.
- UI phải dùng được khi không kết nối mạng ở chế độ local, trừ các chức năng phụ thuộc dịch vụ bên ngoài.
- Không chặn giao diện trong khi xử lý ảnh/model; thao tác dài phải có tiến độ và khả năng hủy.
- Đảm bảo tương tác bàn phím, nhãn dễ hiểu, trạng thái focus và tương phản phù hợp.
- Wizard lần đầu phải dễ hiểu với người mới, không ép cấu hình AI; có thể bỏ qua, xem demo offline và mở lại từ menu trợ giúp.

## 7. Dữ liệu, quyền riêng tư và độ tin cậy

- Không sửa/xóa ảnh nguồn; xuất kết quả sang thư mục/tên file mới.
- Không gửi ảnh hoặc nội dung dự án lên cloud nếu chưa chọn provider cloud và được thông báo.
- Không lưu API key dạng plaintext; che key trong UI và loại khỏi log/lỗi.
- Lưu cấu hình nhạy cảm ngoài file dự án khi có thể; khi xuất/chia sẻ dự án phải loại thông tin xác thực.
- Nêu rõ dữ liệu tạm, dữ liệu được lưu và cách xóa cache/model.
- Ghi nhật ký tác vụ không chứa bí mật; cho phép người dùng xem lỗi hữu ích.
- Không quảng cáo kết quả vision/đọc chữ, bản dịch, nhận diện vùng hoặc inpainting là hoàn hảo; luôn cho phép kiểm tra và sửa.

## 8. Tiêu chí nghiệm thu

1. Ứng dụng khởi động được trên hệ điều hành mục tiêu và tạo/mở/lưu project `.mangatrans` mẫu.
2. Nhập nhiều trang, lưu rồi mở lại project; thứ tự trang, nội dung, thiết lập và trạng thái duyệt được khôi phục, ảnh nguồn không bị sửa.
3. Pipeline có thể phát hiện/nhập vùng chữ, hiển thị overlay và cho phép thêm, sửa, xóa vùng.
4. Người dùng sửa được nội dung vision model nhận diện và bản dịch, có preview dàn chữ và cảnh báo tràn.
5. Context/glossary được dùng xuyên trang và có thể cấu hình; việc tạo lại không âm thầm ghi đè chỉnh sửa đã duyệt.
6. Ngôn ngữ nguồn được nhận diện mặc định theo vùng khi khả thi; người dùng có thể ghi đè ở cấp vùng/trang/dự án, và ứng dụng cho biết độ tin cậy hoặc hạn chế khi nhận diện.
7. Danh sách cần duyệt dẫn đúng tới vấn đề tương ứng; chế độ tự động không chấp nhận các mục vi phạm điều kiện đã cấu hình.
8. Kết nối được 9Router và LM Studio qua cấu hình endpoint; UI phân biệt dịch vụ từ xa/local, kiểm tra khả năng model/provider và báo rõ lỗi key, mạng hoặc tính năng vision không tương thích.
9. Tự động duyệt và duyệt thủ công có hành vi phân biệt đúng; các mục độ tin cậy thấp không bị âm thầm chấp nhận.
10. Có thể tạm dừng/hủy/retry batch và thấy lỗi theo trang/công đoạn.
11. Sau khi pipeline dịch kết thúc, nút **Export/Xuất** xuất ảnh ra thư mục con `<tên project> <mã ngôn ngữ đích>` trong đích đến người dùng chọn (ví dụ `Tên truyện vi`); ảnh mở được bằng ứng dụng xem ảnh thông thường và project `.mangatrans` vẫn mở lại/chỉnh sửa được.
12. Hồ sơ nhân vật/tóm tắt ngữ cảnh có thể xem và sửa; sửa lại một vùng không làm mất các chỉnh sửa đã duyệt khác.
13. Kiểm thử tự động cho các luồng cốt lõi, nhận diện ngôn ngữ và ghi đè thủ công, lưu dự án/phiên bản, trạng thái công việc và các tình huống lỗi.
14. Tài liệu hướng dẫn cài đặt/chạy, cấu hình provider, yêu cầu GPU, giới hạn đã biết và cách báo lỗi.
15. Danh mục model cập nhật khi file được thêm vào thư mục; model VLM thiếu mmproj không được báo sẵn sàng; Load/Eject phản ánh đúng trạng thái runtime.
16. Trên Windows, hiển thị được các chỉ số GPU mà hệ thống/driver hỗ trợ; sensor không có phải hiện rõ là không khả dụng, không crash hoặc hiển thị số giả.
17. Nếu một tính năng chưa triển khai (ví dụ vision text reading, phát hiện vùng, inpainting hoặc telemetry GPU trên một model card), đánh dấu rõ trong UI/tài liệu và không tạo kết quả giả.
18. Nếu môi trường agent có MCP dùng để điều khiển/quan sát ứng dụng, phải chạy các luồng UI MCP độc lập được liệt kê trong testcase; nếu không có MCP, ghi rõ giới hạn và chạy các kiểm thử thay thế khả dụng.
19. Có bản cài Windows x64 để người dùng cài và mở ứng dụng mà không cần cài Rust, Node.js hoặc chạy lệnh build; kiểm thử trên môi trường Windows sạch.
20. Bản phát hành có `docs/USER_GUIDE_VI.md` và `docs/RELEASE_TEST_REPORT.md`; báo cáo nêu file build, kết quả test, điều kiện cần để dịch, khả năng tương thích đã xác minh và giới hạn còn lại.
21. Lần mở đầu hướng dẫn rõ lựa chọn 9Router, LM Studio hoặc model local; không giả định người dùng đã có API key, server/model hoặc kết nối mạng.
22. Có bản portable chạy từ thư mục đã giải nén, không cần cài đặt/quyền admin; kiểm tra đường dẫn ghi dữ liệu, WebView2/runtime và lần chạy trên Windows sạch.
23. Wizard người mới có thể bỏ qua/quay lại/mở lại; kiểm thử cả luồng demo offline lẫn trường hợp chưa cấu hình provider, và không gửi dữ liệu ra mạng ngoài ý muốn.
24. Nhập folder vào project mới hiện câu hỏi đổi tên Có/Không; project đã lưu không bị đổi tên/di chuyển tự động.
25. Natural sort/regex sắp đúng các tên có số và padding (`1`, `01`, `001`, `10`); trang không rõ tên được vision model gợi ý có độ tin cậy và yêu cầu xác nhận khi mơ hồ.
26. Template đầu ra xem trước đúng số trang, padding và biến; filename trùng/ký tự Windows cấm được báo trước, ảnh nguồn không bị đổi tên hoặc ghi đè mặc định.
27. Bấm **Start dịch** chạy pipeline có tiến độ tổng/trang/công đoạn; trong lúc chạy vẫn chuyển trang và xem preview đã hoàn tất mà UI không bị khóa.
28. Có thể tô vùng, chọn preset hoặc custom prompt và thêm job sửa khi pipeline đang chạy; nút **Start sửa** xử lý hàng chờ riêng.
29. Job sửa cập nhật đúng trang/vùng đã chọn, giữ nguyên thứ tự và các trang khác; chế độ thủ công cho phép sửa lặp và chỉ hoàn tất sau khi người dùng approve.
30. Thay đổi người dùng mới hơn không bị job cũ ghi đè; job chờ đúng khi bản dịch gốc của trang chưa hoàn tất và lỗi/retry được hiển thị rõ.
31. Lưu/đóng/mở lại project khôi phục hàng chờ sửa, vùng tô, prompt, trạng thái và liên kết đúng trang.
32. Online-first tối ưu request theo trang/vùng, tái sử dụng cache và không gửi lại ảnh đã xử lý nếu input/cấu hình không đổi.
33. Khi lỗi kỹ thuật đủ điều kiện fallback, chỉ job bị lỗi được chuyển sang local; job thành công không chạy lại, người dùng được báo nguyên nhân/model mới.
34. Không fallback tự động khi lỗi key/cấu hình, người dùng hủy hoặc provider từ chối theo chính sách; nếu local chưa nạp/thiếu VRAM thì dừng và hướng dẫn.
35. Rate limit/quota được tôn trọng: retry có giới hạn, tuân thủ Retry-After/circuit breaker, không tạo request song song để vượt giới hạn.
36. Sau khi job dịch kết thúc, Export/Xuất cho phép chọn thư mục cha và tạo đúng thư mục `<tên project> <mã ngôn ngữ đích>`; preview đường dẫn và xử lý va chạm tên an toàn.
37. Export dùng đúng template/thứ tự trang; mặc định chỉ gồm trang đã duyệt trong manual mode, báo trang thiếu/lỗi và không ghi đè ảnh nguồn hay file đã có.
38. Trạng thái nút Export/Xuất đúng theo pipeline; export hủy/lỗi không làm hỏng bản export cũ, và export lại sau khi chỉnh sửa tạo bản mới có lịch sử rõ ràng.
39. Nút **Mở thư mục models** mở đúng thư mục đang hoạt động; thêm/xóa model hoặc cặp GGUF/mmproj ở đó cập nhật danh mục theo thời gian thực mà không tự Load.
40. GitHub repository/release không chứa model weights (`.gguf`, `mmproj`), API key hoặc dữ liệu project riêng tư; public portable vẫn chạy và hướng dẫn tải model từ nguồn chính thức.
41. README không dùng emoji, giới thiệu ứng dụng, hướng dẫn cài installer/portable và dùng cơ bản; GitHub Release có installer Windows, portable public không model, source code và checksum.
42. Portable nội bộ trên máy người dùng có sẵn các model gợi ý đã tải để thử local; các model chỉ nằm trong thư mục local ngoài Git và không xuất hiện trong repository/source archive/GitHub Release.
43. Hoàn tất công việc bao gồm push source/README lên repository đích và tạo GitHub Release có các artifact đã kiểm tra. Không được báo hoàn tất nếu chưa publish thành công; nếu thiếu quyền, credentials, build hoặc upload bị lỗi thì báo trạng thái **Blocked** cùng nguyên nhân và bước cần người dùng hỗ trợ.

## 9. Test cases và quy trình agent tự kiểm tra

Tạo test tự động cho logic Rust/frontend và test UI cho các luồng chính. Dùng ảnh truyện synthetic, public-domain hoặc do người dùng cung cấp; không tải/gửi nội dung có bản quyền để test nếu chưa được cho phép.

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-PROJ-01 | Tạo project, nhập vài ảnh mẫu, đổi thứ tự trang, tạo vùng chữ, lưu, đóng và mở lại `.mangatrans`. | Thứ tự, vùng, bản dịch, thiết lập và trạng thái duyệt được khôi phục; ảnh nguồn không đổi. |
| TC-REGION-01 | Dùng vision model đọc vùng, sửa nội dung nhận diện/bản dịch; tạo/sửa/xóa vùng; dùng undo/redo và tắt/bật overlay. | Overlay khớp vùng, thao tác hoàn tác đúng, ảnh nguồn không bị vẽ đè; không gọi OCR engine riêng. |
| TC-LANG-01 | Chọn ngôn ngữ đích, nhận diện ngôn ngữ nguồn; kiểm thử trang nhiều ngôn ngữ, độ tin cậy thấp và ghi đè ở cấp vùng/trang. | Chỉ ngôn ngữ đích là bắt buộc; vùng chưa chắc chắn được đưa đi duyệt, không âm thầm dịch sai ngôn ngữ. |
| TC-CONTEXT-01 | Dịch các trang có glossary/hồ sơ nhân vật; chỉnh tay một vùng rồi tạo lại vùng khác. | Tên/xưng hô nhất quán theo cấu hình; bản dịch đã duyệt không bị ghi đè; tóm tắt có thể xem/sửa. |
| TC-LAYOUT-01 | Dùng câu dịch dài trong chế độ giữ nguyên vùng, ưu tiên vừa khung và mở rộng vùng. | Cảnh báo tràn/đọc khó; không tự làm mất nghĩa hoặc thay ảnh nguồn; inpainting không hỗ trợ phải báo rõ. |
| TC-API-01 | Dùng mock OpenAI-compatible endpoint để giả lập 9Router/LM Studio: thành công, timeout, lỗi xác thực, model không hỗ trợ ảnh. | Cấu hình/provider xử lý đúng; lỗi rõ; test không gọi API trả phí hoặc gửi dữ liệu ra ngoài. |
| TC-ROUTE-01 | Chạy online-first với mock vision provider thành công trên nhiều trang; chạy lại trang không đổi. | Mỗi trang chỉ gửi request theo chính sách tối ưu; trang không đổi lấy kết quả từ cache; không xử lý lại bằng local nếu online đã thành công. |
| TC-FALLBACK-01 | Mock quota/rate-limit hoặc giới hạn ảnh; bật local model giả lập và đưa nhiều trang vào queue. | Tôn trọng backoff/Retry-After; chuyển job lỗi và job đang chờ sang local theo chính sách; giữ nguyên job thành công/thứ tự; mở circuit breaker để không gửi tiếp lên route bị chặn; UI ghi rõ nguyên nhân. |
| TC-FALLBACK-GUARD-01 | Mock lỗi API key, người dùng hủy, policy rejection, timeout không rõ trạng thái nhận request và local model chưa Load/VRAM thiếu. | Không fallback lặng lẽ hoặc gửi lại mù quáng; lỗi key/policy/cancel dừng; timeout được đánh dấu trạng thái cloud chưa xác định và có cảnh báo chi phí; local chưa sẵn sàng thì đưa job về trạng thái chờ và hướng dẫn. |
| TC-CLOUD-CACHE-01 | Chạy cùng trang/region nhiều lần không đổi rồi sửa một vùng; dùng mock đếm request và payload. | Kết quả không đổi được cache; job sửa chỉ gửi vùng/context cần thiết theo capability; không gửi cả chương lặp lại cho từng vùng. |
| TC-BATCH-01 | Chạy nhiều trang, tạm dừng, tiếp tục, hủy và retry riêng một công đoạn thất bại. | Trạng thái từng trang chính xác; không chạy trùng, không mất kết quả đã hoàn tất. |
| TC-START-01 | Bắt đầu dịch 3 trang; khi trang đầu có preview, chuyển xem trang đó trong lúc trang sau đang xử lý. | Tiến độ tổng/trang đúng, preview không stale, UI vẫn thao tác được và không khởi chạy job trùng. |
| TC-REPAIR-01 | Chọn trang thứ hai, tô vùng tràn, chọn preset, thêm hàng, bấm Start sửa; sau đó thêm custom prompt, sửa lại và cuối cùng approve trong chế độ thủ công. | Cả hai lần đều cập nhật đúng trang thứ hai/vùng; trang 1/3 và ảnh nguồn giữ nguyên; kết quả không được approve tự động, phiên bản cuối chỉ hoàn tất sau thao tác approve. |
| TC-REPAIR-RACE-01 | Tạo job sửa trong khi trang đó chưa dịch xong; thử chỉnh tay khi job đang chạy và tạo thêm job cùng vùng. | Job chờ đúng input, không chạy trùng/đè; thay đổi mới được giữ hoặc có xử lý xung đột rõ ràng. |
| TC-REPAIR-PERSIST-01 | Tạo job sửa có mask/prompt, lưu và mở lại project khi job còn chờ. | Job, mask, prompt, trạng thái và liên kết trang được khôi phục; không tự chạy lại nếu người dùng chưa bấm Start sửa. |
| TC-MODEL-01 | Thêm/xóa model và cặp GGUF/mmproj khi ứng dụng đang mở; thử file thiếu/sai cặp; Load/Eject qua mock runtime. | Danh mục cập nhật realtime; model thiếu thành phần không sẵn sàng; Load/Eject cập nhật đúng hoặc báo lỗi. |
| TC-MODEL-FOLDER-01 | Bấm **Mở thư mục models** với cấu hình mặc định và tùy chỉnh; thêm/xóa model fixture trong folder đã mở. | Mở đúng đường dẫn hiển thị; danh mục cập nhật theo thời gian thực, nhận diện file thiếu/cặp hoàn chỉnh và không tự Load model. |
| TC-GPU-01 | Kiểm thử telemetry với dữ liệu giả lập và trên Windows/GPU thật khi sẵn có. | Mức tải, VRAM, công suất, nhiệt độ có nguồn/đơn vị; sensor thiếu hiện Không khả dụng; không có số giả hoặc crash. |
| TC-EXPORT-01 | Hoàn tất dịch, bấm Export, chọn thư mục cha, xuất ảnh và mở bằng image decoder; so sánh checksum ảnh nguồn trước/sau. | Tạo đúng thư mục `<tên project> <mã ngôn ngữ đích>` (ví dụ `Tên truyện vi`), file theo template/thứ tự; ảnh đầu ra hợp lệ, ảnh nguồn không đổi. |
| TC-EXPORT-STATE-01 | Kiểm tra nút Export trước Start, trong khi dịch, sau khi hoàn tất, khi chỉ có kết quả chưa duyệt, khi một số trang lỗi và khi tất cả trang lỗi. | Nút luôn hiển thị nhưng bị vô hiệu hóa khi job đang chạy/chưa có kết quả; bật sau khi có kết quả, hiển thị đúng số trang có thể xuất; không cho export khi không có kết quả. |
| TC-EXPORT-DEST-01 | Thử tên project có ký tự Windows cấm, ngôn ngữ `vi`/`en`/`ja`, biến thể `pt-BR`, ngôn ngữ `yue` không có mã ISO 639-1, thư mục đích đã tồn tại, manual mode còn trang chưa duyệt và một trang dịch thất bại. | Preview tên/đường dẫn đã làm sạch; mã folder lần lượt là `vi`/`en`/`ja`/`pt`/`yue` và có thể sửa; không ghi đè âm thầm; mặc định chỉ xuất trang đã duyệt, thông báo trang chưa duyệt/thất bại và thống kê chính xác. |
| TC-EXPORT-INTERRUPT-01 | Hủy export giữa chừng; giả lập thư mục không có quyền ghi, hết dung lượng và lỗi ghi một số trang. | Hủy/lỗi toàn bộ dọn staging, giữ nguyên bản export cũ và không báo thành công; lỗi một phần chỉ công bố file thành công kèm báo cáo trang lỗi. |
| TC-EXPORT-REEXPORT-01 | Export project, sửa và approve một trang, sau đó export lại vào cùng thư mục cha. | Bản cũ không bị ghi đè; tạo tên folder mới có hậu tố, cập nhật lịch sử/đánh dấu bản cũ; ảnh mới phản ánh đúng nội dung đã sửa. |
| TC-UI-MCP-01 | Dùng MCP mở app, tạo project test, điều hướng tới các khu vực chính, lưu/đóng/mở lại project. | App khởi động và thao tác project được qua UI; trạng thái được khôi phục, không có lỗi nghiêm trọng. |
| TC-UI-MCP-02 | Dùng provider giả lập để bấm Start dịch, xem preview khi batch chạy và theo dõi tiến độ. | UI không khóa; preview/trạng thái đúng; nút Export bị vô hiệu hóa khi còn job và chuyển đúng trạng thái khi batch kết thúc. |
| TC-UI-MCP-03 | Dùng project test để tạo job sửa, Start sửa, kiểm tra kết quả đúng trang và approve thủ công. | Queue, preview và trạng thái duyệt khớp; không ảnh hưởng trang khác; có thể lưu/mở lại project. |
| TC-UI-MCP-04 | Dùng project có kết quả mock đã hoàn tất, chọn thư mục export test, kiểm tra preview đường dẫn và xuất lại sau khi sửa một trang. | Folder/tệp đúng quy tắc; va chạm được xử lý rõ; export mới không ghi đè bản cũ và hiển thị trạng thái/history chính xác. |
| TC-BUILD-01 | Cài bản Windows x64 trên máy/VM sạch, mở từ shortcut, chạy smoke test rồi gỡ cài đặt. | Không cần môi trường dev; app khởi động, nêu rõ bước cấu hình AI và gỡ cài đặt không xóa project người dùng nếu chưa xác nhận. |
| TC-PORTABLE-01 | Giải nén gói portable vào thư mục không cần admin trên Windows sạch, chạy ứng dụng, tạo project và đóng/mở lại. | App chạy không cần installer/dev tools; dữ liệu lưu đúng nơi đã thông báo; nếu thiếu WebView2/runtime thì hướng dẫn cài từ nguồn chính thức. |
| TC-PORTABLE-MODELS-01 | Chạy bản portable nội bộ có model trong `models`; chạy bản portable public sạch không có weights rồi dùng model fixture để kiểm tra hướng dẫn/nút mở folder. | Bản nội bộ nhận diện và, khi có GPU/runtime phù hợp, Load được model đã chuẩn bị; bản public không chứa weights, hướng dẫn/đường dẫn mở folder đúng và fixture được nhận diện realtime. CI không tải model nhiều GB. |
| TC-GITHUB-RELEASE-01 | Kiểm tra nội dung GitHub repository và Release candidate trước khi phát hành. | Có README tiếng Việt không emoji; Release có installer, portable không model, source code và checksum; không có `.gguf`, `mmproj`, API key, project mẫu riêng tư hoặc build artifact bị commit nhầm vào source. |
| TC-ONBOARD-01 | Chạy onboarding như người mới: chọn Để sau, quay lại, chạy demo offline, thử cấu hình endpoint lỗi rồi mở lại hướng dẫn. | Không bị khóa khỏi app; demo ghi rõ là demo; key được che; lỗi có hướng dẫn; link key/setup trỏ đúng nguồn chính thức; không phát sinh cloud request khi chưa xác nhận. |
| TC-ORDER-01 | Nhập folder có tên `1.jpg`, `01.jpg`, `001.jpg`, `2.jpg`, `10.jpg` và các mẫu chapter/page; thử regex/natural sort, vision model đọc số trang và đổi tên project Có/Không. | Thứ tự số đúng (10 đứng sau 2); prompt Có/Không đúng; tên nguồn được giữ nguyên; thứ tự mơ hồ yêu cầu xác nhận. |
| TC-ORDER-AI-01 | Với fixture truyện synthetic/public-domain đã xáo trộn và tên file vô nghĩa, yêu cầu VLM đề xuất thứ tự bằng dấu hiệu trang/số trang/tình tiết; gồm ít nhất một trang mơ hồ. | Hiển thị thứ tự đề xuất kèm căn cứ/confidence; vùng mơ hồ yêu cầu người dùng duyệt; thứ tự đã khóa thủ công không bị đổi. Ghi rõ model/revision khi chạy kiểm thử chất lượng thật. |
| TC-NAME-01 | Thử template `{index}.{ext}`, `{page:000}.{ext}` và template có project/chapter; export vào thư mục có file trùng/tên Unicode/ký tự Windows cấm. | Preview tên chính xác theo start index/padding; va chạm được chặn hoặc hỏi; không ghi đè âm thầm. |

### Quy trình tự kiểm tra và sửa lỗi

1. Trước khi sửa code, xem test/build/lint hiện có và ghi nhận lỗi nền có sẵn để phân biệt với lỗi mới.
2. Sau mỗi mốc, chạy các test liên quan; trước khi báo hoàn tất, chạy lại toàn bộ bộ test phù hợp và build ứng dụng.
3. Nếu test thất bại, đọc lỗi và log, tìm nguyên nhân gốc, sửa code/test nếu cần, rồi chạy lại test thất bại cùng nhóm test bị ảnh hưởng. Lặp lại cho đến khi pass hoặc xác định được blocker thực tế.
4. Nếu có MCP điều khiển desktop/UI, agent phải tự mở ứng dụng và chạy các luồng `TC-UI-MCP-01` đến `TC-UI-MCP-04`; ghi nhận rõ bước nào đã kiểm tra và kết quả. Dùng MCP chỉ để điều khiển/quan sát ứng dụng test, không gửi credentials, ảnh riêng tư hay dữ liệu thật qua công cụ không được phép.
5. MCP là tùy chọn của môi trường phát triển, không phải dependency runtime/bắt buộc cài vào sản phẩm. Nếu không có MCP, dùng UI automation/test runner sẵn có; không tuyên bố đã kiểm tra giao diện bằng MCP.
6. Không dùng API trả phí, tải model lớn hoặc kiểm thử GPU thật nếu chưa được người dùng cho phép. Dùng mock/fake runtime cho CI; ghi rõ test phần cứng/provider nào chưa thể chạy.
7. Báo kết quả theo từng nhóm: pass, fail, blocked/not run; nêu lệnh/test, môi trường và lỗi còn tồn tại. Không được đánh dấu pass chỉ vì test khởi chạy thành công.

## 10. Kế hoạch triển khai đề xuất

Không cố xây toàn bộ hệ thống AI trong một bước. Tạo các mốc nhỏ có thể chạy và kiểm thử:

### Mốc 1 — Khung ứng dụng

- Khởi tạo Tauri + Rust + React/TypeScript + shadcn/ui.
- Tạo `.gitignore` sớm để loại trừ secrets, model weights, output/cache và build artifacts khỏi Git; tạo README ban đầu, cập nhật dần theo tính năng đã thực sự triển khai.
- Tạo dự án, nhập/xem/sắp xếp ảnh, lưu và mở lại dự án.
- Nhập folder, giữ tên gốc, nhận diện số trang bằng regex/natural sort; hỏi Có/Không trước khi lấy tên folder làm tên project.
- Lưu/đóng/mở lại một project `.mangatrans` và xác nhận dữ liệu dự án được khôi phục.
- Thiết lập pipeline build bản cài thử nghiệm và chạy TC-BUILD-01 sớm để phát hiện vấn đề đóng gói.
- Thiết lập wizard onboarding, demo offline và gói portable thử nghiệm; chạy TC-ONBOARD-01/TC-PORTABLE-01.
- Xây canvas có zoom/pan, danh sách trang và cấu trúc dữ liệu vùng chữ.
- Chọn ngôn ngữ đích; hỗ trợ nhập ngôn ngữ nguồn thủ công trong khi chưa có nhận diện tự động.
- Thêm kiểm thử và hướng dẫn chạy.

### Mốc 2 — Vùng chữ và preview

- Tạo/sửa/xóa vùng chữ thủ công, overlay, chỉnh thuộc tính chữ và preview dàn chữ.
- Cảnh báo tràn, undo/redo, bộ ghi ảnh đầu ra và hộp thoại chọn thư mục export cơ bản (có thể kiểm thử bằng nội dung dịch mẫu).
- Có template tên file đầu ra, preview tên và chặn va chạm trước khi export.

### Mốc 3 — Vision và dịch qua API

- Tạo pipeline/provider abstractions; tích hợp vision model nhận diện vùng/đọc chữ trực tiếp từ ảnh và cấu hình kết nối 9Router/LM Studio.
- Tích hợp 9Router cho dịch vụ online và LM Studio cho server local qua API tương thích OpenAI; không viết adapter SDK riêng cho từng provider được định tuyến qua 9Router.
- Gom xử lý theo trang, cache theo input/model/config và giới hạn gửi crop/request dư thừa; hiển thị request/usage khi provider có cung cấp.
- Lưu glossary, hồ sơ nhân vật, context/tóm tắt xuyên trang, nhận diện ngôn ngữ nguồn, tiến độ, lỗi/retry và duyệt thủ công.
- Dùng vision model đọc số trang in trên ảnh để hỗ trợ sắp xếp folder khi tên file không đủ rõ.
- Có nút Start dịch, cập nhật tiến độ theo trang và cho phép xem các preview đã hoàn tất trong lúc batch tiếp tục chạy.
- Kết nối trạng thái hoàn tất/thất bại của pipeline với nút Export/Xuất; bật/tắt đúng lúc và tạo folder `<tên project> <mã ngôn ngữ đích>`.

### Mốc 4 — Tự động hóa và xử lý ảnh nâng cao

- Thêm batch, ngưỡng tự duyệt, nhận diện vùng tự động, xử lý nền/inpainting tùy backend.
- Hoàn thiện tab hàng chờ sửa, mask/vùng tô, preset lỗi phổ biến, custom prompt, Start sửa, xử lý job phụ thuộc trang và vòng sửa/duyệt thủ công.
- Thêm rate-limit classification, retry giới hạn, Retry-After/circuit breaker, hạn mức cloud do người dùng đặt và trạng thái route rõ ràng.
- Thêm danh sách cần duyệt, so sánh gốc/preview và các phương án dịch cho câu mơ hồ.
- Khi regex/natural sort và vision model đọc số trang chưa xác định được thứ tự, cho VLM đề xuất thứ tự trang theo dấu hiệu thị giác/tình tiết; luôn có confidence, preview và bước xác nhận của người dùng.
- Hiển thị rõ dữ liệu gửi qua 9Router, xác nhận sử dụng cloud và cảnh báo chi phí khi có thông tin.

### Mốc 5 — Local model và tối ưu GPU

- Ưu tiên GGUF với llama.cpp sau khi kiểm thử khả năng hỗ trợ vision encoder và API trên hệ điều hành mục tiêu.
- Thêm theo dõi thư mục model, nút mở đúng thư mục models, nhận diện cặp GGUF/mmproj, danh sách model, Load/Eject, ước lượng bộ nhớ và đề xuất Qwen3-VL-4B/8B theo VRAM trống.
- Kết nối model local làm fallback của các job online lỗi kỹ thuật; yêu cầu xác nhận/nạp model nếu chưa sẵn sàng và không chạy lại trang online đã thành công.
- Thêm GPU telemetry trên Windows bằng DXGI và API phù hợp của NVIDIA/AMD; kiểm tra khả năng đọc usage, VRAM, power và nhiệt độ theo từng GPU/driver.
- Kiểm thử NVIDIA/CUDA, AMD với backend khả dụng (ví dụ Vulkan/ROCm tùy nền tảng), và CPU fallback; công bố ma trận tương thích thực tế.
- Tạo installer và portable public không model, kiểm thử trên Windows sạch, hoàn thiện README/hướng dẫn/báo cáo; sau khi mọi kiểm tra đạt, publish source và GitHub Release tới `https://github.com/kingbone2006/manga-trans`.

## 11. Hướng dẫn làm việc cho AI agent

Hãy thực hiện theo các chỉ dẫn sau:

1. Khảo sát repository, hệ điều hành, công cụ và dependency hiện có trước khi sửa; không ghi đè thay đổi sẵn có.
2. Nếu repository trống, khởi tạo cấu trúc tối thiểu phù hợp với kiến trúc trên. Nếu đã có dự án, tuân theo các pattern hiện tại khi hợp lý.
3. Trước khi triển khai, nêu ngắn gọn kiến trúc, mốc đầu tiên và giả định quan trọng. Nếu cần quyết định ảnh hưởng lớn đến nền tảng/phạm vi, hỏi người dùng trước.
4. Triển khai theo từng mốc có thể chạy được. Ưu tiên một vertical slice hoàn chỉnh, không tạo UI giả vờ rằng chức năng AI chưa có đã hoạt động.
5. Giữ API key và ảnh riêng tư; không tự gọi dịch vụ trả phí, tải model lớn hoặc gửi dữ liệu ra ngoài nếu chưa có sự cho phép rõ ràng.
6. Dùng dependency đang được duy trì, kiểm tra license và tương thích hệ điều hành/GPU; tránh thêm dependency không cần thiết.
7. Viết test cho hành vi mới; chạy format, lint, test và build liên quan. Sửa lỗi do thay đổi gây ra.
8. Báo cáo những gì đã triển khai, lệnh kiểm thử và kết quả, tính năng còn thiếu, giới hạn đã xác minh và bước tiếp theo. Không tuyên bố đã hỗ trợ GPU/model/provider nếu chưa kiểm chứng.

## 12. Bản build, báo cáo và hướng dẫn sử dụng

- Ưu tiên bản phát hành đầu tiên cho Windows x64. Nếu cần macOS/Linux, tạo và kiểm thử installer riêng cho từng hệ điều hành; không coi một file build là chạy được trên mọi nền tảng.
- Dùng Tauri bundler tạo installer Windows dễ cài (ví dụ `.exe`/NSIS hoặc `.msi`), shortcut Start Menu/Desktop tùy chọn, thông tin phiên bản và uninstaller.
- Người dùng cuối không cần cài Rust/Node.js, mở terminal, chạy dev server hoặc tự build source. Đóng gói các runtime dependency cần thiết của ứng dụng; kiểm thử cài/mở/gỡ trên Windows sạch.
- Ngoài installer, tạo gói **portable** (ví dụ `MangaTrans-Portable-Windows-x64.zip`) chứa ứng dụng và runtime/resource cần thiết; người dùng chỉ cần giải nén rồi mở `.exe`, không chạy installer hoặc cần quyền admin.
- Tạo hai biến thể portable khác mục đích: (1) **portable nội bộ để người dùng test trên máy mình**, chuẩn bị sẵn các model gợi ý người dùng đã chọn tải (ví dụ model 4B/8B phù hợp cùng `mmproj`) trong thư mục `models`; (2) **portable public đưa lên GitHub**, không có bất kỳ model weight nào. Đặt tên phân biệt rõ như `MangaTrans-Portable-Local-Test-Windows-x64.zip` và `MangaTrans-Portable-Windows-x64.zip`. Bản nội bộ không được commit/push hoặc đính kèm GitHub Release.
- Installer và portable public không kèm model; chúng vẫn phải khởi động bình thường, dùng được chế độ online và hướng dẫn người dùng tải model khi chọn local. Không yêu cầu tải model để mở ứng dụng.
- Portable và installer phải chạy cùng project/file `.mangatrans`; không yêu cầu chuyển đổi định dạng giữa hai bản. Model đặt ở thư mục `models` theo đường dẫn ứng dụng hiển thị; không nhân bản weights vào GitHub hoặc source archive.
- Không commit thư mục model/weights vào Git; thêm các mẫu model vào `.gitignore` (bao gồm `.gguf`, mmproj và shard model). Có thể giữ placeholder/tài liệu hướng dẫn nhưng không đưa weights vào source.
- Portable không được âm thầm lưu API key dạng plaintext cạnh `.exe`. Settings không nhạy cảm có thể lưu trong thư mục portable khi ghi được; credentials dùng kho bảo mật Windows và cần nhập lại khi chuyển sang máy khác. Nếu thiếu quyền ghi hoặc WebView2/runtime trên máy, hiển thị hướng dẫn từ nguồn chính thức thay vì thoát im lặng.
- Chạy TC-PORTABLE-01 trên Windows sạch và thử giải nén/chạy từ thư mục có khoảng trắng trong đường dẫn; kiểm tra ứng dụng không phụ thuộc working directory hiện tại.
- Tạo `README.md` ở root repository bằng tiếng Việt, **không sử dụng emoji**. README cần giới thiệu phần mềm/mục tiêu, tính năng chính, yêu cầu hệ thống, hướng dẫn cài installer và chạy portable, hướng dẫn sử dụng cơ bản (tạo project, nhập ảnh, chọn AI, dịch/duyệt, export) và liên kết tài liệu đầy đủ. Phân biệt tính năng đã triển khai với kế hoạch/giới hạn; không quảng bá chức năng chưa hoạt động như thể đã sẵn sàng.
- README phải có bảng model gợi ý gồm mức VRAM, tên model/quantization, file trọng số và `mmproj` cần thiết, dung lượng tải ước tính, license cần kiểm tra và link trực tiếp tới trang model/file chính thức trên Hugging Face. Nêu rõ dung lượng file không đồng nghĩa với VRAM runtime; không host hoặc mirror model.
- README hướng dẫn tải đúng các file từ Hugging Face, mở **Quản lý model local → Mở thư mục models**, chép cả file LLM và `mmproj` vào thư mục vừa mở, chờ ứng dụng tự nhận diện, chọn model rồi bấm **Load**. Hướng dẫn phải khớp tên file/cặp file được app hỗ trợ thực tế.
- Repository đích: `https://github.com/kingbone2006/manga-trans`. Khi sản phẩm và bộ kiểm thử đã đạt điều kiện phát hành, bắt buộc push source code và README lên repository; không dừng ở việc tạo file/build cục bộ.
- Sau khi test/build/review artifacts đạt, tạo tag phiên bản và publish GitHub Release lên repository đích với installer Windows x64, portable public không chứa model, ghi chú phát hành, checksum SHA-256 và source code đúng tag (GitHub-generated source ZIP/TAR.GZ hoặc archive source tương ứng). Không tải installer, portable binary hoặc model weights vào lịch sử source nếu chúng chỉ dành cho Release.
- Trước khi publish Release, chạy test/build phù hợp, kiểm tra nội dung từng artifact (đặc biệt quét `.gguf`, `mmproj`, secrets và project cá nhân), ghi rõ portable public không kèm model và xác minh link tải Hugging Face. Nếu build/test chưa đạt hoặc thiếu artifact thì không tạo Release thành công giả.
- Sau khi publish, xác minh trang Release và tải/kiểm tra các asset đã upload; báo cáo cuối phải có URL repository, tag/commit, URL Release, danh sách asset và checksum. Nếu GitHub push/release không thành công do quyền truy cập, giới hạn kích thước hoặc lỗi mạng, báo **Blocked** và không tuyên bố đã hoàn tất phát hành.
- Có onboarding lần đầu: chọn 9Router, LM Studio hoặc model local; nhập cấu hình cần thiết, kiểm tra kết nối/nạp model và mở project mẫu. Không nhúng API key riêng tư vào installer.
- Phân biệt điều kiện sử dụng: 9Router cần mạng và cấu hình/key phù hợp; LM Studio cần server/model mà người dùng cấu hình; chế độ offline cần có model tương thích trong thư mục model hoặc tải model theo xác nhận. Chỉ bản portable nội bộ riêng trên máy người dùng mới được chuẩn bị kèm model đã tải; không tạo/gửi gói offline có model lên GitHub.
- Kèm hướng dẫn sử dụng bằng tiếng Việt: cài đặt và chạy cả installer lẫn portable, lần chạy đầu, cấu hình 9Router và LM Studio, thiết lập online-first/local fallback và hạn mức request, xem bảng model và tải đúng file GGUF cùng mmproj từ Hugging Face, mở thư mục models trong ứng dụng, Load/Eject, nhập folder và sắp thứ tự trang, đổi tên project, tạo template tên file, export sau khi dịch xong và quy tắc folder `<tên project> <mã ngôn ngữ đích>`, xử lý export lại (tạo thư mục hậu tố, không ghi đè), sử dụng project `.mangatrans`, dịch/duyệt/xuất, thiết lập GPU, vị trí lưu dữ liệu portable, quyền riêng tư, sao lưu và xử lý lỗi thường gặp.
- Bản public GitHub Release chỉ chứa app/source/docs; không chứa model weights. README/model table là danh sách link tới nguồn Hugging Face gốc để người dùng tự tải.
- Onboarding/Help nên có link trực tiếp tới [9Router](https://9router.com), [hướng dẫn 9Router chính thức trên GitHub](https://github.com/decolua/9router), [tải LM Studio](https://lmstudio.ai/download), [hướng dẫn chạy server LM Studio](https://lmstudio.ai/docs/developer/core/server), [API tương thích OpenAI của LM Studio](https://lmstudio.ai/docs/developer/openai-compat) và [trang model Qwen3-VL trên Hugging Face](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF).
- Với trang lấy API key của provider upstream, cung cấp link chính thức tương ứng trong danh mục trợ giúp theo provider/route đã chọn; nói rõ key được tạo/lưu ở 9Router hay trong ứng dụng. Không bắt người dùng gửi mật khẩu, không thu thập key qua video/form bên thứ ba, và không coi link YouTube không được kiểm chứng là nguồn chính thức.
- Kiểm tra các link trợ giúp trước mỗi bản phát hành; gắn nhãn **Tài liệu chính thức** hoặc **Video bên ngoài**, mở trong trình duyệt và cho phép người dùng bỏ qua.
- Lưu hướng dẫn tại `docs/USER_GUIDE_VI.md` và báo cáo phát hành/kiểm thử tại `docs/RELEASE_TEST_REPORT.md`; cập nhật các tài liệu này theo đúng bản build cuối cùng.
- Báo cáo cuối phải nêu:
  - File build/installer, phiên bản, vị trí lưu và checksum SHA-256.
  - Hệ điều hành/môi trường build, lệnh build và kết quả kiểm thử (pass/fail/blocked/not run), bao gồm MCP UI test nếu có.
  - GPU, driver, runtime, model/provider và các luồng đã thực sự kiểm chứng; tách rõ mock test với test phần cứng/API thật.
  - Cách cài/chạy nhanh, yêu cầu API key/mạng/model, dung lượng tải thêm và cách mở hướng dẫn đầy đủ.
  - Giới hạn đã biết, lỗi còn lại và bước khắc phục; không tuyên bố "sẵn sàng sử dụng" nếu installer hoặc luồng cài/chạy sạch chưa được kiểm tra.

## 13. Những quyết định cần chốt trước khi phát triển lớn

- Có phát hành ngoài Windows x64 ngay từ đầu hay không; mặc định nên hoàn thiện Windows trước rồi mở rộng.
- Danh sách ngôn ngữ đích cần hỗ trợ và ngôn ngữ đích mặc định (nếu muốn đặt sẵn). Ngôn ngữ nguồn tự nhận diện mặc định, có thể ghi đè thủ công theo dự án/trang/vùng.
- Có cần đóng gói runtime/model trong bộ cài hay để người dùng tự cài/chọn.
- Chiến lược đã chốt là online-first; khi bật fallback, job lỗi kỹ thuật được chuyển sang local nếu model tương thích sẵn sàng. Người dùng vẫn có thể chọn chỉ online hoặc chỉ local. Trước khi phát triển cần chốt mức ngân sách/hạn mức mặc định, thời gian chờ Retry-After tối đa và việc tự nạp model dự phòng; không đổi mặc định sang local-first nếu người dùng chưa yêu cầu.
- Định dạng xuất phụ trợ cần có: CBZ, PSD/layer hay file phụ đề/bản dịch. `.mangatrans` là định dạng project làm việc, tách biệt với định dạng xuất.
- Phạm vi xử lý chữ hiệu ứng và inpainting; đây thường là phần tốn công và phụ thuộc model nhất.
- Mức độ tự động được phép: mặc định nên duyệt thủ công cho đến khi người dùng chủ động bật auto-approve.

## 14. Gợi ý bổ sung

- Hỗ trợ xuất CBZ tùy chọn để đọc cả chương; giữ xuất ảnh riêng làm định dạng cơ bản.
- Hỗ trợ từ điển thay thế hàng loạt và quy tắc giữ nguyên thuật ngữ/tên.
- Có preset font/kiểu chữ theo thể loại hoặc dự án, nhưng luôn cho phép chỉnh tay.
- Tách pipeline thành các bước độc lập để thay vision model đọc chữ, model dịch, inpainting và renderer theo nhu cầu.

