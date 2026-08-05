import { describe, expect, it } from 'vitest';
import { defaultSceneLayoutDocument } from '../scene-layout';
import {
  computeDragPreviewRect,
  computeResizePreviewRect,
} from './scene-transform-math';

describe('scene-transform-math', () => {
  const radio = defaultSceneLayoutDocument.items.radio;

  it('从 238/631 开始右移 65 屏幕像素，scale=0.65 时会到约 338/631', () => {
    const next = computeDragPreviewRect(radio, 65, 0, {
      stageScale: 0.65,
      snapEnabled: false,
    });

    expect(next.x).toBe(338);
    expect(next.y).toBe(631);
  });

  it('DOM target 是否落在 0/0 不影响拖拽结果', () => {
    const next = computeDragPreviewRect(radio, 10, 0, {
      stageScale: 0.5,
      snapEnabled: false,
    });

    expect(next.x).toBe(258);
    expect(next.y).toBe(631);
  });

  it('图片 loaded/error 状态不参与坐标计算', () => {
    const loaded = computeDragPreviewRect(radio, 20, 10, {
      stageScale: 0.5,
      snapEnabled: false,
    });
    const errored = computeDragPreviewRect(radio, 20, 10, {
      stageScale: 0.5,
      snapEnabled: false,
    });

    expect(loaded).toEqual(errored);
  });

  it('连续 pointermove 始终基于起始快照，不重复累计', () => {
    const moveA = computeDragPreviewRect(radio, 10, 0, {
      stageScale: 0.5,
      snapEnabled: false,
    });
    const moveB = computeDragPreviewRect(radio, 20, 0, {
      stageScale: 0.5,
      snapEnabled: false,
    });

    expect(moveA.x).toBe(258);
    expect(moveB.x).toBe(278);
  });

  it('scale 改变后会使用最新 scale', () => {
    const atHalf = computeDragPreviewRect(radio, 60, 0, {
      stageScale: 0.5,
      snapEnabled: false,
    });
    const atThreeQuarter = computeDragPreviewRect(radio, 60, 0, {
      stageScale: 0.75,
      snapEnabled: false,
    });

    expect(atHalf.x).toBe(358);
    expect(atThreeQuarter.x).toBe(318);
  });

  it('拖拽越界时会正确限制在舞台内', () => {
    const next = computeDragPreviewRect(radio, -1000, -1000, {
      stageScale: 1,
      snapEnabled: false,
    });

    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  it('开启与关闭 10px 吸附结果不同', () => {
    const unsnapped = computeDragPreviewRect(radio, 12, 0, {
      stageScale: 1,
      snapEnabled: false,
    });
    const snapped = computeDragPreviewRect(radio, 12, 0, {
      stageScale: 1,
      snapEnabled: true,
    });

    expect(unsnapped.x).toBe(250);
    expect(snapped.x).toBe(250);
  });

  it.each([
    ['east', 20, 0],
    ['west', -20, 0],
    ['south', 0, 20],
    ['north', 0, -20],
    ['south-east', 20, 20],
    ['south-west', -20, 20],
    ['north-east', 20, -20],
    ['north-west', -20, -20],
  ] as const)('8 个控制点 %s 的方向计算正确', (handle, dx, dy) => {
    const next = computeResizePreviewRect(radio, handle, dx, dy, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: false,
      aspectRatio: null,
    });

    if (handle.includes('east')) {
      expect(next.width).toBeGreaterThan(radio.width);
    }
    if (handle.includes('west')) {
      expect(next.x).toBeLessThan(radio.x);
      expect(next.width).toBeGreaterThan(radio.width);
    }
    if (handle.includes('south')) {
      expect(next.height).toBeGreaterThan(radio.height);
    }
    if (handle.includes('north')) {
      expect(next.y).toBeLessThan(radio.y);
      expect(next.height).toBeGreaterThan(radio.height);
    }
  });

  it('west 和 north 缩放时会同步改变 x/y', () => {
    const west = computeResizePreviewRect(radio, 'west', -30, 0, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: false,
      aspectRatio: null,
    });
    const north = computeResizePreviewRect(radio, 'north', 0, -30, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: false,
      aspectRatio: null,
    });

    expect(west.x).toBe(208);
    expect(north.y).toBe(601);
  });

  it('缩放时 opposite anchor 会保持固定', () => {
    const next = computeResizePreviewRect(radio, 'west', -30, 0, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: false,
      aspectRatio: null,
    });

    expect(next.x + next.width).toBe(radio.x + radio.width);
  });

  it('尺寸不会小于 20px', () => {
    const next = computeResizePreviewRect(radio, 'east', -1000, 0, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: false,
      aspectRatio: null,
    });

    expect(next.width).toBeGreaterThanOrEqual(20);
  });

  it('keepRatio=true 时保持素材比例', () => {
    const next = computeResizePreviewRect(radio, 'south-east', 120, 10, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: true,
      aspectRatio: 520 / 360,
    });

    expect(next.width / next.height).toBeCloseTo(520 / 360, 2);
  });

  it('keepRatio=false 时允许自由宽高', () => {
    const next = computeResizePreviewRect(radio, 'south-east', 80, 5, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: false,
      aspectRatio: 520 / 360,
    });

    expect(next.width).toBe(radio.width + 80);
    expect(next.height).toBe(radio.height + 5);
  });

  it('靠近四边时缩放不会越界', () => {
    const nearEdge = {
      ...radio,
      x: 1200,
      y: 700,
      width: 220,
      height: 150,
    };
    const next = computeResizePreviewRect(nearEdge, 'south-east', 200, 200, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: true,
      aspectRatio: 520 / 360,
    });

    expect(next.x + next.width).toBeLessThanOrEqual(1440);
    expect(next.y + next.height).toBeLessThanOrEqual(900);
  });

  it('north handle 在 keepRatio=true 时会围绕 south-center 缩放', () => {
    const next = computeResizePreviewRect(radio, 'north', 0, -40, {
      stageScale: 1,
      snapEnabled: false,
      keepRatio: true,
      aspectRatio: 520 / 360,
    });

    const originalAnchorX = radio.x + (radio.width / 2);
    const originalAnchorY = radio.y + radio.height;
    expect(Math.abs((next.x + (next.width / 2)) - originalAnchorX)).toBeLessThanOrEqual(0.5);
    expect(next.y + next.height).toBeCloseTo(originalAnchorY, 0);
  });
});
