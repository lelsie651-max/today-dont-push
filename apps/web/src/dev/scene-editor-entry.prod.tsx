import type { ComponentType } from 'react';

export const SceneEditorEntry: ComponentType<{
  readonly debugAssets?: boolean;
}> = function SceneEditorEntry() {
  return null;
};

export function resolveSceneEditorView() {
  return false;
}
