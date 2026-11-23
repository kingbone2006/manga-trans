import os
import io
import json
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont
from rapidocr import RapidOCR

ocr = RapidOCR()

MANGA_DIR = r"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người"
OUTPUT_DIR = r"C:\Users\BoneLap\Desktop\manga-trans\output_translated\pages"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SERVER_URL = "http://127.0.0.1:8080/v1/chat/completions"
FONT_PATH = r"C:\Windows\Fonts\arialbd.ttf"
if not os.path.exists(FONT_PATH):
    FONT_PATH = r"C:\Windows\Fonts\tahoma.ttf"

def group_boxes_into_bubbles(boxes, txts, scores, max_x_dist=75, max_y_dist=60):
    items = []
    for b, t, s in zip(boxes, txts, scores):
        pts = np.array(b)
        xmin, ymin = pts.min(axis=0)
        xmax, ymax = pts.max(axis=0)
        items.append({
            "xmin": float(xmin), "ymin": float(ymin),
            "xmax": float(xmax), "ymax": float(ymax),
            "text": str(t), "score": float(s)
        })

    bubbles = []
    used = set()
    for i, it in enumerate(items):
        if i in used:
            continue
        cluster = [it]
        used.add(i)
        changed = True
        while changed:
            changed = False
            for j, other in enumerate(items):
                if j in used:
                    continue
                for member in cluster:
                    x_dist = max(0, max(member["xmin"], other["xmin"]) - min(member["xmax"], other["xmax"]))
                    y_dist = max(0, max(member["ymin"], other["ymin"]) - min(member["ymax"], other["ymax"]))
                    if x_dist <= max_x_dist and y_dist <= max_y_dist:
                        cluster.append(other)
                        used.add(j)
                        changed = True
                        break

        cluster.sort(key=lambda x: -x["xmax"])
        combined_text = "".join(x["text"] for x in cluster)
        bubbles.append({
            "xmin": min(x["xmin"] for x in cluster),
            "ymin": min(x["ymin"] for x in cluster),
            "xmax": max(x["xmax"] for x in cluster),
            "ymax": max(x["ymax"] for x in cluster),
            "japanese": combined_text
        })
    return bubbles

def translate_bubbles_to_vietnamese(bubbles):
    if not bubbles:
        return []
    lines = [f"{i+1}. {b['japanese']}" for i, b in enumerate(bubbles)]
    prompt = f"""You are an expert manga localizer. Translate each Japanese manga dialogue bubble into natural Vietnamese (Tiếng Việt).
Character Context:
- Maria is an arrogant, proud noble lady (tiểu thư quý tộc).
- Common words: お嬢様 = tiểu thư, 庶民 = thường dân, 勝利 = chiến thắng.

Japanese text:
{chr(10).join(lines)}

Respond ONLY with JSON format:
{{"translations": ["Bản dịch 1", "Bản dịch 2", ...]}}"""

    try:
        resp = requests.post(SERVER_URL, json={
            "model": "Qwen",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }, timeout=45)
        raw = resp.json()["choices"][0]["message"]["content"]
        raw = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        return data.get("translations", [])
    except Exception as e:
        print(f"Translation API error: {e}")
        return []

def wrap_text(text, font, max_width, draw):
    words = text.split()
    if not words:
        return []
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width or not current_line:
            current_line.append(word)
        else:
            lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def render_bubble_text(img, bubble, vietnamese_text):
    draw = ImageDraw.Draw(img)
    bx = bubble["xmin"]
    by = bubble["ymin"]
    bw = bubble["xmax"] - bx
    bh = bubble["ymax"] - by

    pad_x = min(bw * 0.15, 20)
    pad_y = min(bh * 0.15, 20)
    clean_box = [bx - pad_x, by - pad_y, bubble["xmax"] + pad_x, bubble["ymax"] + pad_y]

    # Clean bubble background with white fill
    draw.rounded_rectangle(clean_box, radius=12, fill=(255, 255, 255))

    target_w = clean_box[2] - clean_box[0] - 8
    target_h = clean_box[3] - clean_box[1] - 8

    best_font_size = 20
    best_lines = []
    for fs in range(28, 12, -2):
        font = ImageFont.truetype(FONT_PATH, fs)
        lines = wrap_text(vietnamese_text, font, target_w, draw)
        if not lines:
            continue
        line_height = fs * 1.25
        total_h = len(lines) * line_height
        if total_h <= target_h:
            best_font_size = fs
            best_lines = lines
            break
    else:
        font = ImageFont.truetype(FONT_PATH, 14)
        best_lines = wrap_text(vietnamese_text, font, target_w, draw)
        best_font_size = 14

    font = ImageFont.truetype(FONT_PATH, best_font_size)
    line_h = best_font_size * 1.25
    total_text_h = len(best_lines) * line_h
    start_y = (clean_box[1] + clean_box[3] - total_text_h) / 2
    center_x = (clean_box[0] + clean_box[2]) / 2

    for i, line in enumerate(best_lines):
        y = start_y + i * line_h
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        x = center_x - lw / 2
        draw.text((x, y), line, font=font, fill=(0, 0, 0))

def process_and_translate_manga_page(page_name):
    page_path = os.path.join(MANGA_DIR, page_name)
    if not os.path.exists(page_path):
        return

    print(f"\nProcessing & Translating {page_name}...")
    out = ocr(page_path)
    if not out or not hasattr(out, "boxes") or out.boxes is None or len(out.boxes) == 0:
        print(f"No text found on {page_name}")
        return

    bubbles = group_boxes_into_bubbles(out.boxes, out.txts, out.scores)
    print(f"Detected {len(bubbles)} speech bubbles on {page_name}:")
    for i, b in enumerate(bubbles):
        print(f"  Bubble {i+1}: {b['japanese']}")

    translations = translate_bubbles_to_vietnamese(bubbles)
    print("Translated to Vietnamese:")
    for i, t in enumerate(translations):
        print(f"  [{i+1}]: {t}")

    img = Image.open(page_path).convert("RGB")
    for i, b in enumerate(bubbles):
        trans = translations[i] if i < len(translations) else b["japanese"]
        render_bubble_text(img, b, trans)

    out_file = os.path.join(OUTPUT_DIR, f"translated_{page_name}")
    img.save(out_file, quality=95)
    print(f"SUCCESS: Generated translated manga image at {out_file} ({img.size})")

for p in ["4.jpg", "5.jpg", "6.jpg"]:
    process_and_translate_manga_page(p)

print("\n" + "="*60)
print(f"Translation & Replacement Complete! Output saved to: {OUTPUT_DIR}")
print("="*60)
