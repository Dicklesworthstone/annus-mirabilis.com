"use client";

import { useId, useState } from "react";
import {
  EXPONENT_CHOICES,
  PLANE_HALF_WIDTH,
  type Point,
  SPREAD_CHOICES,
  twoCurves,
} from "../../foundations/twoCurves.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** The drawing: about one viewBox unit to the pixel, the plane centred on the true pair. */
const SIZE = 320;
const CENTRE = SIZE / 2;
const SCALE = (SIZE / 2 - 20) / PLANE_HALF_WIDTH;
const L = PLANE_HALF_WIDTH;

const px = (p: Point) =>
  `${(CENTRE + p.x * SCALE).toFixed(1)},${(CENTRE - p.y * SCALE).toFixed(1)}`;
const polygon = (points: readonly Point[]) => points.map(px).join(" ");

/** A band y = −k·x ± s across the whole plane, as four corners. */
function band(k: number, s: number): readonly Point[] {
  return [
    { x: -L, y: k * L + s },
    { x: L, y: -k * L + s },
    { x: L, y: -k * L - s },
    { x: -L, y: k * L - s },
  ];
}

const percent = (fraction: number) => `${Math.round(fraction * 100)} per cent`;
const factor = (value: number) => value.toFixed(2);

/**
 * The two-measurements lesson's construction. The plane, the bands and the overlap come from
 * src/foundations/twoCurves.ts; this component only draws them. The bands differ by line style,
 * dashed for diffusion and solid for the second measurement, and the overlap is outlined heavily,
 * so colour never carries the difference alone.
 */
export function TwoCurves({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [second, setSecond] = useState(true);
  const [exponent, setExponent] = useState<number>(EXPONENT_CHOICES[0]);
  const [spread, setSpread] = useState<number>(SPREAD_CHOICES[1]);
  const outcome = twoCurves({ second, exponent, spread });

  const described =
    outcome.status === "region"
      ? `Two bands cross near the true pair. The radius lies between ${factor(outcome.radiusFactor.low)} and ${factor(outcome.radiusFactor.high)} times the true radius, and N between ${factor(outcome.numberFactor.low)} and ${factor(outcome.numberFactor.high)} times the true N.`
      : second
        ? "Two parallel bands lie on top of each other, so they fix no single radius."
        : "One band crosses the plane from upper left to lower right, and every point on it fits the measurement.";

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="two-measurements-two-unknowns"
    >
      <Title id={headingId} className="construction-title">
        Try it: where two measurements cross
      </Title>
      <p>
        The plane holds every pair of a radius and a molecular number, each drawn as a multiple of
        the true value, on scales where equal steps mean equal factors. Diffusion fixes N·a, a band
        of slope −1. A second measurement that fixes a<sup>k</sup>·N is a band of slope −k; the
        viscosity measurement of the dissertation has k = 3. Both are drawn centred on the true
        pair, as if each measurement had landed on it, and as wide as its stated spread.
      </p>

      <div className="construction-controls">
        <div className="button-group">
          <button
            type="button"
            className={second ? "secondary" : undefined}
            aria-pressed={!second}
            onClick={() => setSecond(false)}
          >
            Diffusion only
          </button>
          <button
            type="button"
            className={second ? undefined : "secondary"}
            aria-pressed={second}
            onClick={() => setSecond(true)}
          >
            Add a second measurement
          </button>
        </div>
        <fieldset className="button-group" disabled={!second}>
          <legend className="fine">How steep the second band is</legend>
          {EXPONENT_CHOICES.map((k) => (
            <button
              key={k}
              type="button"
              className={k === exponent ? undefined : "secondary"}
              aria-pressed={k === exponent}
              onClick={() => setExponent(k)}
            >
              k = {k}
            </button>
          ))}
        </fieldset>
        <fieldset className="button-group">
          <legend className="fine">How wide each band is</legend>
          {SPREAD_CHOICES.map((s) => (
            <button
              key={s}
              type="button"
              className={s === spread ? undefined : "secondary"}
              aria-pressed={s === spread}
              onClick={() => setSpread(s)}
            >
              ±{Math.round(s * 100)}%
            </button>
          ))}
        </fieldset>
      </div>

      <div className="construction-display" role="status">
        {outcome.status === "region" ? (
          <p>
            <strong>
              The radius lies between {factor(outcome.radiusFactor.low)} and{" "}
              {factor(outcome.radiusFactor.high)} times the true radius, and N between{" "}
              {factor(outcome.numberFactor.low)} and {factor(outcome.numberFactor.high)} times the
              true N.
            </strong>{" "}
            {outcome.clipped ? "Part of the overlap runs beyond the drawing. " : ""}
            That is the overlap of the two stated spreads, not a probability.
          </p>
        ) : outcome.status === "curve" ? (
          <p>
            <strong>The radius is not fixed.</strong>{" "}
            {second
              ? "With k = 1 the second measurement fixes N·a again, so the bands coincide and every radius along them fits both."
              : "Every radius along the band fits, each with its own N. Measuring D more carefully narrows the band and leaves it just as long."}
          </p>
        ) : (
          <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      <svg
        className="vector-axes-figure"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={described}
      >
        <line className="vector-axis-original" x1={0} y1={CENTRE} x2={SIZE} y2={CENTRE} />
        <line className="vector-axis-original" x1={CENTRE} y1={0} x2={CENTRE} y2={SIZE} />
        <polygon className="products-area" points={polygon(band(1, spread))} />
        {second && (
          <polygon className="curves-band-second" points={polygon(band(exponent, spread))} />
        )}
        <circle className="curves-truth" cx={CENTRE} cy={CENTRE} r={4} />
        {outcome.status === "region" && (
          <polygon className="curves-overlap" points={polygon(outcome.corners)} />
        )}
        <text x={SIZE - 4} y={CENTRE - 6} textAnchor="end">
          radius ÷ true radius
        </text>
        <text x={CENTRE + 6} y={14}>
          N ÷ true N
        </text>
        <text x={CENTRE + Math.log(1.25) * SCALE} y={CENTRE + 16} textAnchor="middle">
          1.25
        </text>
        <text x={CENTRE - Math.log(1.25) * SCALE} y={CENTRE + 16} textAnchor="middle">
          0.8
        </text>
      </svg>

      <p>
        The dissertation's own inversion, from a measured diffusion coefficient and a solution's
        viscosity, runs in the{" "}
        <a href="/lab/avogadro-lab/">molecular-dimensions companion preview</a>, with the viscosity
        coefficient as printed in 1906 or as corrected in 1911.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          With diffusion alone, the pairs that fit form a band running the whole width of the plane:
          a smaller radius with a larger N fits exactly as well. A second measurement of a different
          combination is a band at a different slope, and the two cross in a small region around the
          true pair. The more the slopes differ, the smaller that region: at k = 3 and a spread of{" "}
          {percent(SPREAD_CHOICES[1])} on each, the radius is fixed to within about 5 per cent. As k
          comes down towards 1 the bands turn parallel and the region stretches along them, because
          a small error in either measurement moves the crossing a long way. At k = 1 both
          measurements fix the same product and the radius is not fixed at all.
        </p>
      </div>
    </section>
  );
}
