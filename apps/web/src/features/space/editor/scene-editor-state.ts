import { getSceneItemManifestAspectRatio } from '../asset-manifest';
import {
  defaultSceneLayoutDocument,
  SCENE_ITEM_ORDER,
  SCENE_MIN_SIZE,
  screenDeltaToDesignDelta,
  updateSceneLayoutItem,
  validateSceneLayoutDocument,
  type SceneItemKey,
  type SceneLayoutDocument,
  type SceneLayoutPatch,
  type SceneLayoutRect,
} from '../scene-layout';

const HISTORY_LIMIT = 50;

export interface SceneEditorHistory {
  readonly past: readonly SceneLayoutDocument[];
  readonly present: SceneLayoutDocument;
  readonly future: readonly SceneLayoutDocument[];
}

export interface SceneEditorState {
  readonly history: SceneEditorHistory;
  readonly selectedItemKey: SceneItemKey | null;
  readonly snapEnabled: boolean;
  readonly interactionDocument: SceneLayoutDocument | null;
}

export interface SceneScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneInteractionStartSnapshot {
  readonly itemKey: SceneItemKey;
  readonly rect: SceneLayoutRect;
  readonly stageScale: number;
}

export function createSceneEditorState(
  document: SceneLayoutDocument = defaultSceneLayoutDocument,
): SceneEditorState {
  return {
    history: {
      past: [],
      present: document,
      future: [],
    },
    selectedItemKey: SCENE_ITEM_ORDER[0],
    snapEnabled: true,
    interactionDocument: null,
  };
}

export function getSceneEditorDocument(state: SceneEditorState): SceneLayoutDocument {
  return state.interactionDocument ?? state.history.present;
}

export function documentsEqual(a: SceneLayoutDocument, b: SceneLayoutDocument) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pushHistory(
  history: SceneEditorHistory,
  nextDocument: SceneLayoutDocument,
): SceneEditorHistory {
  if (documentsEqual(history.present, nextDocument)) {
    return history;
  }

  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: nextDocument,
    future: [],
  };
}

export function selectSceneItem(
  state: SceneEditorState,
  itemKey: SceneItemKey | null,
): SceneEditorState {
  return {
    ...state,
    selectedItemKey: itemKey,
  };
}

export function setSceneEditorSnapEnabled(
  state: SceneEditorState,
  enabled: boolean,
): SceneEditorState {
  return {
    ...state,
    snapEnabled: enabled,
  };
}

export function commitSceneDocument(
  state: SceneEditorState,
  nextDocument: SceneLayoutDocument,
): SceneEditorState {
  return {
    ...state,
    history: pushHistory(state.history, nextDocument),
    interactionDocument: null,
  };
}

export function previewSceneDocument(
  state: SceneEditorState,
  nextDocument: SceneLayoutDocument,
): SceneEditorState {
  return {
    ...state,
    interactionDocument: nextDocument,
  };
}

export function finishSceneInteraction(state: SceneEditorState): SceneEditorState {
  if (state.interactionDocument === null) {
    return state;
  }
  return commitSceneDocument(state, state.interactionDocument);
}

export function undoSceneDocument(state: SceneEditorState): SceneEditorState {
  if (state.history.past.length === 0) {
    return {
      ...state,
      interactionDocument: null,
    };
  }

  const previous = state.history.past[state.history.past.length - 1]!;
  return {
    ...state,
    history: {
      past: state.history.past.slice(0, -1),
      present: previous,
      future: [state.history.present, ...state.history.future].slice(0, HISTORY_LIMIT),
    },
    interactionDocument: null,
  };
}

export function redoSceneDocument(state: SceneEditorState): SceneEditorState {
  if (state.history.future.length === 0) {
    return {
      ...state,
      interactionDocument: null,
    };
  }

  const [next, ...rest] = state.history.future;
  return {
    ...state,
    history: {
      past: [...state.history.past, state.history.present].slice(-HISTORY_LIMIT),
      present: next,
      future: rest,
    },
    interactionDocument: null,
  };
}

export function canUndoSceneDocument(state: SceneEditorState) {
  return state.history.past.length > 0;
}

export function canRedoSceneDocument(state: SceneEditorState) {
  return state.history.future.length > 0;
}

function getPreferredAspectRatio(itemKey: SceneItemKey, document: SceneLayoutDocument) {
  const manifestRatio = getSceneItemManifestAspectRatio(itemKey);
  if (manifestRatio !== null) {
    return manifestRatio;
  }
  const item = document.items[itemKey];
  return item.width / item.height;
}

export function updateSceneEditorItem(
  state: SceneEditorState,
  itemKey: SceneItemKey,
  patch: SceneLayoutPatch,
  options: {
    readonly preferredDimension?: 'width' | 'height';
    readonly commit?: boolean;
  } = {},
): SceneEditorState {
  const baseDocument = getSceneEditorDocument(state);
  const nextDocument = updateSceneLayoutItem(baseDocument, itemKey, patch, {
    aspectRatio: getPreferredAspectRatio(itemKey, baseDocument),
    preferredDimension: options.preferredDimension,
  });

  if (options.commit === false) {
    return previewSceneDocument(state, nextDocument);
  }
  return commitSceneDocument(state, nextDocument);
}

export function toggleSceneEditorItemFlag(
  state: SceneEditorState,
  itemKey: SceneItemKey,
  flag: 'visible' | 'locked' | 'keepRatio',
): SceneEditorState {
  const document = getSceneEditorDocument(state);
  return updateSceneEditorItem(state, itemKey, {
    [flag]: !document.items[itemKey][flag],
  });
}

export function nudgeSceneEditorItem(
  state: SceneEditorState,
  itemKey: SceneItemKey,
  dx: number,
  dy: number,
): SceneEditorState {
  const document = getSceneEditorDocument(state);
  if (document.items[itemKey].locked) {
    return state;
  }
  return updateSceneEditorItem(state, itemKey, {
    x: document.items[itemKey].x + dx,
    y: document.items[itemKey].y + dy,
  });
}

export function screenRectToDesignRect(
  screenRect: SceneScreenRect,
  stageScale: number,
  currentRect: SceneLayoutRect,
): SceneLayoutRect {
  if (!Number.isFinite(stageScale) || stageScale <= 0) {
    return currentRect;
  }

  return {
    x: Math.round(screenRect.left / stageScale),
    y: Math.round(screenRect.top / stageScale),
    width: Math.max(SCENE_MIN_SIZE, Math.round(screenRect.width / stageScale)),
    height: Math.max(SCENE_MIN_SIZE, Math.round(screenRect.height / stageScale)),
    zIndex: currentRect.zIndex,
  };
}

export function createSceneInteractionStartSnapshot(
  document: SceneLayoutDocument,
  itemKey: SceneItemKey,
  stageScale: number,
): SceneInteractionStartSnapshot {
  return {
    itemKey,
    rect: document.items[itemKey],
    stageScale,
  };
}

export function previewDragInScreenSpace(
  state: SceneEditorState,
  itemKey: SceneItemKey,
  screenRect: SceneScreenRect,
  stageScale: number,
): SceneEditorState {
  const document = getSceneEditorDocument(state);
  const item = document.items[itemKey];
  if (item.locked) {
    return state;
  }

  const nextRect = screenRectToDesignRect(screenRect, stageScale, item);
  return updateSceneEditorItem(
    state,
    itemKey,
    {
      x: nextRect.x,
      y: nextRect.y,
    },
    { commit: false },
  );
}

export function previewDragByScreenDelta(
  state: SceneEditorState,
  snapshot: SceneInteractionStartSnapshot,
  screenDx: number,
  screenDy: number,
  stageScale: number,
): SceneEditorState {
  const document = getSceneEditorDocument(state);
  const item = document.items[snapshot.itemKey];
  if (item.locked) {
    return state;
  }

  return updateSceneEditorItem(
    state,
    snapshot.itemKey,
    {
      x: snapshot.rect.x + screenDeltaToDesignDelta(screenDx, stageScale),
      y: snapshot.rect.y + screenDeltaToDesignDelta(screenDy, stageScale),
    },
    { commit: false },
  );
}

export function previewResizeInScreenSpace(
  state: SceneEditorState,
  itemKey: SceneItemKey,
  screenRect: SceneScreenRect,
  stageScale: number,
  preferredDimension: 'width' | 'height',
): SceneEditorState {
  const document = getSceneEditorDocument(state);
  const item = document.items[itemKey];
  if (item.locked) {
    return state;
  }

  const nextRect = screenRectToDesignRect(screenRect, stageScale, item);
  return updateSceneEditorItem(
    state,
    itemKey,
    {
      x: nextRect.x,
      y: nextRect.y,
      width: nextRect.width,
      height: nextRect.height,
    },
    {
      preferredDimension,
      commit: false,
    },
  );
}

export function previewResizeByScreenDelta(
  state: SceneEditorState,
  snapshot: SceneInteractionStartSnapshot,
  screenDx: number,
  screenDy: number,
  screenWidth: number,
  screenHeight: number,
  stageScale: number,
  preferredDimension: 'width' | 'height',
): SceneEditorState {
  const document = getSceneEditorDocument(state);
  const item = document.items[snapshot.itemKey];
  if (item.locked) {
    return state;
  }
  if (!Number.isFinite(stageScale) || stageScale <= 0) {
    return state;
  }

  return updateSceneEditorItem(
    state,
    snapshot.itemKey,
    {
      x: snapshot.rect.x + screenDeltaToDesignDelta(screenDx, stageScale),
      y: snapshot.rect.y + screenDeltaToDesignDelta(screenDy, stageScale),
      width: Math.max(SCENE_MIN_SIZE, Math.round(screenWidth / stageScale)),
      height: Math.max(SCENE_MIN_SIZE, Math.round(screenHeight / stageScale)),
    },
    {
      preferredDimension,
      commit: false,
    },
  );
}

export function getStageScale(stageWidth: number) {
  return stageWidth / defaultSceneLayoutDocument.designSpace.width;
}

export function moveByScreenDelta(
  document: SceneLayoutDocument,
  itemKey: SceneItemKey,
  dx: number,
  dy: number,
  stageScale: number,
): SceneLayoutDocument {
  const item = document.items[itemKey];
  return updateSceneLayoutItem(document, itemKey, {
    x: item.x + screenDeltaToDesignDelta(dx, stageScale),
    y: item.y + screenDeltaToDesignDelta(dy, stageScale),
  });
}

export function validateEditorDocument(document: SceneLayoutDocument) {
  return validateSceneLayoutDocument(document);
}
