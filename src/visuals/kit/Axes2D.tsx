import type { ReactElement } from "react";
import type { TickMark } from "./coordinates.ts";
import type { LogAxisDensityKind } from "./types.ts";

export interface AxisProps {
  readonly orientation: "horizontal" | "vertical";
  readonly start: number;
  readonly end: number;
  readonly crossPosition: number;
  readonly ticks: readonly TickMark[];
  readonly label?: string | undefined;
  readonly quantityId?: string | undefined;
  readonly unit?: string | undefined;
  readonly densityKind?: LogAxisDensityKind | undefined;
  readonly showGrid?: boolean | undefined;
  readonly gridCrossEnd?: number | undefined;
}

export function Axis({
  orientation,
  start,
  end,
  crossPosition,
  ticks,
  label,
  quantityId,
  unit,
  densityKind,
  showGrid,
  gridCrossEnd,
}: AxisProps): ReactElement {
  const isHoriz = orientation === "horizontal";
  const axisClass = isHoriz ? "axis axis-horizontal" : "axis axis-vertical";

  const fullLabel = [
    label,
    densityKind ? `(${densityKind})` : undefined,
    unit ? `[${unit}]` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <g className={axisClass} data-quantity-id={quantityId}>
      {/* Main baseline */}
      {isHoriz ? (
        <line x1={start} y1={crossPosition} x2={end} y2={crossPosition} stroke="currentColor" />
      ) : (
        <line x1={crossPosition} y1={start} x2={crossPosition} y2={end} stroke="currentColor" />
      )}

      {/* Grid lines */}
      {showGrid && gridCrossEnd !== undefined && (
        <g className="grid-lines" opacity={0.15}>
          {ticks.map((t) =>
            isHoriz ? (
              <line
                key={`grid-${t.value}`}
                x1={t.position}
                y1={crossPosition}
                x2={t.position}
                y2={gridCrossEnd}
                stroke="currentColor"
                strokeDasharray="2 2"
              />
            ) : (
              <line
                key={`grid-${t.value}`}
                x1={crossPosition}
                y1={t.position}
                x2={gridCrossEnd}
                y2={t.position}
                stroke="currentColor"
                strokeDasharray="2 2"
              />
            ),
          )}
        </g>
      )}

      {/* Ticks and labels */}
      {ticks.map((t) => (
        <g key={`tick-${t.value}`} className="tick">
          {isHoriz ? (
            <>
              <line
                x1={t.position}
                y1={crossPosition}
                x2={t.position}
                y2={crossPosition + 6}
                stroke="currentColor"
              />
              <text
                x={t.position}
                y={crossPosition + 18}
                textAnchor="middle"
                fontSize={11}
                fill="currentColor"
              >
                {t.label}
              </text>
            </>
          ) : (
            <>
              <line
                x1={crossPosition - 6}
                y1={t.position}
                x2={crossPosition}
                y2={t.position}
                stroke="currentColor"
              />
              <text
                x={crossPosition - 10}
                y={t.position + 4}
                textAnchor="end"
                fontSize={11}
                fill="currentColor"
              >
                {t.label}
              </text>
            </>
          )}
        </g>
      ))}

      {/* Axis title / label */}
      {fullLabel &&
        (isHoriz ? (
          <text
            x={(start + end) / 2}
            y={crossPosition + 36}
            textAnchor="middle"
            fontSize={12}
            fontWeight="500"
            fill="currentColor"
            data-quantity-id={quantityId}
          >
            {fullLabel}
          </text>
        ) : (
          <text
            x={crossPosition - 40}
            y={(start + end) / 2}
            textAnchor="middle"
            fontSize={12}
            fontWeight="500"
            fill="currentColor"
            transform={`rotate(-90 ${crossPosition - 40} ${(start + end) / 2})`}
            data-quantity-id={quantityId}
          >
            {fullLabel}
          </text>
        ))}
    </g>
  );
}

export interface Axes2DProps {
  readonly xStart: number;
  readonly xEnd: number;
  readonly yStart: number;
  readonly yEnd: number;
  readonly xTicks: readonly TickMark[];
  readonly yTicks: readonly TickMark[];
  readonly xLabel?: string | undefined;
  readonly yLabel?: string | undefined;
  readonly xQuantityId?: string | undefined;
  readonly yQuantityId?: string | undefined;
  readonly xUnit?: string | undefined;
  readonly yUnit?: string | undefined;
  readonly yDensityKind?: LogAxisDensityKind | undefined;
  readonly showGrid?: boolean | undefined;
}

export function Axes2D({
  xStart,
  xEnd,
  yStart,
  yEnd,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  xQuantityId,
  yQuantityId,
  xUnit,
  yUnit,
  yDensityKind,
  showGrid = true,
}: Axes2DProps): ReactElement {
  return (
    <g className="axes-2d">
      <Axis
        orientation="horizontal"
        start={xStart}
        end={xEnd}
        crossPosition={yEnd}
        ticks={xTicks}
        label={xLabel}
        quantityId={xQuantityId}
        unit={xUnit}
        showGrid={showGrid}
        gridCrossEnd={yStart}
      />
      <Axis
        orientation="vertical"
        start={yEnd}
        end={yStart}
        crossPosition={xStart}
        ticks={yTicks}
        label={yLabel}
        quantityId={yQuantityId}
        unit={yUnit}
        densityKind={yDensityKind}
        showGrid={showGrid}
        gridCrossEnd={xEnd}
      />
    </g>
  );
}
