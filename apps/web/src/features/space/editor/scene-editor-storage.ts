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
    }
  | {
      readonly kind: 'storage_error';
      readonly message: string;
    };

export type SceneLayoutDraftMutationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return {
      ok: false as const,
      message: '当前环境不支持本地草稿存储。',
    };
  }

  try {
    if (typeof window.localStorage === 'undefined') {
      return {
        ok: false as const,
        message: '浏览器当前不支持本地草稿存储。',
      };
    }

    return {
      ok: true as const,
      storage: window.localStorage,
    };
  } catch {
    return {
      ok: false as const,
      message: '浏览器当前拒绝访问本地草稿存储。',
    };
  }
}

export function loadSceneLayoutDraft(): SceneLayoutDraftLoadResult {
  const storageResult = getLocalStorage();
  if (!storageResult.ok) {
    return {
      kind: 'storage_error',
      message: `${storageResult.message} 本地草稿不会自动恢复。`,
    };
  }

  let raw: string | null;
  try {
    raw = storageResult.storage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY);
  } catch {
    return {
      kind: 'storage_error',
      message: '浏览器当前拒绝读取本地草稿，已跳过恢复。',
    };
  }

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

export function saveSceneLayoutDraft(document: SceneLayoutDocument): SceneLayoutDraftMutationResult {
  const storageResult = getLocalStorage();
  if (!storageResult.ok) {
    return {
      ok: false,
      message: `${storageResult.message} 未能自动保存草稿。`,
    };
  }

  try {
    storageResult.storage.setItem(
      SCENE_LAYOUT_DRAFT_STORAGE_KEY,
      serializeSceneLayoutDocument(document),
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: '浏览器当前拒绝写入本地草稿，未能自动保存草稿。',
    };
  }
}

export function clearSceneLayoutDraft(): SceneLayoutDraftMutationResult {
  const storageResult = getLocalStorage();
  if (!storageResult.ok) {
    return {
      ok: false,
      message: `${storageResult.message} 未能清除本地草稿。`,
    };
  }

  try {
    storageResult.storage.removeItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: '浏览器当前拒绝删除本地草稿，未能清除本地草稿。',
    };
  }
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
  if (draft.kind === 'storage_error') {
    return {
      document: defaultSceneLayoutDocument,
      notice: draft.message,
    };
  }
  return {
    document: defaultSceneLayoutDocument,
    notice: null,
  };
}
