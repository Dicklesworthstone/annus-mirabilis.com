import { useId } from "react";
import {
  exactSquare,
  linearEstimate,
  PRINTED_CORNERS,
  SQUARE_SIDE,
  SQUARE_STEPS,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The square foundation:taylor-expansion tells the reader to picture (dispatch 421).
 *
 * Its first sentence is the instruction: "What is 2.1 squared, without a calculator? Start from
 * what you know: 2 squared is 4. Picture a square 2 wide growing to 2.1 wide. It gains two strips,
 * each 2 long and 0.1 thick, which add 0.4, and a small corner, 0.1 by 0.1, which adds 0.01." The
 * page drew none of it; its construction is a table of relativistic partial sums, a different
 * subject in the same lesson.
 *
 * The first panel is that square, DRAWN TO SCALE. The strips really are a twentieth of the side
 * and the corner really is a four-hundredth of the area, because the whole argument is that the
 * corner is negligible and a figure that exaggerated it would argue the opposite.
 *
 * The second panel is the lesson's worked example, the same square at each step it lists, all
 * three at one scale, so that the corner growing as the square of the step is something a reader
 * sees rather than something the caption asserts.
 */

const A_W = 300,
  A_H = 236;
const A_UNIT = 78,
  A_X = 56,
  A_BOTTOM = 212;
const STEP = SQUARE_STEPS[0] as number;
const SIDE = SQUARE_SIDE * A_UNIT;
const GROWN = (SQUARE_SIDE + STEP) * A_UNIT;

const B_W = 300,
  B_H = 176,
  B_UNIT = 26,
  B_BOTTOM = 132,
  B_GAP = 16;

export function SquareAndItsCorner({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const strips = 2 * SQUARE_SIDE * STEP;
  const corner = PRINTED_CORNERS[0] as number;
  const exact = exactSquare(STEP);

  let cursor = 12;
  const panels = SQUARE_STEPS.map((step) => {
    const grown = (SQUARE_SIDE + step) * B_UNIT;
    const left = cursor;
    cursor += grown + B_GAP;
    return { step, grown, left };
  });

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="taylor-expansion"
    >
      <Title id={headingId} className="construction-title">
        The square, its two strips and its corner
      </Title>
      <p>
        A square {SQUARE_SIDE} wide grown to {SQUARE_SIDE + STEP}, drawn to scale. The strips are a
        twentieth of the side and the corner is what the straight-line estimate throws away.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${A_W} ${A_H}`}
        role="img"
        aria-label={`A square of side ${SQUARE_SIDE}, area ${SQUARE_SIDE * SQUARE_SIDE}, with a thin strip added along its right edge and another along its top, each ${SQUARE_SIDE} long and ${STEP} thick, and a small square corner where the two strips meet. The two strips together add ${strips} and the corner adds ${corner}, making ${exact}. The corner is drawn at its true size, a four-hundredth of the whole.`}
      >
        <rect className="bridge-bar-share" x={A_X} y={A_BOTTOM - SIDE} width={SIDE} height={SIDE} />
        <rect className="bridge-bar-whole" x={A_X} y={A_BOTTOM - SIDE} width={SIDE} height={SIDE} />
        <text
          className="bridge-axis-name"
          x={A_X + SIDE / 2}
          y={A_BOTTOM - SIDE / 2 + 5}
          textAnchor="middle"
        >
          {SQUARE_SIDE * SQUARE_SIDE}
        </text>

        {/* The two strips, at true thickness. */}
        <rect
          className="bridge-band-inner"
          x={A_X + SIDE}
          y={A_BOTTOM - SIDE}
          width={GROWN - SIDE}
          height={SIDE}
        />
        <rect
          className="bridge-band-inner"
          x={A_X}
          y={A_BOTTOM - GROWN}
          width={SIDE}
          height={GROWN - SIDE}
        />
        {/* The corner, the term the estimate drops. */}
        <rect
          className="bridge-bar"
          x={A_X + SIDE}
          y={A_BOTTOM - GROWN}
          width={GROWN - SIDE}
          height={GROWN - SIDE}
        />
        <rect
          className="bridge-bar-whole"
          x={A_X}
          y={A_BOTTOM - GROWN}
          width={GROWN}
          height={GROWN}
        />

        {/* Leaders, because a strip a twentieth of the side has no room for a label inside it. */}
        {/* The leader runs to the right margin and the label is right-aligned there: set to the
            left of the margin it ran to 331 in a 300-unit box, which the label audit caught. */}
        <line
          className="bridge-tick"
          x1={A_X + GROWN}
          y1={A_BOTTOM - GROWN + 4}
          x2={A_W - 8}
          y2={A_BOTTOM - GROWN - 10}
        />
        <text className="bridge-number" x={A_W - 6} y={A_BOTTOM - GROWN - 14} textAnchor="end">
          corner {corner}
        </text>
        <text className="bridge-number" x={A_X} y={A_BOTTOM - GROWN - 12}>
          two strips add {strips}
        </text>
        <text className="bridge-number" x={A_X} y={A_BOTTOM + 20}>
          side {SQUARE_SIDE} grown to {SQUARE_SIDE + STEP}: area {exact}
        </text>
      </svg>

      <p className="fine">
        Keeping the square and the strips gives {linearEstimate(STEP)}, which is the straight-line
        estimate. The whole grown square is {exact}. The difference is the corner, {corner}, and it
        did about a fiftieth of the work the strips did.
      </p>

      <p>
        Now the same square at each step the lesson lists, all three at one scale. The corner grows
        as the square of the step, so it catches up quickly.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${B_W} ${B_H}`}
        role="img"
        aria-label={`Three grown squares side by side at one scale, for steps of ${SQUARE_STEPS.join(", ")}. In the first the dropped corner is a speck; in the second it is clearly visible; in the third it is a quarter of the whole square. The dropped amounts are ${PRINTED_CORNERS.join(", ")}.`}
      >
        {panels.map(({ step, grown, left }, i) => {
          const base = SQUARE_SIDE * B_UNIT;
          return (
            <g key={step}>
              <rect
                className="bridge-bar-share"
                x={left}
                y={B_BOTTOM - base}
                width={base}
                height={base}
              />
              <rect
                className="bridge-bar"
                x={left + base}
                y={B_BOTTOM - grown}
                width={grown - base}
                height={grown - base}
              />
              <rect
                className="bridge-bar-whole"
                x={left}
                y={B_BOTTOM - grown}
                width={grown}
                height={grown}
              />
              <text
                className="bridge-number"
                x={left + grown / 2}
                y={B_BOTTOM + 18}
                textAnchor="middle"
              >
                +{step}
              </text>
              <text
                className="bridge-number"
                x={left + grown / 2}
                y={B_BOTTOM + 34}
                textAnchor="middle"
              >
                {PRINTED_CORNERS[i]}
              </text>
            </g>
          );
        })}
        <text className="bridge-axis-name" x={12} y={B_H - 6}>
          step added, and the corner it drops
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first drawing is a square of side {SQUARE_SIDE} and area {SQUARE_SIDE * SQUARE_SIDE},
          grown to {SQUARE_SIDE + STEP}. It gains a strip along its right edge and another along its
          top, each {SQUARE_SIDE} long and {STEP} thick, which together add {strips}, and a small
          square corner of {STEP} by {STEP}, which adds {corner}. Together that is {exact}.
          Everything is at its true size, so the corner really is the speck it looks like: a
          four-hundredth of the area.
        </p>
        <p>
          The second drawing is the same square grown by {SQUARE_STEPS.join(", ")} in turn, all at
          one scale. The dropped corners are {PRINTED_CORNERS.join(", ")}. At the smallest step the
          corner is a speck and the straight-line estimate is almost the whole answer; at a step of{" "}
          {SQUARE_STEPS[2]} the corner is a quarter of the square and the estimate has stopped being
          useful. Halving the step quarters the corner, because the corner is the step squared.
        </p>
        <p>
          What it does not show: squaring is the case where the series stops of its own accord. A
          square has one corner and nothing after it, so keeping the value, the strips and the
          corner is not an approximation at all, it is the whole answer. For a curve that is not a
          square there are further terms behind the corner, each smaller than the last near the
          point and each growing faster away from it, and nothing here draws them.
        </p>
      </div>
    </section>
  );
}
