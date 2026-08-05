import { describe, expect, it } from 'vitest';
import {
  defaultSceneLayoutDocument,
  updateSceneLayoutItem,
} from '../scene-layout';
import {
  createSceneInteractionStartSnapshot,
  canUndoSceneDocument,
  createSceneEditorState,
  finishSceneInteraction,
  getSceneEditorDocument,
  getStageScale,
  moveByScreenDelta,
  nudgeSceneEditorItem,
  previewDragByScreenDelta,
  previewDragInScreenSpace,
  previewResizeByScreenDelta,
  previewResizeInScreenSpace,
  screenRectToDesignRect,
  updateSceneEditorItem,
} from './scene-editor-state';
import {
  createStageMetrics,
  createStageMoveableMetrics,
} from './useStageMetrics';

describe('scene-editor-state', () => {
  it('屏幕 delta 会正确换算为 1440x900 设计坐标', () => {
    const moved = moveByScreenDelta(defaultSceneLayoutDocument, 'radio', 60, 30, 0.5);
    expect(moved.items.radio.x).toBe(358);
    expect(moved.items.radio.y).toBe(691);
  });

  it('screenRectToDesignRect 会把屏幕矩形换算回设计坐标', () => {
    const result = screenRectToDesignRect(
      {
        left: 119,
        top: 315.5,
        width: 129.5,
        height: 89.5,
      },
      0.5,
      defaultSceneLayoutDocument.items.radio,
    );

    expect(result).toMatchObject({
      x: 238,
      y: 631,
      width: 259,
      height: 179,
    });
  });

  it('keepRatio 会按资源比例保持宽高', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const next = updateSceneEditorItem(state, 'radio', { width: 520 });
    expect(next.history.present.items.radio.width).toBe(520);
    expect(next.history.present.items.radio.height).toBe(360);
  });

  it('radio 宽度输入 1440 后仍保持 520:360 比例并完整位于舞台内', () => {
    const updated = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { width: 1440 }, {
      aspectRatio: 520 / 360,
      preferredDimension: 'width',
    });

    expect(updated.items.radio.width / updated.items.radio.height).toBeCloseTo(520 / 360, 3);
    expect(updated.items.radio.x).toBeGreaterThanOrEqual(0);
    expect(updated.items.radio.y).toBeGreaterThanOrEqual(0);
    expect(updated.items.radio.x + updated.items.radio.width).toBeLessThanOrEqual(1440);
    expect(updated.items.radio.y + updated.items.radio.height).toBeLessThanOrEqual(900);
  });

  it('高度输入 900 时保持比例', () => {
    const updated = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { height: 900 }, {
      aspectRatio: 520 / 360,
      preferredDimension: 'height',
    });

    expect(updated.items.radio.width / updated.items.radio.height).toBeCloseTo(520 / 360, 3);
    expect(updated.items.radio.x + updated.items.radio.width).toBeLessThanOrEqual(1440);
    expect(updated.items.radio.y + updated.items.radio.height).toBeLessThanOrEqual(900);
  });

  it('靠右下角缩放时保持比例且不越界', () => {
    const positioned = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', {
      x: 1200,
      y: 760,
    });
    const resized = updateSceneLayoutItem(positioned, 'radio', { width: 600 }, {
      aspectRatio: 520 / 360,
      preferredDimension: 'width',
    });

    expect(resized.items.radio.width / resized.items.radio.height).toBeCloseTo(520 / 360, 2);
    expect(resized.items.radio.x + resized.items.radio.width).toBeLessThanOrEqual(1440);
    expect(resized.items.radio.y + resized.items.radio.height).toBeLessThanOrEqual(900);
  });

  it('keepRatio=false 时允许自由改变宽高', () => {
    const freeform = updateSceneLayoutItem(
      updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { keepRatio: false }),
      'radio',
      { width: 400, height: 111 },
      {
        aspectRatio: 520 / 360,
        preferredDimension: 'width',
      },
    );

    expect(freeform.items.radio.width).toBe(400);
    expect(freeform.items.radio.height).toBe(111);
  });

  it('最小尺寸场景保持比例，不出现某一边低于 20', () => {
    const updated = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { width: 1 }, {
      aspectRatio: 520 / 360,
      preferredDimension: 'width',
    });

    expect(updated.items.radio.width).toBeGreaterThanOrEqual(20);
    expect(updated.items.radio.height).toBeGreaterThanOrEqual(20);
    expect(updated.items.radio.width / updated.items.radio.height).toBeCloseTo(520 / 360, 1);
  });

  it('边界与最小尺寸限制会生效', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const next = updateSceneEditorItem(state, 'radio', {
      x: 2000,
      y: 2000,
      width: 1,
      height: 1,
    });
    expect(next.history.present.items.radio.width).toBe(29);
    expect(next.history.present.items.radio.height).toBe(20);
    expect(next.history.present.items.radio.x + next.history.present.items.radio.width).toBeLessThanOrEqual(1440);
    expect(next.history.present.items.radio.y + next.history.present.items.radio.height).toBeLessThanOrEqual(900);
  });

  it('locked 物件不能通过微调修改', () => {
    const lockedState = updateSceneEditorItem(
      createSceneEditorState(defaultSceneLayoutDocument),
      'radio',
      { locked: true },
    );
    const nudged = nudgeSceneEditorItem(lockedState, 'radio', 10, 10);
    expect(nudged.history.present.items.radio.x).toBe(238);
    expect(nudged.history.present.items.radio.y).toBe(631);
  });

  it('一次拖拽连续预览只会形成一个历史节点', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const previewA = previewDragInScreenSpace(
      state,
      'radio',
      { left: 130, top: 315.5, width: 129.5, height: 89.5 },
      0.5,
    );
    const previewB = previewDragInScreenSpace(
      previewA,
      'radio',
      { left: 140, top: 325.5, width: 129.5, height: 89.5 },
      0.5,
    );

    expect(canUndoSceneDocument(previewB)).toBe(false);
    const committed = finishSceneInteraction(previewB);
    expect(canUndoSceneDocument(committed)).toBe(true);
    expect(committed.history.past).toHaveLength(1);
  });

  it('拖拽使用起始坐标与相对 delta，而不是绝对 left/top', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const snapshot = createSceneInteractionStartSnapshot(
      defaultSceneLayoutDocument,
      'radio',
      0.5,
    );
    const preview = previewDragByScreenDelta(state, snapshot, 10, 20, 0.5);

    expect(getSceneEditorDocument(preview).items.radio).toMatchObject({
      x: 258,
      y: 671,
    });
  });

  it('Moveable 绝对 left/top 失真时，只要 dist 正确就不会跳到 0/0', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const snapshot = createSceneInteractionStartSnapshot(
      defaultSceneLayoutDocument,
      'radio',
      0.6513888888888889,
    );
    const brokenAbsolutePreview = previewDragInScreenSpace(
      state,
      'radio',
      { left: -168.687, top: -116.828, width: 168.703, height: 116.594 },
      0.6513888888888889,
    );
    const relativePreview = previewDragByScreenDelta(
      state,
      snapshot,
      10,
      0,
      0.6513888888888889,
    );

    expect(getSceneEditorDocument(brokenAbsolutePreview).items.radio).toMatchObject({
      x: 0,
      y: 0,
    });
    expect(getSceneEditorDocument(relativePreview).items.radio).toMatchObject({
      x: 253,
      y: 631,
    });
  });

  it('连续 onDrag 都基于同一起始快照，不会重复累计 delta', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const snapshot = createSceneInteractionStartSnapshot(
      defaultSceneLayoutDocument,
      'radio',
      0.5,
    );
    const previewA = previewDragByScreenDelta(state, snapshot, 10, 0, 0.5);
    const previewB = previewDragByScreenDelta(previewA, snapshot, 20, 0, 0.5);

    expect(getSceneEditorDocument(previewB).items.radio.x).toBe(278);
  });

  it('预览缩放会按设计空间尺寸更新', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const preview = previewResizeInScreenSpace(
      state,
      'radio',
      { left: 119, top: 315.5, width: 260, height: 180 },
      0.5,
      'width',
    );

    expect(getSceneEditorDocument(preview).items.radio.width).toBe(520);
    expect(getSceneEditorDocument(preview).items.radio.height).toBe(360);
  });

  it('resize 使用起始快照与相对信息，不依赖绝对 left/top', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const snapshot = createSceneInteractionStartSnapshot(
      defaultSceneLayoutDocument,
      'radio',
      0.5,
    );
    const preview = previewResizeByScreenDelta(
      state,
      snapshot,
      10,
      20,
      260,
      180,
      0.5,
      'width',
    );

    expect(getSceneEditorDocument(preview).items.radio).toMatchObject({
      x: 258,
      y: 540,
      width: 520,
      height: 360,
    });
  });

  it('舞台缩放比例按 clientWidth / 1440 计算', () => {
    expect(getStageScale(720)).toBe(0.5);
    expect(getStageScale(1440)).toBe(1);
  });

  it('舞台从 720 变为 1080 时 scale 从 0.5 更新为 0.75', () => {
    expect(createStageMetrics(720, 450).scale).toBe(0.5);
    expect(createStageMetrics(1080, 675).scale).toBe(0.75);
  });

  it('尺寸变化后同样屏幕 delta 会使用新 scale', () => {
    const atHalf = moveByScreenDelta(defaultSceneLayoutDocument, 'radio', 60, 0, 0.5);
    const atThreeQuarter = moveByScreenDelta(defaultSceneLayoutDocument, 'radio', 60, 0, 0.75);

    expect(atHalf.items.radio.x).toBe(358);
    expect(atThreeQuarter.items.radio.x).toBe(318);
  });

  it('bounds 与 guidelines 会随 metrics 同步更新', () => {
    const metrics = createStageMoveableMetrics(createStageMetrics(1080, 675), true);

    expect(metrics.bounds).toMatchObject({
      right: 1080,
      bottom: 675,
    });
    expect(metrics.verticalGuidelines).toEqual([0, 540, 1080]);
    expect(metrics.horizontalGuidelines).toEqual([0, 337.5, 675]);
    expect(metrics.snapGridWidth).toBe(7.5);
    expect(metrics.snapGridHeight).toBe(7.5);
  });
});
