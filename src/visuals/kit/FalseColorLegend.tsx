import type { ReactElement } from "react";

export interface FalseColorLegendProps {
  readonly minWavelengthNm: number;
  readonly maxWavelengthNm: number;
  readonly visibleRangeNm?: readonly [number, number] | undefined;
  readonly title?: string | undefined;
  readonly className?: string | undefined;
}

export function isOutsideVisibleSpectrum(
  minNm: number,
  maxNm: number,
  visibleRange: readonly [number, number] = [380, 750],
): boolean {
  return minNm < visibleRange[0] || maxNm > visibleRange[1];
}

export function FalseColorLegend({
  minWavelengthNm,
  maxWavelengthNm,
  visibleRangeNm = [380, 750],
  title = "False-color spectrum legend",
  className = "",
}: FalseColorLegendProps): ReactElement | null {
  const hasInvisibleLight = isOutsideVisibleSpectrum(
    minWavelengthNm,
    maxWavelengthNm,
    visibleRangeNm,
  );

  return (
    <div
      className={`false-color-legend border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded text-xs ${className}`.trim()}
      data-false-color-legend="true"
      data-has-invisible-light={hasInvisibleLight}
      role="note"
      aria-label={title}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-amber-900 dark:text-amber-200">
          {hasInvisibleLight ? "⚠ False-Color Mapping" : "Visible Spectrum"}
        </span>
        <span className="text-neutral-600 dark:text-neutral-400">
          Range: {minWavelengthNm}–{maxWavelengthNm} nm
        </span>
      </div>
      {hasInvisibleLight && (
        <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-tight mb-1.5">
          Frequencies outside the visible band (380–750 nm) are mapped to display colors. Colors
          represent spectral intensity, not direct human visual perception.
        </p>
      )}
      <div
        className="spectrum-bar h-2 w-full rounded"
        style={{
          background:
            "linear-gradient(to right, #4b0082, #0000ff, #00ff00, #ffff00, #ff7f00, #ff0000)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
