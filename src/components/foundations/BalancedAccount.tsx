import { useId } from "react";
import { ACCOUNT } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-equals-sign-relationship names and does not show (dispatch 409).
 *
 * The lesson says an equals sign states a balance "like the two sides of a balanced account", and
 * then writes one: 100 = 70 + 30. Two bars at one scale are that sentence drawn, and they make the
 * claim checkable by looking rather than by trusting the addition, because the second row is built
 * from two separate lengths and still ends exactly where the first does.
 *
 * One vertical cuts both bars at 70. The stretch to the right of it is the 30 the light carried
 * away when read on the lower bar, and it is what is left of the 100 when read on the upper one.
 * That is the lesson's rearrangement, 100 - 70 = 30, as one segment rather than as a second sum:
 * nothing moved, and the line is read from either side.
 *
 * The distinctions are drawn twice over, as the other bridge figures are: the boundary at 70 is a
 * solid rule and the shared right-hand end is a broken one, because the first is a division of the
 * account and the second is a comparison the reader makes.
 */

const W = 300,
  H = 128;
const LEFT = 24,
  RIGHT = 252;
const BAR_H = 18;
const TOP_Y = 26,
  LOWER_Y = 80;
const scale = (units: number) => LEFT + ((RIGHT - LEFT) * units) / ACCOUNT.before;

export function BalancedAccount({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const split = scale(ACCOUNT.kept);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-equals-sign-relationship"
    >
      <Title id={headingId} className="construction-title">
        The two sides of the account, drawn at one scale
      </Title>
      <p>
        The upper bar is the energy the body started with. The lower bar is the same length, built
        from two pieces: what it kept, and what the light carried away.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Two horizontal bars at the same scale, one above the other. The upper bar is a single length of ${ACCOUNT.before} units. The lower bar is the same total length, cut at ${ACCOUNT.kept} units into a piece marked kept and a piece marked sent out as light of ${ACCOUNT.sent} units. A solid line cuts both bars at ${ACCOUNT.kept} and a broken line marks the right-hand end, where both bars finish.`}
      >
        <text className="bridge-number" x={LEFT} y={18}>
          Before
        </text>
        <rect
          className="bridge-bar"
          x={LEFT}
          y={TOP_Y}
          width={RIGHT - LEFT}
          height={BAR_H}
          rx={2}
        />
        <text className="bridge-number" x={RIGHT + 6} y={TOP_Y + 13}>
          {ACCOUNT.before}
        </text>
        <text
          className="bridge-number"
          x={(split + RIGHT) / 2}
          y={TOP_Y + BAR_H + 16}
          textAnchor="middle"
        >
          {ACCOUNT.before} &minus; {ACCOUNT.kept}
        </text>

        <text className="bridge-number" x={LEFT} y={72}>
          After
        </text>
        <rect
          className="bridge-bar"
          x={LEFT}
          y={LOWER_Y}
          width={split - LEFT}
          height={BAR_H}
          rx={2}
        />
        <rect
          className="bridge-bar-share"
          x={split}
          y={LOWER_Y}
          width={RIGHT - split}
          height={BAR_H}
        />
        <rect
          className="bridge-bar-whole"
          x={split}
          y={LOWER_Y}
          width={RIGHT - split}
          height={BAR_H}
        />
        <text
          className="bridge-number"
          x={(LEFT + split) / 2}
          y={LOWER_Y + BAR_H + 16}
          textAnchor="middle"
        >
          {ACCOUNT.kept} kept
        </text>
        <text
          className="bridge-number"
          x={(split + RIGHT) / 2}
          y={LOWER_Y + BAR_H + 16}
          textAnchor="middle"
        >
          {ACCOUNT.sent} sent
        </text>

        <line
          className="bridge-tick"
          x1={split}
          y1={TOP_Y - 6}
          x2={split}
          y2={LOWER_Y + BAR_H + 4}
        />
        <line
          className="bridge-step"
          x1={RIGHT}
          y1={TOP_Y - 6}
          x2={RIGHT}
          y2={LOWER_Y + BAR_H + 4}
        />
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Both bars run from the same starting edge to the same finishing edge, so both stand for{" "}
          {ACCOUNT.before} units. The lower one is cut at {ACCOUNT.kept}, leaving a stretch of{" "}
          {ACCOUNT.sent} beside it. Read on the lower bar that stretch is the energy sent out; read
          on the upper bar it is what is left of the {ACCOUNT.before} after {ACCOUNT.kept} is set
          aside. One length, two readings, which is why {ACCOUNT.before} = {ACCOUNT.kept} +{" "}
          {ACCOUNT.sent} and {ACCOUNT.before} &minus; {ACCOUNT.kept} = {ACCOUNT.sent} say the same
          thing.
        </p>
        <p>
          Nothing in the drawing says which piece to work out first, and there is no step in it that
          has to be done in an order. That is the difference between a statement and an instruction.
        </p>
      </div>
    </section>
  );
}
