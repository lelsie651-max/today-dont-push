import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sceneLayoutJson from './scene-layout.json';
import {
  defaultSceneLayoutDocument,
  parseSceneLayoutDraft,
  sceneLayout,
  sceneLayoutEntries,
  SCENE_DESIGN_HEIGHT,
  SCENE_DESIGN_WIDTH,
  serializeSceneLayoutDocument,
  updateSceneLayoutItem,
  validateSceneInspectorValue,
  validateSceneLayoutDocument,
} from './scene-layout';

describe('sceneLayout', () => {
  it('默认 JSON 与迁移前坐标完全一致', () => {
    expect(defaultSceneLayoutDocument.items.radio).toMatchObject({
      x: 238,
      y: 631,
      width: 259,
      height: 179,
      zIndex: 7,
      visible: true,
      locked: false,
      keepRatio: true,
    });
    expect(defaultSceneLayoutDocument.items.windowViewport).toMatchObject({
      x: 445,
      y: 10,
      width: 940,
      height: 520,
      locked: true,
    });
    expect(sceneLayout).toEqual(defaultSceneLayoutDocument.items);
    expect(sceneLayoutJson.items.plant).toMatchObject({
      x: 936,
      y: 587,
      width: 187,
      height: 227,
      zIndex: 7,
    });
  });

  it('所有布局项都位于 1440x900 范围内', () => {
    sceneLayoutEntries.forEach(([, rect]) => {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(SCENE_DESIGN_WIDTH);
      expect(rect.y + rect.height).toBeLessThanOrEqual(SCENE_DESIGN_HEIGHT);
    });
  });

  it('所有布局宽高都大于 0', () => {
    sceneLayoutEntries.forEach(([, rect]) => {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    });
  });

  it('windowViewport 精确为 445/10/940/520', () => {
    expect(sceneLayout.windowViewport).toMatchObject({
      x: 445,
      y: 10,
      width: 940,
      height: 520,
    });
  });

  it('roomForeground 覆盖完整舞台', () => {
    expect(sceneLayout.roomForeground).toMatchObject({
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
    });
  });

  it('非法布局会被校验器拒绝', () => {
    const result = validateSceneLayoutDocument({
      ...sceneLayoutJson,
      items: {
        ...sceneLayoutJson.items,
        radio: {
          ...sceneLayoutJson.items.radio,
          width: 10,
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('items.radio.width 不能小于 20');
  });

  it('非法 JSON 草稿不会导致解析崩溃', () => {
    const result = parseSceneLayoutDraft('{oops');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toBe('本地草稿不是合法 JSON');
  });

  it('更新工具会把物件限制在舞台范围内', () => {
    const updated = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', {
      x: 2000,
      y: 2000,
      width: 10,
      height: 10,
    });

    expect(updated.items.radio.width).toBe(20);
    expect(updated.items.radio.height).toBe(20);
    expect(updated.items.radio.x + updated.items.radio.width).toBeLessThanOrEqual(1440);
    expect(updated.items.radio.y + updated.items.radio.height).toBeLessThanOrEqual(900);
  });

  it('序列化字段顺序稳定', () => {
    const serialized = serializeSceneLayoutDocument(defaultSceneLayoutDocument);
    expect(serialized).toContain('"version": 1');
    expect(serialized.indexOf('"designSpace"')).toBeLessThan(serialized.indexOf('"items"'));
    expect(serialized.indexOf('"windowViewport"')).toBeLessThan(serialized.indexOf('"roomForeground"'));
  });

  it('CSS 中不再残留 .slot-* 的位置和 z-index 硬编码', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/features/space/space.css'),
      'utf8',
    );
    expect(css).not.toMatch(/\.slot-[\w-]+\s*\{[^}]*\b(left|right|top|bottom|width|height|z-index)\b/);
  });

  it('Inspector 会对超界 x 给出精确允许范围', () => {
    const result = validateSceneInspectorValue(
      defaultSceneLayoutDocument.items.radio,
      'x',
      '2000',
      {
        aspectRatio: 520 / 360,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('x 允许范围为 0-1181px');
  });

  it('Inspector 会拒绝无法在当前位置容纳的 keepRatio width', () => {
    const result = validateSceneInspectorValue(
      defaultSceneLayoutDocument.items.radio,
      'width',
      '1440',
      {
        aspectRatio: 520 / 360,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('当前位置保持比例时');
  });

  it('Inspector 会要求 zIndex 为安全整数', () => {
    const result = validateSceneInspectorValue(
      defaultSceneLayoutDocument.items.radio,
      'zIndex',
      `${Number.MAX_SAFE_INTEGER + 1}`,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('zIndex 必须是安全整数');
  });
});
