import { useId } from "react";
import {
  RAMP,
  rampArea,
  rampDensity,
  STRIP_COUNTS,
  stripSum,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The strips foundation:integration tells the reader to cut (dispatch 421).
 *
 * The lesson had no construction at all, and its mechanism is an instruction to picture something:
 * "Where the density changes from place to place, cut the line into narrow strips. Each strip
 * contributes its height times its width, as if the density were flat across it. Add the strips,
 * then cut them narrower and add again. For a smooth curve the totals settle on one value, and
 * that value is the integral."
 *
 * Its worked example is already countable, so the figure draws that and nothing else: a density
 * rising from 0 to 0.5 per micrometre across 4 micrometres, cut first into four strips and then
 * into eight. Every strip takes the height at its own LEFT edge, which is why the sums fall short
 * of the triangle and why they climb when the strips narrow. The sums come from stripSum(), so the
 * bars drawn and the totals printed are the same arithmetic.
 */

const W = 300,
  H = 168;
const LEFT = 34,
  RIGHT = 280,
  BASE = 124,
  TOP = 26;

const x = (micrometres: number) => LEFT + (micrometres / RAMP.micrometres) * (RIGHT - LEFT);
const y = (density: number) => BASE - (density / RAMP.topDensity) * (BASE - TOP);

export function AddingInStrips({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const area = rampArea();

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="integration"
    >
      <Title id={headingId} className="construction-title">
        The same triangle, cut two ways
      </Title>
      <p>
        A density rising from 0 to {RAMP.topDensity} per micrometre across {RAMP.micrometres} μm.
        Each strip is as tall as the curve at its own left edge, which is why every strip falls
        short and why the shortfall shrinks when the strips do.
      </p>

      {STRIP_COUNTS.map((strips) => {
        const width = RAMP.micrometres / strips;
        const total = stripSum(strips);
        return (
          <svg
            key={strips}
            className="bridge-figure"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`A density rising in a straight line from zero to ${RAMP.topDensity} per micrometre across ${RAMP.micrometres} micrometres, with ${strips} strips drawn under it, each ${width} micrometre wide and as tall as the line at its own left edge. The strips add to ${total}, short of the triangle's area of ${area}, because each one misses the wedge above it.`}
          >
            <text className="bridge-axis-name" x="2" y="14">
              {strips} strips of {width} μm: {total}
            </text>
            {Array.from({ length: strips }, (_, i) => i * width).map((edge) => (
              <rect
                key={edge}
                className="bridge-bar-share"
                x={x(edge)}
                y={y(rampDensity(edge))}
                width={x(width) - x(0)}
                height={BASE - y(rampDensity(edge))}
              />
            ))}
            {Array.from({ length: strips }, (_, i) => i * width).map((edge) => (
              <rect
                key={edge}
                className="bridge-bar-whole"
                x={x(edge)}
                y={y(rampDensity(edge))}
                width={x(width) - x(0)}
                height={BASE - y(rampDensity(edge))}
              />
            ))}
            <line
              className="bridge-line"
              x1={x(0)}
              y1={y(0)}
              x2={x(RAMP.micrometres)}
              y2={y(RAMP.topDensity)}
            />
            <line className="bridge-axis" x1={LEFT} y1={TOP - 8} x2={LEFT} y2={BASE} />
            <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
            {[0, RAMP.micrometres].map((tick) => (
              <text
                key={tick}
                className="bridge-number"
                x={x(tick)}
                y={BASE + 18}
                textAnchor="middle"
              >
                {tick}
              </text>
            ))}
            <text
              className="bridge-number"
              x={LEFT - 6}
              y={y(RAMP.topDensity) + 4}
              textAnchor="end"
            >
              {RAMP.topDensity}
            </text>
            <text className="bridge-axis-name" x={(LEFT + RIGHT) / 2} y={H - 6} textAnchor="middle">
              micrometres
            </text>
          </svg>
        );
      })}

      <p className="fine">
        {STRIP_COUNTS[0]} strips add to {stripSum(STRIP_COUNTS[0] as number)}; {STRIP_COUNTS[1]}{" "}
        strips add to {stripSum(STRIP_COUNTS[1] as number)}. The triangle itself is {area}. Cut
        narrower and the total climbs toward it without ever passing it, and the value it climbs
        toward is the integral.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Both drawings are the same density, rising in a straight line from 0 at the left end to{" "}
          {RAMP.topDensity} per micrometre at the right, across {RAMP.micrometres} micrometres. The
          first is cut into {STRIP_COUNTS[0]} strips of{" "}
          {RAMP.micrometres / (STRIP_COUNTS[0] as number)} micrometre each and the second into{" "}
          {STRIP_COUNTS[1]} strips of {RAMP.micrometres / (STRIP_COUNTS[1] as number)}.
        </p>
        <p>
          Each strip is as tall as the line at its own left edge, so each leaves a wedge uncovered
          above it. The {STRIP_COUNTS[0]} strips add to {stripSum(STRIP_COUNTS[0] as number)} and
          the {STRIP_COUNTS[1]} strips to {stripSum(STRIP_COUNTS[1] as number)}, against the
          triangle's area of {area}. Narrower strips leave smaller wedges, so the totals climb
          toward {area} and never past it. That limit is what the integral names.
        </p>
      </div>
    </section>
  );
}
