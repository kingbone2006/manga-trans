import { describe, expect, it } from 'vitest';
import { pairModels } from './modelInventory';
const entry = (name: string, extension: string, kind: string) => ({ name, path: name, extension, size_bytes: 1, kind, ready: false });
describe('model inventory pairing', () => { it('marks a GGUF with matching mmproj ready', () => { const pairs = pairModels([entry('Qwen3-VL-4B.gguf', 'gguf', 'llm'), entry('Qwen3-VL-4B-mmproj.gguf', 'mmproj', 'vision-encoder')]); expect(pairs[0]?.ready).toBe(true); }); it('does not mark missing encoder ready', () => { const pairs = pairModels([entry('model.gguf', 'gguf', 'llm')]); expect(pairs[0]?.ready).toBe(false); }); });
