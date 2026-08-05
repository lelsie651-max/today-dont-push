import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpaceScene } from './SpaceScene';
import { assetManifest } from './asset-manifest';
import { sceneLayout } from './scene-layout';

describe('SpaceScene', () => {
  it('可以渲染空间场景', () => {
    render(<SpaceScene />);
    expect(screen.getByRole('region', { name: '窗边桌面空间' })).toBeInTheDocument();
  });

  it('默认使用 daytime 和 clear 资源', () => {
    render(<SpaceScene />);

    const backgroundImage = document.querySelector('[data-asset-id="scene-background"] img');
    const weatherImage = document.querySelector('[data-asset-id="weather-overlay"] img');
    expect(backgroundImage).toHaveAttribute('src', '/assets/scene/background/scene-background-daytime.webp');
    expect(weatherImage).toHaveAttribute('src', '/assets/scene/weather/weather-clear.png');
  });

  it('传入 morning 和 rain 时选择正确资源路径', () => {
    render(<SpaceScene visualState={{ timeOfDay: 'morning', weather: 'rain' }} />);

    const backgroundImage = document.querySelector('[data-asset-id="scene-background"] img');
    const weatherImage = document.querySelector('[data-asset-id="weather-overlay"] img');
    expect(backgroundImage).toHaveAttribute('src', '/assets/scene/background/scene-background-morning.webp');
    expect(weatherImage).toHaveAttribute('src', '/assets/scene/weather/weather-rain.png');
  });

  it('背景、天气、room 和 props 层全部存在', () => {
    render(<SpaceScene />);

    expect(screen.getByTestId('space-layer-background')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-weather')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-room')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-props')).toBeInTheDocument();
  });

  it('全舞台基础层都使用各自的全舞台布局', () => {
    const { container } = render(<SpaceScene />);
    const stageLayerPairs = [
      ['scene-background', 'sceneBackground'],
      ['weather-overlay', 'weatherOverlay'],
      ['room-foreground', 'roomForeground'],
    ] as const;

    stageLayerPairs.forEach(([assetId, itemKey]) => {
      const element = container.querySelector(`[data-asset-id="${assetId}"]`);
      expect(element).toHaveStyle({
        left: `${(sceneLayout[itemKey].x / 1440) * 100}%`,
        top: `${(sceneLayout[itemKey].y / 900) * 100}%`,
        width: `${(sceneLayout[itemKey].width / 1440) * 100}%`,
        height: `${(sceneLayout[itemKey].height / 900) * 100}%`,
      });
    });
  });

  it('默认空间不显示校准层', () => {
    render(<SpaceScene />);
    expect(screen.queryByTestId('space-debug-layer')).not.toBeInTheDocument();
  });

  it('debugAssets 开启后显示网格、窗洞和所有 slot 坐标', () => {
    render(<SpaceScene debugAssets />);

    expect(screen.getByTestId('space-debug-layer')).toBeInTheDocument();
    expect(screen.getByTestId('space-debug-window-viewport')).toBeInTheDocument();
    expect(screen.getByTestId('space-debug-sceneBackground')).toBeInTheDocument();
    expect(screen.getByTestId('space-debug-weatherOverlay')).toBeInTheDocument();
    expect(screen.getByTestId('space-debug-roomForeground')).toBeInTheDocument();
    expect(screen.getByTestId('space-debug-planBoard')).toBeInTheDocument();
    expect(screen.getByText(/windowViewport · x:445 y:10 w:940 h:520/)).toBeInTheDocument();
    expect(screen.getByText(/sceneBackground · x:0 y:0 w:1440 h:900/)).toBeInTheDocument();
    expect(screen.getByText(/planBoard · x:89 y:108 w:317 h:247/)).toBeInTheDocument();
  });

  it('manifest 的关键文件名和尺寸符合标准', () => {
    expect(assetManifest.roomForeground.path).toBe('/assets/scene/scene-room-foreground.png');
    expect(assetManifest.roomForeground.width).toBe(1920);
    expect(assetManifest.sceneBackground.night.path).toBe('/assets/scene/background/scene-background-night.webp');
    expect(assetManifest.sceneBackground.night.width).toBe(1920);
    expect(assetManifest.weatherOverlay.storm.path).toBe('/assets/scene/weather/weather-storm.png');
    expect(assetManifest.weatherOverlay.storm.height).toBe(1200);
    expect(assetManifest.planBoard.width).toBe(720);
    expect(assetManifest.planBoard.height).toBe(560);
    expect(assetManifest.tarotEntry.path).toBe('/assets/tarot/icon-tarot-entry.png');
    expect(assetManifest.magazine.path).toBe('/assets/props/prop-magazine-closed.png');
    expect(assetManifest.radio.width).toBe(520);
    expect(assetManifest.focusClock.height).toBe(300);
    expect(assetManifest.reviewPrinter.height).toBe(520);
    expect(assetManifest.plant.path).toBe('/assets/props/prop-desk-plant.png');
  });
});
