import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { resolveAppViewState } from './app-view-state';
import {
  defaultSceneLayoutDocument,
  serializeSceneLayoutDocument,
  updateSceneLayoutItem,
} from './features/space/scene-layout';
import { resolveSpaceWorkspaceMode } from './features/space/space-workspace-mode';
import { SCENE_LAYOUT_DRAFT_STORAGE_KEY } from './features/space/editor/scene-editor-storage';

afterEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('App scene editor entry', () => {
  it('production 解析逻辑不会开启 editor', () => {
    expect(resolveAppViewState('?view=space&sceneEditor=1', false)).toEqual({
      isSpaceView: true,
      isSceneEditorView: false,
      debugAssets: false,
    });
    expect(resolveSpaceWorkspaceMode({ enableDevEditor: false })).toBe('scene');
    expect(resolveAppViewState('?view=space&debugAssets=1', false)).toEqual({
      isSceneEditorView: false,
      isSpaceView: true,
      debugAssets: true,
    });
  });

  it('development 解析逻辑会识别 editor 请求', () => {
    expect(resolveAppViewState('?view=space&sceneEditor=1', true)).toEqual({
      isSpaceView: true,
      isSceneEditorView: true,
      debugAssets: false,
    });
    expect(resolveSpaceWorkspaceMode({ enableDevEditor: true })).toBe('editor');
  });

  it('普通空间不会读取 localStorage 草稿', () => {
    const draft = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { x: 520 });
    window.localStorage.setItem(
      SCENE_LAYOUT_DRAFT_STORAGE_KEY,
      serializeSceneLayoutDocument(draft),
    );

    window.history.replaceState({}, '', '/?view=space');
    render(<App />);

    expect(screen.getByRole('navigation', { name: '页面切换' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '导出布局' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'radio' })).toHaveStyle({
      left: `${(238 / 1440) * 100}%`,
    });
  });

  it('sceneEditor 模式不显示 app-view-switch，并渲染独立编辑器外壳', async () => {
    window.history.replaceState({}, '', '/?view=space&sceneEditor=1');
    render(<App />);

    expect(screen.queryByRole('navigation', { name: '页面切换' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '场景编辑器' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '预览当前效果' })).toBeInTheDocument();
  });
});
