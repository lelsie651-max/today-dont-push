export interface AppViewState {
  readonly isSpaceView: boolean;
  readonly debugAssets: boolean;
}

export function resolveAppViewState(search: string): AppViewState {
  const searchParams = new URLSearchParams(search);
  const view = searchParams.get('view') ?? null;

  return {
    isSpaceView: view === 'space',
    debugAssets: searchParams.get('debugAssets') === '1',
  };
}
