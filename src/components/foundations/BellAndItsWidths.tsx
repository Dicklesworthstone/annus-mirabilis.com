import { useId } from "react";
import { bellHeight, WIDTH_BANDS, withinWidths } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The shape foundation:gaussian-distributions is about (dispatch 420).
 *
 * The lesson was 6,747 visible characters on the shape of a distribution, with five inline svg
 * that were all square-root signs inside its own formulas and no picture of the shape at all. Its
 * first step list is the figure, written out: "Within one width of the start, between minus 1 and
 * plus 1 micrometre, end about 68 per cent of the particles. Within two widths, about 95; within
 * three, about 99.7."
 *
 * The bands are drawn once, on one curve, because they are nested and a reader has to see that the
 * 95 contains the 68. Their percentages come from withinWidths(), which is the erf owner, so this
 * figure and foundSlice.numbers.test.ts are held to one function rather than to two copies of
 * three numbers.
 *
 * Colour carries none of it: each band is separated by a drawn rule at its width, numbered along
 * the axis, and named in the key underneath.
 */

const W = 300,
  H = 180;
const MID = W / 2,
  UNIT = 44,
  BASE = 132,
  PEAK = 34,
  SPAN = 3.2;

const x = (widths: number) => MID + widths * UNIT;
const y = (height: number) => BASE - height * (BASE - PEAK);

/** The filled region of the bell between two widths, closed along the axis. */
function band(from: number, to: number): string {
  const steps = 48;
  const top = Array.from({ length: steps + 1 }, (_, i) => {
    const u = from + ((to - from) * i) / steps;
    return `${x(u)},${y(bellHeight(u))}`;
  });
  return `M ${x(from)},${BASE} L ${top.join(" L ")} L ${x(to)},${BASE} Z`;
}

const CURVE = Array.from({ length: 129 }, (_, i) => -SPAN + (2 * SPAN * i) / 128);

export function BellAndItsWidths({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const percent = (k: number) => Number(withinWidths(k).toPrecision(k === 3 ? 4 : 2));
  const outsideOne = Number((100 - withinWidths(1)).toPrecision(2));

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="gaussian-distributions"
    >
      <Title id={headingId} className="construction-title">
        The bell, and what each width is worth
      </Title>
      <p>
        One curve, with a rule drawn at one, two and three widths either side of the start. The
        bands are nested: the second contains the first.
      </p>

      <svg
        className="bridge-figure bell-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`A bell curve centred on the start, with rules drawn at one, two and three root-mean-square widths either side. The band within one width either way holds about ${percent(1)} per cent of the chance, within two widths about ${percent(2)} per cent, and within three about ${percent(3)} per cent. The curve is the same shape to the left of the start as to the right.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          chance per unit of displacement
        </text>

        <path className="bridge-band-outer" d={band(-3, 3)} />
        <path className="bridge-band-middle" d={band(-2, 2)} />
        <path className="bridge-band-inner" d={band(-1, 1)} />

        <polyline
          className="bridge-line"
          points={CURVE.map((u) => `${x(u)},${y(bellHeight(u))}`).join(" ")}
        />
        <line className="bridge-axis" x1={x(-SPAN)} y1={BASE} x2={x(SPAN)} y2={BASE} />

        {WIDTH_BANDS.flatMap((k) => [-k, k]).map((k) => (
          <line
            key={k}
            className="bridge-tick"
            x1={x(k)}
            y1={y(bellHeight(k))}
            x2={x(k)}
            y2={BASE + 6}
          />
        ))}
        <line className="bridge-tick" x1={MID} y1={BASE} x2={MID} y2={BASE + 10} />
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <text key={k} className="bridge-number" x={x(k)} y={BASE + 22} textAnchor="middle">
            {k > 0 ? `+${k}` : k}
          </text>
        ))}
        <text className="bridge-axis-name" x={MID} y={H - 26} textAnchor="middle">
          widths from the start
        </text>
      </svg>

      <p className="fine">
        One width is the root mean square displacement, √(2Dt). It is a label too long to sit inside
        a drawing, where text does not reflow on a narrow screen.
      </p>

      <ul className="bell-key">
        {WIDTH_BANDS.map((k) => (
          <li key={k}>
            <svg className="bell-swatch" viewBox="0 0 28 18" aria-hidden="true">
              <rect
                className={
                  k === 1
                    ? "bridge-band-inner"
                    : k === 2
                      ? "bridge-band-middle"
                      : "bridge-band-outer"
                }
                x="1"
                y="1"
                width="26"
                height="16"
              />
              <rect className="bridge-bar-whole" x="1" y="1" width="26" height="16" />
            </svg>
            <span>
              Within {k === 1 ? "one width" : k === 2 ? "two widths" : "three widths"} either way,
              between {`−${k}`} and +{k}: about {percent(k)} per cent of the chance.
            </span>
          </li>
        ))}
      </ul>

      <p className="fine">
        So about {outsideOne} per cent, roughly one particle in three, ends more than one width from
        where it started. A width is a typical distance, never a limit.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          A bell curve centred on the start, with a rule drawn at one, two and three widths either
          side. The band within one width either way holds about {percent(1)} per cent of the
          chance; within two widths about {percent(2)} per cent; within three about {percent(3)}.
          The bands are nested, so the {percent(2)} already includes the {percent(1)}, and each
          further width adds less than the one before it.
        </p>
        <p>
          The curve is the same shape to the left of the start as to the right, because the
          displacement enters the formula squared. About {outsideOne} per cent of the chance lies
          outside one width altogether, which is the part a reader most often forgets: the width
          says where particles typically end, and roughly one in three ends farther out than that.
        </p>
      </div>
    </section>
  );
}
