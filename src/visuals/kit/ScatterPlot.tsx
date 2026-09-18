import type { ReactElement } from "react";
import { optionalIdentityAttributes } from "./identity.ts";
import type { OptionalViewIdentityProps, PlotSeriesClass, Projector } from "./types.ts";

export interface ScatterPoint {
  readonly x: number;
  readonly y: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly label?: string;
  readonly id?: string;
}

export interface ScatterPlotProps extends OptionalViewIdentityProps {
  readonly data: readonly ScatterPoint[];
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly seriesClass?: PlotSeriesClass;
  readonly quantityId?: string;
  readonly radius?: number;
  readonly color?: string;
  readonly isHighlighted?: boolean;
}

export function ScatterPlot({
  data,
  xProjector,
  yProjector,
  seriesClass = "empirical",
  quantityId,
  radius = 4,
  color = "currentColor",
  isHighlighted,
  instanceId,
  runId,
  snapshotVersion,
}: ScatterPlotProps): ReactElement | null {
  if (!data || data.length === 0) return null;

  const className = [
    "scatter-plot",
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
      {data.map((pt, idx) => {
        const px = xProjector(pt.x);
        const py = yProjector(pt.y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

        const key = pt.id ?? `pt-${idx}-${pt.x}-${pt.y}`;

        // Error / uncertainty bars
        let errorBars: ReactElement | null = null;
        if (pt.dy !== undefined && pt.dy > 0) {
          const pyLow = yProjector(pt.y - pt.dy);
          const pyHigh = yProjector(pt.y + pt.dy);
          if (Number.isFinite(pyLow) && Number.isFinite(pyHigh)) {
            errorBars = (
              <g className="error-bar y-error" opacity={0.7}>
                <line x1={px} y1={pyLow} x2={px} y2={pyHigh} stroke={color} strokeWidth={1} />
                <line
                  x1={px - 3}
                  y1={pyLow}
                  x2={px + 3}
                  y2={pyLow}
                  stroke={color}
                  strokeWidth={1}
                />
                <line
                  x1={px - 3}
                  y1={pyHigh}
                  x2={px + 3}
                  y2={pyHigh}
                  stroke={color}
                  strokeWidth={1}
                />
              </g>
            );
          }
        }

        let marker: ReactElement;
        if (seriesClass === "theoretical") {
          // Circle marker
          marker = <circle cx={px} cy={py} r={radius} fill={color} />;
        } else if (seriesClass === "historical") {
          // Diamond marker
          const d = `M ${px} ${py - radius} L ${px + radius} ${py} L ${px} ${py + radius} L ${px - radius} ${py} Z`;
          marker = <path d={d} fill="none" stroke={color} strokeWidth={1.5} />;
        } else {
          // Empirical: filled circle with stroke
          marker = (
            <circle cx={px} cy={py} r={radius} fill={color} stroke="white" strokeWidth={1} />
          );
        }

        return (
          <g key={key} className="scatter-point" data-quantity-id={quantityId}>
            {errorBars}
            {marker}
            {pt.label && <title>{pt.label}</title>}
          </g>
        );
      })}
    </g>
  );
}
