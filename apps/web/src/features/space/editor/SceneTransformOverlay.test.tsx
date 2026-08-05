import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defaultSceneLayoutDocument, updateSceneLayoutItem } from '../scene-layout';
import { SceneTransformOverlay } from './SceneTransformOverlay';

function dispatchPointerEvent(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: {
    readonly pointerId: number;
    readonly clientX: number;
    readonly clientY: number;
  },
) {
  const eventFactory = {
    pointerdown: createEvent.pointerDown,
    pointermove: createEvent.pointerMove,
    pointerup: createEvent.pointerUp,
    pointercancel: createEvent.pointerCancel,
  }[type];
  const event = eventFactory(element, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerType: { value: 'mouse' },
  });
  fireEvent(element, event);
}

function OverlayHarness({
  locked = false,
}: {
  readonly locked?: boolean;
}) {
  const initial = locked
    ? updateSceneLayoutItem(defaultSceneLayoutDocument, 'radio', { locked: true })
    : defaultSceneLayoutDocument;
  const [committedDocument, setCommittedDocument] = useState(initial);
  const [document, setDocument] = useState(initial);
  const [commitCount, setCommitCount] = useState(0);

  return (
    <div style={{ position: 'relative', width: 1440, height: 900 }}>
      <SceneTransformOverlay
        document={document}
        itemKey="radio"
        snapEnabled={false}
        stageScale={1}
        onPreviewDocument={(nextDocument) => setDocument(nextDocument)}
        onCommitDocument={(nextDocument) => {
          setDocument(nextDocument);
          setCommittedDocument(nextDocument);
          setCommitCount((current) => current + 1);
        }}
        onCancelInteraction={() => {
          setDocument(committedDocument);
        }}
      />
      <output data-testid="x-value">{document.items.radio.x}</output>
      <output data-testid="width-value">{document.items.radio.width}</output>
      <output data-testid="commit-count">{commitCount}</output>
    </div>
  );
}

describe('SceneTransformOverlay', () => {
  it('未锁定选中物件会显示选中框和 8 个 handle', () => {
    render(<OverlayHarness />);

    expect(screen.getByTestId('scene-transform-overlay-frame')).toBeInTheDocument();
    expect(screen.getAllByTestId(/scene-transform-handle-/)).toHaveLength(8);
  });

  it('locked 物件只显示选中框，不显示可操作控制点', () => {
    render(<OverlayHarness locked />);

    expect(screen.getByTestId('scene-transform-overlay')).toHaveClass('is-locked');
    expect(screen.queryByTestId('scene-transform-handle-east')).not.toBeInTheDocument();
  });

  it('pointer capture 会在拖拽时建立并在 pointerup 后释放', async () => {
    render(<OverlayHarness />);

    const frame = screen.getByTestId('scene-transform-overlay-frame') as HTMLDivElement & {
      setPointerCapture: (pointerId: number) => void;
      releasePointerCapture: (pointerId: number) => void;
      hasPointerCapture: (pointerId: number) => boolean;
    };
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    let capturedPointerId: number | null = null;

    frame.setPointerCapture = (pointerId: number) => {
      capturedPointerId = pointerId;
      setPointerCapture(pointerId);
    };
    frame.releasePointerCapture = (pointerId: number) => {
      if (capturedPointerId === pointerId) {
        capturedPointerId = null;
      }
      releasePointerCapture(pointerId);
    };
    frame.hasPointerCapture = (pointerId: number) => capturedPointerId === pointerId;

    dispatchPointerEvent(frame, 'pointerdown', { pointerId: 7, clientX: 238, clientY: 631 });
    dispatchPointerEvent(frame, 'pointermove', { pointerId: 7, clientX: 248, clientY: 631 });
    dispatchPointerEvent(frame, 'pointerup', { pointerId: 7, clientX: 248, clientY: 631 });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    await waitFor(() => {
      expect(screen.getByTestId('x-value')).toHaveTextContent('248');
      expect(screen.getByTestId('commit-count')).toHaveTextContent('1');
    });
  });

  it('pointercancel 会恢复起点且不形成历史节点', async () => {
    render(<OverlayHarness />);

    const frame = screen.getByTestId('scene-transform-overlay-frame');
    dispatchPointerEvent(frame, 'pointerdown', { pointerId: 3, clientX: 238, clientY: 631 });
    dispatchPointerEvent(frame, 'pointermove', { pointerId: 3, clientX: 278, clientY: 631 });
    expect(screen.getByTestId('x-value')).toHaveTextContent('278');

    dispatchPointerEvent(frame, 'pointercancel', { pointerId: 3, clientX: 278, clientY: 631 });

    await waitFor(() => {
      expect(screen.getByTestId('x-value')).toHaveTextContent('238');
      expect(screen.getByTestId('commit-count')).toHaveTextContent('0');
    });
  });

  it('handle 缩放会改变尺寸，并在 pointerup 时只提交一次', async () => {
    render(<OverlayHarness />);

    const handle = screen.getByTestId('scene-transform-handle-east');
    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 5, clientX: 497, clientY: 720 });
    dispatchPointerEvent(handle, 'pointermove', { pointerId: 5, clientX: 557, clientY: 720 });
    dispatchPointerEvent(handle, 'pointerup', { pointerId: 5, clientX: 557, clientY: 720 });

    await waitFor(() => {
      expect(Number(screen.getByTestId('width-value').textContent)).toBeGreaterThan(259);
      expect(screen.getByTestId('commit-count')).toHaveTextContent('1');
    });
  });

  it('Escape 会取消当前交互并恢复起点', async () => {
    render(<OverlayHarness />);

    const frame = screen.getByTestId('scene-transform-overlay-frame');
    dispatchPointerEvent(frame, 'pointerdown', { pointerId: 9, clientX: 238, clientY: 631 });
    dispatchPointerEvent(frame, 'pointermove', { pointerId: 9, clientX: 278, clientY: 631 });
    expect(screen.getByTestId('x-value')).toHaveTextContent('278');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.getByTestId('x-value')).toHaveTextContent('238');
      expect(screen.getByTestId('commit-count')).toHaveTextContent('0');
    });
  });
});
