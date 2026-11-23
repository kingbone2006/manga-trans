import os
import io
import json
import base64
import requests
from PIL import Image, ImageDraw, ImageFont

MANGA_DIR = r"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người"
OUTPUT_DIR = r"C:\Users\BoneLap\Desktop\manga-trans\output_translated"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SERVER_URL = "http://127.0.0.1:8080/v1/chat/completions"

GLOSSARY = {
    "マリア": "Maria",
    "お嬢様": "tiểu thư",
    "わたくし": "ta/tôi",
}

def analyze_and_translate_page(page_name):
    img_path = os.path.join(MANGA_DIR, page_name)
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return None

    orig_img = Image.open(img_path)
    orig_w, orig_h = orig_img.size

    # Prepare optimized image for vision
    vis_img = orig_img.copy()
    vis_img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    vis_img.save(buf, format="JPEG", quality=90)
    vis_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    print(f"\n==========================================")
    print(f"Processing {page_name} ({orig_w}x{orig_h})...")
    print(f"==========================================")

    # 1. Vision Detection Prompt
    vision_prompt = (
        "You are an expert manga assistant. Look at this manga page, detect all speech bubbles and narration boxes. "
        "Transcribe the Japanese text in each bubble line by line. "
        "List each bubble with its position on the page (top, bottom, left, right, or center)."
    )
    
    vis_payload = {
        "model": "Qwen",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": vision_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{vis_b64}"}}
                ]
            }
        ],
        "max_tokens": 1024,
        "temperature": 0.1
    }

    print("-> Stage 1: Running local AI Vision detection on GPU...")
    resp = requests.post(SERVER_URL, json=vis_payload, timeout=90)
    vis_content = resp.json()["choices"][0]["message"]["content"]
    print(f"Vision transcription result:\n{vis_content}\n")

    # 2. Contextual Vietnamese Translation Prompt
    trans_prompt = f"""You are a professional Vietnamese manga localizer.
Translate all dialogue and narration from this manga page into natural, idiomatic Vietnamese (Tiếng Việt).
Glossary rules:
- マリア = Maria
- お嬢様 = tiểu thư
- Keep character speech polite yet noble (tiểu thư quý tộc).

Detected Japanese text:
{vis_content}

Output format:
Line by line Vietnamese translations."""

    trans_payload = {
        "model": "Qwen",
        "messages": [
            {"role": "user", "content": trans_prompt}
        ],
        "max_tokens": 1024,
        "temperature": 0.3
    }

    print("-> Stage 2: Running Contextual Vietnamese Translation...")
    resp2 = requests.post(SERVER_URL, json=trans_payload, timeout=90)
    trans_content = resp2.json()["choices"][0]["message"]["content"]
    print(f"Vietnamese translation result:\n{trans_content}\n")

    # 3. Render Translation Overlay Preview
    out_img = orig_img.copy()
    draw = ImageDraw.Draw(out_img)
    
    # Save text report
    report_file = os.path.join(OUTPUT_DIR, f"{page_name}.translation.txt")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(f"=== Manga Translation Report: {page_name} ===\n\n")
        f.write("[Original Japanese detected by Vision AI]:\n")
        f.write(vis_content + "\n\n")
        f.write("[Vietnamese Localization]:\n")
        f.write(trans_content + "\n")

    print(f"Saved translation report to {report_file}")
    return {
        "page": page_name,
        "vision": vis_content,
        "translation": trans_content
    }

pages_to_test = ["1.jpg", "2.jpg", "3.jpg"]
results = []
for p in pages_to_test:
    res = analyze_and_translate_page(p)
    if res:
        results.append(res)

print("\n" + "="*50)
print(f"Completed translation test on {len(results)} pages of '[Yoshio Ereki] Maria Của Mọi Người'!")
print("="*50)
