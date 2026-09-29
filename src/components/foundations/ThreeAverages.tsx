import { useId } from "react";
import {
  average,
  meanDistance,
  meanSquare,
  PARTICLE_ENDS,
  PRINTED_RMS,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The three answers foundation:mean-variance-rms gives to one question (dispatch 444).
 *
 * The lesson asks which average shows how far particles got and answers with three, none of which
 * the page drew. Its four displacements are already drawn twice elsewhere, as bars in
 * bridge-a-graph and as squares in bridge-squaring-square-roots, so this draws the part neither
 * does: the three statistics laid on one scale of distance, where the gap between them is the
 * whole lesson.
 *
 * The mean square is deliberately NOT on that scale. It is 5 square micrometres, an area, and
 * putting it beside two lengths would be the error the lesson exists to prevent; taking its square
 * root is what brings it back to a distance.
 */

const A_W = 300,
  A_H = 148,
  A_MID = 150,
  A_UNIT = 30,
  A_SPAN = 4,
  A_AXIS = 92;
const ax = (u: number) => A_MID + u * A_UNIT;

const B_W = 300,
  B_H = 152,
  B_LEFT = 40,
  B_PER_UNIT = 60,
  B_AXIS = 104;
const bx = (d: number) => B_LEFT + d * B_PER_UNIT;

export function ThreeAverages({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const mean = average(PARTICLE_ENDS);
  const distance = meanDistance(PARTICLE_ENDS);
  const squares = meanSquare(PARTICLE_ENDS);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="mean-variance-rms"
    >
      <Title id={headingId} className="construction-title">
        One question, three answers
      </Title>
      <p>
        The four displacements the lesson counts, on a ruler through the start. Two went left and
        two went right, by matching amounts.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${A_W} ${A_H}`}
        role="img"
        aria-label={`Four points on a ruler numbered from minus four to plus four micrometres, at ${PARTICLE_ENDS.join(", ")}. Two lie left of zero and two right of it, at matching distances, and a mark under zero shows that their average position is ${mean}.`}
      >
        {PARTICLE_ENDS.map((u) => (
          <circle key={u} className="bridge-dot" cx={ax(u)} cy={54} r="5" />
        ))}
        <line className="bridge-axis" x1={ax(-A_SPAN)} y1={A_AXIS} x2={ax(A_SPAN)} y2={A_AXIS} />
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((u) => (
          <line
            key={u}
            className="bridge-tick"
            x1={ax(u)}
            y1={A_AXIS}
            x2={ax(u)}
            y2={A_AXIS + (u === 0 ? 10 : 5)}
          />
        ))}
        {[-3, 0, 3].map((u) => (
          <text key={u} className="bridge-number" x={ax(u)} y={A_AXIS + 24} textAnchor="middle">
            {u > 0 ? `+${u}` : u}
          </text>
        ))}
        <path
          className="bridge-marker"
          d={`M ${ax(mean) - 7} ${A_AXIS + 34} L ${ax(mean) + 7} ${A_AXIS + 34} L ${ax(mean)} ${A_AXIS + 24} Z`}
        />
        <text className="bridge-axis-name" x={A_MID} y={A_H - 6} textAnchor="middle">
          average position {mean}
        </text>
      </svg>

      <p>
        Now the three averages on one scale of distance from the start. They are three different
        numbers because they answer three different questions.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${B_W} ${B_H}`}
        role="img"
        aria-label={`A scale of distance from the start running from 0 to 4 micrometres, with three marks on it. The average position sits at ${mean}. The average distance, ignoring sign, sits at ${distance}. The root mean square sits at about ${PRINTED_RMS}, a little beyond it. The mean square itself is ${squares} square micrometres and is not on this scale, because it is an area rather than a distance.`}
      >
        <line className="bridge-axis" x1={bx(0)} y1={B_AXIS} x2={bx(4)} y2={B_AXIS} />
        {[0, 1, 2, 3, 4].map((d) => (
          <g key={d}>
            <line className="bridge-tick" x1={bx(d)} y1={B_AXIS} x2={bx(d)} y2={B_AXIS + 6} />
            <text className="bridge-number" x={bx(d)} y={B_AXIS + 22} textAnchor="middle">
              {d}
            </text>
          </g>
        ))}
        {/* Staggered, because the last two sit a fifth of a micrometre apart. */}
        <line className="bridge-step" x1={bx(mean)} y1={B_AXIS} x2={bx(mean)} y2={78} />
        <circle className="bridge-dot" cx={bx(mean)} cy={B_AXIS} r="5" />
        <text className="bridge-number" x={bx(mean)} y={70} textAnchor="middle">
          mean {mean}
        </text>

        <line className="bridge-step" x1={bx(distance)} y1={B_AXIS} x2={bx(distance)} y2={56} />
        <circle className="bridge-dot" cx={bx(distance)} cy={B_AXIS} r="5" />
        <text className="bridge-number" x={bx(distance)} y={48} textAnchor="middle">
          mean distance {distance}
        </text>

        <line
          className="bridge-step"
          x1={bx(PRINTED_RMS)}
          y1={B_AXIS}
          x2={bx(PRINTED_RMS)}
          y2={30}
        />
        <circle className="bridge-dot" cx={bx(PRINTED_RMS)} cy={B_AXIS} r="5" />
        <text className="bridge-number" x={bx(PRINTED_RMS)} y={22} textAnchor="middle">
          RMS {PRINTED_RMS}
        </text>

        <text className="bridge-axis-name" x={B_W / 2} y={B_H - 6} textAnchor="middle">
          micrometres from the start
        </text>
      </svg>

      <p className="fine">
        The mean square, {squares} square micrometres, is not on that scale and could not be: it is
        an area. Taking its square root is what brings it back to a distance, and that root, about{" "}
        {PRINTED_RMS}, sits a little beyond the average distance of {distance}.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first drawing puts the four displacements, {PARTICLE_ENDS.join(", ")} micrometres, on
          a ruler through the start. Two are left of zero and two right of it at matching distances,
          so the average position is {mean}: the particles have spread out and their average has not
          moved at all.
        </p>
        <p>
          The second puts three averages on one scale of distance. The average position is {mean}.
          The average of the distances, ignoring sign, is {distance}. The root mean square is about{" "}
          {PRINTED_RMS}, a little farther out, because squaring weighs the two particles that went
          three micrometres more heavily than the two that went one. The mean square, {squares}{" "}
          square micrometres, is not drawn there: it is an area, and putting it beside two lengths
          would be the mistake the lesson exists to prevent.
        </p>
        <p>
          What it does not show: these four are one sample, not the model behind it. A small random
          sample need not have a signed average of exactly zero even when the model's is zero, and
          nothing in either drawing distinguishes a real cancellation from a lucky one. The root
          mean square and the standard deviation are the same number here only because this average
          happens to be zero; where it is not, they part company, and neither drawing shows that.
        </p>
      </div>
    </section>
  );
}
