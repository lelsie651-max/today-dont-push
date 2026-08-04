import { describe, expect, it } from 'vitest';
import type { AIProvider } from './index.js';

describe('AIProvider 接口占位', () => {
  it('可以被最小实现结构化满足', () => {
    const provider: AIProvider = { name: 'stub' };
    expect(provider.name).toBe('stub');
  });
});
