interface SceneToolbarProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly snapEnabled: boolean;
  readonly editingLocked?: boolean;
  readonly isSavingToProject?: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onToggleSnap: () => void;
  readonly onRestoreDefault: () => void;
  readonly onClearDraft: () => void;
  readonly onExport: () => void;
  readonly onSaveToProject?: () => void;
}

export function SceneToolbar({
  canUndo,
  canRedo,
  snapEnabled,
  editingLocked = false,
  isSavingToProject = false,
  onUndo,
  onRedo,
  onToggleSnap,
  onRestoreDefault,
  onClearDraft,
  onExport,
  onSaveToProject,
}: SceneToolbarProps) {
  return (
    <section className="scene-editor-toolbar" aria-label="场景编辑器工具栏">
      <div className="scene-editor-toolbar-group">
        <button
          type="button"
          className="scene-editor-button"
          onClick={onUndo}
          disabled={!canUndo || editingLocked}
        >
          Undo
        </button>
        <button
          type="button"
          className="scene-editor-button"
          onClick={onRedo}
          disabled={!canRedo || editingLocked}
        >
          Redo
        </button>
        <button
          type="button"
          className="scene-editor-button"
          onClick={onToggleSnap}
          aria-pressed={snapEnabled}
          disabled={editingLocked}
        >
          {snapEnabled ? '关闭吸附' : '开启吸附'}
        </button>
      </div>
      <div className="scene-editor-toolbar-group">
        <button
          type="button"
          className="scene-editor-button"
          onClick={onRestoreDefault}
          disabled={editingLocked}
        >
          恢复默认布局
        </button>
        <button
          type="button"
          className="scene-editor-button"
          onClick={onClearDraft}
          disabled={editingLocked}
        >
          清除本地草稿
        </button>
        {onSaveToProject ? (
          <button
            type="button"
            className="scene-editor-button"
            onClick={onSaveToProject}
            disabled={editingLocked}
          >
            {isSavingToProject ? '正在写入工程……' : '保存到工程'}
          </button>
        ) : null}
        <button type="button" className="scene-editor-button is-primary" onClick={onExport}>
          导出布局
        </button>
      </div>
    </section>
  );
}
