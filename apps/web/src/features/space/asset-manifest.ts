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
  readonly roomForeground: AssetManifestEntry;
  readonly windowCitySkyline: AssetManifestEntry;
  readonly sky: Record<TimeOfDay, AssetManifestEntry>;
  readonly weather: Record<WeatherKind, AssetManifestEntry>;
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
  roomForeground: {
    label: 'room foreground',
    path: '/assets/scene/scene-room-foreground.png',
    width: 1920,
    height: 1200,
    role: 'decorative',
    fit: 'cover',
  },
  windowCitySkyline: {
    label: 'window city skyline',
    path: '/assets/scene/window/window-city-skyline.png',
    width: 960,
    height: 600,
    role: 'decorative',
    fit: 'cover',
  },
  sky: {
    morning: {
      label: 'sky',
      path: '/assets/scene/window/sky-morning.webp',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
    daytime: {
      label: 'sky',
      path: '/assets/scene/window/sky-daytime.webp',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
    evening: {
      label: 'sky',
      path: '/assets/scene/window/sky-evening.webp',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
    night: {
      label: 'sky',
      path: '/assets/scene/window/sky-night.webp',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
  } satisfies Record<TimeOfDay, AssetManifestEntry>,
  weather: {
    clear: {
      label: 'weather overlay',
      path: '/assets/scene/window/weather-clear.png',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
    cloudy: {
      label: 'weather overlay',
      path: '/assets/scene/window/weather-cloudy.png',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
    rain: {
      label: 'weather overlay',
      path: '/assets/scene/window/weather-rain.png',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
    storm: {
      label: 'weather overlay',
      path: '/assets/scene/window/weather-storm.png',
      width: 960,
      height: 600,
      role: 'decorative',
      fit: 'cover',
    },
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

export type AssetManifestKey = keyof Omit<typeof assetManifest, 'sky' | 'weather'>;

export interface SpaceVisualState {
  readonly timeOfDay: TimeOfDay;
  readonly weather: WeatherKind;
}

export const defaultVisualState: SpaceVisualState = {
  timeOfDay: 'daytime',
  weather: 'clear',
};

export function getSkyAsset(timeOfDay: TimeOfDay): AssetManifestEntry {
  return assetManifest.sky[timeOfDay];
}

export function getWeatherAsset(weather: WeatherKind): AssetManifestEntry {
  return assetManifest.weather[weather];
}
