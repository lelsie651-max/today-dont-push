import { Component, Suspense, lazy, type ReactNode, useState } from 'react';
import './space.css';
import { SpaceScene } from './SpaceScene';
import type { SpaceWorkspaceMode } from './space-workspace-mode';

interface SpaceWorkspaceProps {
  readonly debugAssets?: boolean;
  readonly mode?: SpaceWorkspaceMode;
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

export function SpaceWorkspace({
  debugAssets = false,
  mode = 'scene',
}: SpaceWorkspaceProps) {
  const isEditorMode = mode === 'editor';
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  return (
    <main className={`space-workspace ${isEditorMode ? 'is-editor-mode' : ''}`}>
      <div className="space-workspace-shell">
        {isEditorMode ? (
          isPreviewMode ? null : (
            <header className="space-workspace-editor-header">
              <div>
                <p className="space-workspace-editor-eyebrow">Scene Editor Workspace</p>
                <h1>场景编辑器</h1>
                <p>当前是独立编辑模式，不显示会丢失 `sceneEditor=1` 的业务导航。</p>
              </div>
            </header>
          )
        ) : (
          <header className="space-workspace-header">
            <div>
              <h1>今天别硬撑</h1>
              <p>先给未来的窗边桌面留出位置。这里会慢慢长成一个属于你的陪伴空间。</p>
            </div>
          </header>
        )}
        {isEditorMode && DevEditorPanel !== null ? (
          <DevEditorLoadBoundary>
            <Suspense
              fallback={
                <div className="space-workspace-dev-notice" role="status">
                  正在加载场景编辑器开发模块……
                </div>
              }
            >
              <DevEditorPanel
                debugAssets={debugAssets}
                onPreviewModeChange={setIsPreviewMode}
              />
            </Suspense>
          </DevEditorLoadBoundary>
        ) : (
          <SpaceScene debugAssets={debugAssets} />
        )}
      </div>
    </main>
  );
}
