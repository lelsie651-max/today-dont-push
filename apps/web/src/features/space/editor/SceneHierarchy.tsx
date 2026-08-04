import { getSceneItemLabel } from '../asset-manifest';
import type { SceneItemKey, SceneLayoutDocument } from '../scene-layout';

interface SceneHierarchyProps {
  readonly document: SceneLayoutDocument;
  readonly selectedItemKey: SceneItemKey | null;
  readonly editingLocked?: boolean;
  readonly onSelectItem: (key: SceneItemKey) => void;
  readonly onToggleVisible: (key: SceneItemKey) => void;
  readonly onToggleLocked: (key: SceneItemKey) => void;
}

export function SceneHierarchy({
  document,
  selectedItemKey,
  editingLocked = false,
  onSelectItem,
  onToggleVisible,
  onToggleLocked,
}: SceneHierarchyProps) {
  return (
    <section className="scene-editor-panel" aria-label="场景层级">
      <div className="scene-editor-panel-header">
        <h2>Hierarchy</h2>
        <p>全部布局项都在这里，隐藏后仍保留在层级里。</p>
      </div>
      <ul className="scene-editor-hierarchy-list">
        {Object.entries(document.items).map(([key, item]) => {
          const sceneItemKey = key as SceneItemKey;
          return (
            <li key={sceneItemKey}>
              <div
                className={`scene-editor-hierarchy-row ${
                  selectedItemKey === sceneItemKey ? 'is-selected' : ''
                }`}
              >
                <button
                  type="button"
                  className="scene-editor-hierarchy-item"
                  aria-label={`在层级中选择 ${getSceneItemLabel(sceneItemKey)}`}
                  onClick={() => onSelectItem(sceneItemKey)}
                >
                  <span className="scene-editor-hierarchy-name">{getSceneItemLabel(sceneItemKey)}</span>
                  <span className="scene-editor-hierarchy-key">{sceneItemKey}</span>
                </button>
                <div className="scene-editor-hierarchy-actions">
                  <button
                    type="button"
                    className="scene-editor-chip"
                    onClick={() => onToggleVisible(sceneItemKey)}
                    aria-pressed={item.visible}
                    disabled={editingLocked}
                  >
                    {item.visible ? '显示' : '隐藏'}
                  </button>
                  <button
                    type="button"
                    className="scene-editor-chip"
                    onClick={() => onToggleLocked(sceneItemKey)}
                    aria-pressed={item.locked}
                    disabled={editingLocked}
                  >
                    {item.locked ? '已锁定' : '未锁定'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
