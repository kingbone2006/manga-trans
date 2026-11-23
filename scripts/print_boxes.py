from rapidocr import RapidOCR
import numpy as np

ocr = RapidOCR()
img_path = r"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người\3.jpg"
out = ocr(img_path)

print("Detected boxes and text on 3.jpg:")
if out and hasattr(out, "boxes"):
    for box, txt, score in zip(out.boxes, out.txts, out.scores):
        pts = np.array(box)
        xmin, ymin = pts.min(axis=0)
        xmax, ymax = pts.max(axis=0)
        print(f"Box: ({xmin:.0f}, {ymin:.0f}, {xmax:.0f}, {ymax:.0f}) Score: {score:.2f} Text: {txt}")

