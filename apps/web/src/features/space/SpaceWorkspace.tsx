import './space.css';
import { SpaceScene } from './SpaceScene';
import type { SpaceWorkspaceMode } from './space-workspace-mode';
import { SceneEditorEntry } from '@dev/scene-editor-entry';

interface SpaceWorkspaceProps {
  readonly debugAssets?: boolean;
  readonly mode?: SpaceWorkspaceMode;
}

export function SpaceWorkspace({
  debugAssets = false,
  mode = 'scene',
}: SpaceWorkspaceProps) {
  const isEditorMode = mode === 'editor';

  return (
    <main className={`space-workspace ${isEditorMode ? 'is-editor-mode' : ''}`}>
      <div className="space-workspace-shell">
        {isEditorMode ? null : (
          <header className="space-workspace-header">
            <div>
              <h1>今天别硬撑</h1>
              <p>先给未来的窗边桌面留出位置。这里会慢慢长成一个属于你的陪伴空间。</p>
            </div>
          </header>
        )}
        {isEditorMode ? (
          <SceneEditorEntry debugAssets={debugAssets} />
        ) : (
          <SpaceScene debugAssets={debugAssets} />
        )}
      </div>
    </main>
  );
}
