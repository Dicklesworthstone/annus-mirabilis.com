import { useId } from "react";
import { crossings, FLUX_SECONDS, netChange } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The region and its boundary that foundation:flux-continuity is about (dispatch 418).
 *
 * The lesson was 1,909 visible characters with 22 rendered formulas and no picture at all: the
 * shortest lesson on the site that is not a no-algebra bridge, and the reverse of the bridge
 * problem. A bridge was thin because it had prose and nothing else; this one was thin because it
 * had mathematics and nothing else, so a reader who can follow the formulas needed no help and a
 * reader who could not had nowhere to stand. Flux is how much crosses a surface and continuity is
 * what goes in less what goes out, and both are statements about a REGION WITH A BOUNDARY, which
 * was the one thing the page never showed.
 *
 * Its own worked example already had numbers a reader can check by counting, so the figure draws
 * those rather than inventing others: seven in and five out, then five and five. Every particle is
 * a separate dot on purpose. The net is derived in bridgeFigures.ts, never typed, so the drawing
 * cannot show an accumulation the crossings do not give.
 *
 * No new class names: every rule here is one the bridge figures already declare, which is the
 * convention %2's three figures settled on in 944d0357 and the reason the declared-classes ratchet
 * has nothing to say about this file.
 */

const W = 300,
  H = 156;
const LINE = 74;
const BOX_LEFT = 96,
  BOX_RIGHT = 204,
  BOX_TOP = 36,
  BOX_BOTTOM = 118;
const DOT_STEP = 12,
  DOT_R = 4;

function Arrow({
  from,
  to,
  y,
}: {
  readonly from: number;
  readonly to: number;
  readonly y: number;
}) {
  return (
    <g>
      <line className="bridge-arrow" x1={from} y1={y} x2={to - 7} y2={y} />
      <path
        className="bridge-marker"
        d={`M ${to} ${y} L ${to - 9} ${y - 5} L ${to - 9} ${y + 5} Z`}
      />
    </g>
  );
}

/** A row of countable dots ending at `endX`. */
function Dots({
  count,
  endX,
  y,
}: {
  readonly count: number;
  readonly endX: number;
  readonly y: number;
}) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => endX - (count - 1 - i) * DOT_STEP).map((cx) => (
        <circle key={cx} className="bridge-dot-moved" cx={cx} cy={y} r={DOT_R} />
      ))}
    </g>
  );
}

function Second({
  entered,
  left,
  index,
}: {
  readonly entered: number;
  readonly left: number;
  readonly index: number;
}) {
  const net = netChange({ entered, left });
  const crossed = crossings({ entered, left });
  const when = index === 0 ? "In one second" : "In the next second";
  return (
    <svg
      className="bridge-figure"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${when}, ${entered} particles cross the left boundary into a stretch of tube and ${left} cross out through the right boundary. ${crossed} particles crossed a boundary in all, and the stretch ${net === 0 ? "holds no more and no fewer than it did" : `holds ${net} more than it did`}.`}
    >
      <text className="bridge-axis-name" x={BOX_LEFT} y={20}>
        {when}
      </text>

      {/* The stretch, and the two boundaries its particles are counted across. */}
      <rect
        className="bridge-bar-whole"
        x={BOX_LEFT}
        y={BOX_TOP}
        width={BOX_RIGHT - BOX_LEFT}
        height={BOX_BOTTOM - BOX_TOP}
      />
      <line
        className="bridge-step"
        x1={BOX_LEFT}
        y1={BOX_TOP - 8}
        x2={BOX_LEFT}
        y2={BOX_BOTTOM + 8}
      />
      <line
        className="bridge-step"
        x1={BOX_RIGHT}
        y1={BOX_TOP - 8}
        x2={BOX_RIGHT}
        y2={BOX_BOTTOM + 8}
      />

      <Dots count={entered} endX={BOX_LEFT - 22} y={LINE} />
      <Arrow from={BOX_LEFT - 16} to={BOX_LEFT + 10} y={LINE} />
      <text className="bridge-number" x={4} y={LINE - 18}>
        {entered} in
      </text>

      <Arrow from={BOX_RIGHT - 10} to={BOX_RIGHT + 16} y={LINE} />
      <Dots count={left} endX={W - 6} y={LINE} />
      <text className="bridge-number" x={BOX_RIGHT + 18} y={LINE - 18}>
        {left} out
      </text>

      {/* What stayed: derived from the two counts, so the picture cannot overstate it. */}
      <Dots count={Math.max(net, 0)} endX={(BOX_LEFT + BOX_RIGHT) / 2 + 12} y={LINE - 22} />
      <text
        className="bridge-axis-name"
        x={(BOX_LEFT + BOX_RIGHT) / 2}
        y={LINE + 26}
        textAnchor="middle"
      >
        {net > 0 ? `+${net}` : net}
      </text>
      <text className="bridge-number" x={(BOX_LEFT + BOX_RIGHT) / 2} y={H - 8} textAnchor="middle">
        {crossed} crossed
      </text>
    </svg>
  );
}

export function CrossingABoundary({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [first, second] = FLUX_SECONDS as unknown as readonly [
    (typeof FLUX_SECONDS)[number],
    (typeof FLUX_SECONDS)[number],
  ];

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="flux-continuity"
    >
      <Title id={headingId} className="construction-title">
        The stretch, its two boundaries, and what crossed them
      </Title>
      <p>
        The dashed lines are the boundaries and the box between them is the stretch. Every particle
        that crosses is drawn separately, so the counts can be checked by counting.
      </p>

      <Second entered={first.entered} left={first.left} index={0} />
      <p className="fine">
        More arrived than left, so the stretch holds {netChange(first)} more than it did.
      </p>

      <Second entered={second.entered} left={second.left} index={1} />
      <p className="fine">
        {crossings(second)} particles crossed a boundary and the count inside did not move. A steady
        count is not a still one.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          In the first second {first.entered} particles cross the left boundary into the stretch and{" "}
          {first.left} cross out through the right boundary. {crossings(first)} particles crossed a
          boundary in all, and because {first.entered} arrived against {first.left} that left, the
          stretch ends the second holding {netChange(first)} more than it began with.
        </p>
        <p>
          In the second second {second.entered} cross in and {second.left} cross out.{" "}
          {crossings(second)} particles crossed, which is nearly as many as before, and the number
          inside is exactly what it was. What decides whether a region fills or empties is the
          difference between the two crossings, never the size of either one.
        </p>
      </div>
    </section>
  );
}
