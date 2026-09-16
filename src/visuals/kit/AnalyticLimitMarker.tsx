import type { ReactElement } from "react";
import type { Projector } from "./types.ts";

export interface AnalyticLimitMarkerProps {
  readonly point: number;
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly probability?: number;
  readonly quantityId?: string;
  readonly label?: string;
  readonly color?: string;
}

/**
 * Renders an `analytic-limit` point distribution (e.g. delta distribution at t=0)
 * as a labeled point marker with interval probabilities, NEVER an infinite bar.
 */
export function AnalyticLimitMarker({
  point,
  xProjector,
  yProjector,
  probability = 1.0,
  quantityId,
  label = "Concentrated point mass (P = 1.0)",
  color = "currentColor",
}: AnalyticLimitMarkerProps): ReactElement | null {
  const px = xProjector(point);
  const [, yDomainMax] = yProjector.domain;
  const yBaseline = yProjector(0);
  const yTop = yProjector(yDomainMax * 0.75);

  if (!Number.isFinite(px) || !Number.isFinite(yBaseline) || !Number.isFinite(yTop)) {
    return null;
  }

  return (
    <g
      className="analytic-limit-marker"
      data-quantity-id={quantityId}
      data-result-status="analytic-limit"
    >
      {/* Arrow line from baseline to point */}
      <line x1={px} y1={yBaseline} x2={px} y2={yTop} stroke={color} strokeWidth={2.5} />
      {/* Arrowhead */}
      <path
        d={`M ${px - 6} ${yTop + 10} L ${px} ${yTop} L ${px + 6} ${yTop + 10}`}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Circle marker at peak */}
      <circle cx={px} cy={yTop} r={4} fill={color} />

      {/* Label and probability description */}
      <text x={px} y={yTop - 12} textAnchor="middle" fontSize={11} fontWeight="600" fill={color}>
        {label}
      </text>
      <text x={px} y={yTop - 26} textAnchor="middle" fontSize={10} fill={color} opacity={0.8}>
        {`Point distribution at x = ${point} (P = ${(probability * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
}
