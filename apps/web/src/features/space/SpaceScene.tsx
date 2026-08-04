import { AssetSlot } from './AssetSlot';
import {
  assetManifest,
  defaultVisualState,
  getSkyAsset,
  getWeatherAsset,
  type SpaceVisualState,
} from './asset-manifest';
import {
  sceneLayout,
  sceneLayoutEntries,
  SCENE_DESIGN_HEIGHT,
  SCENE_DESIGN_WIDTH,
  toStageStyle,
} from './scene-layout';

interface SpaceSceneProps {
  readonly visualState?: Partial<SpaceVisualState>;
  readonly debugAssets?: boolean;
}

function formatRect(key: string) {
  const rect = sceneLayout[key as keyof typeof sceneLayout];
  return `${key} · x:${rect.x} y:${rect.y} w:${rect.width} h:${rect.height}`;
}

export function SpaceScene({ visualState, debugAssets = false }: SpaceSceneProps) {
  const resolvedVisualState: SpaceVisualState = {
    ...defaultVisualState,
    ...visualState,
  };

  return (
    <section className="space-scene" aria-label="窗边桌面空间">
      <div className="space-scene-frame">
        <div className="space-scene-topbar">
          <div className="space-scene-status">
            <span>城市窗边</span>
            <span>陪你慢一点</span>
          </div>
        </div>

        <div className="space-scene-stage">
          <div
            className="space-layer space-layer-sky"
            data-testid="space-layer-sky"
          >
            <AssetSlot
              assetId="sky"
              manifest={getSkyAsset(resolvedVisualState.timeOfDay)}
              passive
              style={toStageStyle({
                ...sceneLayout.windowViewport,
                zIndex: 1,
              })}
            />
          </div>
          <div
            className="space-layer space-layer-city"
            data-testid="space-layer-city"
          >
            <AssetSlot
              assetId="window-city-skyline"
              manifest={assetManifest.windowCitySkyline}
              passive
              style={toStageStyle({
                ...sceneLayout.windowViewport,
                zIndex: 2,
              })}
            />
          </div>
          <div
            className="space-layer space-layer-weather"
            data-testid="space-layer-weather"
          >
            <AssetSlot
              assetId="weather-overlay"
              manifest={getWeatherAsset(resolvedVisualState.weather)}
              passive
              style={toStageStyle({
                ...sceneLayout.windowViewport,
                zIndex: 3,
              })}
            />
          </div>
          <div
            className="space-layer space-layer-room"
            data-testid="space-layer-room"
          >
            <AssetSlot
              assetId="room-foreground"
              manifest={assetManifest.roomForeground}
              passive
              style={toStageStyle(sceneLayout.roomForeground)}
            />
          </div>
          <div
            className="space-layer space-layer-props"
            data-testid="space-layer-props"
          >
            <AssetSlot
              assetId="plan-board"
              manifest={assetManifest.planBoard}
              style={toStageStyle(sceneLayout.planBoard)}
            />
            <AssetSlot
              assetId="desk-lamp"
              manifest={assetManifest.deskLamp}
              style={toStageStyle(sceneLayout.deskLamp)}
            />
            <AssetSlot
              assetId="radio"
              manifest={assetManifest.radio}
              style={toStageStyle(sceneLayout.radio)}
            />
            <AssetSlot
              assetId="focus-clock"
              manifest={assetManifest.focusClock}
              style={toStageStyle(sceneLayout.focusClock)}
            />
            <AssetSlot
              assetId="tarot-entry"
              manifest={assetManifest.tarotEntry}
              style={toStageStyle(sceneLayout.tarotEntry)}
            />
            <AssetSlot
              assetId="magazine"
              manifest={assetManifest.magazine}
              style={toStageStyle(sceneLayout.magazine)}
            />
            <AssetSlot
              assetId="review-printer"
              manifest={assetManifest.reviewPrinter}
              style={toStageStyle(sceneLayout.reviewPrinter)}
            />
            <AssetSlot
              assetId="plant"
              manifest={assetManifest.plant}
              style={toStageStyle(sceneLayout.plant)}
            />
          </div>

          {debugAssets ? (
            <div className="space-debug-layer" data-testid="space-debug-layer" aria-hidden="true">
              <div className="space-debug-grid space-debug-grid-minor" />
              <div className="space-debug-grid space-debug-grid-major" />
              <div className="space-debug-centerline space-debug-centerline-x" />
              <div className="space-debug-centerline space-debug-centerline-y" />
              <div className="space-debug-stage-outline">
                <span>{SCENE_DESIGN_WIDTH} x {SCENE_DESIGN_HEIGHT}</span>
              </div>
              <div
                className="space-debug-rect space-debug-window"
                data-testid="space-debug-window-viewport"
                style={toStageStyle(sceneLayout.windowViewport)}
              >
                <span className="space-debug-label">{formatRect('windowViewport')}</span>
              </div>
              {sceneLayoutEntries
                .filter(([key]) => key !== 'windowViewport')
                .map(([key, rect]) => (
                <div
                  key={key}
                  className="space-debug-rect"
                  data-testid={`space-debug-${key}`}
                  style={toStageStyle(rect)}
                >
                  <span className="space-debug-label">{formatRect(key)}</span>
                </div>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
