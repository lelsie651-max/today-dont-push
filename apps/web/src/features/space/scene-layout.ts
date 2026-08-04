import type { CSSProperties } from 'react';
import sceneLayoutJson from './scene-layout.json';

export const SCENE_LAYOUT_VERSION = 1;
export const SCENE_DESIGN_WIDTH = 1440;
export const SCENE_DESIGN_HEIGHT = 900;
export const SCENE_MIN_SIZE = 20;
export const SCENE_ITEM_ORDER = [
  'windowViewport',
  'roomForeground',
  'planBoard',
  'deskLamp',
  'radio',
  'focusClock',
  'tarotEntry',
  'magazine',
  'reviewPrinter',
  'plant',
] as const;

export type SceneItemKey = (typeof SCENE_ITEM_ORDER)[number];

export interface SceneLayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
}

export interface SceneLayoutItem extends SceneLayoutRect {
  readonly visible: boolean;
  readonly locked: boolean;
  readonly keepRatio: boolean;
}

export interface SceneDesignSpace {
  readonly width: number;
  readonly height: number;
}

export type SceneLayoutItems = Record<SceneItemKey, SceneLayoutItem>;

export interface SceneLayoutDocument {
  readonly version: number;
  readonly designSpace: SceneDesignSpace;
  readonly items: SceneLayoutItems;
}

export interface SceneLayoutValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly document: SceneLayoutDocument | null;
}

export interface SceneLayoutPatch {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly zIndex?: number;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly keepRatio?: boolean;
}

export type SceneNumericField = 'x' | 'y' | 'width' | 'height' | 'zIndex';

export interface SceneInspectorValidationResult {
  readonly ok: boolean;
  readonly error: string | null;
}

const DEFAULT_DOCUMENT_RESULT = validateSceneLayoutDocument(sceneLayoutJson);

if (!DEFAULT_DOCUMENT_RESULT.ok || DEFAULT_DOCUMENT_RESULT.document === null) {
  throw new Error(`默认场景布局无效：${DEFAULT_DOCUMENT_RESULT.errors.join('；')}`);
}

export const defaultSceneLayoutDocument = freezeSceneLayoutDocument(DEFAULT_DOCUMENT_RESULT.document);
export const sceneLayout = defaultSceneLayoutDocument.items;
export const sceneLayoutEntries = SCENE_ITEM_ORDER.map((key) => [key, sceneLayout[key]] as const);

function freezeSceneLayoutDocument(document: SceneLayoutDocument): SceneLayoutDocument {
  return Object.freeze({
    ...document,
    designSpace: Object.freeze({ ...document.designSpace }),
    items: Object.freeze(
      Object.fromEntries(
        SCENE_ITEM_ORDER.map((key) => [key, Object.freeze({ ...document.items[key] })]),
      ) as SceneLayoutItems,
    ),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isSafeIntegerValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function validateSceneLayoutItem(
  key: SceneItemKey,
  value: unknown,
  designSpace: SceneDesignSpace,
): { item: SceneLayoutItem | null; errors: string[] } {
  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return {
      item: null,
      errors: [`items.${key} 必须是对象`],
    };
  }

  const x = value.x;
  const y = value.y;
  const width = value.width;
  const height = value.height;
  const zIndex = value.zIndex;
  const visible = value.visible;
  const locked = value.locked;
  const keepRatio = value.keepRatio;

  if (!isSafeIntegerValue(x)) {
    errors.push(`items.${key}.x 必须是安全整数`);
  }
  if (!isSafeIntegerValue(y)) {
    errors.push(`items.${key}.y 必须是安全整数`);
  }
  if (!isSafeIntegerValue(width)) {
    errors.push(`items.${key}.width 必须是安全整数`);
  }
  if (!isSafeIntegerValue(height)) {
    errors.push(`items.${key}.height 必须是安全整数`);
  }
  if (!isSafeIntegerValue(zIndex)) {
    errors.push(`items.${key}.zIndex 必须是安全整数`);
  }
  if (!isBoolean(visible)) {
    errors.push(`items.${key}.visible 必须是布尔值`);
  }
  if (!isBoolean(locked)) {
    errors.push(`items.${key}.locked 必须是布尔值`);
  }
  if (!isBoolean(keepRatio)) {
    errors.push(`items.${key}.keepRatio 必须是布尔值`);
  }

  if (errors.length > 0) {
    return { item: null, errors };
  }

  const safeX = x as number;
  const safeY = y as number;
  const safeWidth = width as number;
  const safeHeight = height as number;
  const safeZIndex = zIndex as number;
  const safeVisible = visible as boolean;
  const safeLocked = locked as boolean;
  const safeKeepRatio = keepRatio as boolean;

  if (safeWidth < SCENE_MIN_SIZE) {
    errors.push(`items.${key}.width 不能小于 ${SCENE_MIN_SIZE}`);
  }
  if (safeHeight < SCENE_MIN_SIZE) {
    errors.push(`items.${key}.height 不能小于 ${SCENE_MIN_SIZE}`);
  }
  if (safeX < 0 || safeY < 0) {
    errors.push(`items.${key} 不能超出舞台左上边界`);
  }
  if (safeX + safeWidth > designSpace.width || safeY + safeHeight > designSpace.height) {
    errors.push(`items.${key} 必须完整位于 ${designSpace.width}x${designSpace.height} 舞台内`);
  }

  if (errors.length > 0) {
    return { item: null, errors };
  }

  return {
    item: {
      x: safeX,
      y: safeY,
      width: safeWidth,
      height: safeHeight,
      zIndex: safeZIndex,
      visible: safeVisible,
      locked: safeLocked,
      keepRatio: safeKeepRatio,
    },
    errors,
  };
}

export function validateSceneLayoutDocument(input: unknown): SceneLayoutValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: ['场景布局文档必须是对象'],
      document: null,
    };
  }

  if (input.version !== SCENE_LAYOUT_VERSION) {
    errors.push(`version 必须为 ${SCENE_LAYOUT_VERSION}`);
  }

  const designSpaceValue = input.designSpace;
  let designSpace: SceneDesignSpace | null = null;
  if (!isPlainObject(designSpaceValue)) {
    errors.push('designSpace 必须是对象');
  } else if (
    designSpaceValue.width !== SCENE_DESIGN_WIDTH ||
    designSpaceValue.height !== SCENE_DESIGN_HEIGHT
  ) {
    errors.push(`designSpace 必须固定为 ${SCENE_DESIGN_WIDTH}x${SCENE_DESIGN_HEIGHT}`);
  } else {
    designSpace = {
      width: designSpaceValue.width,
      height: designSpaceValue.height,
    };
  }

  const itemsValue = input.items;
  if (!isPlainObject(itemsValue)) {
    errors.push('items 必须是对象');
  }

  if (errors.length > 0 || designSpace === null || !isPlainObject(itemsValue)) {
    return { ok: false, errors, document: null };
  }

  const items = {} as Record<SceneItemKey, SceneLayoutItem>;
  const itemKeys = Object.keys(itemsValue);
  const missingKeys = SCENE_ITEM_ORDER.filter((key) => !itemKeys.includes(key));
  const extraKeys = itemKeys.filter((key) => !SCENE_ITEM_ORDER.includes(key as SceneItemKey));

  missingKeys.forEach((key) => errors.push(`items 缺少 ${key}`));
  extraKeys.forEach((key) => errors.push(`items.${key} 不是受支持的布局项`));

  SCENE_ITEM_ORDER.forEach((key) => {
    const result = validateSceneLayoutItem(key, itemsValue[key], designSpace);
    if (result.item !== null) {
      items[key] = result.item;
    }
    errors.push(...result.errors);
  });

  if (errors.length > 0) {
    return { ok: false, errors, document: null };
  }

  return {
    ok: true,
    errors: [],
    document: {
      version: SCENE_LAYOUT_VERSION,
      designSpace,
      items: items as SceneLayoutItems,
    },
  };
}

export function parseSceneLayoutDraft(input: string): SceneLayoutValidationResult {
  try {
    return validateSceneLayoutDocument(JSON.parse(input) as unknown);
  } catch {
    return {
      ok: false,
      errors: ['本地草稿不是合法 JSON'],
      document: null,
    };
  }
}

function clampWithinRange(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMinimumKeepRatioSize(aspectRatio: number, preferredDimension: 'width' | 'height') {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return {
      width: SCENE_MIN_SIZE,
      height: SCENE_MIN_SIZE,
    };
  }

  if (preferredDimension === 'width') {
    const width = Math.max(SCENE_MIN_SIZE, Math.ceil(SCENE_MIN_SIZE * aspectRatio));
    return {
      width,
      height: Math.max(SCENE_MIN_SIZE, Math.round(width / aspectRatio)),
    };
  }

  const height = Math.max(SCENE_MIN_SIZE, Math.ceil(SCENE_MIN_SIZE / aspectRatio), SCENE_MIN_SIZE);
  return {
    width: Math.max(SCENE_MIN_SIZE, Math.round(height * aspectRatio)),
    height,
  };
}

function createKeepRatioRect(
  rect: SceneLayoutRect,
  aspectRatio: number,
  preferredDimension: 'width' | 'height',
): SceneLayoutRect {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return rect;
  }

  const minimumSize = getMinimumKeepRatioSize(aspectRatio, preferredDimension);

  if (preferredDimension === 'width') {
    const width = Math.max(Math.round(rect.width), minimumSize.width);
    return {
      ...rect,
      width,
      height: Math.max(minimumSize.height, Math.round(width / aspectRatio)),
    };
  }

  const height = Math.max(Math.round(rect.height), minimumSize.height);
  return {
    ...rect,
    width: Math.max(minimumSize.width, Math.round(height * aspectRatio)),
    height,
  };
}

function fitKeepRatioRectWithinStage(
  rect: SceneLayoutRect,
  aspectRatio: number,
): SceneLayoutRect {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return rect;
  }

  let width = rect.width;
  let height = rect.height;

  if (width > SCENE_DESIGN_WIDTH || height > SCENE_DESIGN_HEIGHT) {
    const widthScale = SCENE_DESIGN_WIDTH / width;
    const heightScale = SCENE_DESIGN_HEIGHT / height;

    if (widthScale <= heightScale) {
      width = SCENE_DESIGN_WIDTH;
      height = Math.max(SCENE_MIN_SIZE, Math.round(width / aspectRatio));
      if (height > SCENE_DESIGN_HEIGHT) {
        height = SCENE_DESIGN_HEIGHT;
        width = Math.max(SCENE_MIN_SIZE, Math.round(height * aspectRatio));
      }
    } else {
      height = SCENE_DESIGN_HEIGHT;
      width = Math.max(SCENE_MIN_SIZE, Math.round(height * aspectRatio));
      if (width > SCENE_DESIGN_WIDTH) {
        width = SCENE_DESIGN_WIDTH;
        height = Math.max(SCENE_MIN_SIZE, Math.round(width / aspectRatio));
      }
    }
  }

  return {
    ...rect,
    width,
    height,
  };
}

export function clampSceneRect(
  rect: SceneLayoutRect,
  options: {
    readonly aspectRatio?: number;
    readonly keepRatio?: boolean;
    readonly preferredDimension?: 'width' | 'height';
  } = {},
): SceneLayoutRect {
  let nextRect: SceneLayoutRect = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    zIndex: Math.round(rect.zIndex),
  };

  if (options.keepRatio && options.aspectRatio !== undefined) {
    nextRect = createKeepRatioRect(
      nextRect,
      options.aspectRatio,
      options.preferredDimension ?? 'width',
    );
    nextRect = fitKeepRatioRectWithinStage(nextRect, options.aspectRatio);
  } else {
    nextRect = {
      ...nextRect,
      width: clampWithinRange(nextRect.width, SCENE_MIN_SIZE, SCENE_DESIGN_WIDTH),
      height: clampWithinRange(nextRect.height, SCENE_MIN_SIZE, SCENE_DESIGN_HEIGHT),
    };
  }

  return {
    ...nextRect,
    x: clampWithinRange(nextRect.x, 0, SCENE_DESIGN_WIDTH - nextRect.width),
    y: clampWithinRange(nextRect.y, 0, SCENE_DESIGN_HEIGHT - nextRect.height),
  };
}

export function applyKeepRatio(
  nextRect: SceneLayoutRect,
  aspectRatio: number,
  preferredDimension: 'width' | 'height',
): SceneLayoutRect {
  return createKeepRatioRect(nextRect, aspectRatio, preferredDimension);
}

function getSceneItemAspectRatioForValidation(
  item: SceneLayoutItem,
  aspectRatio?: number,
) {
  if (aspectRatio !== undefined && Number.isFinite(aspectRatio) && aspectRatio > 0) {
    return aspectRatio;
  }
  return item.width / item.height;
}

function validateSceneInspectorSizeInput(
  item: SceneLayoutItem,
  field: 'width' | 'height',
  value: number,
  aspectRatio?: number,
): SceneInspectorValidationResult {
  const preferredDimension = field === 'height' ? 'height' : 'width';
  const ratio = getSceneItemAspectRatioForValidation(item, aspectRatio);

  if (item.keepRatio) {
    const candidate = createKeepRatioRect(
      {
        x: item.x,
        y: item.y,
        width: field === 'width' ? value : item.width,
        height: field === 'height' ? value : item.height,
        zIndex: item.zIndex,
      },
      ratio,
      preferredDimension,
    );

    const minimumSize = getMinimumKeepRatioSize(ratio, preferredDimension);
    const actualValue = field === 'width' ? candidate.width : candidate.height;
    const minimumValue = field === 'width' ? minimumSize.width : minimumSize.height;
    if (actualValue !== value && value < minimumValue) {
      return {
        ok: false,
        error: `${field} 不能小于 ${minimumValue}px（保持比例后）`,
      };
    }

    const availableWidth = SCENE_DESIGN_WIDTH - item.x;
    const availableHeight = SCENE_DESIGN_HEIGHT - item.y;
    if (candidate.width > availableWidth || candidate.height > availableHeight) {
      const maxByWidth = Math.max(
        minimumSize.width,
        Math.min(availableWidth, Math.floor(availableHeight * ratio)),
      );
      const maxByHeight = Math.max(
        minimumSize.height,
        Math.min(availableHeight, Math.floor(availableWidth / ratio)),
      );
      return {
        ok: false,
        error:
          field === 'width'
            ? `当前位置保持比例时，width 允许范围为 ${minimumSize.width}-${maxByWidth}px`
            : `当前位置保持比例时，height 允许范围为 ${minimumSize.height}-${maxByHeight}px`,
      };
    }

    return { ok: true, error: null };
  }

  const minimumValue = SCENE_MIN_SIZE;
  const maximumValue =
    field === 'width' ? SCENE_DESIGN_WIDTH - item.x : SCENE_DESIGN_HEIGHT - item.y;

  if (value < minimumValue || value > maximumValue) {
    return {
      ok: false,
      error: `${field} 允许范围为 ${minimumValue}-${maximumValue}px`,
    };
  }

  return { ok: true, error: null };
}

export function validateSceneInspectorValue(
  item: SceneLayoutItem,
  field: SceneNumericField,
  rawValue: string,
  options: {
    readonly aspectRatio?: number;
  } = {},
): SceneInspectorValidationResult {
  if (!/^-?\d+$/.test(rawValue.trim())) {
    return {
      ok: false,
      error: '请输入整数',
    };
  }

  const value = Number.parseInt(rawValue, 10);

  if (field === 'zIndex') {
    if (!isSafeIntegerValue(value)) {
      return {
        ok: false,
        error: 'zIndex 必须是安全整数',
      };
    }
    return { ok: true, error: null };
  }

  if ((field === 'x' || field === 'y') && !isSafeIntegerValue(value)) {
    return {
      ok: false,
      error: `${field} 必须是安全整数`,
    };
  }

  if (field === 'x') {
    const maxX = SCENE_DESIGN_WIDTH - item.width;
    if (value < 0 || value > maxX) {
      return {
        ok: false,
        error: `x 允许范围为 0-${maxX}px`,
      };
    }
    return { ok: true, error: null };
  }

  if (field === 'y') {
    const maxY = SCENE_DESIGN_HEIGHT - item.height;
    if (value < 0 || value > maxY) {
      return {
        ok: false,
        error: `y 允许范围为 0-${maxY}px`,
      };
    }
    return { ok: true, error: null };
  }

  return validateSceneInspectorSizeInput(
    item,
    field,
    value,
    options.aspectRatio,
  );
}

export function updateSceneLayoutItem(
  document: SceneLayoutDocument,
  key: SceneItemKey,
  patch: SceneLayoutPatch,
  options: {
    readonly aspectRatio?: number;
    readonly preferredDimension?: 'width' | 'height';
  } = {},
): SceneLayoutDocument {
  const currentItem = document.items[key];
  let nextItem: SceneLayoutItem = {
    ...currentItem,
    ...patch,
  };
  const keepRatio = currentItem.keepRatio;

  if (
    keepRatio &&
    (patch.width !== undefined || patch.height !== undefined) &&
    options.aspectRatio !== undefined
  ) {
    nextItem = {
      ...nextItem,
      ...applyKeepRatio(
        nextItem,
        options.aspectRatio,
        options.preferredDimension ?? (patch.width !== undefined ? 'width' : 'height'),
      ),
    };
  }

  nextItem = {
    ...nextItem,
    ...clampSceneRect(nextItem, {
      keepRatio,
      aspectRatio: options.aspectRatio,
      preferredDimension: options.preferredDimension,
    }),
  };

  const result = validateSceneLayoutDocument({
    ...document,
    items: {
      ...document.items,
      [key]: nextItem,
    },
  });

  return result.document ?? document;
}

export function toggleSceneLayoutItemFlag(
  document: SceneLayoutDocument,
  key: SceneItemKey,
  flag: 'visible' | 'locked' | 'keepRatio',
): SceneLayoutDocument {
  return updateSceneLayoutItem(document, key, {
    [flag]: !document.items[key][flag],
  });
}

export function toStageStyle(rect: SceneLayoutRect): CSSProperties {
  return {
    left: `${(rect.x / SCENE_DESIGN_WIDTH) * 100}%`,
    top: `${(rect.y / SCENE_DESIGN_HEIGHT) * 100}%`,
    width: `${(rect.width / SCENE_DESIGN_WIDTH) * 100}%`,
    height: `${(rect.height / SCENE_DESIGN_HEIGHT) * 100}%`,
    zIndex: rect.zIndex,
  };
}

export function roundToScenePixels(value: number): number {
  return Math.round(value);
}

export function screenDeltaToDesignDelta(delta: number, stageScale: number): number {
  if (!Number.isFinite(stageScale) || stageScale <= 0) {
    return 0;
  }
  return roundToScenePixels(delta / stageScale);
}

export function getSceneLayoutItemAspectRatio(item: SceneLayoutItem): number {
  return item.width / item.height;
}

export function serializeSceneLayoutDocument(document: SceneLayoutDocument): string {
  return `${JSON.stringify(
    {
      version: document.version,
      designSpace: {
        width: document.designSpace.width,
        height: document.designSpace.height,
      },
      items: Object.fromEntries(
        SCENE_ITEM_ORDER.map((key) => [
          key,
          {
            x: document.items[key].x,
            y: document.items[key].y,
            width: document.items[key].width,
            height: document.items[key].height,
            zIndex: document.items[key].zIndex,
            visible: document.items[key].visible,
            locked: document.items[key].locked,
            keepRatio: document.items[key].keepRatio,
          },
        ]),
      ),
    },
    null,
    2,
  )}\n`;
}
