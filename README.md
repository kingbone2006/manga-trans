# MangaTrans - Phan Mem Dich Truyen Tranh Bang AI

MangaTrans la ung dung desktop giup dich truyen tranh theo tung trang, duy tri ngu canh xuyen suot chuong truyen. Nguoi dung co the xem preview, sua vung chu va ban dich truc tiep tren canvas, tuy chinh dan chu, quan ly hang cho sua va xuat anh an toan.

Phan mem uu tien chat luong ban dich, quyen kiem soat cua nguoi dung, kha nang chay offline local va minh bach ve thong so phan cung (khong gia lap so lieu).

## Tinh nang chinh

- Quan ly du an: Dinh dang container `.mangatrans` chuan hoa bang ZIP (chua manifest.json, project.json va media), luu nguyen tu (atomic save) kem ban sao luu `.bak`, chong loi Zip Slip va khong sua anh goc.
- Nhap va sap xep trang: Ho tro PNG, JPEG, WebP; tu dong nhan dien thu tu so bang natural sort (`001`, `01`, `2`, `10`); tuy chon doi ten du an theo folder anh nguon.
- Vision AI & Doc chu truc tiep: Su dung model AI co vision input nhan dien bounding box, do tin cay (confidence), phan loai vung thoai/dan chuyen/hieu ung am thanh va ngon ngu nguon.
- Dich theo ngu canh chuong: Tich hop glossary (tu dien thuat ngu/ten rieng), ho so nhan vat (ten, dai tu xung ho, dac diem giong dieu), tom tat cot truyen va ghi chu ngu canh; bao ve cac vung da duyet (approved) khong bi ghi de khi regenerate.
- Dan chu & Canh bao: Tu dong tinh toan xuong dong, co chu; canh bao tran vien, chu qua nho, do tuong phan kem hoac chong lan vung chu.
- Hang cho sua (Repair Queue): Ho tro cac preset sua loi pho bien (tran khung, doc sai, bo sot thoai, dich chua tu nhien, sai thu tu doc, sai giong nhan vat, sot chu/nen, mo rong bong bong, sai phong/co chu) hoac prompt tuy chinh; co co che kiem tra revision de chong xung dot khi sua song song.
- Ket noi AI linh hoat: Ho tro 9Router online, LM Studio local, OpenAI-compatible tuy chinh va local offline model; phan biet ro endpoint tu xa va local; bat buoc co consent truoc khi gui du lieu len cloud; tuan thu Retry-After va circuit breaker khi gap rate limit.
- Giam sat GPU Windows DXGI: Doc ten GPU adapter, VRAM dedicated, budget va muc dung bo nho theo thoi gian thuc; cac cam bien chua duoc ho tro duoc bao ro la "Khong kha dung" (khong hien thi so lieu gia).
- Xuat anh an toan (Export): Tu dong tao thu muc con theo ten project va ma ngon ngu dich (vi du `Ten truyen vi`), su dung template ten file linh hoat (`{page:000}.{ext}`, `{project}_p{page:00}.{ext}`), xuat qua staging thu muc tam roi cong bo nguyen tu de chong ghi de file cu.

## Bang model local de xuat (Qwen3-VL GGUF)

Cac model local can duoc nguoi dung tu chu dong tai tu Hugging Face chinh thuc va sao chep vao thu muc `models` cua ung dung. Kho luu tru Git va ban phat hanh Release public khong chua model weights (`.gguf`, `mmproj`).

| Muc VRAM trong | Model de xuat | File LLM trong so | File Vision mmproj | Dung luong tai uoc tinh | License | Link chinh thuc Hugging Face |
|---|---|---|---|---|---|---|
| 6 - 8 GB | Qwen3-VL-4B-Instruct-GGUF (Q4_K_M) | `Qwen3-VL-4B-Instruct-Q4_K_M.gguf` | `mmproj-Qwen3-VL-4B-Instruct-Q8_0.gguf` | ~2.50 GB + ~0.45 GB | Apache-2.0 | https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF |
| 10 - 16 GB | Qwen3-VL-8B-Instruct-GGUF (Q4_K_M) | `Qwen3-VL-8B-Instruct-Q4_K_M.gguf` | `mmproj-Qwen3-VL-8B-Instruct-Q8_0.gguf` | ~5.03 GB + ~0.75 GB | Apache-2.0 | https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF |
| Tren 16 GB | Qwen3-VL-8B-Instruct-GGUF (Q8_0 hoac Q4_K_M) | `Qwen3-VL-8B-Instruct-Q8_0.gguf` | `mmproj-Qwen3-VL-8B-Instruct-Q8_0.gguf` | ~8.50 GB + ~0.75 GB | Apache-2.0 | https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF |

*Luu y:* Dung luong file tai xuong khong dong nghia voi tong VRAM yeu cau khi chay, vi runtime con can bo nho cho context cache, KV cache, vision encoder va he dieu hanh.


### Huong dan su dung model local

1. Trong ung dung, bam nut **Model local** tren thanh cong cu.
2. Bam nut **Mo thu muc models** de mo dung thu muc `models` trong Windows Explorer.
3. Tai ca hai file gom file LLM (`.gguf`) va file vision encoder (`mmproj...gguf`) tu link Hugging Face chinh thuc o bang tren.
4. Chep ca hai file vao thu muc `models` vua mo.
5. Ung dung tu dong quet va nhan dien cap file hop le theo thoi gian thuc.
6. Chon model va bam **Load** de nap vao GPU khi can dung.

## Cai dat va su dung

### Ban cai dat (Installer Windows x64)

1. Tai file cai dat `MangaTrans_0.1.0_x64-setup.exe` tu muc Releases tren GitHub.
2. Chay trinh cai dat va lam theo huong dan tren man hinh.
3. Mo MangaTrans tu Start Menu hoac Desktop shortcut.

### Ban Portable (Khong can cai dat)

1. Tai file `MangaTrans-Portable-Windows-x64.zip` tu muc Releases.
2. Giai nen file ZIP vao mot thu muc bat ky tren o dia (khong yeu cau quyen quan tri vien/admin).
3. Chay truc tiep `manga-trans.exe`.

### Quy trinh su dung co ban

1. **Nhap anh:** Bam `Nhap anh` hoac `Nhap folder`. Chon anh PNG/JPEG/WebP. Thu tu trang se duoc sap xep tu dong bang natural sort.
2. **Cau hinh AI:** Bam `AI/Provider` de chon:
   - 9Router online (nhap Base URL, API key va model route).
   - LM Studio local (nhap endpoint server local vi du `http://127.0.0.1:1234/v1`).
   - Local model tich hop (sau khi da chep cap file GGUF/mmproj vao thu muc models).
3. **Start dich:** Bam nut `Start dich` tren thanh cong cu de bat dau pipeline 2 giai doan:
   - Giai doan 1: Nhan dien vision va doc chu toan trang.
   - Giai doan 2: Dich theo ngu canh (ap dung glossary, nhan vat, cot truyen).
4. **Duyet & Chinh sua:** Chuyen qua tung trang de xem preview, sua truc tiep noi dung doc duoc, ban dich, phong chu, mau sac hoac them vao `Hang cho sua`.
5. **Xuat anh (Export):** Khi qua trinh dich ket thuc, nut `Xuat da duyet` se duoc kich hoat. Bam nut de chon thu muc cha; ung dung se tu dong tao thu muc con `<Ten project> <ma ngon ngu>` (vi du `Truyen vi`) va xuat toan bo cac trang da duyet ma khong lam thay doi anh nguon.

## Huong dan nha phat trien (Dev setup)

Yeu cau:
- Node.js 20 tro len va npm
- Rust 1.78+ va Cargo (voi target `x86_64-pc-windows-msvc`)
- Visual Studio C++ Build Tools (tren Windows)

Cac lenh phat trien va kiem tra:

```bash
# Cai dat dependencies
npm install

# Chay Vitest unit & acceptance tests (15 test files / 44 tests)
npm test -- --run

# Kiem tra Rust backend & unit tests (ZIP container, telemetry, atomic save)
cargo test --manifest-path src-tauri/Cargo.toml

# Build frontend production
npm run build

# Chay desktop dev app
npm run tauri dev

# Dong goi ban cai dat Windows (NSIS)
npm run tauri build
```

## Chinh sach bao mat va quyen rieng tu

- Khong bao gio tu dong gui anh len mang neu nguoi dung chua lua chon provider cloud va xac nhan consent.
- API key chi duoc luu trong bo nho phien lam viec hoac kho bao mat he dieu hanh, khong ghi vao log hoac file project.
- Khong commit ma doc, API key, model weights hoac du lieu rieng tu vao kho luu tru Git.

