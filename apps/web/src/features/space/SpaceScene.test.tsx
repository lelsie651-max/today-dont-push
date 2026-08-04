import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpaceScene } from './SpaceScene';
import { assetManifest } from './asset-manifest';

describe('SpaceScene', () => {
  it('可以渲染空间场景', () => {
    render(<SpaceScene />);
    expect(screen.getByRole('region', { name: '窗边桌面空间' })).toBeInTheDocument();
  });

  it('所有资产槽位都存在', () => {
    render(<SpaceScene />);

    expect(screen.getByRole('button', { name: 'room background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'window city scene' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plan board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'desk lamp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'radio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'focus clock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tarot entry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'magazine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'review printer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plant' })).toBeInTheDocument();
  });

  it('asset manifest 配置可读取', () => {
    expect(assetManifest.roomBackground.path).toBe('/assets/scene/scene-room-background.png');
    expect(assetManifest.radio.width).toBe(520);
    expect(assetManifest.reviewPrinter.height).toBe(380);
  });
});
