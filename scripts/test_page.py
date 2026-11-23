import requests
import base64
import os

img_path = r"C:\Users\BoneLap\Desktop\manga-trans\[Yoshio Ereki] Maria Của Mọi Người\2.jpg"
with open(img_path, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode("utf-8")

payload = {
    "model": "Qwen",
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Transcribe all the Japanese text in this manga page line by line."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
            ]
        }
    ],
    "max_tokens": 512,
    "temperature": 0.2
}

try:
    resp = requests.post("http://127.0.0.1:8080/v1/chat/completions", json=payload, timeout=60)
    print("Status code:", resp.status_code)
    data = resp.json()
    print("Content:")
    print(data["choices"][0]["message"]["content"])
except Exception as e:
    print("Error:", e)
