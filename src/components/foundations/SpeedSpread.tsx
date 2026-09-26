"use client";

import { useId, useState } from "react";
import {
  FAST_PERCENT,
  PARTICLES,
  type Particle,
  SLOW_PERCENT,
  SPREAD_RATIO,
} from "../../foundations/speedSpread.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import {
  axisTicks,
  BASE,
  CENTRE,
  curvePath,
  DRAWN_WIDTHS,
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  multiple,
  NUMBER_Y,
  regionPath,
  TICK_LENGTH,
  TITLE_Y,
  tailOutline,
  x,
} from "./speedSpreadLayout.ts";

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
  const ticks = axisTicks(particle.spread);
  const at = (u: number) => multiple(u, particle.spread);

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
        className="vector-axes-figure speed-spread-figure"
        viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}
        role="img"
        aria-label={`A bell curve of speed along one axis, centred on zero, with its width marked at ${at(1)} ${particle.unit}. The middle, under half a width either way, is shaded; the two ends beyond two widths are outlined.`}
      >
        <path className="speed-spread-middle" d={regionPath(-0.5, 0.5)} />
        <path className="speed-spread-tail" d={regionPath(-DRAWN_WIDTHS, -2)} />
        <path className="speed-spread-tail" d={regionPath(2, DRAWN_WIDTHS)} />
        <path className="curves-band-second" d={curvePath(-DRAWN_WIDTHS, DRAWN_WIDTHS)} />
        <path className="speed-spread-tail-edge" d={tailOutline(-1)} />
        <path className="speed-spread-tail-edge" d={tailOutline(1)} />
        <line
          className="speed-spread-axis"
          x1={x(-DRAWN_WIDTHS)}
          y1={BASE}
          x2={x(DRAWN_WIDTHS)}
          y2={BASE}
        />
        {ticks.map((t) => (
          <line
            key={t.u}
            className="speed-spread-tick"
            data-tick={t.u}
            x1={t.x}
            y1={BASE}
            x2={t.x}
            y2={BASE + TICK_LENGTH}
          />
        ))}
        {ticks.map((t) => (
          <text key={t.u} x={t.x} y={NUMBER_Y} textAnchor="middle">
            {t.label}
          </text>
        ))}
        <text x={CENTRE} y={TITLE_Y} textAnchor="middle">
          speed along one axis, {particle.unit}
        </text>
      </svg>

      <ul className="speed-spread-key">
        <li>
          <svg className="speed-spread-swatch" viewBox="0 0 28 18" aria-hidden="true">
            <rect className="speed-spread-middle" x="1" y="1" width="26" height="16" />
          </svg>
          <span>
            Shaded in the middle, within half a width either way ({at(-0.5)} to {at(0.5)}{" "}
            {particle.unit}): the particles that have, at that moment, less than a quarter of the
            average energy of motion along the axis, about {SLOW_PERCENT} per cent of them.
          </span>
        </li>
        <li>
          <svg className="speed-spread-swatch" viewBox="0 0 28 18" aria-hidden="true">
            <rect className="speed-spread-tail" x="1.5" y="1.5" width="25" height="15" />
            <rect className="speed-spread-tail-edge" x="1.5" y="1.5" width="25" height="15" />
          </svg>
          <span>
            Outlined at the two ends, beyond two widths (past {at(-2)} or {at(2)} {particle.unit}):
            those with more than four times the average, about {FAST_PERCENT} per cent.
          </span>
        </li>
      </ul>
      <p>Collisions move each particle about the whole curve.</p>

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
