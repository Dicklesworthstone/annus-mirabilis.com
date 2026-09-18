import type { ReactElement } from "react";
import type { HistogramBinData, Projector } from "./types.ts";

export interface HistogramProps {
  readonly bins: HistogramBinData;
  readonly xProjector: Projector;
  readonly yProjector: Projector;
  readonly mode?: "probability" | "density";
  readonly quantityId?: string;
  readonly comparisonData?: readonly number[];
  readonly comparisonLabel?: string;
  readonly fillColor?: string;
  readonly strokeColor?: string;
  readonly showOverflow?: boolean;
}

export function Histogram({
  bins,
  xProjector,
  yProjector,
  mode = "probability",
  quantityId,
  comparisonData,
  comparisonLabel = "Comparison model",
  fillColor = "currentColor",
  strokeColor = "currentColor",
  showOverflow = true,
}: HistogramProps): ReactElement | null {
  const { edges, counts, binProbabilities, overflowCounts } = bins;
  if (!edges || edges.length < 2 || !counts || counts.length !== edges.length - 1) {
    return null;
  }

  const firstEdge = edges[0];
  const secondEdge = edges[1];
  const lastEdge = edges[edges.length - 1];
  if (firstEdge === undefined || secondEdge === undefined || lastEdge === undefined) {
    return null;
  }

  const numBins = edges.length - 1;
  const binWidth = secondEdge - firstEdge;

  const yValues = binProbabilities.map((prob, i) => {
    const eCurrent = edges[i];
    const eNext = edges[i + 1];
    if (mode === "density" && eCurrent !== undefined && eNext !== undefined) {
      const width = Math.max(1e-12, eNext - eCurrent);
      return prob / width;
    }
    return prob;
  });

  const baselineY = yProjector(0);

  return (
    <g
      className={mode === "density" ? "histogram histogram-density" : "histogram histogram-probability"}
      data-quantity-id={quantityId}
      data-histogram-mode={mode}
    >
      {/* Histogram bars */}
      <g className="bins">
        {yValues.map((val, i) => {
          const eCurrent = edges[i];
          const eNext = edges[i + 1];
          if (eCurrent === undefined || eNext === undefined) return null;

          const x0 = xProjector(eCurrent);
          const x1 = xProjector(eNext);
          const yTop = yProjector(val);

          if (
            !Number.isFinite(x0) ||
            !Number.isFinite(x1) ||
            !Number.isFinite(yTop) ||
            !Number.isFinite(baselineY)
          ) {
            return null;
          }

          const left = Math.min(x0, x1);
          const width = Math.abs(x1 - x0);
          const top = Math.min(yTop, baselineY);
          const height = Math.abs(baselineY - yTop);

          const count = counts[i] ?? 0;
          const prob = binProbabilities[i] ?? 0;

          return (
            <rect
              key={`bin-${eCurrent}-${eNext}`}
              className="histogram-bar"
              x={left}
              y={top}
              width={Math.max(0.5, width - 0.5)}
              height={height}
              fill={fillColor}
              fillOpacity={0.4}
              stroke={strokeColor}
              strokeWidth={1}
            >
              <title>{`[${eCurrent}, ${eNext}]: count = ${count}, prob = ${prob.toFixed(4)}`}</title>
            </rect>
          );
        })}
      </g>

      {/* Comparison series (non-color identity: dashed curve with distinct markers) */}
      {comparisonData && comparisonData.length === numBins && (
        <g className="comparison-series" data-comparison-label={comparisonLabel}>
          {/* Comparison line */}
          <path
            d={`M ${comparisonData
              .map((val, i) => {
                const eCurrent = edges[i];
                const eNext = edges[i + 1];
                if (eCurrent === undefined || eNext === undefined) return "";
                const midX = (eCurrent + eNext) / 2;
                const px = xProjector(midX);
                const compY = mode === "density" ? val / Math.max(1e-12, eNext - eCurrent) : val;
                const py = yProjector(compY);
                return `${px.toFixed(2)},${py.toFixed(2)}`;
              })
              .filter(Boolean)
              .join(" L ")}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          {/* Comparison markers */}
          {comparisonData.map((val, i) => {
            const eCurrent = edges[i];
            const eNext = edges[i + 1];
            if (eCurrent === undefined || eNext === undefined) return null;
            const midX = (eCurrent + eNext) / 2;
            const px = xProjector(midX);
            const compY = mode === "density" ? val / Math.max(1e-12, eNext - eCurrent) : val;
            const py = yProjector(compY);
            return (
              <circle
                key={`comp-mark-${eCurrent}`}
                cx={px}
                cy={py}
                r={3}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
      )}

      {/* Overflow indicators */}
      {showOverflow && overflowCounts && (
        <g
          className="overflow-indicators"
          style={{ fontSize: 10 }}
          fill="currentColor"
          opacity={0.8}
        >
          {overflowCounts.underflow > 0 && (
            <text x={xProjector(firstEdge) - 8} y={baselineY - 10} textAnchor="end">
              {`← ${overflowCounts.underflow}`}
            </text>
          )}
          {overflowCounts.overflow > 0 && (
            <text x={xProjector(lastEdge) + 8} y={baselineY - 10} textAnchor="start">
              {`${overflowCounts.overflow} →`}
            </text>
          )}
        </g>
      )}

      {/* Normalization and bin width annotation */}
      <g
        className="histogram-annotation"
        style={{ fontSize: 11 }}
        fill="currentColor"
        opacity={0.75}
      >
        <text x={xProjector(firstEdge)} y={baselineY + 28}>
          {`Bin width Δx = ${binWidth.toPrecision(3)} · Mode: ${mode === "probability" ? "Bin probability" : "Probability density"}`}
        </text>
      </g>
    </g>
  );
}
