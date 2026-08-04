import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStageMetrics } from './useStageMetrics';

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(
    private readonly callback: ResizeObserverCallback,
  ) {
    ResizeObserverMock.instances.push(this);
  }

  emit(width: number, height: number) {
    this.callback(
      [
        {
          contentRect: { width, height } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

function StageMetricsProbe({ stageElement }: { readonly stageElement: HTMLDivElement | null }) {
  const metrics = useStageMetrics(stageElement);
  return (
    <output data-testid="stage-metrics">
      {metrics.width}x{metrics.height}@{metrics.scale}
    </output>
  );
}

describe('useStageMetrics', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    ResizeObserverMock.instances = [];
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('ResizeObserver 正确更新尺寸并在卸载时释放', () => {
    const stage = document.createElement('div');
    Object.defineProperty(stage, 'clientWidth', {
      configurable: true,
      get: () => 720,
    });
    Object.defineProperty(stage, 'clientHeight', {
      configurable: true,
      get: () => 450,
    });

    const view = render(<StageMetricsProbe stageElement={stage} />);

    expect(screen.getByTestId('stage-metrics')).toHaveTextContent('720x450@0.5');
    expect(ResizeObserverMock.instances).toHaveLength(1);

    act(() => {
      ResizeObserverMock.instances[0]!.emit(1080, 675);
    });

    expect(screen.getByTestId('stage-metrics')).toHaveTextContent('1080x675@0.75');

    view.unmount();
    expect(ResizeObserverMock.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('ResizeObserver 不可用时安全降级，不会崩溃', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const stage = document.createElement('div');
    Object.defineProperty(stage, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(stage, 'clientHeight', {
      configurable: true,
      get: () => 563,
    });

    render(<StageMetricsProbe stageElement={stage} />);
    expect(screen.getByTestId('stage-metrics')).toHaveTextContent('900x563@0.625');
  });
});
