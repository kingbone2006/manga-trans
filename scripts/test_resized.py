import requests
import base64
import io
from PIL import Image

def test_resized_page(page_name):
    img_path = fr"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người\{page_name}"
    img = Image.open(img_path)
    # Resize keeping aspect ratio so max dimension is 1024
    img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    
    payload = {
        "model": "Qwen",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this manga page and read all Japanese speech bubbles."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]
            }
        ],
        "max_tokens": 512,
        "temperature": 0.2
    }
    
    resp = requests.post("http://127.0.0.1:8080/v1/chat/completions", json=payload, timeout=60)
    print(f"\n=== Result for {page_name} (resized to {img.size}) ===")
    print("Status code:", resp.status_code)
    try:
        content = resp.json()["choices"][0]["message"]["content"]
        print("Reply:", content[:400])
    except Exception as e:
        print("Response error:", resp.text)

test_resized_page("3.jpg")
test_resized_page("4.jpg")

