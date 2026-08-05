import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssetSlot } from './AssetSlot';
import { assetManifest, getSceneBackgroundAsset } from './asset-manifest';

describe('AssetSlot', () => {
  it('初始渲染时就输出 img', () => {
    const { container } = render(
      <AssetSlot
        assetId="scene-background"
        manifest={getSceneBackgroundAsset('daytime')}
        passive
      />,
    );

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('src', '/assets/scene/background/scene-background-daytime.png');
  });

  it('根元素具有 manifest 对应的 aspect-ratio', () => {
    const { container } = render(
      <AssetSlot
        assetId="scene-background"
        manifest={getSceneBackgroundAsset('daytime')}
        passive
      />,
    );

    expect(container.firstElementChild).toHaveStyle({ aspectRatio: '1920 / 1200' });
  });

  it('图片 error 后显示占位内容', () => {
    const { container } = render(
      <AssetSlot
        assetId="scene-background"
        manifest={getSceneBackgroundAsset('daytime')}
        passive
      />,
    );

    const image = container.querySelector('img');
    if (image === null) {
      throw new Error('图片元素不存在');
    }
    fireEvent.error(image);

    expect(screen.getByText('scene background')).toBeInTheDocument();
    expect(screen.getByText('1920 x 1200')).toBeInTheDocument();
    expect(screen.getByText('/assets/scene/background/scene-background-daytime.png')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: '1920 / 1200' });
  });

  it('图片成功加载后不显示占位文字', () => {
    const { container } = render(
      <AssetSlot
        assetId="scene-background"
        manifest={getSceneBackgroundAsset('daytime')}
        passive
      />,
    );

    const image = container.querySelector('img');
    if (image === null) {
      throw new Error('图片元素不存在');
    }
    fireEvent.load(image);

    expect(screen.queryByText('scene background')).not.toBeInTheDocument();
    expect(screen.queryByText('1920 x 1200')).not.toBeInTheDocument();
    expect(screen.queryByText('/assets/scene/background/scene-background-daytime.png')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: '1920 / 1200' });
  });

  it('decorative 资产不是 button', () => {
    render(
      <AssetSlot
        assetId="plant"
        manifest={assetManifest.plant}
      />,
    );

    expect(screen.queryByRole('button', { name: 'plant' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-asset-id="plant"]')).toHaveAttribute('data-role', 'decorative');
  });

  it('future-action 资产具有不可用语义', () => {
    render(
      <AssetSlot
        assetId="tarot-entry"
        manifest={assetManifest.tarotEntry}
      />,
    );

    const button = screen.getByRole('button', { name: 'tarot entry' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
