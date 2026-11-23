from rapidocr import RapidOCR

ocr = RapidOCR()
for page_num in ["1.jpg", "2.jpg", "3.jpg"]:
    path = fr"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người\{page_num}"
    out = ocr(path)
    print(f"\n=== OCR Results for {page_num} ===")
    if out and hasattr(out, "txts") and out.txts:
        for text, score in zip(out.txts, out.scores):
            print(f"[{score:.2f}] {text}")
    elif out and hasattr(out, "boxes"):
        print(out)
    else:
        print("No text detected.")

