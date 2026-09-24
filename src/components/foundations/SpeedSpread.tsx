"use client";

import { useId, useState } from "react";
import {
  bell,
  FAST_PERCENT,
  PARTICLES,
  type Particle,
  SLOW_PERCENT,
  SPREAD_RATIO,
  TICKS,
} from "../../foundations/speedSpread.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The drawing: the curve over three widths either side. 250 units wide, so that in a 230px phone
 * column the axis labels still come out at about 12px; at 320 units they measured 9.5px.
 */
const W = 250;
const CENTRE = W / 2;
const UNIT = 38;
const BASE = 128;
const HEIGHT = 100;
const x = (u: number) => CENTRE + u * UNIT;
const y = (u: number) => BASE - HEIGHT * bell(u);

/** The curve, or the region under it between two widths, as an SVG path. */
function path(from: number, to: number, closed: boolean): string {
  const points: string[] = [];
  for (let u = from; u <= to + 1e-9; u += 0.05)
    points.push(`${x(u).toFixed(1)},${y(u).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  return closed ? `${line} L${x(to).toFixed(1)},${BASE} L${x(from).toFixed(1)},${BASE} Z` : line;
}

const label = (value: number) => (value < 0 ? `−${-value}` : String(value));

/**
 * The temperature lesson's construction: the spread of speeds along one axis, which temperature
 * fixes, drawn once and labelled for a molecule or for a grain. The facts are printed in
 * src/foundations/speedSpread.ts and recomputed by its test.
 */
export function SpeedSpread({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [id, setId] = useState<Particle["id"]>("nitrogen");
  const particle = PARTICLES.find((p) => p.id === id) as Particle;
  const tick = (u: number) => label(Number((u * particle.spread).toPrecision(3)));

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="temperature-thermal-energy"
    >
      <Title id={headingId} className="construction-title">
        Try it: one spread of speeds, two scales
      </Title>
      <p>
        At any moment, the speeds of particles along one axis are spread in a bell curve. The
        temperature sets its width, and the width depends on the particle's mass. Label the same
        curve for a molecule or for a grain.
      </p>

      <div className="construction-controls">
        <fieldset className="button-group">
          <legend className="fine">Label the axis for</legend>
          {PARTICLES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === id ? undefined : "secondary"}
              aria-pressed={p.id === id}
              onClick={() => setId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="construction-display" role="status">
        <p>
          <strong>
            At 293 K, {particle.name} moves along one axis with a spread of about {particle.spread}{" "}
            {particle.unit}.
          </strong>{" "}
          The curve does not change; only the numbers on its axis do, by a factor of about{" "}
          {String(SPREAD_RATIO).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.
        </p>
      </div>

      <svg
        className="vector-axes-figure"
        viewBox={`0 0 ${W} 172`}
        role="img"
        aria-label={`A bell curve of speed along one axis, centred on zero, with its width marked at ${tick(1)} ${particle.unit}. The middle, under half a width either way, is shaded; the two ends beyond two widths are outlined.`}
      >
        <path className="products-area" d={path(-0.5, 0.5, true)} />
        <path className="curves-overlap" d={path(-3, -2, true)} />
        <path className="curves-overlap" d={path(2, 3, true)} />
        <path className="curves-band-second" d={path(-3, 3, false)} />
        <line className="vector-axis-original" x1={x(-3)} y1={BASE} x2={x(3)} y2={BASE} />
        {TICKS.map((u) => (
          <text key={u} x={x(u)} y={BASE + 18} textAnchor="middle">
            {tick(u)}
          </text>
        ))}
        <text x={CENTRE} y={BASE + 38} textAnchor="middle">
          speed along one axis, {particle.unit}
        </text>
      </svg>

      <p>
        Shaded in the middle, under half a width either way: the particles that have, at that
        moment, less than a quarter of the average energy of motion along the axis, about{" "}
        {SLOW_PERCENT} per cent of them. Outlined at the two ends, beyond two widths: those with
        more than four times the average, about {FAST_PERCENT} per cent. Collisions move each
        particle about the whole curve.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          At 293 kelvin a nitrogen molecule's speed along one axis is spread with a width of about
          295 metres a second, and a half-micrometre grain's with a width of about 2.5 millimetres a
          second. Measured in its own width the spread is the same bell curve for both, with the
          same average energy of motion along the axis, 2.02 × 10⁻²¹ joules. At any moment about 38
          per cent of the particles have less than a quarter of that average and about 5 per cent
          more than four times it. The temperature fixes the spread, not the energy of any one
          particle.
        </p>
      </div>
    </section>
  );
}
