from PIL import Image
import numpy as np

img = Image.open(r"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người\2.jpg")
print("Size:", img.size)
arr = np.array(img)
print("Min, Max, Mean pixel value:", arr.min(), arr.max(), arr.mean())

# Check a few other pages (3.jpg, 4.jpg, etc.)
for p in ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]:
    im = Image.open(fr"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người\{p}")
    a = np.array(im)
    print(f"Page {p}: size={im.size}, mean={a.mean():.1f}, std={a.std():.1f}")
