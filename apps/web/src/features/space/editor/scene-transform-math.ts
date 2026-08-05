import {
  SCENE_DESIGN_HEIGHT,
  SCENE_DESIGN_WIDTH,
  SCENE_MIN_SIZE,
  roundToScenePixels,
  screenDeltaToDesignDelta,
  type SceneLayoutRect,
} from '../scene-layout';

export type SceneResizeHandle =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

export interface SceneTransformOptions {
  readonly stageScale: number;
  readonly snapEnabled: boolean;
}

export interface SceneResizeOptions extends SceneTransformOptions {
  readonly keepRatio: boolean;
  readonly aspectRatio: number | null;
}

const SNAP_GRID_SIZE = 10;
const SNAP_GUIDE_THRESHOLD = 6;

interface SceneRectEdges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface SceneSizeLimits {
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
}

function toEdges(rect: SceneLayoutRect): SceneRectEdges {
  return {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
  };
}

function fromEdges(edges: SceneRectEdges, zIndex: number): SceneLayoutRect {
  return {
    x: roundToScenePixels(edges.left),
    y: roundToScenePixels(edges.top),
    width: roundToScenePixels(edges.right - edges.left),
    height: roundToScenePixels(edges.bottom - edges.top),
    zIndex,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundRect(rect: SceneLayoutRect): SceneLayoutRect {
  return {
    x: roundToScenePixels(rect.x),
    y: roundToScenePixels(rect.y),
    width: roundToScenePixels(rect.width),
    height: roundToScenePixels(rect.height),
    zIndex: roundToScenePixels(rect.zIndex),
  };
}

function clampDraggedRect(rect: SceneLayoutRect): SceneLayoutRect {
  return {
    ...roundRect(rect),
    x: clamp(roundToScenePixels(rect.x), 0, SCENE_DESIGN_WIDTH - roundToScenePixels(rect.width)),
    y: clamp(roundToScenePixels(rect.y), 0, SCENE_DESIGN_HEIGHT - roundToScenePixels(rect.height)),
  };
}

function snapToGrid(value: number) {
  return roundToScenePixels(Math.round(value / SNAP_GRID_SIZE) * SNAP_GRID_SIZE);
}

function snapByGuides(
  left: number,
  size: number,
  stageSize: number,
): number {
  const right = left + size;
  const center = left + (size / 2);
  const guideCandidates = [0, stageSize / 2, stageSize];

  for (const guide of guideCandidates) {
    if (Math.abs(left - guide) <= SNAP_GUIDE_THRESHOLD) {
      return roundToScenePixels(guide);
    }
    if (Math.abs(right - guide) <= SNAP_GUIDE_THRESHOLD) {
      return roundToScenePixels(guide - size);
    }
    if (Math.abs(center - guide) <= SNAP_GUIDE_THRESHOLD) {
      return roundToScenePixels(guide - (size / 2));
    }
  }

  return roundToScenePixels(left);
}

function snapDragRect(rect: SceneLayoutRect): SceneLayoutRect {
  const gridX = snapToGrid(rect.x);
  const gridY = snapToGrid(rect.y);
  return {
    ...rect,
    x: snapByGuides(gridX, rect.width, SCENE_DESIGN_WIDTH),
    y: snapByGuides(gridY, rect.height, SCENE_DESIGN_HEIGHT),
  };
}

function getResizeHandleDirection(handle: SceneResizeHandle) {
  return {
    x:
      handle.includes('east')
        ? 1
        : handle.includes('west')
          ? -1
          : 0,
    y:
      handle.includes('south')
        ? 1
        : handle.includes('north')
          ? -1
          : 0,
  } as const;
}

function applyFreeformResize(
  startRect: SceneLayoutRect,
  handle: SceneResizeHandle,
  dxDesign: number,
  dyDesign: number,
): SceneLayoutRect {
  const start = toEdges(startRect);
  let left = start.left;
  let right = start.right;
  let top = start.top;
  let bottom = start.bottom;

  switch (handle) {
    case 'north':
      top = clamp(start.top + dyDesign, 0, start.bottom - SCENE_MIN_SIZE);
      break;
    case 'north-east':
      top = clamp(start.top + dyDesign, 0, start.bottom - SCENE_MIN_SIZE);
      right = clamp(start.right + dxDesign, start.left + SCENE_MIN_SIZE, SCENE_DESIGN_WIDTH);
      break;
    case 'east':
      right = clamp(start.right + dxDesign, start.left + SCENE_MIN_SIZE, SCENE_DESIGN_WIDTH);
      break;
    case 'south-east':
      right = clamp(start.right + dxDesign, start.left + SCENE_MIN_SIZE, SCENE_DESIGN_WIDTH);
      bottom = clamp(start.bottom + dyDesign, start.top + SCENE_MIN_SIZE, SCENE_DESIGN_HEIGHT);
      break;
    case 'south':
      bottom = clamp(start.bottom + dyDesign, start.top + SCENE_MIN_SIZE, SCENE_DESIGN_HEIGHT);
      break;
    case 'south-west':
      bottom = clamp(start.bottom + dyDesign, start.top + SCENE_MIN_SIZE, SCENE_DESIGN_HEIGHT);
      left = clamp(start.left + dxDesign, 0, start.right - SCENE_MIN_SIZE);
      break;
    case 'west':
      left = clamp(start.left + dxDesign, 0, start.right - SCENE_MIN_SIZE);
      break;
    case 'north-west':
      left = clamp(start.left + dxDesign, 0, start.right - SCENE_MIN_SIZE);
      top = clamp(start.top + dyDesign, 0, start.bottom - SCENE_MIN_SIZE);
      break;
  }

  return fromEdges({ left, top, right, bottom }, startRect.zIndex);
}

function getKeepRatioMinimumSize(
  aspectRatio: number,
  preferredDimension: 'width' | 'height',
) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return {
      minWidth: SCENE_MIN_SIZE,
      minHeight: SCENE_MIN_SIZE,
    };
  }

  if (preferredDimension === 'width') {
    const minWidth = Math.max(SCENE_MIN_SIZE, Math.ceil(SCENE_MIN_SIZE * aspectRatio));
    return {
      minWidth,
      minHeight: Math.max(SCENE_MIN_SIZE, Math.round(minWidth / aspectRatio)),
    };
  }

  const minHeight = Math.max(SCENE_MIN_SIZE, Math.ceil(SCENE_MIN_SIZE / aspectRatio));
  return {
    minWidth: Math.max(SCENE_MIN_SIZE, Math.round(minHeight * aspectRatio)),
    minHeight,
  };
}

function getKeepRatioSizeLimits(
  startRect: SceneLayoutRect,
  handle: SceneResizeHandle,
  aspectRatio: number,
  preferredDimension: 'width' | 'height',
): SceneSizeLimits {
  const anchorLeft = startRect.x;
  const anchorRight = startRect.x + startRect.width;
  const anchorTop = startRect.y;
  const anchorBottom = startRect.y + startRect.height;
  const centerX = startRect.x + (startRect.width / 2);
  const centerY = startRect.y + (startRect.height / 2);
  const minimum = getKeepRatioMinimumSize(aspectRatio, preferredDimension);

  switch (handle) {
    case 'east':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: SCENE_DESIGN_WIDTH - anchorLeft,
        maxHeight: Math.min(centerY * 2, (SCENE_DESIGN_HEIGHT - centerY) * 2),
      };
    case 'west':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: anchorRight,
        maxHeight: Math.min(centerY * 2, (SCENE_DESIGN_HEIGHT - centerY) * 2),
      };
    case 'south':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: Math.min(centerX * 2, (SCENE_DESIGN_WIDTH - centerX) * 2),
        maxHeight: SCENE_DESIGN_HEIGHT - anchorTop,
      };
    case 'north':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: Math.min(centerX * 2, (SCENE_DESIGN_WIDTH - centerX) * 2),
        maxHeight: anchorBottom,
      };
    case 'south-east':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: SCENE_DESIGN_WIDTH - anchorLeft,
        maxHeight: SCENE_DESIGN_HEIGHT - anchorTop,
      };
    case 'south-west':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: anchorRight,
        maxHeight: SCENE_DESIGN_HEIGHT - anchorTop,
      };
    case 'north-east':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: SCENE_DESIGN_WIDTH - anchorLeft,
        maxHeight: anchorBottom,
      };
    case 'north-west':
      return {
        minWidth: minimum.minWidth,
        minHeight: minimum.minHeight,
        maxWidth: anchorRight,
        maxHeight: anchorBottom,
      };
  }
}

function constrainKeepRatioSize(
  requestedWidth: number,
  requestedHeight: number,
  preferredDimension: 'width' | 'height',
  aspectRatio: number,
  limits: SceneSizeLimits,
) {
  const maxWidth = Math.max(limits.minWidth, Math.min(limits.maxWidth, Math.floor(limits.maxHeight * aspectRatio)));
  const maxHeight = Math.max(limits.minHeight, Math.min(limits.maxHeight, Math.floor(limits.maxWidth / aspectRatio)));

  if (preferredDimension === 'width') {
    let width = clamp(roundToScenePixels(requestedWidth), limits.minWidth, maxWidth);
    let height = Math.max(limits.minHeight, roundToScenePixels(width / aspectRatio));
    if (height > limits.maxHeight) {
      height = clamp(height, limits.minHeight, maxHeight);
      width = Math.max(limits.minWidth, roundToScenePixels(height * aspectRatio));
    }
    return { width, height };
  }

  let height = clamp(roundToScenePixels(requestedHeight), limits.minHeight, maxHeight);
  let width = Math.max(limits.minWidth, roundToScenePixels(height * aspectRatio));
  if (width > limits.maxWidth) {
    width = clamp(width, limits.minWidth, maxWidth);
    height = Math.max(limits.minHeight, roundToScenePixels(width / aspectRatio));
  }
  return { width, height };
}

function createKeepRatioRectFromAnchor(
  startRect: SceneLayoutRect,
  handle: SceneResizeHandle,
  width: number,
  height: number,
): SceneLayoutRect {
  const left = startRect.x;
  const top = startRect.y;
  const right = startRect.x + startRect.width;
  const bottom = startRect.y + startRect.height;
  const centerX = left + (startRect.width / 2);
  const centerY = top + (startRect.height / 2);

  switch (handle) {
    case 'east':
      return {
        x: left,
        y: centerY - (height / 2),
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'west':
      return {
        x: right - width,
        y: centerY - (height / 2),
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'south':
      return {
        x: centerX - (width / 2),
        y: top,
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'north':
      return {
        x: centerX - (width / 2),
        y: bottom - height,
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'south-east':
      return {
        x: left,
        y: top,
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'south-west':
      return {
        x: right - width,
        y: top,
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'north-east':
      return {
        x: left,
        y: bottom - height,
        width,
        height,
        zIndex: startRect.zIndex,
      };
    case 'north-west':
      return {
        x: right - width,
        y: bottom - height,
        width,
        height,
        zIndex: startRect.zIndex,
      };
  }
}

function getPreferredResizeDimension(
  handle: SceneResizeHandle,
  dxDesign: number,
  dyDesign: number,
  aspectRatio: number,
): 'width' | 'height' {
  if (handle === 'east' || handle === 'west') {
    return 'width';
  }
  if (handle === 'north' || handle === 'south') {
    return 'height';
  }
  return Math.abs(dxDesign) >= Math.abs(dyDesign * aspectRatio) ? 'width' : 'height';
}

function applyKeepRatioResize(
  startRect: SceneLayoutRect,
  handle: SceneResizeHandle,
  dxDesign: number,
  dyDesign: number,
  aspectRatio: number,
): SceneLayoutRect {
  const direction = getResizeHandleDirection(handle);
  const preferredDimension = getPreferredResizeDimension(handle, dxDesign, dyDesign, aspectRatio);
  const requestedWidth = startRect.width + (direction.x * dxDesign);
  const requestedHeight = startRect.height + (direction.y * dyDesign);
  const limits = getKeepRatioSizeLimits(startRect, handle, aspectRatio, preferredDimension);
  const { width, height } = constrainKeepRatioSize(
    requestedWidth,
    requestedHeight,
    preferredDimension,
    aspectRatio,
    limits,
  );

  return roundRect(createKeepRatioRectFromAnchor(startRect, handle, width, height));
}

function snapResizedRect(rect: SceneLayoutRect, handle: SceneResizeHandle): SceneLayoutRect {
  const snapped = roundRect({
    ...rect,
    x: snapToGrid(rect.x),
    y: snapToGrid(rect.y),
    width: Math.max(SCENE_MIN_SIZE, snapToGrid(rect.width)),
    height: Math.max(SCENE_MIN_SIZE, snapToGrid(rect.height)),
  });

  const right = snapped.x + snapped.width;
  const bottom = snapped.y + snapped.height;
  const centerX = snapped.x + (snapped.width / 2);
  const centerY = snapped.y + (snapped.height / 2);
  const horizontalGuides = [0, SCENE_DESIGN_WIDTH / 2, SCENE_DESIGN_WIDTH];
  const verticalGuides = [0, SCENE_DESIGN_HEIGHT / 2, SCENE_DESIGN_HEIGHT];

  if (handle.includes('west')) {
    for (const guide of horizontalGuides) {
      if (Math.abs(snapped.x - guide) <= SNAP_GUIDE_THRESHOLD) {
        return {
          ...snapped,
          x: roundToScenePixels(guide),
          width: roundToScenePixels(right - guide),
        };
      }
    }
  }

  if (handle.includes('east')) {
    for (const guide of horizontalGuides) {
      if (Math.abs(right - guide) <= SNAP_GUIDE_THRESHOLD) {
        return {
          ...snapped,
          width: roundToScenePixels(guide - snapped.x),
        };
      }
    }
  }

  if (handle.includes('north')) {
    for (const guide of verticalGuides) {
      if (Math.abs(snapped.y - guide) <= SNAP_GUIDE_THRESHOLD) {
        return {
          ...snapped,
          y: roundToScenePixels(guide),
          height: roundToScenePixels(bottom - guide),
        };
      }
    }
  }

  if (handle.includes('south')) {
    for (const guide of verticalGuides) {
      if (Math.abs(bottom - guide) <= SNAP_GUIDE_THRESHOLD) {
        return {
          ...snapped,
          height: roundToScenePixels(guide - snapped.y),
        };
      }
    }
  }

  if (handle === 'north' || handle === 'south') {
    for (const guide of horizontalGuides) {
      if (Math.abs(centerX - guide) <= SNAP_GUIDE_THRESHOLD) {
        return {
          ...snapped,
          x: roundToScenePixels(guide - (snapped.width / 2)),
        };
      }
    }
  }

  if (handle === 'east' || handle === 'west') {
    for (const guide of verticalGuides) {
      if (Math.abs(centerY - guide) <= SNAP_GUIDE_THRESHOLD) {
        return {
          ...snapped,
          y: roundToScenePixels(guide - (snapped.height / 2)),
        };
      }
    }
  }

  return snapped;
}

export function computeDragPreviewRect(
  startRect: SceneLayoutRect,
  dxScreen: number,
  dyScreen: number,
  options: SceneTransformOptions,
): SceneLayoutRect {
  const dxDesign = screenDeltaToDesignDelta(dxScreen, options.stageScale);
  const dyDesign = screenDeltaToDesignDelta(dyScreen, options.stageScale);
  const nextRect = clampDraggedRect({
    ...startRect,
    x: startRect.x + dxDesign,
    y: startRect.y + dyDesign,
  });

  return options.snapEnabled ? clampDraggedRect(snapDragRect(nextRect)) : nextRect;
}

export function computeResizePreviewRect(
  startRect: SceneLayoutRect,
  handle: SceneResizeHandle,
  dxScreen: number,
  dyScreen: number,
  options: SceneResizeOptions,
): SceneLayoutRect {
  const dxDesign = screenDeltaToDesignDelta(dxScreen, options.stageScale);
  const dyDesign = screenDeltaToDesignDelta(dyScreen, options.stageScale);
  const aspectRatio =
    options.aspectRatio !== null && options.aspectRatio > 0
      ? options.aspectRatio
      : startRect.width / startRect.height;

  const resized = options.keepRatio
    ? applyKeepRatioResize(startRect, handle, dxDesign, dyDesign, aspectRatio)
    : applyFreeformResize(startRect, handle, dxDesign, dyDesign);

  return options.snapEnabled ? roundRect(snapResizedRect(resized, handle)) : roundRect(resized);
}
