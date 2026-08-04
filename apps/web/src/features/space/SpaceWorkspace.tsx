import './space.css';
import { SpaceScene } from './SpaceScene';

export function SpaceWorkspace() {
  return (
    <main className="space-workspace">
      <div className="space-workspace-shell">
        <header className="space-workspace-header">
          <div>
            <h1>今天别硬撑</h1>
            <p>先给未来的窗边桌面留出位置。这里会慢慢长成一个属于你的陪伴空间。</p>
          </div>
        </header>
        <SpaceScene />
      </div>
    </main>
  );
}
