export interface AppViewState {
  readonly isSpaceView: boolean;
  readonly debugAssets: boolean;
  readonly isSceneEditorView: boolean;
}

export function resolveAppViewState(
  search: string,
  isDevelopment: boolean,
): AppViewState {
  const searchParams = new URLSearchParams(search);
  const view = searchParams.get('view') ?? null;
  const isSpaceView = view === 'space';

  return {
    isSpaceView,
    debugAssets: searchParams.get('debugAssets') === '1',
    isSceneEditorView: isDevelopment && isSpaceView && searchParams.get('sceneEditor') === '1',
  };
}
