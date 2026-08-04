export interface SpaceWorkspaceMode {
  readonly enableDevEditor: boolean;
}

export function resolveSpaceWorkspaceMode(
  search: string,
  isDevelopment: boolean,
): SpaceWorkspaceMode {
  const searchParams = new URLSearchParams(search);
  return {
    enableDevEditor: isDevelopment && searchParams.get('sceneEditor') === '1',
  };
}
