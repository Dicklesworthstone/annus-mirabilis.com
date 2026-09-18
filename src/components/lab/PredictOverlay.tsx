"use client";

import type { SketchPoint } from "../../experiments/predict/predictSketch.ts";
import type { PredictionChoice } from "../../experiments/predict/predictState.ts";
import "./predict.css";

export interface PredictOverlayProps {
  readonly choice: PredictionChoice | null;
  readonly resultPoints?: readonly SketchPoint[];
  readonly resultLabel?: string;
  readonly xRange?: readonly [number, number];
  readonly yRange?: readonly [number, number];
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly onClear?: () => void;
  readonly width?: number;
  readonly height?: number;
}

/**
 * PredictOverlay (am-inst-predict-mode-ti7m):
 * Visually distinguishes the reader's prediction from the computed model result
 * WITHOUT relying on color alone:
 * - Prediction: DASHED line pattern (---), SQUARE markers (■), labeled legend.
 * - Result: SOLID line pattern (───), ROUND markers (●), labeled legend.
 * - Screen-reader accessible figure description and table.
 * - Both remain until the reader clears them via `onClear`.
 */
export function PredictOverlay({
  choice,
  resultPoints = [],
  resultLabel = "Model result",
  xRange = [0, 1],
  yRange = [0, 1],
  xLabel = "x",
  yLabel = "y",
  onClear,
  width = 500,
  height = 300,
}: PredictOverlayProps) {
  if (!choice && resultPoints.length === 0) {
    return null;
  }

  const padding = 40;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const toSvgX = (x: number) => padding + ((x - xMin) / xSpan) * plotWidth;
  const toSvgY = (y: number) => height - padding - ((y - yMin) / ySpan) * plotHeight;

  // Render prediction points if sketch or values
  let predPoints: readonly SketchPoint[] = [];
  let predDescription = "";

  if (choice) {
    if (choice.form === "sketch") {
      predPoints = choice.points;
      predDescription = `Freehand sketch with ${choice.points.length} points`;
    } else if (choice.form === "values") {
      predPoints = choice.targets.map((t, idx) => [
        xMin + (idx / Math.max(1, choice.targets.length - 1)) * xSpan,
        t.value,
      ]);
      predDescription = `Target values: ${choice.targets.map((t) => `${t.targetId}=${t.value}`).join(", ")}`;
    } else if (choice.form === "candidate") {
      predDescription = `Candidate: ${choice.candidateId}`;
    } else if (choice.form === "verbal") {
      predDescription = `Verbal: direction ${choice.directionId}, shape ${choice.shapeId}`;
    }
  }

  const predPathD =
    predPoints.length > 1
      ? predPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${toSvgX(x)} ${toSvgY(y)}`).join(" ")
      : "";

  const resultPathD =
    resultPoints.length > 1
      ? resultPoints
          .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${toSvgX(x)} ${toSvgY(y)}`)
          .join(" ")
      : "";

  return (
    <figure
      className="predict-overlay"
      data-predict-overlay=""
      aria-label="Prediction and model result comparison"
    >
      <div className="predict-overlay-header">
        <h4 className="predict-overlay-title">Prediction & Result Comparison</h4>
        {onClear ? (
          <button
            type="button"
            className="secondary predict-overlay-clear"
            onClick={onClear}
            aria-label="Clear prediction and model overlay"
          >
            Clear comparison
          </button>
        ) : null}
      </div>

      <div className="predict-overlay-legend" data-predict-legend="">
        <div
          className="legend-item legend-prediction"
          data-legend-predict=""
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <span
            aria-hidden="true"
            className="symbol-prediction"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          >
            <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
              <line
                x1="0"
                y1="6"
                x2="24"
                y2="6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />
              <rect x="9" y="3" width="6" height="6" fill="currentColor" />
            </svg>
            [■ - - -]
          </span>
          <span className="legend-label">
            <strong>Your prediction</strong>
            {predDescription ? ` (${predDescription})` : ""}
          </span>
        </div>

        <div
          className="legend-item legend-result"
          data-legend-result=""
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <span
            aria-hidden="true"
            className="symbol-result"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          >
            <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
              <line x1="0" y1="6" x2="24" y2="6" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="12" cy="6" r="3.5" fill="currentColor" />
            </svg>
            [● ───]
          </span>
          <span className="legend-label">
            <strong>{resultLabel}</strong>
          </span>
        </div>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="predict-overlay-svg"
        role="img"
        aria-label={`Overlay plot comparing your prediction (${predDescription || "none"}) with the ${resultLabel}. Prediction uses dashed lines and square markers; model uses solid lines and round markers.`}
      >
        {/* Axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Axis Labels */}
        <text x={width / 2} y={height - 10} textAnchor="middle" fontSize="12" fill="currentColor">
          {xLabel}
        </text>
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill="currentColor"
          transform={`rotate(-90 15 ${height / 2})`}
        >
          {yLabel}
        </text>

        {/* Model Result Path (SOLID + ROUND MARKERS) */}
        {resultPathD ? (
          <path
            d={resultPathD}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            data-overlay-curve="result"
          />
        ) : null}
        {resultPoints.map(([rx, ry]) => (
          <circle
            key={`res-pt-${rx}-${ry}`}
            cx={toSvgX(rx)}
            cy={toSvgY(ry)}
            r="4"
            fill="currentColor"
            data-overlay-marker="result-round"
          />
        ))}

        {/* Prediction Path (DASHED + SQUARE MARKERS) */}
        {predPathD ? (
          <path
            d={predPathD}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            data-overlay-curve="prediction"
          />
        ) : null}
        {predPoints.map(([px, py]) => (
          <rect
            key={`pred-pt-${px}-${py}`}
            x={toSvgX(px) - 4}
            y={toSvgY(py) - 4}
            width="8"
            height="8"
            fill="currentColor"
            data-overlay-marker="prediction-square"
          />
        ))}
      </svg>

      <figcaption className="sr-only">
        Comparison showing prediction ({predDescription}) versus {resultLabel}. Distinguished by
        pattern: prediction is dashed with square markers; result is solid with circular markers.
      </figcaption>
    </figure>
  );
}
