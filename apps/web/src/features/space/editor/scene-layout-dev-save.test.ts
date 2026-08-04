import { describe, expect, it, vi } from 'vitest';
import { defaultSceneLayoutDocument } from '../scene-layout';
import {
  saveSceneLayoutToProject,
  SCENE_LAYOUT_DEV_SAVE_ENDPOINT,
} from './scene-layout-dev-save';

describe('scene-layout-dev-save', () => {
  it('保存请求会发送到固定开发端点', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: '已保存到scene-layout.json，Git现在可以看到修改。',
      }),
    })) as unknown as typeof fetch;

    const result = await saveSceneLayoutToProject(defaultSceneLayoutDocument, fetchMock);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      SCENE_LAYOUT_DEV_SAVE_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('非法布局会在前端直接拒绝，不发请求', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const invalidDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          zIndex: Number.MAX_SAFE_INTEGER + 1,
        },
      },
    };

    const result = await saveSceneLayoutToProject(invalidDocument, fetchMock);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('items.radio.zIndex');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
