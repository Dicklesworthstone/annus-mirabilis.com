import { useId } from "react";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-negative-numbers-direction asks for (dispatch 401).
 *
 * The lesson opens "Put the starting point at zero on a ruler", and then drew no ruler. It is the
 * lesson a reader reaches before the Brownian displacement arithmetic, so the one thing it has to
 * make plain is that a total of zero is not the same as nothing having moved. Two journeys are
 * drawn above one ruler: two walkers who end three units either side of the start, and one walker
 * who goes out and comes back. Both add to zero, and in both every arrow has a length.
 *
 * Direction is carried by the arrowheads and by the labels, not by colour, so the figure survives
 * a reader who cannot tell the two strokes apart.
 */

const W = 300,
  H = 190;
const MID = W / 2,
  UNIT = 30,
  SPAN = 4;
const AXIS = 134;
const x = (units: number) => MID + units * UNIT;

/** A horizontal arrow on one band, with its head at the far end. */
function Arrow({
  from,
  to,
  y,
  dashed = false,
}: {
  readonly from: number;
  readonly to: number;
  readonly y: number;
  readonly dashed?: boolean;
}) {
  const head = to > from ? -1 : 1;
  return (
    <g>
      <line
        className={dashed ? "bridge-step" : "bridge-arrow"}
        x1={x(from)}
        y1={y}
        x2={x(to) + head * 7}
        y2={y}
      />
      <path
        className="bridge-marker"
        d={`M ${x(to)} ${y} L ${x(to) + head * 9} ${y - 5} L ${x(to) + head * 9} ${y + 5} Z`}
      />
    </g>
  );
}

export function SignedRuler({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-negative-numbers-direction"
    >
      <Title id={headingId} className="construction-title">
        The ruler, with both journeys on it
      </Title>
      <p>
        Zero is where each journey starts. Every arrow has a length, and the arrowhead says which
        way it went.
      </p>

      <svg
        className="bridge-figure ruler-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="A ruler numbered from minus four to plus four with zero at the middle. On the upper band two arrows leave zero, one reaching plus three and one reaching minus three. On the lower band one arrow leaves zero for plus three and a second, drawn as a broken line, returns from plus three to zero. Every arrow is three units long."
      >
        <text className="bridge-axis-name" x="2" y="14">
          two walkers, opposite directions
        </text>
        <Arrow from={0} to={3} y={38} />
        <Arrow from={0} to={-3} y={38} />
        <text className="bridge-number" x={x(1.5)} y={30} textAnchor="middle">
          +3
        </text>
        <text className="bridge-number" x={x(-1.5)} y={30} textAnchor="middle">
          −3
        </text>

        <text className="bridge-axis-name" x="2" y="76">
          one walker, out and back
        </text>
        <Arrow from={0} to={3} y={98} />
        <Arrow from={3} to={0} y={114} dashed />
        <text className="bridge-number" x={x(1.5)} y={92} textAnchor="middle">
          out +3
        </text>
        <text className="bridge-number" x={x(1.5)} y={128} textAnchor="middle">
          back −3
        </text>

        <line className="bridge-axis" x1={x(-SPAN)} y1={AXIS} x2={x(SPAN)} y2={AXIS} />
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((u) => (
          <line
            key={u}
            className="bridge-tick"
            x1={x(u)}
            y1={AXIS}
            x2={x(u)}
            y2={AXIS + (u === 0 ? 11 : 6)}
          />
        ))}
        {[-3, 0, 3].map((u) => (
          <text key={u} className="bridge-number" x={x(u)} y={AXIS + 26} textAnchor="middle">
            {u > 0 ? `+${u}` : u}
          </text>
        ))}
        <text className="bridge-number" x={x(0)} y={AXIS + 42} textAnchor="middle">
          start
        </text>
        <text className="bridge-axis-name" x={MID} y={H - 4} textAnchor="middle">
          units along the ruler
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          On the upper band two arrows leave zero in opposite directions and each is three units
          long. Their signed displacements, +3 and −3, add to zero; the distances they cover, three
          and three, add to six. On the lower band a single walker goes out three units and comes
          back along the same three units. That walker ends where the journey began, so the
          displacement is zero, and six units of ruler passed underneath.
        </p>
        <p>
          In neither picture did anything stay still. A total of zero is a statement about where
          things ended, and the arrows are what it leaves out.
        </p>
      </div>
    </section>
  );
}
