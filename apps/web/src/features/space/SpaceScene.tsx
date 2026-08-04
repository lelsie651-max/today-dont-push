import { AssetSlot } from './AssetSlot';
import { assetManifest } from './asset-manifest';

export function SpaceScene() {
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
          <AssetSlot
            assetId="room-background"
            label="room background"
            manifest={assetManifest.roomBackground}
            className="slot-room-background"
          />
          <AssetSlot
            assetId="window-city-scene"
            label="window city scene"
            manifest={assetManifest.windowCityScene}
            className="slot-window-city-scene"
          />
          <AssetSlot
            assetId="plan-board"
            label="plan board"
            manifest={assetManifest.planBoard}
            className="slot-plan-board"
          />
          <AssetSlot
            assetId="desk-lamp"
            label="desk lamp"
            manifest={assetManifest.deskLamp}
            className="slot-desk-lamp"
          />
          <AssetSlot
            assetId="radio"
            label="radio"
            manifest={assetManifest.radio}
            className="slot-radio"
          />
          <AssetSlot
            assetId="focus-clock"
            label="focus clock"
            manifest={assetManifest.focusClock}
            className="slot-focus-clock"
          />
          <AssetSlot
            assetId="tarot-entry"
            label="tarot entry"
            manifest={assetManifest.tarotEntry}
            className="slot-tarot-entry"
          />
          <AssetSlot
            assetId="magazine"
            label="magazine"
            manifest={assetManifest.magazine}
            className="slot-magazine"
          />
          <AssetSlot
            assetId="review-printer"
            label="review printer"
            manifest={assetManifest.reviewPrinter}
            className="slot-review-printer"
          />
          <AssetSlot
            assetId="plant"
            label="plant"
            manifest={assetManifest.plant}
            className="slot-plant"
          />
        </div>
      </div>
    </section>
  );
}
