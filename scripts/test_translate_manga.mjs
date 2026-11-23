import fs from 'fs';
import path from 'path';

async function testTranslation() {
  const mangaDir = path.resolve('./[Yoshio Ereki] Maria Của Mọi Người');
  const files = ['1.jpg', '2.jpg'];
  console.log(`Testing manga translation on: ${files.join(', ')} from ${mangaDir}`);

  const serverUrl = 'http://127.0.0.1:8080/v1/chat/completions';

  for (const file of files) {
    const filePath = path.join(mangaDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      continue;
    }

    const imageBytes = fs.readFileSync(filePath);
    const base64Data = imageBytes.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;

    console.log(`\n--- [Stage 1: AI Vision Detection on ${file}] ---`);
    const prompt = 'Analyze this manga page. Detect all dialogue bubbles and text areas. Return valid JSON only with this schema: {"regions": [{"id": "r1", "x": 10, "y": 10, "width": 20, "height": 15, "sourceText": "japanese text here", "confidence": 0.95, "kind": "speech", "sourceLanguage": "ja"}]}';

    const visionPayload = {
      model: 'C:\\Users\\BoneLap\\Desktop\\manga-trans\\models\\Qwen2.5-VL-3B-Instruct.Q4_K_M.gguf',
      messages: [
        {
          role: 'system',
          content: 'You are an OCR and manga layout assistant. Read all text in the image and detect dialogue bounding boxes. Output JSON strictly matching: {"regions": [{"id": "r1", "x": 0, "y": 0, "width": 10, "height": 10, "sourceText": "...", "confidence": 0.9, "kind": "speech", "sourceLanguage": "ja"}]}'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Detect all text areas and transcribe the Japanese text in this manga page as JSON.' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0.1,
      presence_penalty: 0.2
    };

    const startTime = Date.now();
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionPayload)
    });

    if (!res.ok) {
      console.error(`Vision request failed with HTTP ${res.status}:`, await res.text());
      continue;
    }

    const visionJson = await res.json();
    const visionReply = visionJson.choices?.[0]?.message?.content || '';
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Vision response received in ${elapsed}s:`);
    console.log(visionReply);

    console.log(`\n--- [Stage 2: Vietnamese Translation on ${file}] ---`);
    const transPrompt = `You are a professional manga translator. Translate the text detected from the manga page into natural Vietnamese (Tiếng Việt). Preserve the manga speech tone.
Detected text:
${visionReply}

Respond ONLY with valid JSON with format: {"translations": [{"id": "...", "translation": "Bản dịch tiếng Việt"}]}`;

    const transPayload = {
      model: 'C:\\Users\\BoneLap\\Desktop\\manga-trans\\models\\Qwen2.5-VL-3B-Instruct.Q4_K_M.gguf',
      messages: [
        { role: 'user', content: transPrompt }
      ],
      temperature: 0.3
    };

    const transRes = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transPayload)
    });

    const transJson = await transRes.json();
    const transReply = transJson.choices?.[0]?.message?.content || '';
    console.log('Vietnamese Translation response:');
    console.log(transReply);
  }
}

testTranslation().catch(console.error);
