import { useId } from "react";
import {
  BIN,
  binDensityPerMetre,
  binDensityPerMicrometre,
  binProbability,
  FLAT_SPANS,
  flatDensity,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The two pictures foundation:distributions argues with and never drew (dispatch 420).
 *
 * The lesson was 3,950 visible characters and its title is a denial: "Density is not probability".
 * A denial is the hardest thing to carry in prose alone, because the reader has to hold both the
 * thing and its negation, and the page gave them nothing to look at.
 *
 * Two panels, each attacking the same claim from a different side, both drawn from numbers the
 * lesson already prints. The first is one bin labelled in two units: the height reads 0.15 per
 * micrometre or 150,000 per metre depending only on the ruler, while the area it encloses is 0.3
 * either way. The second is one unit of probability spread over four micrometres and then over
 * two: the height doubles and the area does not move. Between them they say what the stopping
 * point says, that only the area over an interval is a probability.
 *
 * The two rectangles in the second panel are drawn on one density scale and one length scale, so
 * "twice as tall over half the width" is literally true of the pixels and not only of the caption.
 */

const W = 300;

/** Panel one: a single bin, labelled twice. */
const A_H = 168,
  A_LEFT = 84,
  A_RIGHT = 216,
  A_BASE = 124,
  A_TOP = 54;

/** Panel two: one unit of probability over two spans, on one scale. */
const B_H = 200,
  B_X0 = 40,
  B_PER_MICROMETRE = 48,
  B_PER_DENSITY = 120;
const bx = (micrometres: number) => B_X0 + micrometres * B_PER_MICROMETRE;
const ROWS = [
  { base: 84, span: FLAT_SPANS[0] },
  { base: 174, span: FLAT_SPANS[1] },
] as const;

export function HeightIsNotProbability({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const probability = binProbability();
  const perMicrometre = binDensityPerMicrometre();
  const perMetre = binDensityPerMetre().toLocaleString("en-GB");

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="distributions"
    >
      <Title id={headingId} className="construction-title">
        The height moves, the area does not
      </Title>
      <p>
        One bin, holding {BIN.inBin} of the {BIN.particles} particles. Its height is written twice,
        in two units of length; what it encloses is written once.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${A_H}`}
        role="img"
        aria-label={`A single bar standing on a ${BIN.micrometres} micrometre stretch of ruler, holding ${BIN.inBin} of ${BIN.particles} particles. Its height is labelled both ${perMicrometre} per micrometre and ${perMetre} per metre, the same height under two units of length, and the area it encloses is labelled ${probability} under either.`}
      >
        {/* Two lines, not one: the single sentence ran 324 units wide in a 300-unit viewBox and
            would have been clipped, which the label audit caught. */}
        <text className="bridge-number" x={W / 2} y={24} textAnchor="middle">
          height: {perMicrometre} per μm
        </text>
        <text className="bridge-number" x={W / 2} y={40} textAnchor="middle">
          or {perMetre} per metre
        </text>
        <line className="bridge-tick" x1={A_LEFT - 10} y1={A_TOP} x2={A_RIGHT + 10} y2={A_TOP} />
        <rect
          className="bridge-bar-share"
          x={A_LEFT}
          y={A_TOP}
          width={A_RIGHT - A_LEFT}
          height={A_BASE - A_TOP}
        />
        <rect
          className="bridge-bar-whole"
          x={A_LEFT}
          y={A_TOP}
          width={A_RIGHT - A_LEFT}
          height={A_BASE - A_TOP}
        />
        <text
          className="bridge-axis-name"
          x={(A_LEFT + A_RIGHT) / 2}
          y={A_BASE - 34}
          textAnchor="middle"
        >
          area {probability}
        </text>
        <line className="bridge-axis" x1={20} y1={A_BASE} x2={280} y2={A_BASE} />
        {[A_LEFT, A_RIGHT].map((tick) => (
          <line
            key={tick}
            className="bridge-tick"
            x1={tick}
            y1={A_BASE}
            x2={tick}
            y2={A_BASE + 8}
          />
        ))}
        <text className="bridge-number" x={W / 2} y={A_BASE + 24} textAnchor="middle">
          {BIN.micrometres} μm bin, {BIN.inBin} of {BIN.particles} particles
        </text>
        <text className="bridge-axis-name" x={W / 2} y={A_H - 6} textAnchor="middle">
          along the ruler
        </text>
      </svg>

      <p className="fine">
        Change the ruler from micrometres to metres and the height is multiplied by a million. The
        bin still holds {probability} of the particles. A number that moves when you change the
        ruler was never the probability.
      </p>

      <p>
        The same the other way round: one whole unit of probability, spread over {FLAT_SPANS[0]} μm
        and then squeezed into {FLAT_SPANS[1]}.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${B_H}`}
        role="img"
        aria-label={`Two rectangles drawn on one scale. The upper is ${FLAT_SPANS[0]} micrometres wide and ${flatDensity(FLAT_SPANS[0])} per micrometre tall. The lower is ${FLAT_SPANS[1]} micrometres wide, half as wide, and ${flatDensity(FLAT_SPANS[1])} per micrometre tall, twice as tall. Both enclose an area of 1, so both hold the whole probability.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          chance per micrometre
        </text>
        {ROWS.map((row) => {
          const density = flatDensity(row.span);
          const top = row.base - density * B_PER_DENSITY;
          return (
            <g key={row.span}>
              <rect
                className="bridge-bar-share"
                x={bx(0)}
                y={top}
                width={bx(row.span) - bx(0)}
                height={row.base - top}
              />
              <rect
                className="bridge-bar-whole"
                x={bx(0)}
                y={top}
                width={bx(row.span) - bx(0)}
                height={row.base - top}
              />
              <line className="bridge-axis" x1={bx(0) - 14} y1={row.base} x2={280} y2={row.base} />
              <text className="bridge-number" x={bx(0) + 6} y={top - 6}>
                {density} per μm over {row.span} μm
              </text>
              <text
                className="bridge-axis-name"
                x={(bx(0) + bx(row.span)) / 2}
                y={row.base - 10}
                textAnchor="middle"
              >
                area 1
              </text>
            </g>
          );
        })}
        <text className="bridge-axis-name" x={W / 2} y={B_H - 6} textAnchor="middle">
          micrometres
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first drawing is one {BIN.micrometres} micrometre bin holding {BIN.inBin} of{" "}
          {BIN.particles} particles. Measured per micrometre its height is {perMicrometre}; measured
          per metre the same height is {perMetre}. Nothing about the particles changed between those
          two numbers, only the ruler. The area the bar encloses is {probability} under either, and
          that is the bin's probability.
        </p>
        <p>
          The second drawing is one whole unit of probability twice over. Spread across{" "}
          {FLAT_SPANS[0]} micrometres it stands {flatDensity(FLAT_SPANS[0])} per micrometre tall;
          squeezed into {FLAT_SPANS[1]} it stands {flatDensity(FLAT_SPANS[1])}, exactly twice as
          tall over half the width. The two rectangles enclose the same area, 1, because it is the
          same probability. The height was never the probability; the area always was.
        </p>
      </div>
    </section>
  );
}
