import type { CSSProperties } from 'react';

export const SCENE_DESIGN_WIDTH = 1440;
export const SCENE_DESIGN_HEIGHT = 900;

export interface SceneLayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
}

export interface SceneLayout {
  readonly windowViewport: SceneLayoutRect;
  readonly roomForeground: SceneLayoutRect;
  readonly planBoard: SceneLayoutRect;
  readonly deskLamp: SceneLayoutRect;
  readonly radio: SceneLayoutRect;
  readonly focusClock: SceneLayoutRect;
  readonly tarotEntry: SceneLayoutRect;
  readonly magazine: SceneLayoutRect;
  readonly reviewPrinter: SceneLayoutRect;
  readonly plant: SceneLayoutRect;
}

export const sceneLayout: SceneLayout = {
  windowViewport: {
    x: 445,
    y: 10,
    width: 940,
    height: 520,
    zIndex: 1,
  },
  roomForeground: {
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
    zIndex: 4,
  },
  planBoard: {
    x: 89,
    y: 108,
    width: 317,
    height: 247,
    zIndex: 6,
  },
  deskLamp: {
    x: 734,
    y: 496,
    width: 219,
    height: 323,
    zIndex: 7,
  },
  radio: {
    x: 238,
    y: 631,
    width: 259,
    height: 179,
    zIndex: 7,
  },
  focusClock: {
    x: 550,
    y: 667,
    width: 194,
    height: 121,
    zIndex: 7,
  },
  tarotEntry: {
    x: 1146,
    y: 221,
    width: 144,
    height: 144,
    zIndex: 7,
  },
  magazine: {
    x: 441,
    y: 667,
    width: 245,
    height: 172,
    zIndex: 6,
  },
  reviewPrinter: {
    x: 1128,
    y: 539,
    width: 219,
    height: 271,
    zIndex: 7,
  },
  plant: {
    x: 936,
    y: 587,
    width: 187,
    height: 227,
    zIndex: 7,
  },
};

export const sceneLayoutEntries = Object.entries(sceneLayout) as ReadonlyArray<
  readonly [keyof SceneLayout, SceneLayoutRect]
>;

export function toStageStyle(rect: SceneLayoutRect): CSSProperties {
  return {
    left: `${(rect.x / SCENE_DESIGN_WIDTH) * 100}%`,
    top: `${(rect.y / SCENE_DESIGN_HEIGHT) * 100}%`,
    width: `${(rect.width / SCENE_DESIGN_WIDTH) * 100}%`,
    height: `${(rect.height / SCENE_DESIGN_HEIGHT) * 100}%`,
    zIndex: rect.zIndex,
  };
}
