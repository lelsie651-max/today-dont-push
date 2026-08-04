import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Moveable, { type OnDrag, type OnResize } from 'react-moveable';
import { SpaceScene } from '../SpaceScene';
import {
  defaultSceneLayoutDocument,
  type SceneItemKey,
  type SceneLayoutPatch,
  validateSceneLayoutDocument,
} from '../scene-layout';
import {
  canRedoSceneDocument,
  canUndoSceneDocument,
  commitSceneDocument,
  createSceneEditorState,
  documentsEqual,
  finishSceneInteraction,
  getSceneEditorDocument,
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
import { saveSceneLayoutToProject } from './scene-layout-dev-save';
import { SceneHierarchy } from './SceneHierarchy';
import { SceneInspector } from './SceneInspector';
import { SceneToolbar } from './SceneToolbar';
import { createStageMoveableMetrics, useStageMetrics } from './useStageMetrics';
import './scene-editor.css';

interface SceneEditorProps {
  readonly debugAssets?: boolean;
}

type SceneEditorDocumentState = ReturnType<typeof createSceneEditorState>;

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function SceneEditor({ debugAssets = false }: SceneEditorProps) {
  const [{ initialEditorState, initialNotice }] = useState(() => {
    const initial = getInitialSceneLayoutDocument();
    return {
      initialEditorState: createSceneEditorState(initial.document),
      initialNotice: initial.notice,
    };
  });
  const [editorState, setEditorState] = useState<SceneEditorDocumentState>(initialEditorState);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null);
  const [targetElements, setTargetElements] = useState<Partial<Record<SceneItemKey, HTMLButtonElement | null>>>({});
  const targetRefCallbacks = useRef<Partial<Record<SceneItemKey, (element: HTMLButtonElement | null) => void>>>({});
  const stageMetrics = useStageMetrics(stageElement);
  const stageMetricsRef = useRef(stageMetrics);
  const editorStateRef = useRef(editorState);
  const selectedItemKeyRef = useRef<SceneItemKey | null>(editorState.selectedItemKey);
  const autosaveFailureMessageRef = useRef<string | null>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const autosaveGenerationRef = useRef(0);
  const saveLockRef = useRef(false);
  const latestCanvasDocumentRef = useRef(getSceneEditorDocument(editorState));
  const latestCommittedDocumentRef = useRef(editorState.history.present);
  const lastProjectSavedDocumentRef = useRef<ReturnType<typeof getSceneEditorDocument> | null>(null);
  const [isSavingToProject, setIsSavingToProject] = useState(false);

  const document = getSceneEditorDocument(editorState);
  const selectedItemKey = editorState.selectedItemKey;
  const selectedItem = selectedItemKey === null ? null : document.items[selectedItemKey];
  const selectedTarget = selectedItemKey === null ? null : targetElements[selectedItemKey] ?? null;
  const editingLocked = isSavingToProject;
  const canTransform = Boolean(selectedItem && selectedItem.visible && !selectedItem.locked && !editingLocked);
  const moveableMetrics = useMemo(
    () => createStageMoveableMetrics(stageMetrics, editorState.snapEnabled),
    [editorState.snapEnabled, stageMetrics],
  );
  editorStateRef.current = editorState;
  latestCanvasDocumentRef.current = document;
  latestCommittedDocumentRef.current = editorState.history.present;

  useEffect(() => {
    stageMetricsRef.current = stageMetrics;
  }, [stageMetrics]);

  useEffect(() => {
    selectedItemKeyRef.current = selectedItemKey;
  }, [selectedItemKey]);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
  }, []);

  const commitEditorState = useCallback((
    nextEditorState: SceneEditorDocumentState,
    nextNotice?: string | null,
  ) => {
    editorStateRef.current = nextEditorState;
    selectedItemKeyRef.current = nextEditorState.selectedItemKey;
    latestCommittedDocumentRef.current = nextEditorState.history.present;
    latestCanvasDocumentRef.current = getSceneEditorDocument(nextEditorState);
    flushSync(() => {
      setEditorState(nextEditorState);
    });
    if (nextNotice !== undefined) {
      setNotice(nextNotice);
    }
  }, []);

  const updateEditorState = useCallback((
    transform: (current: SceneEditorDocumentState) => SceneEditorDocumentState,
    nextNotice?: string | null,
  ) => {
    const nextEditorState = transform(editorStateRef.current);
    commitEditorState(nextEditorState, nextNotice);
  }, [commitEditorState]);

  useEffect(() => {
    clearAutosaveTimer();

    if (isSavingToProject) {
      return;
    }

    const lastSavedDocument = lastProjectSavedDocumentRef.current;
    if (
      lastSavedDocument !== null &&
      documentsEqual(editorState.history.present, lastSavedDocument)
    ) {
      return;
    }

    const generation = autosaveGenerationRef.current;
    autosaveTimeoutRef.current = window.setTimeout(() => {
      autosaveTimeoutRef.current = null;
      if (generation !== autosaveGenerationRef.current || saveLockRef.current) {
        return;
      }

      const currentDocument = latestCommittedDocumentRef.current;
      const latestSavedDocument = lastProjectSavedDocumentRef.current;
      if (
        latestSavedDocument !== null &&
        documentsEqual(currentDocument, latestSavedDocument)
      ) {
        return;
      }

      const result = saveSceneLayoutDraft(currentDocument);
      if (result.ok) {
        autosaveFailureMessageRef.current = null;
        return;
      }

      if (autosaveFailureMessageRef.current === result.message) {
        return;
      }

      autosaveFailureMessageRef.current = result.message;
      setNotice(result.message);
    }, 300);

    return clearAutosaveTimer;
  }, [clearAutosaveTimer, editorState.history.present, isSavingToProject]);

  useEffect(() => clearAutosaveTimer, [clearAutosaveTimer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isNudgeKey = event.key.startsWith('Arrow');
      const isUndoKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
      if (saveLockRef.current && (isUndoKey || isNudgeKey)) {
        event.preventDefault();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (isUndoKey) {
        event.preventDefault();
        updateEditorState((current) => (
          event.shiftKey
            ? redoSceneDocument(current)
            : undoSceneDocument(current)
        ));
        return;
      }

      if (selectedItemKey === null || selectedItem?.locked) {
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
      updateEditorState((current) => (
        nudgeSceneEditorItem(
          current,
          selectedItemKey,
          delta.dx,
          delta.dy,
        )
      ));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItemKey, selectedItem?.locked, updateEditorState]);

  const registerEditorTarget = useCallback(
    (key: SceneItemKey) => {
      const existingCallback = targetRefCallbacks.current[key];
      if (existingCallback !== undefined) {
        return existingCallback;
      }

      const nextCallback = (element: HTMLButtonElement | null) => {
        setTargetElements((current) => {
          if ((current[key] ?? null) === element) {
            return current;
          }
          return {
            ...current,
            [key]: element,
          };
        });
      };
      targetRefCallbacks.current[key] = nextCallback;
      return nextCallback;
    },
    [],
  );

  const handlePatchItem = (
    key: SceneItemKey,
    patch: SceneLayoutPatch,
    options?: { readonly preferredDimension?: 'width' | 'height' },
  ) => {
    if (saveLockRef.current) {
      return;
    }

    updateEditorState((current) => (
      updateSceneEditorItem(current, key, patch, {
        preferredDimension: options?.preferredDimension,
      })
    ));
  };

  const handleRestoreDefault = () => {
    if (saveLockRef.current) {
      return;
    }

    if (!window.confirm('确定要恢复默认布局吗？当前画布会被重置。')) {
      return;
    }

    updateEditorState(
      (current) => commitSceneDocument(current, defaultSceneLayoutDocument),
      '已恢复默认布局。',
    );
  };

  const handleSaveToProject = useCallback(async () => {
    if (saveLockRef.current) {
      return;
    }

    const saveCandidate = latestCanvasDocumentRef.current;
    const validation = validateSceneLayoutDocument(saveCandidate);
    if (!validation.ok || validation.document === null) {
      setNotice(validation.errors[0] ?? '当前布局校验失败，无法写入工程文件。');
      return;
    }

    const saveSnapshot = validation.document;
    saveLockRef.current = true;
    autosaveGenerationRef.current += 1;
    clearAutosaveTimer();
    setIsSavingToProject(true);
    setNotice('正在写入工程……');

    try {
      const saveResult = await saveSceneLayoutToProject(saveSnapshot);
      if (!saveResult.ok) {
        setNotice(saveResult.message);
        return;
      }

      autosaveFailureMessageRef.current = null;
      lastProjectSavedDocumentRef.current = saveSnapshot;

      if (!documentsEqual(latestCanvasDocumentRef.current, saveSnapshot)) {
        setNotice('工程已保存，但当前画布还有新的未保存修改。');
        return;
      }

      const clearResult = clearSceneLayoutDraft();
      setNotice(
        clearResult.ok
          ? saveResult.message
          : `${saveResult.message} 但未能清除本地草稿：${clearResult.message}`,
      );
    } finally {
      saveLockRef.current = false;
      setIsSavingToProject(false);
    }
  }, [clearAutosaveTimer]);

  return (
    <section className="scene-editor" aria-label="场景编辑器 V1">
      <SceneToolbar
        canUndo={canUndoSceneDocument(editorState)}
        canRedo={canRedoSceneDocument(editorState)}
        snapEnabled={editorState.snapEnabled}
        editingLocked={editingLocked}
        isSavingToProject={isSavingToProject}
        onUndo={() => {
          if (saveLockRef.current) {
            return;
          }
          updateEditorState((current) => undoSceneDocument(current));
        }}
        onRedo={() => {
          if (saveLockRef.current) {
            return;
          }
          updateEditorState((current) => redoSceneDocument(current));
        }}
        onToggleSnap={() => {
          if (saveLockRef.current) {
            return;
          }
          updateEditorState((current) => (
            setSceneEditorSnapEnabled(current, !current.snapEnabled)
          ));
        }}
        onRestoreDefault={handleRestoreDefault}
        onClearDraft={() => {
          if (saveLockRef.current) {
            return;
          }
          const clearResult = clearSceneLayoutDraft();
          setNotice(
            clearResult.ok
              ? '本地草稿已清除，刷新后会回到默认布局。'
              : clearResult.message,
          );
        }}
        onSaveToProject={handleSaveToProject}
        onExport={() => {
          const exportResult = downloadSceneLayoutDocument(document);
          setNotice(
            exportResult.ok
              ? '布局 JSON 已导出。'
              : exportResult.error ?? '导出失败。',
          );
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
          editingLocked={editingLocked}
          onSelectItem={(key) => {
            updateEditorState((current) => selectSceneItem(current, key));
          }}
          onToggleVisible={(key) => {
            if (saveLockRef.current) {
              return;
            }
            updateEditorState((current) => (
              toggleSceneEditorItemFlag(current, key, 'visible')
            ));
          }}
          onToggleLocked={(key) => {
            if (saveLockRef.current) {
              return;
            }
            updateEditorState((current) => (
              toggleSceneEditorItemFlag(current, key, 'locked')
            ));
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
              updateEditorState((current) => selectSceneItem(current, key));
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
              bounds={moveableMetrics.bounds}
              verticalGuidelines={moveableMetrics.verticalGuidelines}
              horizontalGuidelines={moveableMetrics.horizontalGuidelines}
              snapGridWidth={moveableMetrics.snapGridWidth}
              snapGridHeight={moveableMetrics.snapGridHeight}
              throttleDrag={0}
              throttleResize={0}
              onDrag={({ left, top, width, height }: OnDrag) => {
                if (saveLockRef.current) {
                  return;
                }
                const activeItemKey = selectedItemKeyRef.current;
                if (activeItemKey === null) {
                  return;
                }
                updateEditorState((current) => (
                  previewDragInScreenSpace(
                    current,
                    activeItemKey,
                    { left, top, width, height },
                    stageMetricsRef.current.scale,
                  )
                ));
              }}
              onDragEnd={({ isDrag }) => {
                if (!isDrag || saveLockRef.current) {
                  return;
                }
                updateEditorState((current) => finishSceneInteraction(current));
              }}
              onResize={(event: OnResize) => {
                if (saveLockRef.current) {
                  return;
                }
                const activeItemKey = selectedItemKeyRef.current;
                if (activeItemKey === null) {
                  return;
                }
                const preferredDimension =
                  Math.abs(event.delta[0]) >= Math.abs(event.delta[1]) ? 'width' : 'height';
                const left = event.drag.left;
                const top = event.drag.top;
                updateEditorState((current) => (
                  previewResizeInScreenSpace(
                    current,
                    activeItemKey,
                    {
                      left,
                      top,
                      width: event.width,
                      height: event.height,
                    },
                    stageMetricsRef.current.scale,
                    preferredDimension,
                  )
                ));
              }}
              onResizeEnd={({ isDrag }) => {
                if (!isDrag || saveLockRef.current) {
                  return;
                }
                updateEditorState((current) => finishSceneInteraction(current));
              }}
            />
          ) : null}
        </div>

        <SceneInspector
          selectedItemKey={selectedItemKey}
          selectedItem={selectedItem}
          editingLocked={editingLocked}
          onPatchItem={handlePatchItem}
          onToggleFlag={(key, flag) => {
            if (saveLockRef.current) {
              return;
            }
            updateEditorState((current) => (
              toggleSceneEditorItemFlag(current, key, flag)
            ));
          }}
        />
      </div>
    </section>
  );
}
