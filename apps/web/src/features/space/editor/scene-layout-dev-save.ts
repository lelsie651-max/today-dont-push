import {
  validateSceneLayoutDocument,
  type SceneLayoutDocument,
} from '../scene-layout';

export const SCENE_LAYOUT_DEV_SAVE_ENDPOINT = '/__dev/scene-layout';

export interface SceneLayoutProjectSaveSuccess {
  readonly ok: true;
  readonly message: string;
}

export interface SceneLayoutProjectSaveFailure {
  readonly ok: false;
  readonly message: string;
  readonly errors?: readonly string[];
}

export type SceneLayoutProjectSaveResult =
  | SceneLayoutProjectSaveSuccess
  | SceneLayoutProjectSaveFailure;

interface SceneLayoutProjectSavePayload {
  readonly status: string;
  readonly message?: string;
  readonly errors?: readonly string[];
}

function isSceneLayoutProjectSavePayload(value: unknown): value is SceneLayoutProjectSavePayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.status !== 'string') {
    return false;
  }

  if ('message' in payload && payload.message !== undefined && typeof payload.message !== 'string') {
    return false;
  }

  if (
    'errors' in payload &&
    payload.errors !== undefined &&
    (!Array.isArray(payload.errors) || payload.errors.some((item) => typeof item !== 'string'))
  ) {
    return false;
  }

  return true;
}

export async function saveSceneLayoutToProject(
  document: SceneLayoutDocument,
  fetchImpl: typeof fetch = fetch,
): Promise<SceneLayoutProjectSaveResult> {
  const validation = validateSceneLayoutDocument(document);
  if (!validation.ok || validation.document === null) {
    return {
      ok: false,
      message: validation.errors[0] ?? '当前布局校验失败，无法写入工程文件。',
      errors: validation.errors,
    };
  }

  try {
    const response = await fetchImpl(SCENE_LAYOUT_DEV_SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        document: validation.document,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!isSceneLayoutProjectSavePayload(payload)) {
      return {
        ok: false,
        message: '开发保存接口返回了无效响应，布局未确认写入工程文件。',
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message ?? '写入工程文件失败，请稍后重试。',
        errors: payload.errors,
      };
    }

    if (payload.status !== 'ok') {
      return {
        ok: false,
        message: payload.message ?? '开发保存接口返回了异常状态，布局未确认写入工程文件。',
        errors: payload.errors,
      };
    }

    return {
      ok: true,
      message: payload.message ?? '已保存到scene-layout.json，Git现在可以看到修改。',
    };
  } catch {
    return {
      ok: false,
      message: '当前无法连接开发保存接口，请确认 Vite dev server 正在运行。',
    };
  }
}
