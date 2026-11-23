import urllib.request
import urllib.error
import json
import time
import base64

url = 'http://localhost:20128/v1/chat/completions'
headers = {
    'Authorization': 'Bearer sk-a3e70186218002b5-271cfp-e8ece405',
    'Content-Type': 'application/json'
}

with open(r'[Yoshio Ereki] Maria Cua Moi Nguoi/2.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('utf-8')

data = {
    'model': 'nicegg',
    'messages': [
        {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'Hãy nhìn vào trang truyện manga tiếng Nhật này. Đọc các đoạn thoại trong bong bóng và dịch sang tiếng Việt tự nhiên theo thứ tự đọc từ phải sang trái.'},
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{img_b64}'}}
            ]
        }
    ],
    'stream': False
}

print("Gửi ảnh manga tới nicegg (9Router) qua Vision...")
start = time.time()
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        elapsed = time.time() - start
        print(f"Phản hồi Vision thành công sau {elapsed:.2f}s:")
        choice = res['choices'][0]['message']
        print(choice.get('content'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode('utf-8', errors='ignore'))
except Exception as e:
    print("Error:", e)
