import { useId } from "react";
import {
  BALL,
  ballPosition,
  INSTANT_SPEED,
  NUDGES,
  PRINTED_POSITIONS,
  PRINTED_SPEEDS,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The curve foundation:derivatives talks about and never drew (dispatch 437).
 *
 * The lesson says "shorten the interval and watch what happens", lists the averages 9, 6.3, 6.03
 * and 6.003 m/s, and then says in as many words: "On a graph of position against time, the
 * derivative at a point is the steepness of the curve there." Its construction is a numeric
 * readout and renders no svg at all, so the one thing the sentence points at was missing.
 *
 * The first panel is that graph: the ball's curve, the chord over a whole second, and the tangent
 * at the instant. The second is the part the first cannot show, because at intervals below a tenth
 * of a second every chord lies on the tangent at any scale that fits a page: the four averages
 * plotted against the interval they were taken over, settling onto 6.
 *
 * Every number is the lesson's own, and the printed values are declared in bridgeFigures.ts rather
 * than formatted here, because the average over a tenth of a second is 6.300000000000008 in double
 * precision.
 */

const A_W = 300,
  A_H = 194,
  A_LEFT = 38,
  A_RIGHT = 288,
  A_BASE = 152,
  A_TOP = 24,
  A_SECONDS = 2.2,
  A_METRES = 15;

const ax = (seconds: number) => A_LEFT + (seconds / A_SECONDS) * (A_RIGHT - A_LEFT);
const ay = (metres: number) => A_BASE - (metres / A_METRES) * (A_BASE - A_TOP);
const CURVE = Array.from({ length: 89 }, (_, i) => (i / 88) * A_SECONDS);

/** A straight line of the given slope through the point the lesson asks about. */
function through(slope: number, from: number, to: number): string {
  const at = (t: number) =>
    `${ax(t)},${ay(ballPosition(BALL.atSeconds) + slope * (t - BALL.atSeconds))}`;
  return `M ${at(from)} L ${at(to)}`;
}

const B_W = 300,
  B_H = 176,
  B_BASE = 130,
  B_LOW = 5.8,
  B_HIGH = 9.4,
  B_TOP = 30;
const COLUMNS = [70, 130, 190, 250];
const by = (speed: number) => B_BASE - ((speed - B_LOW) / (B_HIGH - B_LOW)) * (B_BASE - B_TOP);

export function SecantsToATangent({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const widest = NUDGES[0] as number;
  const widestSlope = PRINTED_SPEEDS[0] as number;
  const secondSlope = PRINTED_SPEEDS[1] as number;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="derivatives"
    >
      <Title id={headingId} className="construction-title">
        The chord, and what it settles onto
      </Title>
      <p>
        The ball's position against time, with the chord over a whole second and the tangent at{" "}
        {BALL.atSeconds} second drawn through the same point.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${A_W} ${A_H}`}
        role="img"
        aria-label={`A curve of position against time, rising more and more steeply. A point is marked at ${BALL.atSeconds} second, ${ballPosition(BALL.atSeconds)} metres. A broken straight line through it reaches the curve again a second later at ${PRINTED_POSITIONS[0]} metres, a slope of ${widestSlope} metres per second. A solid straight line through the same point, less steep, is the tangent, a slope of ${INSTANT_SPEED}. Between them lies the chord over a tenth of a second, too close to the tangent to be told apart at this size.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          metres gone
        </text>
        {[5, 10, 15].map((m) => (
          <g key={m}>
            <line className="bridge-grid" x1={A_LEFT} y1={ay(m)} x2={A_RIGHT} y2={ay(m)} />
            <text className="bridge-number" x={A_LEFT - 5} y={ay(m) + 4} textAnchor="end">
              {m}
            </text>
          </g>
        ))}
        <polyline
          className="bridge-line"
          points={CURVE.map((t) => `${ax(t)},${ay(ballPosition(t))}`).join(" ")}
        />
        {/* The chord over a whole second, and the tangent it is closing onto. */}
        <path className="bridge-step" d={through(widestSlope, 0.55, 2.1)} />
        <path className="bridge-arrow" d={through(INSTANT_SPEED, 0.55, 2.1)} />
        <circle
          className="bridge-dot"
          cx={ax(BALL.atSeconds)}
          cy={ay(ballPosition(BALL.atSeconds))}
          r="4.5"
        />
        <circle
          className="bridge-dot-still"
          cx={ax(BALL.atSeconds + widest)}
          cy={ay(PRINTED_POSITIONS[0] as number)}
          r="4.5"
        />
        <text className="bridge-number" x={ax(2.1) + 4} y={ay(3 + widestSlope * 1.1) + 4}>
          {widestSlope}
        </text>
        <text className="bridge-number" x={ax(2.1) + 4} y={ay(3 + INSTANT_SPEED * 1.1) + 4}>
          {INSTANT_SPEED}
        </text>
        <line className="bridge-axis" x1={A_LEFT} y1={A_TOP - 6} x2={A_LEFT} y2={A_BASE} />
        <line className="bridge-axis" x1={A_LEFT} y1={A_BASE} x2={A_RIGHT} y2={A_BASE} />
        {[1, 2].map((t) => (
          <text key={t} className="bridge-number" x={ax(t)} y={A_BASE + 18} textAnchor="middle">
            {t}
          </text>
        ))}
        <text
          className="bridge-axis-name"
          x={(A_LEFT + A_RIGHT) / 2}
          y={A_H - 6}
          textAnchor="middle"
        >
          seconds
        </text>
      </svg>

      <p className="fine">
        The broken chord climbs {widestSlope} metres a second; the tangent climbs {INSTANT_SPEED}.
        The chord over a tenth of a second climbs {secondSlope}, which at this size is already the
        tangent: no drawing that fits a page can separate them.
      </p>

      <p>
        So the settling is plotted instead, one point for each interval the lesson averages over.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${B_W} ${B_H}`}
        role="img"
        aria-label={`Four points plotted against the interval they were averaged over, ${NUDGES.join(", ")} of a second. Their average speeds are ${PRINTED_SPEEDS.join(", ")} metres per second. The first sits well above a line drawn at ${INSTANT_SPEED}; the other three lie on it at this size.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          average speed, metres per second
        </text>
        <line
          className="bridge-grid"
          x1={40}
          y1={by(INSTANT_SPEED)}
          x2={288}
          y2={by(INSTANT_SPEED)}
        />
        <text className="bridge-number" x={288} y={by(INSTANT_SPEED) - 6} textAnchor="end">
          {INSTANT_SPEED} at the instant
        </text>
        {COLUMNS.map((cx, i) => (
          <circle
            key={cx}
            className="bridge-dot"
            cx={cx}
            cy={by(PRINTED_SPEEDS[i] as number)}
            r="4.5"
          />
        ))}
        <line className="bridge-axis" x1={40} y1={B_TOP - 6} x2={40} y2={B_BASE + 6} />
        {COLUMNS.map((cx, i) => (
          <text key={cx} className="bridge-number" x={cx} y={B_BASE + 26} textAnchor="middle">
            {NUDGES[i]}
          </text>
        ))}
        {COLUMNS.map((cx, i) => (
          <text key={cx} className="bridge-number" x={cx} y={B_BASE + 44} textAnchor="middle">
            {PRINTED_SPEEDS[i]}
          </text>
        ))}
        <text className="bridge-axis-name" x={40} y={B_H - 4}>
          interval averaged over, seconds
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first drawing is the ball's position against time, a curve rising more and more
          steeply. A point is marked at {BALL.atSeconds} second, {ballPosition(BALL.atSeconds)}{" "}
          metres. The broken line through it meets the curve again a second later, at{" "}
          {PRINTED_POSITIONS[0]} metres, so it climbs {widestSlope} metres a second. The solid line
          through the same point is less steep and climbs {INSTANT_SPEED}: that is the tangent, and
          its steepness is the speed at the instant.
        </p>
        <p>
          The second drawing plots the four averages against the interval each was taken over:{" "}
          {PRINTED_SPEEDS.join(", ")} metres per second for intervals of {NUDGES.join(", ")} of a
          second. The first point sits well above the line at {INSTANT_SPEED} and the other three
          lie on it. The interval is never set to zero; it only shrinks, and the averages settle.
        </p>
        <p>
          What it does not show: the averages settle here because this curve is smooth at this
          instant. A curve with a corner would give one answer from the left and another from the
          right, and no tangent to draw, and nothing in either drawing rules that out. The lesson's
          worked example is what shows why these particular averages settle, by cancelling the 3Δt
          that the shrinking interval leaves behind.
        </p>
      </div>
    </section>
  );
}
