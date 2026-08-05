export type SpaceWorkspaceMode = 'scene' | 'editor';

export function resolveSpaceWorkspaceMode(options: {
  readonly enableDevEditor: boolean;
}): SpaceWorkspaceMode {
  return options.enableDevEditor ? 'editor' : 'scene';
}
