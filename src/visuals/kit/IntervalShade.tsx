import type { ReactElement } from "react";
import { optionalIdentityAttributes } from "./identity.ts";
import type { OptionalViewIdentityProps, Projector } from "./types.ts";

export interface IntervalShadeProps extends OptionalViewIdentityProps {
  readonly interval: readonly [number, number];
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly probability?: number;
  readonly quantityId?: string;
  readonly label?: string;
  readonly fillColor?: string;
  readonly fillOpacity?: number;
}

export function IntervalShade({
  interval,
  xProjector,
  yProjector,
  probability,
  quantityId,
  label,
  fillColor = "currentColor",
  fillOpacity = 0.25,
  instanceId,
  runId,
  snapshotVersion,
}: IntervalShadeProps): ReactElement | null {
  const [x0, x1] = interval;
  const px0 = xProjector(x0);
  const px1 = xProjector(x1);

  if (!Number.isFinite(px0) || !Number.isFinite(px1)) {
    return null;
  }

  const [, yDomainMax] = yProjector.domain;
  const [, yRangeTop] = yProjector.range;
  const yBaseline = yProjector(0);
  const yTop = Number.isFinite(yRangeTop) ? yRangeTop : yProjector(yDomainMax);

  const left = Math.min(px0, px1);
  const width = Math.abs(px1 - px0);
  const top = Math.min(yTop, yBaseline);
  const height = Math.abs(yBaseline - yTop);

  const probLabel =
    probability !== undefined
      ? `P([${x0.toFixed(2)}, ${x1.toFixed(2)}]) = ${(probability * 100).toFixed(1)}%`
      : undefined;

  const identityAttrs = optionalIdentityAttributes({ instanceId, runId, snapshotVersion });

  return (
    <g className="interval-shade" data-quantity-id={quantityId} {...identityAttrs}>
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={fillColor}
        strokeWidth={1}
        strokeDasharray="4 2"
      >
        <title>{label ?? probLabel ?? `Interval [${x0}, ${x1}]`}</title>
      </rect>
      {probLabel && (
        <text
          x={(left + left + width) / 2}
          y={top - 6}
          textAnchor="middle"
          fontSize={11}
          fontWeight="500"
          fill="currentColor"
        >
          {probLabel}
        </text>
      )}
    </g>
  );
}
