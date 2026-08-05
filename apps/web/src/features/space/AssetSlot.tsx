import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { AssetManifestEntry } from './asset-manifest';

interface AssetSlotProps {
  readonly assetId: string;
  readonly manifest: AssetManifestEntry;
  readonly className?: string;
  readonly passive?: boolean;
  readonly style?: CSSProperties;
}

export function AssetSlot({
  assetId,
  manifest,
  className = '',
  passive = false,
  style,
}: AssetSlotProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const aspectRatio = `${manifest.width} / ${manifest.height}`;
  const showPlaceholder = hasError || !hasLoaded;
  const isFutureAction = manifest.role === 'future-action';
  const combinedClassName = [
    'asset-slot',
    className,
    isFutureAction ? 'asset-slot--future-action' : 'asset-slot--decorative',
    passive ? 'asset-slot--passive' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const rootStyle: CSSProperties = {
    ...style,
    aspectRatio,
  };

  const content = (
    <>
      <img
        className={`asset-slot-image ${hasLoaded && !hasError ? 'is-visible' : ''}`}
        src={manifest.path}
        alt=""
        draggable={false}
        onLoad={() => {
          setHasLoaded(true);
          setHasError(false);
        }}
        onError={() => {
          setHasLoaded(false);
          setHasError(true);
        }}
        style={{ objectFit: manifest.fit }}
      />
      {showPlaceholder ? (
        <div className="asset-slot-surface">
          <span className="asset-slot-name">{manifest.label}</span>
          <span className="asset-slot-meta">
            {manifest.width} x {manifest.height}
          </span>
          <span className="asset-slot-path">{manifest.path}</span>
        </div>
      ) : null}
    </>
  );

  if (isFutureAction) {
    return (
      <button
        type="button"
        className={combinedClassName}
        data-asset-id={assetId}
        aria-label={manifest.label}
        aria-disabled="true"
        disabled
        title={`${manifest.label}（暂未开放，未来资源：${manifest.path}）`}
        style={rootStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={combinedClassName}
      data-asset-id={assetId}
      data-role={manifest.role}
      aria-hidden="true"
      title={`${manifest.label}（未来资源：${manifest.path}）`}
      style={rootStyle}
    >
      {content}
    </div>
  );
}
