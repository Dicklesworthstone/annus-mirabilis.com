import type { ReactElement } from "react";
import type { Projector } from "./types.ts";

export interface EnergyChannel {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly uncertainty?: number;
  readonly quantityId?: string;
  readonly color?: string;
}

export interface EnergyLedgerPlotProps {
  readonly channels: readonly EnergyChannel[];
  readonly yProjector: Projector;
  readonly totalExpected?: number;
  readonly width?: number;
  readonly height?: number;
  readonly unit?: string;
}

/**
 * Visualizes energy / mass-energy channel balances with conservation lines.
 */
export function EnergyLedgerPlot({
  channels,
  yProjector,
  totalExpected,
  width = 500,
  height = 300,
  unit = "J",
}: EnergyLedgerPlotProps): ReactElement {
  const barWidth = Math.max(20, Math.min(60, (width - 100) / Math.max(1, channels.length) - 20));
  const baselineY = yProjector(0);

  const totalActual = channels.reduce((sum, ch) => sum + ch.value, 0);

  return (
    <div className="energy-ledger-plot">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`Energy ledger: total = ${totalActual.toFixed(4)} ${unit}`}
      >
        {/* Baseline */}
        <line
          x1={40}
          y1={baselineY}
          x2={width - 20}
          y2={baselineY}
          stroke="currentColor"
          strokeWidth={1}
        />

        {/* Channels */}
        {channels.map((ch, idx) => {
          const centerX = 60 + idx * (barWidth + 24) + barWidth / 2;
          const yTop = yProjector(ch.value);
          const top = Math.min(yTop, baselineY);
          const barHeight = Math.abs(baselineY - yTop);

          return (
            <g key={`ch-${ch.id}`} className="energy-channel" data-quantity-id={ch.quantityId}>
              <rect
                x={centerX - barWidth / 2}
                y={top}
                width={barWidth}
                height={barHeight}
                fill={ch.color ?? "currentColor"}
                fillOpacity={0.6}
                stroke={ch.color ?? "currentColor"}
                strokeWidth={1}
              >
                <title>{`${ch.label}: ${ch.value.toFixed(4)} ${unit}`}</title>
              </rect>

              {/* Uncertainty bar */}
              {ch.uncertainty !== undefined && ch.uncertainty > 0 && (
                <g className="uncertainty-bar">
                  <line
                    x1={centerX}
                    y1={yProjector(ch.value - ch.uncertainty)}
                    x2={centerX}
                    y2={yProjector(ch.value + ch.uncertainty)}
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                </g>
              )}

              {/* Label */}
              <text
                x={centerX}
                y={baselineY + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
              >
                {ch.label}
              </text>
              <text
                x={centerX}
                y={top - 6}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                fill="currentColor"
              >
                {ch.value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Total expected conservation line */}
        {totalExpected !== undefined && (
          <g className="conservation-line">
            <line
              x1={40}
              y1={yProjector(totalExpected)}
              x2={width - 20}
              y2={yProjector(totalExpected)}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.8}
            />
            <text
              x={width - 24}
              y={yProjector(totalExpected) - 6}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
            >
              {`Expected Total: ${totalExpected.toFixed(2)} ${unit}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
