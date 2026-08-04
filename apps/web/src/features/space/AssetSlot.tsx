import type { AssetManifestEntry } from './asset-manifest';

interface AssetSlotProps {
  readonly assetId: string;
  readonly label: string;
  readonly manifest: AssetManifestEntry;
  readonly className?: string;
}

export function AssetSlot({
  assetId,
  label,
  manifest,
  className = '',
}: AssetSlotProps) {
  const aspectRatio = `${manifest.width} / ${manifest.height}`;

  return (
    <button
      type="button"
      className={`asset-slot ${className}`.trim()}
      data-asset-id={assetId}
      aria-label={label}
      title={`${label}（未来资源：${manifest.path}）`}
    >
      <div
        className="asset-slot-surface"
        style={{ aspectRatio }}
      >
        <span className="asset-slot-name">{label}</span>
        <span className="asset-slot-meta">
          {manifest.width} x {manifest.height}
        </span>
      </div>
    </button>
  );
}
