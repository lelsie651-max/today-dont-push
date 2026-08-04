import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  sceneLayout,
  sceneLayoutEntries,
  SCENE_DESIGN_HEIGHT,
  SCENE_DESIGN_WIDTH,
} from './scene-layout';

describe('sceneLayout', () => {
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

  it('CSS 中不再残留 .slot-* 的位置和 z-index 硬编码', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/features/space/space.css'),
      'utf8',
    );
    expect(css).not.toMatch(/\.slot-[\w-]+\s*\{[^}]*\b(left|right|top|bottom|width|height|z-index)\b/);
  });
});
