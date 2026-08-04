import './space.css';
import { SceneEditor } from './editor/SceneEditor';
import { SpaceScene } from './SpaceScene';

interface SpaceWorkspaceProps {
  readonly debugAssets?: boolean;
  readonly sceneEditor?: boolean;
}

export function SpaceWorkspace({
  debugAssets = false,
  sceneEditor = false,
}: SpaceWorkspaceProps) {
  return (
    <main className="space-workspace">
      <div className="space-workspace-shell">
        <header className="space-workspace-header">
          <div>
            <h1>今天别硬撑</h1>
            <p>先给未来的窗边桌面留出位置。这里会慢慢长成一个属于你的陪伴空间。</p>
          </div>
        </header>
        {sceneEditor ? <SceneEditor debugAssets={debugAssets} /> : <SpaceScene debugAssets={debugAssets} />}
      </div>
    </main>
  );
}
