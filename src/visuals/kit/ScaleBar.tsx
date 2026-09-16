import type { ReactElement } from "react";
import { validateRepresentationScale } from "./scale.ts";
import type { RepresentationScale } from "./types.ts";

export interface ScaleBarProps {
  /** The RepresentationScale published alongside the visual state. */
  readonly scale: RepresentationScale;
  /** Physical length represented by the scale bar (e.g. 1e-6 for 1 μm). */
  readonly physicalLength: number;
  /** Physical unit string (e.g. "μm", "nm", "m"). */
  readonly unit: string;
  /** Unmagnified pixel length per unit of physical length. */
  readonly basePixelsPerUnit: number;
  readonly x?: number;
  readonly y?: number;
  readonly height?: number;
  readonly strokeColor?: string;
}

/**
 * Derived physical scale bar (am-inst-2d-view-kit-u75r requirement 5).
 * Calibrated from physical length and spatialMagnification.factor.
 */
export function ScaleBar({
  scale,
  physicalLength,
  unit,
  basePixelsPerUnit,
  x = 20,
  y = 20,
  height = 6,
  strokeColor = "currentColor",
}: ScaleBarProps): ReactElement {
  if (!scale) {
    throw new Error("ScaleBar cannot render without a valid RepresentationScale");
  }
  validateRepresentationScale(scale);

  const factor =
    scale.spatialMagnification.appliesTo === "scene" ? scale.spatialMagnification.factor : 1;
  const drawnLengthPx = physicalLength * basePixelsPerUnit * factor;

  const label =
    physicalLength >= 1e5 || (physicalLength > 0 && physicalLength <= 1e-4)
      ? `${physicalLength.toExponential(0)} ${unit}`
      : `${physicalLength} ${unit}`;
  const midX = x + drawnLengthPx / 2;

  return (
    <g className="scale-bar" data-magnification-factor={scale.spatialMagnification.factor}>
      {/* Horizontal bar */}
      <line x1={x} y1={y} x2={x + drawnLengthPx} y2={y} stroke={strokeColor} strokeWidth={2} />
      {/* Left cap */}
      <line
        x1={x}
        y1={y - height / 2}
        x2={x}
        y2={y + height / 2}
        stroke={strokeColor}
        strokeWidth={2}
      />
      {/* Right cap */}
      <line
        x1={x + drawnLengthPx}
        y1={y - height / 2}
        x2={x + drawnLengthPx}
        y2={y + height / 2}
        stroke={strokeColor}
        strokeWidth={2}
      />
      {/* Scale label */}
      <text
        x={midX}
        y={y - height / 2 - 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight="600"
        fill={strokeColor}
      >
        {label}
      </text>
    </g>
  );
}
