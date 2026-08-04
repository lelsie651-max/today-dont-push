import {
  serializeSceneLayoutDocument,
  validateSceneLayoutDocument,
  type SceneLayoutDocument,
} from '../scene-layout';

export interface SceneLayoutExportResult {
  readonly ok: boolean;
  readonly fileName: string;
  readonly content: string | null;
  readonly error: string | null;
}

export const SCENE_LAYOUT_EXPORT_FILE_NAME = 'scene-layout.v1.json';

export function buildSceneLayoutExport(
  layoutDocument: SceneLayoutDocument,
): SceneLayoutExportResult {
  const validation = validateSceneLayoutDocument(layoutDocument);
  if (!validation.ok || validation.document === null) {
    return {
      ok: false,
      fileName: SCENE_LAYOUT_EXPORT_FILE_NAME,
      content: null,
      error: validation.errors[0] ?? '当前布局校验失败，无法导出。',
    };
  }

  return {
    ok: true,
    fileName: SCENE_LAYOUT_EXPORT_FILE_NAME,
    content: serializeSceneLayoutDocument(validation.document),
    error: null,
  };
}

export function downloadSceneLayoutDocument(
  layoutDocument: SceneLayoutDocument,
): SceneLayoutExportResult {
  const exportResult = buildSceneLayoutExport(layoutDocument);
  if (!exportResult.ok || exportResult.content === null) {
    return exportResult;
  }

  if (typeof window === 'undefined') {
    return exportResult;
  }

  const blob = new Blob([exportResult.content], {
    type: 'application/json;charset=utf-8',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = exportResult.fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);

  return exportResult;
}
