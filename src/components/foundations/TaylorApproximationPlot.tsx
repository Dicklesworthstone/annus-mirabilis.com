import type { TaylorComparison } from "../../foundations/taylorApproximation.ts";
import { exponentialSpoken } from "../../units/scientific.ts";
import { SciSvg } from "../lab/Sci.tsx";

/** A projection of one accepted comparison; no series or remainder is evaluated here. */
export function TaylorApproximationPlot({
  comparison,
}: {
  readonly comparison: TaylorComparison;
}) {
  const { curve, count } = comparison;
  const left = 104;
  const right = 396;
  const top = 36;
  const bottom = 160;
  const x = (speed: number) => left + (speed / curve.speedLimit) * (right - left);
  const y = (value: number) => bottom - (value / curve.valueLimit) * (bottom - top);
  const path = (full: boolean) =>
    curve.points
      .map((point) => `${x(point.speed)},${y(full ? point.exact : point.approximation)}`)
      .join(" L ");
  const range = exponentialSpoken(curve.speedLimit);
  const description =
    `Gamma minus one and its ${count}-term approximation, from rest to ${range} times light speed. ` +
    "The solid curve is the full expression and the broken curve is the retained sum. " +
    "Both begin at zero. The retained sum lies below the full expression at nonzero speed. " +
    "The dot marks the accepted approximation. The table below gives the positive remainder " +
    "even when the two curves are too close to distinguish.";
  return (
    <div data-taylor-plot>
      <svg
        className="bridge-figure"
        viewBox="0 0 420 220"
        role="img"
        aria-label={description}
      >
        <text className="bridge-axis-name" x={left} y={16}>
          full expression and retained sum
        </text>
        <line className="bridge-axis" x1={left} y1={top} x2={left} y2={bottom} />
        <line className="bridge-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              className="bridge-axis"
              x1={left - 4}
              y1={y(curve.valueLimit * fraction)}
              x2={left}
              y2={y(curve.valueLimit * fraction)}
            />
            <text
              className="bridge-number"
              x={left - 8}
              y={y(curve.valueLimit * fraction) + 4}
              textAnchor="end"
            >
              <SciSvg value={curve.valueLimit * fraction} digits={3} />
            </text>
          </g>
        ))}
        <path className="bridge-line" data-taylor-curve="full" d={`M ${path(true)}`} />
        <path className="bridge-step" data-taylor-curve="partial" d={`M ${path(false)}`} />
        <circle
          className="bridge-dot"
          data-taylor-accepted-point
          cx={x(comparison.speed)}
          cy={y(comparison.selected.sum)}
          r={4}
        />
        <text className="bridge-number" x={left} y={182} textAnchor="middle">
          0
        </text>
        <text className="bridge-number" x={right} y={182} textAnchor="end">
          <SciSvg value={curve.speedLimit} />
        </text>
        <text className="bridge-axis-name" x={(left + right) / 2} y={211} textAnchor="middle">
          speed divided by light speed
        </text>
      </svg>
      <p className="fine">
        Solid: full γ − 1. Broken: {count} retained {count === 1 ? "term" : "terms"}.
        The dot marks the accepted speed and partial sum. The scales follow the accepted speed;
        the table below keeps the small remainder readable when the curves overlap.
        {comparison.speed === 0 ? (
          <> At rest the drawing keeps the 0 to 0.6c reference range, with the dot at the origin.</>
        ) : null}
      </p>
    </div>
  );
}
