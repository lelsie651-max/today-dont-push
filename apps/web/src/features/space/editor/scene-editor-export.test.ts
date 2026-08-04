import { describe, expect, it } from 'vitest';
import { defaultSceneLayoutDocument, updateSceneLayoutItem } from '../scene-layout';
import { buildSceneLayoutExport } from './scene-editor-export';

describe('scene-editor-export', () => {
  it('导出 JSON 会通过校验且内容稳定一致', () => {
    const first = buildSceneLayoutExport(defaultSceneLayoutDocument);
    const second = buildSceneLayoutExport(defaultSceneLayoutDocument);

    expect(first.ok).toBe(true);
    expect(first.fileName).toBe('scene-layout.v1.json');
    expect(first.content).toBe(second.content);
    expect(first.content).toContain('"version": 1');
    expect(first.content).toContain('"radio"');
  });

  it('校验失败时禁止导出', () => {
    const invalid = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', {
      width: 1,
    });
    const result = buildSceneLayoutExport({
      ...invalid,
      items: {
        ...invalid.items,
        radio: {
          ...invalid.items.radio,
          width: 1,
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('items.radio.width');
  });
});
