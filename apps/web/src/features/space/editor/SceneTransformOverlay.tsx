import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { getSceneItemManifestAspectRatio } from '../asset-manifest';
import {
  toStageStyle,
  type SceneItemKey,
  type SceneLayoutDocument,
  type SceneLayoutRect,
} from '../scene-layout';
import {
  computeDragPreviewRect,
  computeResizePreviewRect,
  type SceneResizeHandle,
} from './scene-transform-math';

interface SceneTransformOverlayProps {
  readonly document: SceneLayoutDocument;
  readonly itemKey: SceneItemKey;
  readonly snapEnabled: boolean;
  readonly stageScale: number;
  readonly editingLocked?: boolean;
  readonly onPreviewDocument: (document: SceneLayoutDocument) => void;
  readonly onCommitDocument: (document: SceneLayoutDocument) => void;
  readonly onCancelInteraction: () => void;
}

interface InteractionSession {
  readonly pointerId: number;
  readonly mode: 'drag' | 'resize';
  readonly handle: SceneResizeHandle | null;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startDocument: SceneLayoutDocument;
  readonly startRect: SceneLayoutDocument['items'][SceneItemKey];
  readonly captureElement: HTMLElement;
  readonly cleanupWindowListeners: () => void;
}

interface PointerLikeEvent extends Event {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

const RESIZE_HANDLES: readonly SceneResizeHandle[] = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

function createPreviewDocument(
  document: SceneLayoutDocument,
  itemKey: SceneItemKey,
  rect: SceneLayoutRect,
): SceneLayoutDocument {
  return {
    ...document,
    items: {
      ...document.items,
      [itemKey]: {
        ...document.items[itemKey],
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: rect.zIndex,
      },
    },
  };
}

function getCursor(handle: SceneResizeHandle) {
  switch (handle) {
    case 'north':
    case 'south':
      return 'ns-resize';
    case 'east':
    case 'west':
      return 'ew-resize';
    case 'north-east':
    case 'south-west':
      return 'nesw-resize';
    case 'north-west':
    case 'south-east':
      return 'nwse-resize';
  }
}

export function SceneTransformOverlay({
  document,
  itemKey,
  snapEnabled,
  stageScale,
  editingLocked = false,
  onPreviewDocument,
  onCommitDocument,
  onCancelInteraction,
}: SceneTransformOverlayProps) {
  const item = document.items[itemKey];
  const stageScaleRef = useRef(stageScale);
  const interactionRef = useRef<InteractionSession | null>(null);
  const documentRef = useRef(document);
  const itemKeyRef = useRef(itemKey);
  const snapEnabledRef = useRef(snapEnabled);
  const keepRatioRef = useRef(item.keepRatio);
  const aspectRatio = useMemo(() => getSceneItemManifestAspectRatio(itemKey), [itemKey]);
  const aspectRatioRef = useRef(aspectRatio);
  const onPreviewDocumentRef = useRef(onPreviewDocument);
  const onCommitDocumentRef = useRef(onCommitDocument);
  const onCancelInteractionRef = useRef(onCancelInteraction);
  const locked = item.locked || editingLocked;

  useEffect(() => {
    stageScaleRef.current = stageScale;
  }, [stageScale]);

  useEffect(() => {
    documentRef.current = document;
    itemKeyRef.current = itemKey;
    snapEnabledRef.current = snapEnabled;
    keepRatioRef.current = item.keepRatio;
    aspectRatioRef.current = aspectRatio;
    onPreviewDocumentRef.current = onPreviewDocument;
    onCommitDocumentRef.current = onCommitDocument;
    onCancelInteractionRef.current = onCancelInteraction;
  }, [
    aspectRatio,
    document,
    item.keepRatio,
    itemKey,
    onCancelInteraction,
    onCommitDocument,
    onPreviewDocument,
    snapEnabled,
  ]);

  const releasePointerCapture = useCallback((session: InteractionSession | null) => {
    if (session === null) {
      return;
    }

    const captureTarget = session.captureElement as HTMLElement & {
      hasPointerCapture?: (pointerId: number) => boolean;
      releasePointerCapture?: (pointerId: number) => void;
    };

    try {
      session.cleanupWindowListeners();
      if (
        typeof captureTarget.releasePointerCapture === 'function' &&
        (typeof captureTarget.hasPointerCapture !== 'function'
          || captureTarget.hasPointerCapture(session.pointerId))
      ) {
        captureTarget.releasePointerCapture(session.pointerId);
      }
    } catch {
      // Ignore release failures during teardown.
    }
  }, []);

  const finishInteraction = useCallback((
    event: ReactPointerEvent<HTMLElement> | KeyboardEvent | null,
    mode: 'commit' | 'cancel',
  ) => {
    const session = interactionRef.current;
    if (session === null) {
      return;
    }

    interactionRef.current = null;
    releasePointerCapture(session);

    if (mode === 'cancel') {
      onCancelInteractionRef.current();
      return;
    }

    const dxScreen =
      event instanceof KeyboardEvent || event === null
        ? 0
        : event.clientX - session.startClientX;
    const dyScreen =
      event instanceof KeyboardEvent || event === null
        ? 0
        : event.clientY - session.startClientY;
    const nextRect = session.mode === 'drag'
      ? computeDragPreviewRect(session.startRect, dxScreen, dyScreen, {
        stageScale: stageScaleRef.current,
        snapEnabled: snapEnabledRef.current,
      })
      : computeResizePreviewRect(session.startRect, session.handle ?? 'south-east', dxScreen, dyScreen, {
        stageScale: stageScaleRef.current,
        snapEnabled: snapEnabledRef.current,
        keepRatio: keepRatioRef.current,
        aspectRatio: aspectRatioRef.current,
      });

    onCommitDocumentRef.current(
      createPreviewDocument(session.startDocument, itemKeyRef.current, nextRect),
    );
  }, [releasePointerCapture]);

  const previewNativeInteraction = useCallback((event: PointerLikeEvent) => {
    const session = interactionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    const dxScreen = event.clientX - session.startClientX;
    const dyScreen = event.clientY - session.startClientY;
    const nextRect = session.mode === 'drag'
      ? computeDragPreviewRect(session.startRect, dxScreen, dyScreen, {
        stageScale: stageScaleRef.current,
        snapEnabled: snapEnabledRef.current,
      })
      : computeResizePreviewRect(session.startRect, session.handle ?? 'south-east', dxScreen, dyScreen, {
        stageScale: stageScaleRef.current,
        snapEnabled: snapEnabledRef.current,
        keepRatio: keepRatioRef.current,
        aspectRatio: aspectRatioRef.current,
      });

    onPreviewDocumentRef.current(
      createPreviewDocument(session.startDocument, itemKeyRef.current, nextRect),
    );
  }, []);

  const finishNativeInteraction = useCallback((
    event: PointerLikeEvent,
    mode: 'commit' | 'cancel',
  ) => {
    const session = interactionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    interactionRef.current = null;
    releasePointerCapture(session);

    if (mode === 'cancel') {
      onCancelInteractionRef.current();
      return;
    }

    const dxScreen = event.clientX - session.startClientX;
    const dyScreen = event.clientY - session.startClientY;
    const nextRect = session.mode === 'drag'
      ? computeDragPreviewRect(session.startRect, dxScreen, dyScreen, {
        stageScale: stageScaleRef.current,
        snapEnabled: snapEnabledRef.current,
      })
      : computeResizePreviewRect(session.startRect, session.handle ?? 'south-east', dxScreen, dyScreen, {
        stageScale: stageScaleRef.current,
        snapEnabled: snapEnabledRef.current,
        keepRatio: keepRatioRef.current,
        aspectRatio: aspectRatioRef.current,
      });

    onCommitDocumentRef.current(
      createPreviewDocument(session.startDocument, itemKeyRef.current, nextRect),
    );
  }, [releasePointerCapture]);

  const startInteraction = useCallback((
    mode: 'drag' | 'resize',
    handle: SceneResizeHandle | null,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const captureTarget = event.currentTarget as HTMLElement & {
      setPointerCapture?: (pointerId: number) => void;
    };

    if (typeof captureTarget.setPointerCapture === 'function') {
      try {
        captureTarget.setPointerCapture(event.pointerId);
      } catch {
        // Script-dispatched PointerEvents in browser automation do not always
        // create an active pointer. Keep the interaction session alive so the
        // preview/commit path can still be verified.
      }
    }

    const handleWindowPointerMove = (nativeEvent: Event) => {
      previewNativeInteraction(nativeEvent as PointerLikeEvent);
    };
    const handleWindowPointerUp = (nativeEvent: Event) => {
      finishNativeInteraction(nativeEvent as PointerLikeEvent, 'commit');
    };
    const handleWindowPointerCancel = (nativeEvent: Event) => {
      finishNativeInteraction(nativeEvent as PointerLikeEvent, 'cancel');
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startDocument: documentRef.current,
      startRect: documentRef.current.items[itemKeyRef.current],
      captureElement: captureTarget,
      cleanupWindowListeners: () => {
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        window.removeEventListener('pointercancel', handleWindowPointerCancel);
      },
    };
  }, [finishNativeInteraction, locked, previewNativeInteraction]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || interactionRef.current === null) {
        return;
      }

      event.preventDefault();
      finishInteraction(event, 'cancel');
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [finishInteraction]);

  useEffect(() => () => {
    releasePointerCapture(interactionRef.current);
    interactionRef.current = null;
  }, [releasePointerCapture]);

  if (!item.visible) {
    return null;
  }

  return (
    <div
      className={`scene-transform-overlay ${locked ? 'is-locked' : 'is-unlocked'}`}
      data-testid="scene-transform-overlay"
      style={toStageStyle(item)}
    >
      <div
        className="scene-transform-overlay-frame"
        data-testid="scene-transform-overlay-frame"
        onPointerDown={(event) => startInteraction('drag', null, event)}
      >
        <span className="scene-transform-overlay-label">{itemKey}</span>
      </div>

      {!locked ? RESIZE_HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          className={`scene-transform-handle is-${handle}`}
          data-testid={`scene-transform-handle-${handle}`}
          aria-label={`调整 ${handle}`}
          onPointerDown={(event) => startInteraction('resize', handle, event)}
          style={{ cursor: getCursor(handle) }}
        />
      )) : null}
    </div>
  );
}
