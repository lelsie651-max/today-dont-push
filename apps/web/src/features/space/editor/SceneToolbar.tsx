interface SceneToolbarProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly snapEnabled: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onToggleSnap: () => void;
  readonly onRestoreDefault: () => void;
  readonly onClearDraft: () => void;
  readonly onExport: () => void;
}

export function SceneToolbar({
  canUndo,
  canRedo,
  snapEnabled,
  onUndo,
  onRedo,
  onToggleSnap,
  onRestoreDefault,
  onClearDraft,
  onExport,
}: SceneToolbarProps) {
  return (
    <section className="scene-editor-toolbar" aria-label="场景编辑器工具栏">
      <div className="scene-editor-toolbar-group">
        <button type="button" className="scene-editor-button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="scene-editor-button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <button
          type="button"
          className="scene-editor-button"
          onClick={onToggleSnap}
          aria-pressed={snapEnabled}
        >
          {snapEnabled ? '关闭吸附' : '开启吸附'}
        </button>
      </div>
      <div className="scene-editor-toolbar-group">
        <button type="button" className="scene-editor-button" onClick={onRestoreDefault}>
          恢复默认布局
        </button>
        <button type="button" className="scene-editor-button" onClick={onClearDraft}>
          清除本地草稿
        </button>
        <button type="button" className="scene-editor-button is-primary" onClick={onExport}>
          导出布局
        </button>
      </div>
    </section>
  );
}
