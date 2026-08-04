import type { RefCallback } from 'react';
import { AssetSlot } from './AssetSlot';
import {
  type AssetManifestEntry,
  assetManifest,
  defaultVisualState,
  getSceneItemLabel,
  getSkyAsset,
  getWeatherAsset,
  type SpaceVisualState,
} from './asset-manifest';
import {
  defaultSceneLayoutDocument,
  sceneLayoutEntries,
  SCENE_DESIGN_HEIGHT,
  SCENE_DESIGN_WIDTH,
  type SceneItemKey,
  type SceneLayoutDocument,
  toStageStyle,
} from './scene-layout';

interface SpaceSceneProps {
  readonly visualState?: Partial<SpaceVisualState>;
  readonly debugAssets?: boolean;
  readonly layoutDocument?: SceneLayoutDocument;
  readonly editorMode?: boolean;
  readonly selectedItemKey?: SceneItemKey | null;
  readonly stageRef?: RefCallback<HTMLDivElement>;
  readonly registerEditorTarget?: (
    key: SceneItemKey,
  ) => RefCallback<HTMLButtonElement>;
  readonly onSelectItem?: (key: SceneItemKey) => void;
}

const propEntries = [
  {
    key: 'planBoard',
    assetId: 'plan-board',
    manifest: assetManifest.planBoard,
  },
  {
    key: 'deskLamp',
    assetId: 'desk-lamp',
    manifest: assetManifest.deskLamp,
  },
  {
    key: 'radio',
    assetId: 'radio',
    manifest: assetManifest.radio,
  },
  {
    key: 'focusClock',
    assetId: 'focus-clock',
    manifest: assetManifest.focusClock,
  },
  {
    key: 'tarotEntry',
    assetId: 'tarot-entry',
    manifest: assetManifest.tarotEntry,
  },
  {
    key: 'magazine',
    assetId: 'magazine',
    manifest: assetManifest.magazine,
  },
  {
    key: 'reviewPrinter',
    assetId: 'review-printer',
    manifest: assetManifest.reviewPrinter,
  },
  {
    key: 'plant',
    assetId: 'plant',
    manifest: assetManifest.plant,
  },
] as const satisfies ReadonlyArray<{
  readonly key: Exclude<SceneItemKey, 'windowViewport' | 'roomForeground'>;
  readonly assetId: string;
  readonly manifest: AssetManifestEntry;
}>;

function formatRect(document: SceneLayoutDocument, key: SceneItemKey) {
  const rect = document.items[key];
  return `${key} · x:${rect.x} y:${rect.y} w:${rect.width} h:${rect.height}`;
}

export function SpaceScene({
  visualState,
  debugAssets = false,
  layoutDocument = defaultSceneLayoutDocument,
  editorMode = false,
  selectedItemKey = null,
  stageRef,
  registerEditorTarget,
  onSelectItem,
}: SpaceSceneProps) {
  const resolvedVisualState: SpaceVisualState = {
    ...defaultVisualState,
    ...visualState,
  };

  const items = layoutDocument.items;
  const viewport = items.windowViewport;
  const roomForeground = items.roomForeground;

  return (
    <section className="space-scene" aria-label="窗边桌面空间">
      <div className="space-scene-frame">
        <div className="space-scene-topbar">
          <div className="space-scene-status">
            <span>城市窗边</span>
            <span>陪你慢一点</span>
          </div>
        </div>

        <div className="space-scene-stage" ref={stageRef}>
          <div
            className="space-layer space-layer-sky"
            data-testid="space-layer-sky"
          >
            {viewport.visible ? (
              <AssetSlot
                assetId="sky"
                manifest={getSkyAsset(resolvedVisualState.timeOfDay)}
                passive
                style={toStageStyle({
                  ...viewport,
                  zIndex: 1,
                })}
              />
            ) : null}
          </div>
          <div
            className="space-layer space-layer-city"
            data-testid="space-layer-city"
          >
            {viewport.visible ? (
              <AssetSlot
                assetId="window-city-skyline"
                manifest={assetManifest.windowCitySkyline}
                passive
                style={toStageStyle({
                  ...viewport,
                  zIndex: 2,
                })}
              />
            ) : null}
          </div>
          <div
            className="space-layer space-layer-weather"
            data-testid="space-layer-weather"
          >
            {viewport.visible ? (
              <AssetSlot
                assetId="weather-overlay"
                manifest={getWeatherAsset(resolvedVisualState.weather)}
                passive
                style={toStageStyle({
                  ...viewport,
                  zIndex: 3,
                })}
              />
            ) : null}
          </div>
          <div
            className="space-layer space-layer-room"
            data-testid="space-layer-room"
          >
            {roomForeground.visible ? (
              <AssetSlot
                assetId="room-foreground"
                manifest={assetManifest.roomForeground}
                passive
                style={toStageStyle(roomForeground)}
              />
            ) : null}
          </div>
          <div
            className="space-layer space-layer-props"
            data-testid="space-layer-props"
          >
            {propEntries.map(({ key, assetId, manifest }) => {
              const item = items[key];
              if (!item.visible) {
                return null;
              }

              return (
                <AssetSlot
                  key={key}
                  assetId={assetId}
                  manifest={manifest}
                  style={toStageStyle(item)}
                />
              );
            })}
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
              {items.windowViewport.visible ? (
                <div
                  className="space-debug-rect space-debug-window"
                  data-testid="space-debug-window-viewport"
                  style={toStageStyle(items.windowViewport)}
                >
                  <span className="space-debug-label">{formatRect(layoutDocument, 'windowViewport')}</span>
                </div>
              ) : null}
              {sceneLayoutEntries
                .filter(([key]) => key !== 'windowViewport')
                .map(([key]) => {
                  const rect = items[key];
                  if (!rect.visible) {
                    return null;
                  }
                  return (
                    <div
                      key={key}
                      className="space-debug-rect"
                      data-testid={`space-debug-${key}`}
                      style={toStageStyle(rect)}
                    >
                      <span className="space-debug-label">{formatRect(layoutDocument, key)}</span>
                    </div>
                  );
                })}
            </div>
          ) : null}

          {editorMode ? (
            <div className="space-editor-target-layer" data-testid="space-editor-target-layer">
              {sceneLayoutEntries.map(([key]) => {
                const item = items[key];
                if (!item.visible) {
                  return null;
                }

                return (
                  <button
                    key={key}
                    ref={registerEditorTarget?.(key)}
                    type="button"
                    className={`space-editor-target ${
                      selectedItemKey === key ? 'is-selected' : ''
                    } ${item.locked ? 'is-locked' : ''}`}
                    data-scene-item-key={key}
                    data-testid={`space-editor-target-${key}`}
                    aria-label={`选择 ${getSceneItemLabel(key)}`}
                    onClick={() => onSelectItem?.(key)}
                    style={toStageStyle(item)}
                  >
                    <span className="space-editor-target-label">{key}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
