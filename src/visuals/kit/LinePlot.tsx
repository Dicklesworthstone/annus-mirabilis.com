import type { ReactElement } from "react";
import { optionalIdentityAttributes } from "./identity.ts";
import type { OptionalViewIdentityProps, PlotSeriesClass, Projector, ReferenceLine } from "./types.ts";

export interface DataPoint {
  readonly x: number;
  readonly y: number;
}

export interface LinePlotProps extends OptionalViewIdentityProps {
  readonly data: readonly DataPoint[];
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly seriesClass?: PlotSeriesClass;
  readonly quantityId?: string;
  readonly label?: string;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
  readonly isHighlighted?: boolean;
}

export function LinePlot({
  data,
  xProjector,
  yProjector,
  seriesClass = "theoretical",
  quantityId,
  label,
  strokeColor = "currentColor",
  strokeWidth = 2,
  isHighlighted,
  instanceId,
  runId,
  snapshotVersion,
}: LinePlotProps): ReactElement | null {
  if (!data || data.length === 0) return null;

  const validPoints = data
    .map((p) => {
      const px = xProjector(p.x);
      const py = yProjector(p.y);
      return Number.isFinite(px) && Number.isFinite(py)
        ? `${px.toFixed(2)},${py.toFixed(2)}`
        : null;
    })
    .filter((pt): pt is string => pt !== null);

  if (validPoints.length === 0) return null;

  const d = `M${validPoints.join(" L")}`;

  let strokeDasharray: string | undefined;
  if (seriesClass === "historical") {
    strokeDasharray = "6 4";
  } else if (seriesClass === "empirical") {
    strokeDasharray = "2 2";
  }

  const className = [
    "line-plot",
    `series-${seriesClass}`,
    isHighlighted ? "is-highlighted" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const identityAttrs = optionalIdentityAttributes({ instanceId, runId, snapshotVersion });

  return (
    <g
      className={className}
      data-quantity-id={quantityId}
      data-series-class={seriesClass}
      {...identityAttrs}
    >
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHighlighted ? strokeWidth + 1.5 : strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {label && <title>{label}</title>}
      </path>
    </g>
  );
}

export interface ReferenceLinePlotProps {
  readonly referenceLine: ReferenceLine;
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly strokeColor?: string;
}

export function ReferenceLinePlot({
  referenceLine,
  xProjector,
  yProjector,
  strokeColor = "currentColor",
}: ReferenceLinePlotProps): ReactElement | null {
  const [x0, x1] = referenceLine.xRange;
  const intercept = referenceLine.intercept ?? 1;

  const y0 = intercept * x0 ** referenceLine.slope;
  const y1 = intercept * x1 ** referenceLine.slope;

  const px0 = xProjector(x0);
  const py0 = yProjector(y0);
  const px1 = xProjector(x1);
  const py1 = yProjector(y1);

  if (
    !Number.isFinite(px0) ||
    !Number.isFinite(py0) ||
    !Number.isFinite(px1) ||
    !Number.isFinite(py1)
  ) {
    return null;
  }

  const midX = (px0 + px1) / 2;
  const midY = (py0 + py1) / 2;

  return (
    <g className="reference-line" data-quantity-id={referenceLine.quantityId}>
      <line
        x1={px0}
        y1={py0}
        x2={px1}
        y2={py1}
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.8}
      />
      <text
        x={midX}
        y={midY - 8}
        textAnchor="middle"
        fontSize={11}
        fontWeight="500"
        fill="currentColor"
        opacity={0.9}
      >
        {referenceLine.label}
      </text>
    </g>
  );
}
