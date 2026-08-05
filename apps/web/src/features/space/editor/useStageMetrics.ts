import { useEffect, useMemo, useState } from 'react';
import { SCENE_DESIGN_WIDTH, SCENE_DESIGN_HEIGHT } from '../scene-layout';

export interface StageMetrics {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

function getSafeStageDimension(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export function createStageMetrics(width: number, height: number): StageMetrics {
  const safeWidth = getSafeStageDimension(width, SCENE_DESIGN_WIDTH);
  const safeHeight = getSafeStageDimension(height, SCENE_DESIGN_HEIGHT);

  return {
    width: safeWidth,
    height: safeHeight,
    scale: safeWidth / SCENE_DESIGN_WIDTH,
  };
}

export function measureStageElement(stageElement: HTMLElement | null): StageMetrics {
  if (stageElement === null) {
    return createStageMetrics(SCENE_DESIGN_WIDTH, SCENE_DESIGN_HEIGHT);
  }
  return createStageMetrics(stageElement.clientWidth, stageElement.clientHeight);
}

export function useStageMetrics(stageElement: HTMLDivElement | null): StageMetrics {
  const [metrics, setMetrics] = useState<StageMetrics>(() => measureStageElement(stageElement));

  useEffect(() => {
    setMetrics(measureStageElement(stageElement));

    if (stageElement === null) {
      return undefined;
    }

    const update = (width?: number, height?: number) => {
      if (width !== undefined && height !== undefined) {
        setMetrics(createStageMetrics(width, height));
        return;
      }
      setMetrics(measureStageElement(stageElement));
    };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry === undefined) {
          update();
          return;
        }
        update(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(stageElement);

      return () => {
        observer.disconnect();
      };
    }

    const handleResize = () => {
      update();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [stageElement]);

  return useMemo(
    () => ({
      width: metrics.width,
      height: metrics.height,
      scale: metrics.scale,
    }),
    [metrics.height, metrics.scale, metrics.width],
  );
}
