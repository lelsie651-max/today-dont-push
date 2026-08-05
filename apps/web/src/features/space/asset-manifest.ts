import type { SceneItemKey } from './scene-layout';

export interface AssetManifestEntry {
  readonly label: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly role: 'decorative' | 'future-action';
  readonly fit: 'contain' | 'cover';
}

export type TimeOfDay = 'morning' | 'daytime' | 'evening' | 'night';
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';

interface SpaceAssetManifest {
  readonly sceneBackground: Record<TimeOfDay, AssetManifestEntry>;
  readonly weatherOverlay: Record<WeatherKind, AssetManifestEntry>;
  readonly roomForeground: AssetManifestEntry;
  readonly planBoard: AssetManifestEntry;
  readonly deskLamp: AssetManifestEntry;
  readonly radio: AssetManifestEntry;
  readonly focusClock: AssetManifestEntry;
  readonly tarotEntry: AssetManifestEntry;
  readonly magazine: AssetManifestEntry;
  readonly reviewPrinter: AssetManifestEntry;
  readonly plant: AssetManifestEntry;
}

export const assetManifest = {
  sceneBackground: {
    morning: {
      label: 'scene background',
      path: '/assets/scene/background/scene-background-morning.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
    daytime: {
      label: 'scene background',
      path: '/assets/scene/background/scene-background-daytime.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
    evening: {
      label: 'scene background',
      path: '/assets/scene/background/scene-background-evening.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
    night: {
      label: 'scene background',
      path: '/assets/scene/background/scene-background-night.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
  } satisfies Record<TimeOfDay, AssetManifestEntry>,
  weatherOverlay: {
    clear: {
      label: 'weather overlay',
      path: '/assets/scene/weather/weather-clear.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
    cloudy: {
      label: 'weather overlay',
      path: '/assets/scene/weather/weather-cloudy.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
    rain: {
      label: 'weather overlay',
      path: '/assets/scene/weather/weather-rain.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
    storm: {
      label: 'weather overlay',
      path: '/assets/scene/weather/weather-storm.png',
      width: 1920,
      height: 1200,
      role: 'decorative',
      fit: 'cover',
    },
  } satisfies Record<WeatherKind, AssetManifestEntry>,
  roomForeground: {
    label: 'room foreground',
    path: '/assets/scene/scene-room-foreground.png',
    width: 1920,
    height: 1200,
    role: 'decorative',
    fit: 'cover',
  },
  planBoard: {
    label: 'plan board',
    path: '/assets/props/prop-plan-board.png',
    width: 720,
    height: 560,
    role: 'future-action',
    fit: 'contain',
  },
  deskLamp: {
    label: 'desk lamp',
    path: '/assets/props/prop-desk-lamp.png',
    width: 420,
    height: 620,
    role: 'decorative',
    fit: 'contain',
  },
  radio: {
    label: 'radio',
    path: '/assets/props/prop-radio.png',
    width: 520,
    height: 360,
    role: 'future-action',
    fit: 'contain',
  },
  focusClock: {
    label: 'focus clock',
    path: '/assets/props/prop-focus-clock.png',
    width: 480,
    height: 300,
    role: 'future-action',
    fit: 'contain',
  },
  tarotEntry: {
    label: 'tarot entry',
    path: '/assets/tarot/icon-tarot-entry.png',
    width: 256,
    height: 256,
    role: 'future-action',
    fit: 'contain',
  },
  magazine: {
    label: 'magazine',
    path: '/assets/props/prop-magazine-closed.png',
    width: 600,
    height: 420,
    role: 'future-action',
    fit: 'contain',
  },
  reviewPrinter: {
    label: 'review printer',
    path: '/assets/props/prop-review-printer.png',
    width: 420,
    height: 520,
    role: 'future-action',
    fit: 'contain',
  },
  plant: {
    label: 'plant',
    path: '/assets/props/prop-desk-plant.png',
    width: 380,
    height: 460,
    role: 'decorative',
    fit: 'contain',
  },
} as const satisfies SpaceAssetManifest;

export type AssetManifestKey = keyof Omit<typeof assetManifest, 'sceneBackground' | 'weatherOverlay'>;

export interface SpaceVisualState {
  readonly timeOfDay: TimeOfDay;
  readonly weather: WeatherKind;
}

export const defaultVisualState: SpaceVisualState = {
  timeOfDay: 'daytime',
  weather: 'clear',
};

export const sceneItemManifestMap: Partial<Record<SceneItemKey, AssetManifestEntry>> = {
  sceneBackground: assetManifest.sceneBackground.daytime,
  weatherOverlay: assetManifest.weatherOverlay.clear,
  roomForeground: assetManifest.roomForeground,
  planBoard: assetManifest.planBoard,
  deskLamp: assetManifest.deskLamp,
  radio: assetManifest.radio,
  focusClock: assetManifest.focusClock,
  tarotEntry: assetManifest.tarotEntry,
  magazine: assetManifest.magazine,
  reviewPrinter: assetManifest.reviewPrinter,
  plant: assetManifest.plant,
};

export function getSceneBackgroundAsset(timeOfDay: TimeOfDay): AssetManifestEntry {
  return assetManifest.sceneBackground[timeOfDay];
}

export function getWeatherOverlayAsset(weather: WeatherKind): AssetManifestEntry {
  return assetManifest.weatherOverlay[weather];
}

export function getSceneItemLabel(itemKey: SceneItemKey): string {
  if (itemKey === 'windowViewport') {
    return 'window viewport guide';
  }
  return sceneItemManifestMap[itemKey]?.label ?? itemKey;
}

export function getSceneItemManifestAspectRatio(itemKey: SceneItemKey): number | null {
  const manifest = sceneItemManifestMap[itemKey];
  if (manifest === undefined) {
    return null;
  }
  return manifest.width / manifest.height;
}
