import { useId } from "react";
import {
  DIP_AT,
  PEAK_AT,
  profileCurvature,
  profileHeight,
  SPREAD,
  spreadAfter,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The shape foundation:diffusion-equation describes and never drew (dispatch 419).
 *
 * The lesson was 2,991 visible characters with 46 rendered formulas and no picture, and its own
 * prose is a drawing in words: "If the dye is thicker on both sides than at the spot itself, a
 * dip, dye drifts in from both sides and the spot fills. If the spot is a peak, thicker than its
 * neighbours, dye leaves. The right-hand side is D times the curvature, which is positive at a dip
 * and negative at a peak." One profile carries both cases, so both are drawn on one curve with the
 * arrows the sentences describe.
 *
 * The second panel is the lesson's worked example: the same dye later, wider and lower. Its widths
 * come from spreadAfter(), which takes the square root of D times t, so the figure cannot show a
 * spreading that disagrees with the rule the lesson states.
 *
 * No new class names, and no formula: the lesson has 46 and needed none of them drawn.
 */

const W = 300;
const LEFT = 24,
  RIGHT = 288,
  BASE = 124,
  SCALE = 52;

const at = (fraction: number) => LEFT + fraction * (RIGHT - LEFT);
const height = (fraction: number) => BASE - profileHeight(fraction) * SCALE;

const PROFILE = Array.from({ length: 61 }, (_, i) => i / 60);

function Arrow({
  from,
  to,
  y,
}: {
  readonly from: number;
  readonly to: number;
  readonly y: number;
}) {
  const head = to > from ? -1 : 1;
  return (
    <g>
      <line className="bridge-arrow" x1={from} y1={y} x2={to + head * 6} y2={y} />
      <path
        className="bridge-marker"
        d={`M ${to} ${y} L ${to + head * 8} ${y - 4.5} L ${to + head * 8} ${y + 4.5} Z`}
      />
    </g>
  );
}

/** A bell of the given width, drawn so that the two panels hold the same amount of dye. */
function bell(widths: number, spanMillimetres: number): string {
  const points = Array.from({ length: 81 }, (_, i) => {
    const mm = -spanMillimetres / 2 + (i / 80) * spanMillimetres;
    const y = Math.exp(-(mm * mm) / (2 * widths * widths)) / widths;
    return `${LEFT + ((mm + spanMillimetres / 2) / spanMillimetres) * (RIGHT - LEFT)},${BASE - y * 44}`;
  });
  return `M ${points.join(" L ")}`;
}

export function PeakAndDip({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const later = spreadAfter(1, 4);
  const denser = spreadAfter(2, 1);
  const span = 8 * SPREAD.millimetres;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="diffusion-equation"
    >
      <Title id={headingId} className="construction-title">
        A peak empties, a dip fills
      </Title>
      <p>
        One profile of dye along the tube, thicker where the curve is higher. The arrows are what
        the rule does next at the two spots the lesson names.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} 178`}
        role="img"
        aria-label="A wavy profile of dye along a tube, with one peak at a quarter of the way along and one dip at three quarters. At the peak two arrows point away from it, one to each side, because dye leaves a spot that is thicker than its neighbours. At the dip two arrows point inward towards it, because dye arrives from both sides."
      >
        <text className="bridge-axis-name" x="2" y="14">
          how thick the dye is
        </text>
        <path
          className="bridge-line"
          d={`M ${PROFILE.map((f) => `${at(f)},${height(f)}`).join(" L ")}`}
        />
        <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />

        {/* The peak: thicker than its neighbours, so dye leaves both ways. */}
        <Arrow from={at(PEAK_AT) - 6} to={at(PEAK_AT) - 40} y={height(PEAK_AT) - 14} />
        <Arrow from={at(PEAK_AT) + 6} to={at(PEAK_AT) + 40} y={height(PEAK_AT) - 14} />
        <circle className="bridge-dot" cx={at(PEAK_AT)} cy={height(PEAK_AT)} r="4.5" />
        <text
          className="bridge-number"
          x={at(PEAK_AT)}
          y={height(PEAK_AT) - 22}
          textAnchor="middle"
        >
          it empties
        </text>

        {/* The dip: thinner than its neighbours, so dye arrives from both sides. */}
        <Arrow from={at(DIP_AT) - 46} to={at(DIP_AT) - 10} y={height(DIP_AT) - 12} />
        <Arrow from={at(DIP_AT) + 46} to={at(DIP_AT) + 10} y={height(DIP_AT) - 12} />
        <circle className="bridge-dot" cx={at(DIP_AT)} cy={height(DIP_AT)} r="4.5" />
        <text className="bridge-number" x={at(DIP_AT)} y={height(DIP_AT) + 20} textAnchor="middle">
          it fills
        </text>

        <text className="bridge-number" x={at(PEAK_AT)} y={BASE + 16} textAnchor="middle">
          peak
        </text>
        <text className="bridge-number" x={at(DIP_AT)} y={BASE + 16} textAnchor="middle">
          dip
        </text>
        <text className="bridge-axis-name" x={(LEFT + RIGHT) / 2} y={172} textAnchor="middle">
          along the tube
        </text>
      </svg>

      <p className="fine">
        The curvature is {profileCurvature(PEAK_AT) < 0 ? "negative" : "positive"} at the peak and{" "}
        {profileCurvature(DIP_AT) > 0 ? "positive" : "negative"} at the dip. That is the whole of
        the sign in the rule: dye runs from thick to thin, and the two spots are one rule seen from
        two sides.
      </p>

      <p>
        Later the same dye is wider and lower. The lesson's example: a typical distance of{" "}
        {SPREAD.millimetres} mm after {SPREAD.minutes} minute.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} 166`}
        role="img"
        aria-label={`Two bell-shaped profiles of the same dye drawn over one another. The taller, narrower one is the dye after one minute, with a typical distance of ${SPREAD.millimetres} millimetre. The lower, wider one is the same dye after four times as long, with a typical distance of ${later} millimetres. The wider curve is half as tall, because the same dye is spread over twice the distance.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          how thick the dye is
        </text>
        <path className="bridge-line" d={bell(SPREAD.millimetres, span)} />
        <path className="bridge-step" d={bell(later, span)} />
        <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
        <text className="bridge-number" x={(LEFT + RIGHT) / 2} y={44} textAnchor="middle">
          after {SPREAD.minutes} minute: {SPREAD.millimetres} mm
        </text>
        <text className="bridge-number" x={(LEFT + RIGHT) / 2} y={BASE - 6} textAnchor="middle">
          after 4 minutes: {later} mm
        </text>
        <text className="bridge-axis-name" x={(LEFT + RIGHT) / 2} y={160} textAnchor="middle">
          along the tube
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first drawing is one profile of dye with a peak a quarter of the way along the tube
          and a dip three quarters of the way along. At the peak the dye is thicker than on either
          side, so it leaves in both directions and the spot empties; at the dip it is thinner than
          on either side, so it arrives from both directions and the spot fills. Nothing in the
          picture treats the two spots differently: the same rule, that dye runs from thick to thin,
          empties one and fills the other.
        </p>
        <p>
          The second drawing is the same dye at two times. After {SPREAD.minutes} minute its typical
          distance from the start is {SPREAD.millimetres} mm; after four times as long it is {later}{" "}
          mm, twice as far, because the mean square grows with the time and the distance is its
          square root. Doubling the diffusion coefficient instead of the time would give about{" "}
          {denser.toFixed(1)} mm, the square root of two rather than of four.
        </p>
      </div>
    </section>
  );
}
