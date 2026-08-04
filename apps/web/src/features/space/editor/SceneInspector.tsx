import { useEffect, useMemo, useState } from 'react';
import {
  getSceneItemLabel,
  getSceneItemManifestAspectRatio,
} from '../asset-manifest';
import type { SceneItemKey, SceneLayoutItem, SceneLayoutPatch } from '../scene-layout';

interface SceneInspectorProps {
  readonly selectedItemKey: SceneItemKey | null;
  readonly selectedItem: SceneLayoutItem | null;
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

type NumericField = 'x' | 'y' | 'width' | 'height' | 'zIndex';

function isIntegerString(value: string) {
  return /^-?\d+$/.test(value.trim());
}

export function SceneInspector({
  selectedItemKey,
  selectedItem,
  onPatchItem,
  onToggleFlag,
}: SceneInspectorProps) {
  const [draftValues, setDraftValues] = useState<Record<NumericField, string>>({
    x: '',
    y: '',
    width: '',
    height: '',
    zIndex: '',
  });
  const [errors, setErrors] = useState<Partial<Record<NumericField, string>>>({});

  useEffect(() => {
    if (selectedItem === null) {
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
      x: String(selectedItem.x),
      y: String(selectedItem.y),
      width: String(selectedItem.width),
      height: String(selectedItem.height),
      zIndex: String(selectedItem.zIndex),
    });
    setErrors({});
  }, [selectedItem]);

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
    readonly key: NumericField;
    readonly label: string;
  }> = [
    { key: 'x', label: 'x' },
    { key: 'y', label: 'y' },
    { key: 'width', label: 'width' },
    { key: 'height', label: 'height' },
    { key: 'zIndex', label: 'zIndex' },
  ];

  const geometryDisabled = selectedItem.locked;
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

                  if (!isIntegerString(nextValue)) {
                    setErrors((previous) => ({
                      ...previous,
                      [key]: '请输入整数',
                    }));
                    return;
                  }

                  setErrors((previous) => ({
                    ...previous,
                    [key]: undefined,
                  }));
                  onPatchItem(
                    selectedItemKey,
                    {
                      [key]: Number.parseInt(nextValue, 10),
                    },
                    {
                      preferredDimension:
                        key === 'height' ? 'height' : 'width',
                    },
                  );
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
            onChange={() => onToggleFlag(selectedItemKey, 'visible')}
          />
          <span>visible</span>
        </label>
        <label className="scene-editor-toggle">
          <input
            type="checkbox"
            checked={selectedItem.locked}
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
