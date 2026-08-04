import { useEffect, useMemo, useRef, useState } from 'react';
import Moveable, { type OnDrag, type OnResize } from 'react-moveable';
import { SpaceScene } from '../SpaceScene';
import {
  defaultSceneLayoutDocument,
  type SceneItemKey,
  type SceneLayoutDocument,
  type SceneLayoutPatch,
} from '../scene-layout';
import {
  canRedoSceneDocument,
  canUndoSceneDocument,
  commitSceneDocument,
  createSceneEditorState,
  finishSceneInteraction,
  getSceneEditorDocument,
  getStageScale,
  nudgeSceneEditorItem,
  previewDragInScreenSpace,
  previewResizeInScreenSpace,
  redoSceneDocument,
  selectSceneItem,
  setSceneEditorSnapEnabled,
  toggleSceneEditorItemFlag,
  undoSceneDocument,
  updateSceneEditorItem,
} from './scene-editor-state';
import { downloadSceneLayoutDocument } from './scene-editor-export';
import {
  clearSceneLayoutDraft,
  getInitialSceneLayoutDocument,
  saveSceneLayoutDraft,
} from './scene-editor-storage';
import { SceneHierarchy } from './SceneHierarchy';
import { SceneInspector } from './SceneInspector';
import { SceneToolbar } from './SceneToolbar';
import './scene-editor.css';

interface SceneEditorProps {
  readonly debugAssets?: boolean;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function SceneEditor({ debugAssets = false }: SceneEditorProps) {
  const [{ editorState, notice }, setEditorState] = useState(() => {
    const initial = getInitialSceneLayoutDocument();
    return {
      editorState: createSceneEditorState(initial.document),
      notice: initial.notice,
    };
  });
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null);
  const targetElementsRef = useRef(new Map<SceneItemKey, HTMLButtonElement>());

  const document = getSceneEditorDocument(editorState);
  const selectedItemKey = editorState.selectedItemKey;
  const selectedItem = selectedItemKey === null ? null : document.items[selectedItemKey];
  const selectedTarget =
    selectedItemKey === null ? null : targetElementsRef.current.get(selectedItemKey) ?? null;
  const stageWidth = stageElement?.clientWidth ?? defaultSceneLayoutDocument.designSpace.width;
  const stageHeight = stageElement?.clientHeight ?? defaultSceneLayoutDocument.designSpace.height;
  const stageScale = getStageScale(stageWidth);
  const canTransform = Boolean(selectedItem && selectedItem.visible && !selectedItem.locked);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      saveSceneLayoutDraft(editorState.history.present);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorState.history.present]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        setEditorState((current) => ({
          ...current,
          editorState: event.shiftKey
            ? redoSceneDocument(current.editorState)
            : undoSceneDocument(current.editorState),
        }));
        return;
      }

      if (selectedItemKey === null || selectedItem?.locked || isTypingTarget(event.target)) {
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      const deltas: Partial<Record<KeyboardEvent['key'], { dx: number; dy: number }>> = {
        ArrowLeft: { dx: -step, dy: 0 },
        ArrowRight: { dx: step, dy: 0 },
        ArrowUp: { dx: 0, dy: -step },
        ArrowDown: { dx: 0, dy: step },
      };

      const delta = deltas[event.key];
      if (delta === undefined) {
        return;
      }

      event.preventDefault();
      setEditorState((current) => ({
        ...current,
        editorState: nudgeSceneEditorItem(
          current.editorState,
          selectedItemKey,
          delta.dx,
          delta.dy,
        ),
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItemKey, selectedItem?.locked]);

  const moveableBounds = useMemo(
    () => ({
      left: 0,
      top: 0,
      right: stageWidth,
      bottom: stageHeight,
      position: 'css' as const,
    }),
    [stageHeight, stageWidth],
  );

  const registerEditorTarget = (key: SceneItemKey) => (element: HTMLButtonElement | null) => {
    if (element === null) {
      targetElementsRef.current.delete(key);
      return;
    }
    targetElementsRef.current.set(key, element);
  };

  const handlePatchItem = (
    key: SceneItemKey,
    patch: SceneLayoutPatch,
    options?: { readonly preferredDimension?: 'width' | 'height' },
  ) => {
    setEditorState((current) => ({
      ...current,
      editorState: updateSceneEditorItem(current.editorState, key, patch, {
        preferredDimension: options?.preferredDimension,
      }),
    }));
  };

  const handleRestoreDefault = () => {
    if (!window.confirm('确定要恢复默认布局吗？当前画布会被重置。')) {
      return;
    }

    setEditorState((current) => ({
      notice: '已恢复默认布局。',
      editorState: commitSceneDocument(
        current.editorState,
        defaultSceneLayoutDocument as SceneLayoutDocument,
      ),
    }));
  };

  return (
    <section className="scene-editor" aria-label="场景编辑器 V1">
      <SceneToolbar
        canUndo={canUndoSceneDocument(editorState)}
        canRedo={canRedoSceneDocument(editorState)}
        snapEnabled={editorState.snapEnabled}
        onUndo={() => {
          setEditorState((current) => ({
            ...current,
            editorState: undoSceneDocument(current.editorState),
          }));
        }}
        onRedo={() => {
          setEditorState((current) => ({
            ...current,
            editorState: redoSceneDocument(current.editorState),
          }));
        }}
        onToggleSnap={() => {
          setEditorState((current) => ({
            ...current,
            editorState: setSceneEditorSnapEnabled(current.editorState, !current.editorState.snapEnabled),
          }));
        }}
        onRestoreDefault={handleRestoreDefault}
        onClearDraft={() => {
          clearSceneLayoutDraft();
          setEditorState((current) => ({
            ...current,
            notice: '本地草稿已清除，刷新后会回到默认布局。',
          }));
        }}
        onExport={() => {
          const exportResult = downloadSceneLayoutDocument(document);
          setEditorState((current) => ({
            ...current,
            notice: exportResult.ok
              ? '布局 JSON 已导出。'
              : exportResult.error ?? '导出失败。',
          }));
        }}
      />

      {notice ? (
        <div className="scene-editor-notice" aria-live="polite">
          {notice}
        </div>
      ) : null}

      <div className="scene-editor-layout">
        <SceneHierarchy
          document={document}
          selectedItemKey={selectedItemKey}
          onSelectItem={(key) => {
            setEditorState((current) => ({
              ...current,
              editorState: selectSceneItem(current.editorState, key),
            }));
          }}
          onToggleVisible={(key) => {
            setEditorState((current) => ({
              ...current,
              editorState: toggleSceneEditorItemFlag(current.editorState, key, 'visible'),
            }));
          }}
          onToggleLocked={(key) => {
            setEditorState((current) => ({
              ...current,
              editorState: toggleSceneEditorItemFlag(current.editorState, key, 'locked'),
            }));
          }}
        />

        <div className="scene-editor-canvas">
          <div className="scene-editor-canvas-header">
            <h2>Canvas</h2>
            <p>画布始终基于 1440×900 设计空间，拖拽和缩放会自动换算回设计坐标。</p>
          </div>
          <SpaceScene
            debugAssets={debugAssets}
            layoutDocument={document}
            editorMode
            selectedItemKey={selectedItemKey}
            stageRef={setStageElement}
            registerEditorTarget={registerEditorTarget}
            onSelectItem={(key) => {
              setEditorState((current) => ({
                ...current,
                editorState: selectSceneItem(current.editorState, key),
              }));
            }}
          />
          {selectedTarget !== null && selectedItem !== null && selectedItem.visible ? (
            <Moveable
              target={selectedTarget}
              container={stageElement ?? undefined}
              origin={false}
              draggable={canTransform}
              resizable={canTransform}
              snappable={editorState.snapEnabled}
              keepRatio={selectedItem.keepRatio}
              bounds={moveableBounds}
              verticalGuidelines={[0, stageWidth / 2, stageWidth]}
              horizontalGuidelines={[0, stageHeight / 2, stageHeight]}
              snapGridWidth={editorState.snapEnabled ? 10 * stageScale : 0}
              snapGridHeight={editorState.snapEnabled ? 10 * stageScale : 0}
              throttleDrag={0}
              throttleResize={0}
              onDrag={({ left, top, width, height }: OnDrag) => {
                setEditorState((current) => ({
                  ...current,
                  editorState: previewDragInScreenSpace(
                    current.editorState,
                    selectedItemKey!,
                    { left, top, width, height },
                    stageScale,
                  ),
                }));
              }}
              onDragEnd={({ isDrag }) => {
                if (!isDrag) {
                  return;
                }
                setEditorState((current) => ({
                  ...current,
                  editorState: finishSceneInteraction(current.editorState),
                }));
              }}
              onResize={(event: OnResize) => {
                const preferredDimension =
                  Math.abs(event.delta[0]) >= Math.abs(event.delta[1]) ? 'width' : 'height';
                const left = event.drag.left;
                const top = event.drag.top;
                setEditorState((current) => ({
                  ...current,
                  editorState: previewResizeInScreenSpace(
                    current.editorState,
                    selectedItemKey!,
                    {
                      left,
                      top,
                      width: event.width,
                      height: event.height,
                    },
                    stageScale,
                    preferredDimension,
                  ),
                }));
              }}
              onResizeEnd={({ isDrag }) => {
                if (!isDrag) {
                  return;
                }
                setEditorState((current) => ({
                  ...current,
                  editorState: finishSceneInteraction(current.editorState),
                }));
              }}
            />
          ) : null}
        </div>

        <SceneInspector
          selectedItemKey={selectedItemKey}
          selectedItem={selectedItem}
          onPatchItem={handlePatchItem}
          onToggleFlag={(key, flag) => {
            setEditorState((current) => ({
              ...current,
              editorState: toggleSceneEditorItemFlag(current.editorState, key, flag),
            }));
          }}
        />
      </div>
    </section>
  );
}
