import { describe, expect, it } from 'vitest';
import { defaultSceneLayoutDocument } from '../scene-layout';
import {
  canUndoSceneDocument,
  createSceneEditorState,
  finishSceneInteraction,
  getSceneEditorDocument,
  getStageScale,
  moveByScreenDelta,
  nudgeSceneEditorItem,
  previewDragInScreenSpace,
  previewResizeInScreenSpace,
  screenRectToDesignRect,
  updateSceneEditorItem,
} from './scene-editor-state';

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

  it('边界与最小尺寸限制会生效', () => {
    const state = createSceneEditorState(defaultSceneLayoutDocument);
    const next = updateSceneEditorItem(state, 'radio', {
      x: 2000,
      y: 2000,
      width: 1,
      height: 1,
    });
    expect(next.history.present.items.radio.width).toBe(20);
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

  it('舞台缩放比例按 clientWidth / 1440 计算', () => {
    expect(getStageScale(720)).toBe(0.5);
    expect(getStageScale(1440)).toBe(1);
  });
});
