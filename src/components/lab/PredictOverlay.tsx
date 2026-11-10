"use client";

import { useId } from "react";
import type { SketchPoint } from "../../experiments/predict/predictSketch.ts";
import type { PredictionChoice } from "../../experiments/predict/predictState.ts";
import "./predict.css";

export interface PredictOverlayProps {
  readonly choice: PredictionChoice | null;
  readonly predictionLabel?: string;
  readonly valueTargets?: readonly Readonly<{ targetId: string; label: string; x: number }>[];
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
 * Compare a recorded prediction with supplied samples from an accepted result. This view never
 * evaluates a model or invents positions for named targets: their x coordinates must be authored.
 * Dashed lines and squares distinguish predictions from the result's solid lines and circles.
 * The disclosure preserves the original prediction values and exact accepted samples as text.
 */
export function PredictOverlay({
  choice,
  predictionLabel = "Your prediction",
  valueTargets = [],
  resultPoints = [],
  resultLabel = "Model result",
  xRange = [0, 1],
  yRange = [0, 1],
  xLabel = "x",
  yLabel = "y",
  onClear,
  width = 340,
  height = 260,
}: PredictOverlayProps) {
  const clipId = useId();
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
  const inPlot = (x: number, y: number) => x >= xMin && x <= xMax && y >= yMin && y <= yMax;

  // Point numbers identify positions in the original recorded sequence, including duplicates.
  let predictionRows: readonly Readonly<{
    id: string;
    label: string;
    x: number | undefined;
    y: number;
  }>[] = [];
  let predDescription = "";

  if (choice) {
    if (choice.form === "sketch") {
      predictionRows = choice.points.map(([x, y], index) => ({
        id: `point-${index}`,
        label: `Point ${index + 1}`,
        x,
        y,
      }));
      predDescription = `Freehand sketch with ${choice.points.length} points`;
    } else if (choice.form === "values") {
      predictionRows = choice.targets.map((target) => {
        const authored = valueTargets.find((entry) => entry.targetId === target.targetId);
        return {
          id: target.targetId,
          label: authored?.label ?? target.targetId,
          x: authored?.x,
          y: target.value,
        };
      });
      predDescription = `Target values: ${predictionRows.map(({ label, y }) => `${label}=${y}`).join(", ")}`;
    } else if (choice.form === "candidate") {
      predDescription = `Candidate: ${choice.candidateId}`;
    } else if (choice.form === "verbal") {
      predDescription = `Verbal: direction ${choice.directionId}, shape ${choice.shapeId}`;
    }
  }

  const predPoints = predictionRows.flatMap(({ id, x, y }) =>
    x === undefined ? [] : [{ id, x, y }],
  );
  if (choice?.form === "values") predPoints.sort((left, right) => left.x - right.x);
  const resultSamples = resultPoints.map((point, index) => ({
    id: `sample-${index}`,
    index,
    point,
  }));

  // Select existing rows, never interpolated values, and retain both accepted endpoints.
  const resultRowCount = Math.min(resultPoints.length, 17);
  const resultRows = Array.from({ length: resultRowCount }, (_, row) => {
    const index =
      resultRowCount < 2 ? 0 : Math.round((row * (resultPoints.length - 1)) / (resultRowCount - 1));
    return { index, point: resultPoints[index] };
  });
  const missingCoordinates = predictionRows.some(({ x }) => x === undefined);

  const predPathD =
    predPoints.length > 1
      ? predPoints
          .map(({ x, y }, i) => `${i === 0 ? "M" : "L"} ${toSvgX(x)} ${toSvgY(y)}`)
          .join(" ")
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
        <h4 className="predict-overlay-title">Prediction and result comparison</h4>
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
            <strong>{predictionLabel}</strong>
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
        aria-label={`Overlay plot comparing ${predictionLabel} (${predDescription || "none"}) with ${resultLabel}. Prediction uses dashed lines and square markers; model uses solid lines and round markers. The values are also available in the table below.`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={padding} y={padding} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>
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
          x={padding}
          y={height - padding + 14}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
        >
          {xMin}
        </text>
        <text
          x={width - padding}
          y={height - padding + 14}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
        >
          {xMax}
        </text>
        <text
          x={padding - 6}
          y={height - padding}
          textAnchor="end"
          fontSize="10"
          fill="currentColor"
        >
          {yMin}
        </text>
        <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize="10" fill="currentColor">
          {yMax}
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

        <g clipPath={`url(#${clipId})`}>
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
          {resultSamples.map(({ id, point: [rx, ry] }) => (
            <circle
              key={id}
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
          {predPoints.map(({ id, x: px, y: py }) => (
            <rect
              key={id}
              x={toSvgX(px) - 4}
              y={toSvgY(py) - 4}
              width="8"
              height="8"
              fill="currentColor"
              data-overlay-marker="prediction-square"
            />
          ))}
        </g>
      </svg>

      <figcaption className="sr-only">
        Comparison showing prediction ({predDescription}) versus {resultLabel}. Distinguished by
        pattern: prediction is dashed with square markers; result is solid with circular markers.
      </figcaption>

      {missingCoordinates && (
        <p className="fine">
          Some prediction targets have no authored x coordinate. Their stated values are kept in the
          table; no plot position is assigned to them.
        </p>
      )}
      <details>
        <summary>Read prediction and result values</summary>
        <p className="fine">
          The tables preserve the supplied values. Lines in the plot connect supplied points.
        </p>
        {predictionRows.length > 0 ? (
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers need to scroll this table's off-screen columns.
            tabIndex={0}
            aria-label={`${predictionLabel} values`}
          >
            <table data-overlay-table="prediction">
              <caption>{predictionLabel}: all original points and values</caption>
              <thead>
                <tr>
                  <th scope="col">Point or target</th>
                  <th scope="col">{xLabel}</th>
                  <th scope="col">{yLabel}</th>
                  <th scope="col">Plot window</th>
                </tr>
              </thead>
              <tbody>
                {predictionRows.map(({ id, label, x, y }) => (
                  <tr key={id}>
                    <th scope="row">{label}</th>
                    <td>{x ?? "No authored x coordinate"}</td>
                    <td>{y}</td>
                    <td>{x === undefined ? "Not placed" : inPlot(x, y) ? "Inside" : "Outside"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : choice ? (
          <p>
            {predictionLabel}: {predDescription}
          </p>
        ) : (
          <p>No prediction was recorded.</p>
        )}
        {resultPoints.length > 0 ? (
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers need to scroll this table's off-screen columns.
            tabIndex={0}
            aria-label={`${resultLabel} values`}
          >
            <table data-overlay-table="result">
              <caption>
                {resultLabel}:{" "}
                {resultRows.length < resultPoints.length
                  ? `${resultRows.length} of ${resultPoints.length} accepted samples, evenly spaced by sample index and including both endpoints`
                  : `all ${resultPoints.length} accepted samples`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Sample</th>
                  <th scope="col">{xLabel}</th>
                  <th scope="col">{yLabel}</th>
                  <th scope="col">Plot window</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map(({ index, point }) =>
                  point ? (
                    <tr key={`result-row-${index}`} data-sample-index={index}>
                      <th scope="row">{index + 1}</th>
                      <td>{point[0]}</td>
                      <td>{point[1]}</td>
                      <td>{inPlot(point[0], point[1]) ? "Inside" : "Outside"}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </section>
        ) : (
          <p>No accepted result samples are available.</p>
        )}
      </details>
    </figure>
  );
}
