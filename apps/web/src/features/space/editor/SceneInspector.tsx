import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getSceneItemLabel,
  getSceneItemManifestAspectRatio,
} from '../asset-manifest';
import {
  validateSceneInspectorValue,
  type SceneItemKey,
  type SceneLayoutItem,
  type SceneLayoutPatch,
  type SceneNumericField,
} from '../scene-layout';

interface SceneInspectorProps {
  readonly selectedItemKey: SceneItemKey | null;
  readonly selectedItem: SceneLayoutItem | null;
  readonly editingLocked?: boolean;
  readonly onPatchItem: (
    key: SceneItemKey,
    patch: SceneLayoutPatch,
    options?: { readonly preferredDimension?: 'width' | 'height' },
  ) => void;
  readonly onToggleFlag: (
    key: SceneItemKey,
    flag: 'visible' | 'locked' | 'keepRatio',
  ) => void;
}

export function SceneInspector({
  selectedItemKey,
  selectedItem,
  editingLocked = false,
  onPatchItem,
  onToggleFlag,
}: SceneInspectorProps) {
  const [draftValues, setDraftValues] = useState<Record<SceneNumericField, string>>({
    x: '',
    y: '',
    width: '',
    height: '',
    zIndex: '',
  });
  const [errors, setErrors] = useState<Partial<Record<SceneNumericField, string>>>({});
  const selectedItemRef = useRef(selectedItem);

  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    const nextSelectedItem = selectedItemRef.current;
    if (selectedItemKey === null || nextSelectedItem === null) {
      setDraftValues({
        x: '',
        y: '',
        width: '',
        height: '',
        zIndex: '',
      });
      setErrors({});
      return;
    }
    setDraftValues({
      x: String(nextSelectedItem.x),
      y: String(nextSelectedItem.y),
      width: String(nextSelectedItem.width),
      height: String(nextSelectedItem.height),
      zIndex: String(nextSelectedItem.zIndex),
    });
    setErrors({});
  }, [selectedItemKey]);

  useEffect(() => {
    if (selectedItem === null) {
      return;
    }

    setDraftValues((previous) => ({
      x: errors.x ? previous.x : String(selectedItem.x),
      y: errors.y ? previous.y : String(selectedItem.y),
      width: errors.width ? previous.width : String(selectedItem.width),
      height: errors.height ? previous.height : String(selectedItem.height),
      zIndex: errors.zIndex ? previous.zIndex : String(selectedItem.zIndex),
    }));
  }, [errors.height, errors.width, errors.x, errors.y, errors.zIndex, selectedItem]);

  const selectedLabel = useMemo(() => {
    if (selectedItemKey === null) {
      return '';
    }
    return getSceneItemLabel(selectedItemKey);
  }, [selectedItemKey]);

  if (selectedItemKey === null || selectedItem === null) {
    return (
      <section className="scene-editor-panel" aria-label="属性检查器">
        <div className="scene-editor-panel-header">
          <h2>Inspector</h2>
          <p>先从左侧层级里选中一个物件。</p>
        </div>
        <div className="scene-editor-empty">未选中任何场景物件。</div>
      </section>
    );
  }

  const numericFields: ReadonlyArray<{
    readonly key: SceneNumericField;
    readonly label: string;
  }> = [
    { key: 'x', label: 'x' },
    { key: 'y', label: 'y' },
    { key: 'width', label: 'width' },
    { key: 'height', label: 'height' },
    { key: 'zIndex', label: 'zIndex' },
  ];

  const geometryDisabled = selectedItem.locked || editingLocked;
  const ratioHint = getSceneItemManifestAspectRatio(selectedItemKey);

  return (
    <section className="scene-editor-panel" aria-label="属性检查器">
      <div className="scene-editor-panel-header">
        <h2>Inspector</h2>
        <p>数值修改会立即反映到场景，非法输入不会写入状态。</p>
      </div>
      <div className="scene-editor-inspector">
        <div className="scene-editor-readonly">
          <span>名称</span>
          <strong>{selectedLabel}</strong>
          <code>{selectedItemKey}</code>
        </div>

        <div className="scene-editor-grid">
          {numericFields.map(({ key, label }) => (
            <label key={key} className="scene-editor-field">
              <span>{label}</span>
              <input
                value={draftValues[key]}
                inputMode="numeric"
                aria-label={label}
                disabled={geometryDisabled}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setDraftValues((previous) => ({
                    ...previous,
                    [key]: nextValue,
                  }));

                  const validation = validateSceneInspectorValue(selectedItem, key, nextValue, {
                    aspectRatio: ratioHint ?? undefined,
                  });

                  setErrors((previous) => ({
                    ...previous,
                    [key]: validation.error ?? undefined,
                  }));

                  if (!validation.ok) {
                    return;
                  }

                  onPatchItem(selectedItemKey, {
                    [key]: Number.parseInt(nextValue, 10),
                  }, {
                    preferredDimension: key === 'height' ? 'height' : 'width',
                  });
                }}
              />
              {errors[key] ? <small>{errors[key]}</small> : null}
            </label>
          ))}
        </div>

        <label className="scene-editor-toggle">
          <input
            type="checkbox"
            checked={selectedItem.visible}
            disabled={editingLocked}
            onChange={() => onToggleFlag(selectedItemKey, 'visible')}
          />
          <span>visible</span>
        </label>
        <label className="scene-editor-toggle">
          <input
            type="checkbox"
            checked={selectedItem.locked}
            disabled={editingLocked}
            onChange={() => onToggleFlag(selectedItemKey, 'locked')}
          />
          <span>locked</span>
        </label>
        <label className="scene-editor-toggle">
          <input
            type="checkbox"
            checked={selectedItem.keepRatio}
            disabled={geometryDisabled}
            onChange={() => onToggleFlag(selectedItemKey, 'keepRatio')}
          />
          <span>keepRatio</span>
        </label>

        {selectedItem.keepRatio ? (
          <p className="scene-editor-hint">
            当前保持比例
            {ratioHint !== null ? `（基于资源比例 ${ratioHint.toFixed(4)}）` : '（基于当前槽位比例）'}。
          </p>
        ) : null}
        {selectedItem.locked ? (
          <p className="scene-editor-hint">当前已锁定，画布拖拽、缩放、方向键和几何数值编辑都会失效。</p>
        ) : null}
      </div>
    </section>
  );
}
