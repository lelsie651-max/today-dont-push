import { Component, Suspense, lazy, type ReactNode } from 'react';
import { useState } from 'react';
import type { ComponentType } from 'react';

const DevEditorPanel = lazy(async () => {
  const module = await import('../features/space/editor/SceneEditor');
  return {
    default: module.SceneEditor,
  };
});

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

export const SceneEditorEntry: ComponentType<{
  readonly debugAssets?: boolean;
}> = function SceneEditorEntry(props) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  return (
    <DevEditorLoadBoundary>
      <>
        {isPreviewMode ? null : (
          <header className="space-workspace-editor-header">
            <div>
              <p className="space-workspace-editor-eyebrow">Scene Editor Workspace</p>
              <h1>场景编辑器</h1>
              <p>当前是独立编辑模式，不显示会丢失 `sceneEditor=1` 的业务导航。</p>
            </div>
          </header>
        )}
        <Suspense
          fallback={
            <div className="space-workspace-dev-notice" role="status">
              正在加载场景编辑器开发模块……
            </div>
          }
        >
          <DevEditorPanel
            {...props}
            onPreviewModeChange={setIsPreviewMode}
          />
        </Suspense>
      </>
    </DevEditorLoadBoundary>
  );
};

export function resolveSceneEditorView(
  search: URLSearchParams,
  isSpaceView: boolean,
  isDevelopment: boolean,
) {
  return isDevelopment && isSpaceView && search.get('sceneEditor') === '1';
}
