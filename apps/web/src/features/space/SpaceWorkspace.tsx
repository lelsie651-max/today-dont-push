import { Component, Suspense, lazy, type ReactNode } from 'react';
import './space.css';
import { SpaceScene } from './SpaceScene';
import { resolveSpaceWorkspaceMode } from './space-workspace-mode';

interface SpaceWorkspaceProps {
  readonly debugAssets?: boolean;
}

const DevEditorPanel =
  import.meta.env.DEV
    ? lazy(async () => {
        const module = await import('./editor/SceneEditor');
        return {
          default: module.SceneEditor,
        };
      })
    : null;

class DevEditorLoadBoundary extends Component<
  { readonly children: ReactNode },
  { readonly hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="space-workspace-dev-notice" role="status">
          场景编辑器开发模块加载失败，请检查本地依赖与控制台日志后重试。
        </div>
      );
    }
    return this.props.children;
  }
}

export function SpaceWorkspace({ debugAssets = false }: SpaceWorkspaceProps) {
  const mode =
    typeof window !== 'undefined'
      ? resolveSpaceWorkspaceMode(window.location.search, import.meta.env.DEV)
      : { enableDevEditor: false };

  return (
    <main className="space-workspace">
      <div className="space-workspace-shell">
        <header className="space-workspace-header">
          <div>
            <h1>今天别硬撑</h1>
            <p>先给未来的窗边桌面留出位置。这里会慢慢长成一个属于你的陪伴空间。</p>
          </div>
        </header>
        {mode.enableDevEditor && DevEditorPanel !== null ? (
          <DevEditorLoadBoundary>
            <Suspense
              fallback={
                <div className="space-workspace-dev-notice" role="status">
                  正在加载场景编辑器开发模块……
                </div>
              }
            >
              <DevEditorPanel debugAssets={debugAssets} />
            </Suspense>
          </DevEditorLoadBoundary>
        ) : (
          <SpaceScene debugAssets={debugAssets} />
        )}
      </div>
    </main>
  );
}
