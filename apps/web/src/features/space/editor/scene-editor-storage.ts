import {
  defaultSceneLayoutDocument,
  parseSceneLayoutDraft,
  serializeSceneLayoutDocument,
  type SceneLayoutDocument,
} from '../scene-layout';

export const SCENE_LAYOUT_DRAFT_STORAGE_KEY = 'today-dont-push:scene-layout-draft:v1';

export type SceneLayoutDraftLoadResult =
  | {
      readonly kind: 'missing';
    }
  | {
      readonly kind: 'restored';
      readonly document: SceneLayoutDocument;
    }
  | {
      readonly kind: 'invalid';
      readonly message: string;
    };

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadSceneLayoutDraft(): SceneLayoutDraftLoadResult {
  if (!canUseStorage()) {
    return { kind: 'missing' };
  }

  const raw = window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY);
  if (raw === null) {
    return { kind: 'missing' };
  }

  const parsed = parseSceneLayoutDraft(raw);
  if (!parsed.ok || parsed.document === null) {
    return {
      kind: 'invalid',
      message: parsed.errors[0] ?? '本地草稿无效，已忽略。',
    };
  }

  return {
    kind: 'restored',
    document: parsed.document,
  };
}

export function saveSceneLayoutDraft(document: SceneLayoutDocument) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(
    SCENE_LAYOUT_DRAFT_STORAGE_KEY,
    serializeSceneLayoutDocument(document),
  );
}

export function clearSceneLayoutDraft() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY);
}

export function getInitialSceneLayoutDocument() {
  const draft = loadSceneLayoutDraft();
  if (draft.kind === 'restored') {
    return {
      document: draft.document,
      notice: '已恢复本地草稿。',
    };
  }
  if (draft.kind === 'invalid') {
    return {
      document: defaultSceneLayoutDocument,
      notice: `本地草稿已忽略：${draft.message}`,
    };
  }
  return {
    document: defaultSceneLayoutDocument,
    notice: null,
  };
}
