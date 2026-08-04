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
});

describe('App scene editor entry', () => {
  it('production 解析逻辑不会开启 editor', () => {
    expect(resolveSpaceWorkspaceMode('?view=space&sceneEditor=1', false)).toEqual({
      enableDevEditor: false,
    });
    expect(resolveAppViewState('?view=space&debugAssets=1')).toEqual({
      isSpaceView: true,
      debugAssets: true,
    });
  });

  it('development 解析逻辑会识别 editor 请求', () => {
    expect(resolveSpaceWorkspaceMode('?view=space&sceneEditor=1', true)).toEqual({
      enableDevEditor: true,
    });
  });

  it('普通空间不会读取 localStorage 草稿', () => {
    const draft = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { x: 520 });
    window.localStorage.setItem(
      SCENE_LAYOUT_DRAFT_STORAGE_KEY,
      serializeSceneLayoutDocument(draft),
    );

    window.history.replaceState({}, '', '/?view=space');
    render(<App />);

    expect(screen.queryByRole('button', { name: '导出布局' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'radio' })).toHaveStyle({
      left: `${(238 / 1440) * 100}%`,
    });
  });
});
