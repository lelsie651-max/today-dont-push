import { AssetSlot } from './AssetSlot';
import {
  assetManifest,
  defaultVisualState,
  getSkyAsset,
  getWeatherAsset,
  type SpaceVisualState,
} from './asset-manifest';

interface SpaceSceneProps {
  readonly visualState?: Partial<SpaceVisualState>;
}

export function SpaceScene({ visualState }: SpaceSceneProps) {
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
          <div className="space-layer space-layer-sky" data-testid="space-layer-sky">
            <AssetSlot
              assetId="sky"
              manifest={getSkyAsset(resolvedVisualState.timeOfDay)}
              className="slot-sky"
              passive
            />
          </div>
          <div className="space-layer space-layer-city" data-testid="space-layer-city">
            <AssetSlot
              assetId="window-city-skyline"
              manifest={assetManifest.windowCitySkyline}
              className="slot-window-city-skyline"
              passive
            />
          </div>
          <div className="space-layer space-layer-weather" data-testid="space-layer-weather">
            <AssetSlot
              assetId="weather-overlay"
              manifest={getWeatherAsset(resolvedVisualState.weather)}
              className="slot-weather-overlay"
              passive
            />
          </div>
          <div className="space-layer space-layer-room" data-testid="space-layer-room">
            <AssetSlot
              assetId="room-foreground"
              manifest={assetManifest.roomForeground}
              className="slot-room-foreground"
              passive
            />
          </div>
          <div className="space-layer space-layer-props" data-testid="space-layer-props">
            <AssetSlot
              assetId="plan-board"
              manifest={assetManifest.planBoard}
              className="slot-plan-board"
            />
            <AssetSlot
              assetId="desk-lamp"
              manifest={assetManifest.deskLamp}
              className="slot-desk-lamp"
            />
            <AssetSlot
              assetId="radio"
              manifest={assetManifest.radio}
              className="slot-radio"
            />
            <AssetSlot
              assetId="focus-clock"
              manifest={assetManifest.focusClock}
              className="slot-focus-clock"
            />
            <AssetSlot
              assetId="tarot-entry"
              manifest={assetManifest.tarotEntry}
              className="slot-tarot-entry"
            />
            <AssetSlot
              assetId="magazine"
              manifest={assetManifest.magazine}
              className="slot-magazine"
            />
            <AssetSlot
              assetId="review-printer"
              manifest={assetManifest.reviewPrinter}
              className="slot-review-printer"
            />
            <AssetSlot
              assetId="plant"
              manifest={assetManifest.plant}
              className="slot-plant"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
