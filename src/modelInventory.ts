export type ScannedModel = { name: string; path: string; extension: string; size_bytes: number; kind: string; ready: boolean; reason?: string };
export type ModelPair = { name: string; llm: ScannedModel; mmproj?: ScannedModel; ready: boolean; reason?: string };
export function pairModels(entries: ScannedModel[]): ModelPair[] {
  const llm = entries.filter((entry) => entry.extension.toLowerCase() === 'gguf' && entry.kind === 'llm');
  const encoders = entries.filter((entry) => entry.extension.toLowerCase() === 'mmproj');
  return llm.map((weight) => {
    const stem = weight.name.replace(/\.gguf$/i, '').toLowerCase();
    const mmproj = encoders.find((entry) => { const encoderStem = entry.name.replace(/\.mmproj$/i, '').toLowerCase(); return encoderStem === stem || encoderStem.includes(stem) || stem.includes(encoderStem); });
    return mmproj ? { name: weight.name, llm: weight, mmproj, ready: true } : { name: weight.name, llm: weight, ready: false, reason: 'Thiếu mmproj tương ứng; chưa sẵn sàng cho vision.' };
  });
}
