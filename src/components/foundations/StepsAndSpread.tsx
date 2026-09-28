import { useId } from "react";
import {
  STEP_MARKS,
  STEP_METRES,
  TWO_STEP_ENDS,
  typicalDistance,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * Why four steps is not four metres (dispatch 419).
 *
 * foundation:random-walks was listed in the 45-lesson sweep as having 2 svg, which is why it was
 * third in the queue rather than first. Both turned out to be KaTeX radical glyphs inside its own
 * formulas, 400em wide with a viewBox of 400000 units, so the lesson had no figure at all and the
 * sweep's figure column was counting square-root signs. It is the same correction the flux lesson
 * needed, arrived at by looking at what the count was made of.
 *
 * Two panels for the lesson's two claims. The first draws the four equally likely two-step walks
 * as the lesson lists them, ending 2 m right, at the start, at the start, and 2 m left: the ends
 * cancel and the squares do not. The second draws the square-root growth against the straight line
 * a reader expects, which leaves the frame almost at once and is the whole answer to the lesson's
 * question.
 *
 * Every distance comes from typicalDistance() in bridgeFigures.ts, so the curve and the marks
 * cannot disagree with the rule the lesson states.
 */

const W = 300;

/** Panel one: the four walks on one line. */
const A_H = 168,
  A_MID = 150,
  A_UNIT = 52,
  A_AXIS = 132;
const ax = (metres: number) => A_MID + metres * A_UNIT;
const ROW_Y = [28, 52, 76, 100];

/** Panel two: distance against step count. */
const B_H = 172,
  B_LEFT = 32,
  B_RIGHT = 288,
  B_BASE = 128,
  B_TOP = 24,
  B_STEPS = 16,
  B_METRES = 5;
const bx = (steps: number) => B_LEFT + (steps / B_STEPS) * (B_RIGHT - B_LEFT);
const by = (metres: number) => B_BASE - (metres / B_METRES) * (B_BASE - B_TOP);

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
      <line className="bridge-arrow" x1={from} y1={y} x2={to + head * 5} y2={y} />
      <path
        className="bridge-marker"
        d={`M ${to} ${y} L ${to + head * 7} ${y - 4} L ${to + head * 7} ${y + 4} Z`}
      />
    </g>
  );
}

/** The four two-step walks, as the two coins that produce them. */
const WALKS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export function StepsAndSpread({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const squares = TWO_STEP_ENDS.map((e) => e * e);
  const meanSquare = squares.reduce((a, b) => a + b, 0) / squares.length;
  const curve = Array.from({ length: 129 }, (_, i) => (i / 128) * B_STEPS);
  const straightExit = B_METRES / STEP_METRES;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="random-walks"
    >
      <Title id={headingId} className="construction-title">
        Four steps is not four metres
      </Title>
      <p>
        The four two-step walks the lesson lists, each drawn from the start. Two arrows a walk, and
        a dot where it ends.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${A_H}`}
        role="img"
        aria-label={`Four two-step walks drawn one above another on a line numbered from minus two to plus two metres. The first goes right then right and ends 2 metres right; the second right then left and the third left then right, both ending back at the start; the fourth left then left and ends 2 metres left. The four ends add to zero, and their squares are ${squares.join(", ")}.`}
      >
        {WALKS.map((walk, row) => {
          const y = ROW_Y[row] as number;
          const mid = walk[0] * STEP_METRES;
          const end = mid + walk[1] * STEP_METRES;
          return (
            <g key={`${walk[0]}${walk[1]}`}>
              <Arrow from={ax(0)} to={ax(mid)} y={y} />
              <Arrow from={ax(mid)} to={ax(end)} y={y} />
              <circle className="bridge-dot" cx={ax(end)} cy={y} r="4.5" />
              <text className="bridge-number" x={4} y={y + 4}>
                {end > 0 ? `+${end}` : end} m
              </text>
            </g>
          );
        })}
        <line className="bridge-axis" x1={ax(-2)} y1={A_AXIS} x2={ax(2)} y2={A_AXIS} />
        {[-2, -1, 0, 1, 2].map((m) => (
          <line
            key={m}
            className="bridge-tick"
            x1={ax(m)}
            y1={A_AXIS}
            x2={ax(m)}
            y2={A_AXIS + (m === 0 ? 10 : 5)}
          />
        ))}
        {[-2, 0, 2].map((m) => (
          <text key={m} className="bridge-number" x={ax(m)} y={A_AXIS + 24} textAnchor="middle">
            {m > 0 ? `+${m}` : m}
          </text>
        ))}
        <text className="bridge-axis-name" x={A_MID} y={A_H - 4} textAnchor="middle">
          metres from the start
        </text>
      </svg>

      <p className="fine">
        The four ends add to zero, so the average end is the start. Their squares are{" "}
        {squares.join(", ")}, which add to {squares.reduce((a, b) => a + b, 0)} and average{" "}
        {meanSquare}. Squares do not cancel, and that is the quantity that keeps count.
      </p>

      <p>
        So the typical distance climbs, but slowly. The straight line is what a reader expects
        before reading the lesson: every step in the same direction.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${B_H}`}
        role="img"
        aria-label={`A graph with the number of steps along the bottom from 0 to ${B_STEPS} and metres up the side from 0 to ${B_METRES}. A curve rises steeply at first and then flattens, passing through 1 metre at 1 step, ${typicalDistance(4)} at 4 steps, ${typicalDistance(9)} at 9 and ${typicalDistance(16)} at ${B_STEPS}. A straight line rising one metre per step leaves the top of the graph after ${straightExit} steps.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          metres from the start
        </text>
        {[1, 2, 3, 4, 5].map((m) => (
          <line key={m} className="bridge-grid" x1={B_LEFT} y1={by(m)} x2={B_RIGHT} y2={by(m)} />
        ))}
        {/* What every step in one direction would give: it leaves the frame almost at once. */}
        <line
          className="bridge-step"
          x1={bx(0)}
          y1={by(0)}
          x2={bx(straightExit)}
          y2={by(B_METRES)}
        />
        <text className="bridge-number" x={bx(straightExit) + 6} y={by(B_METRES) + 12}>
          all one way
        </text>
        <polyline
          className="bridge-line"
          points={curve.map((n) => `${bx(n)},${by(typicalDistance(n))}`).join(" ")}
        />
        {STEP_MARKS.map((n) => (
          <circle key={n} className="bridge-dot" cx={bx(n)} cy={by(typicalDistance(n))} r="4" />
        ))}
        {STEP_MARKS.map((n) => (
          <text
            key={n}
            className="bridge-number"
            x={bx(n)}
            y={by(typicalDistance(n)) - 9}
            textAnchor="middle"
          >
            {typicalDistance(n)} m
          </text>
        ))}
        <line className="bridge-axis" x1={B_LEFT} y1={B_TOP - 6} x2={B_LEFT} y2={B_BASE} />
        <line className="bridge-axis" x1={B_LEFT} y1={B_BASE} x2={B_RIGHT} y2={B_BASE} />
        {STEP_MARKS.map((n) => (
          <text key={n} className="bridge-number" x={bx(n)} y={B_BASE + 16} textAnchor="middle">
            {n}
          </text>
        ))}
        <text
          className="bridge-axis-name"
          x={(B_LEFT + B_RIGHT) / 2}
          y={B_H - 4}
          textAnchor="middle"
        >
          steps taken
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first drawing is the four equally likely two-step walks. Right then right ends 2
          metres right; right then left and left then right both end back at the start; left then
          left ends 2 metres left. The four ends add to zero, so the average end is the start, and
          nobody should read that as the walker not having moved. The squares of those ends are{" "}
          {squares.join(", ")}, and their average is {meanSquare} square metres, which is two
          step-squares for two steps.
        </p>
        <p>
          The second drawing is the typical distance against the number of steps. It passes through{" "}
          {typicalDistance(1)} metre at 1 step, {typicalDistance(4)} at 4, {typicalDistance(9)} at 9
          and {typicalDistance(16)} at {B_STEPS}: four times the steps for twice the distance, every
          time. The broken straight line is a walker whose every step went the same way, one metre
          per step, and it leaves the top of the graph after {straightExit} steps. At a hundred
          steps the curve is at {typicalDistance(100)} metres where that line would be at a hundred.
        </p>
      </div>
    </section>
  );
}
