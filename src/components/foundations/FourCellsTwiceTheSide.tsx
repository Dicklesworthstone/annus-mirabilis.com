import { useId } from "react";
import { DISPLACEMENTS, meanSquare, rootMeanSquare } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-squaring-square-roots argues for in letters and does not draw
 * (dispatch 409).
 *
 * That lesson is the one bridge whose only visual is a formula. Its two svg elements on the built
 * page are KaTeX's radical strokes in \sqrt{4q}=2\sqrt q, not a figure, which is worth saying
 * because a count of svg elements on that page reports two and means none. A formula is exactly
 * what the no-algebra route's reader came here to get around, so this lesson had the least support
 * of the five rather than the most.
 *
 * A square is the one thing "four times a square is the square of twice the number" can be drawn
 * as. The big square is cut into four cells; each cell is the mean square of the lesson's four
 * displacements, and the whole is the mean square after every displacement is doubled. A reader
 * counts four cells and sees that the outer side is two cell sides: four times the area, twice the
 * side, with no step taken on trust.
 *
 * The drawing is to scale, which is the point: the cell side and the outer side are 66 and 132
 * viewBox units, in the same ratio as the two root mean squares the lesson prints. If someone
 * changed a displacement without changing the geometry, the arithmetic in bridgeFigures.test would
 * move and the drawn ratio would not, so the numbers are read from the module rather than typed.
 */

const W = 300,
  H = 190;
const SIDE = 132,
  CELL = SIDE / 2;
const X0 = (W - SIDE) / 2,
  Y0 = 28;
const BOTTOM = Y0 + SIDE,
  MIDDLE_X = X0 + CELL,
  MIDDLE_Y = Y0 + CELL;

/** Three decimals, the precision the lesson's own worked example prints. */
const round = (value: number) => value.toFixed(3);

export function FourCellsTwiceTheSide({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const single = meanSquare(DISPLACEMENTS);
  const doubled = meanSquare(DISPLACEMENTS.map((d) => d * 2));
  const side = rootMeanSquare(DISPLACEMENTS);
  const outerSide = rootMeanSquare(DISPLACEMENTS.map((d) => d * 2));

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-squaring-square-roots"
    >
      <Title id={headingId} className="construction-title">
        Four times the area, twice the side
      </Title>
      <p>
        Each cell is the mean square of the four displacements, {single}. The big square is the mean
        square after every displacement is doubled, {doubled}. Four cells fit in it, and its side is
        two cell sides.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`A square divided into four equal cells by one vertical and one horizontal line. Each cell is marked ${single} and the bottom left cell is shaded. The whole square is marked as ${doubled}. Along the bottom edge, ticks at the two ends and at the middle show that the outer side, ${round(outerSide)}, is exactly two cell sides of ${round(side)}.`}
      >
        <text className="bridge-number" x={W / 2} y={18} textAnchor="middle">
          side {round(outerSide)}
        </text>

        <rect className="bridge-bar-share" x={X0} y={MIDDLE_Y} width={CELL} height={CELL} />
        <rect className="bridge-bar-whole" x={X0} y={Y0} width={SIDE} height={SIDE} />
        <line className="bridge-tick" x1={MIDDLE_X} y1={Y0} x2={MIDDLE_X} y2={BOTTOM} />
        <line className="bridge-tick" x1={X0} y1={MIDDLE_Y} x2={X0 + SIDE} y2={MIDDLE_Y} />

        {[
          [X0 + CELL / 2, Y0 + CELL / 2],
          [MIDDLE_X + CELL / 2, Y0 + CELL / 2],
          [X0 + CELL / 2, MIDDLE_Y + CELL / 2],
          [MIDDLE_X + CELL / 2, MIDDLE_Y + CELL / 2],
        ].map(([cx, cy]) => (
          <text
            key={`${cx}-${cy}`}
            className="bridge-number"
            x={cx}
            y={(cy ?? 0) + 5}
            textAnchor="middle"
          >
            {single}
          </text>
        ))}

        {[X0, MIDDLE_X, X0 + SIDE].map((x) => (
          <line key={x} className="bridge-tick" x1={x} y1={BOTTOM} x2={x} y2={BOTTOM + 7} />
        ))}
        <text className="bridge-number" x={X0 + CELL / 2} y={BOTTOM + 22} textAnchor="middle">
          {round(side)}
        </text>
        <text className="bridge-number" x={MIDDLE_X + CELL / 2} y={BOTTOM + 22} textAnchor="middle">
          {round(side)}
        </text>
        <text className="bridge-number" x={W / 2} y={H - 4} textAnchor="middle">
          four cells, so {doubled} in all
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The displacements {DISPLACEMENTS.join(", ")} have squares{" "}
          {DISPLACEMENTS.map((d) => d * d).join(", ")}, and their average is {single}. That is one
          cell. Doubling every displacement gives a mean square of {doubled}, which is the whole
          square, and four cells fill it exactly.
        </p>
        <p>
          The cell&rsquo;s side is {round(side)} and the whole square&rsquo;s side is{" "}
          {round(outerSide)}. Four times the area, twice the side: the side did not grow by four,
          because a side is a length and the {doubled} is an area. That is the whole difference
          between a mean square and a root mean square, and it is why waiting four times as long in
          the Brownian paper doubles the typical distance rather than quadrupling it.
        </p>
      </div>
    </section>
  );
}
