import type { ReactElement } from "react";
import "./legends.css";

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
      className={`false-color-legend ${className}`.trim()}
      data-false-color-legend="true"
      data-has-invisible-light={hasInvisibleLight}
      role="note"
      aria-label={title}
      style={{
        border: hasInvisibleLight ? "1px solid var(--accent)" : "1px solid var(--line)",
        background: "var(--wash)",
        padding: "0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.25rem",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: hasInvisibleLight ? "var(--accent)" : "var(--ink)",
          }}
        >
          {hasInvisibleLight ? "⚠ False-Color Mapping" : "Visible Spectrum"}
        </span>
        <span style={{ color: "var(--muted)" }}>
          Range: {minWavelengthNm}–{maxWavelengthNm} nm
        </span>
      </div>
      {hasInvisibleLight && (
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.6875rem",
            lineHeight: 1.3,
            margin: "0 0 0.375rem",
          }}
        >
          Frequencies outside the visible band (380–750 nm) are mapped to display colors. Colors
          represent spectral intensity, not direct human visual perception.
        </p>
      )}
      <div
        className="spectrum-bar"
        style={{
          height: "0.5rem",
          width: "100%",
          borderRadius: "0.25rem",
          background:
            "linear-gradient(to right, #4b0082, #0000ff, #00ff00, #ffff00, #ff7f00, #ff0000)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
