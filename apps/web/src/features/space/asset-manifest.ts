export interface AssetManifestEntry {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

export const assetManifest = {
  roomBackground: {
    path: '/assets/scene/scene-room-background.png',
    width: 1920,
    height: 1200,
  },
  windowCityScene: {
    path: '/assets/scene/scene-window-city.png',
    width: 980,
    height: 620,
  },
  planBoard: {
    path: '/assets/props/prop-plan-board.png',
    width: 480,
    height: 320,
  },
  deskLamp: {
    path: '/assets/props/prop-desk-lamp.png',
    width: 360,
    height: 520,
  },
  radio: {
    path: '/assets/props/prop-radio.png',
    width: 520,
    height: 360,
  },
  focusClock: {
    path: '/assets/props/prop-focus-clock.png',
    width: 280,
    height: 280,
  },
  tarotEntry: {
    path: '/assets/props/prop-tarot-entry.png',
    width: 340,
    height: 440,
  },
  magazine: {
    path: '/assets/props/prop-magazine.png',
    width: 320,
    height: 220,
  },
  reviewPrinter: {
    path: '/assets/props/prop-review-printer.png',
    width: 420,
    height: 380,
  },
  plant: {
    path: '/assets/props/prop-plant.png',
    width: 300,
    height: 420,
  },
} satisfies Record<string, AssetManifestEntry>;

export type AssetManifestKey = keyof typeof assetManifest;
