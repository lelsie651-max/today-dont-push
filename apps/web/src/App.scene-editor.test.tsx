import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import {
  defaultSceneLayoutDocument,
  serializeSceneLayoutDocument,
  updateSceneLayoutItem,
} from './features/space/scene-layout';
import { SCENE_LAYOUT_DRAFT_STORAGE_KEY } from './features/space/editor/scene-editor-storage';

afterEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
});

describe('App scene editor entry', () => {
  it('editor 入口仅开发环境可见', () => {
    window.history.replaceState({}, '', '/?view=space&sceneEditor=1');
    const { rerender } = render(<App isDev={false} />);

    expect(screen.queryByRole('region', { name: '场景编辑器 V1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '导出布局' })).not.toBeInTheDocument();

    rerender(<App isDev />);
    expect(screen.getByRole('region', { name: '场景编辑器 V1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出布局' })).toBeInTheDocument();
  });

  it('普通空间不会读取 localStorage 草稿', () => {
    const draft = updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { x: 520 });
    window.localStorage.setItem(
      SCENE_LAYOUT_DRAFT_STORAGE_KEY,
      serializeSceneLayoutDocument(draft),
    );

    window.history.replaceState({}, '', '/?view=space');
    render(<App isDev />);

    expect(screen.queryByRole('button', { name: '导出布局' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'radio' })).toHaveStyle({
      left: `${(238 / 1440) * 100}%`,
    });
  });
});
