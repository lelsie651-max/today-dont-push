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

    const skyImage = document.querySelector('[data-asset-id="sky"] img');
    const weatherImage = document.querySelector('[data-asset-id="weather-overlay"] img');
    expect(skyImage).toHaveAttribute('src', '/assets/scene/window/sky-daytime.webp');
    expect(weatherImage).toHaveAttribute('src', '/assets/scene/window/weather-clear.png');
  });

  it('传入 morning 和 rain 时选择正确资源路径', () => {
    render(<SpaceScene visualState={{ timeOfDay: 'morning', weather: 'rain' }} />);

    const skyImage = document.querySelector('[data-asset-id="sky"] img');
    const weatherImage = document.querySelector('[data-asset-id="weather-overlay"] img');
    expect(skyImage).toHaveAttribute('src', '/assets/scene/window/sky-morning.webp');
    expect(weatherImage).toHaveAttribute('src', '/assets/scene/window/weather-rain.png');
  });

  it('room、天空、城市、天气和 props 层全部存在', () => {
    render(<SpaceScene />);

    expect(screen.getByTestId('space-layer-sky')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-city')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-weather')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-room')).toBeInTheDocument();
    expect(screen.getByTestId('space-layer-props')).toBeInTheDocument();
  });

  it('天空、城市和天气使用同一 windowViewport', () => {
    const { container } = render(<SpaceScene />);
    const expectedLeft = `${(sceneLayout.windowViewport.x / 1440) * 100}%`;
    const expectedTop = `${(sceneLayout.windowViewport.y / 900) * 100}%`;
    const expectedWidth = `${(sceneLayout.windowViewport.width / 1440) * 100}%`;
    const expectedHeight = `${(sceneLayout.windowViewport.height / 900) * 100}%`;

    ['sky', 'window-city-skyline', 'weather-overlay'].forEach((assetId) => {
      const element = container.querySelector(`[data-asset-id="${assetId}"]`);
      expect(element).toHaveStyle({
        left: expectedLeft,
        top: expectedTop,
        width: expectedWidth,
        height: expectedHeight,
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
    expect(screen.getByTestId('space-debug-roomForeground')).toBeInTheDocument();
    expect(screen.getByTestId('space-debug-planBoard')).toBeInTheDocument();
    expect(screen.getByText(/windowViewport · x:445 y:10 w:940 h:520/)).toBeInTheDocument();
    expect(screen.getByText(/planBoard · x:89 y:108 w:317 h:247/)).toBeInTheDocument();
  });

  it('manifest 的关键文件名和尺寸符合标准', () => {
    expect(assetManifest.roomForeground.path).toBe('/assets/scene/scene-room-foreground.png');
    expect(assetManifest.roomForeground.width).toBe(1920);
    expect(assetManifest.windowCitySkyline.path).toBe('/assets/scene/window/window-city-skyline.png');
    expect(assetManifest.sky.night.path).toBe('/assets/scene/window/sky-night.webp');
    expect(assetManifest.weather.storm.path).toBe('/assets/scene/window/weather-storm.png');
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
