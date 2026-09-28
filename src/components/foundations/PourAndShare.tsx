import { useId } from "react";
import { average, JARS, sum } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-sum-average asks for (dispatch 401).
 *
 * The lesson's own sentences are a drawing: "Four jars hold 3, 1, 1, 3 marbles. Pour them together
 * and there are 8. Share the 8 equally between the four jars and each holds 2." It was the thinnest
 * page on the site at 1,373 visible characters and had no picture. Both states of the jars are drawn
 * here, side by side, because what an average keeps and what it loses is visible in the comparison
 * and is not visible in either half alone: the same marbles in the same four jars, level instead of
 * uneven.
 *
 * The marbles are countable on purpose. A reader who does not take the arithmetic on trust can count
 * eight circles on the left and eight on the right.
 */

const W = 300,
  H = 182;
const JAR_BOTTOM = 126,
  JAR_TOP = 54,
  JAR_HALF = 14,
  MARBLE_R = 8.5,
  MARBLE_STEP = 21,
  FIRST_MARBLE = JAR_BOTTOM - 13;
const LEFT_CENTRES = [24, 58, 92, 126],
  RIGHT_CENTRES = [174, 208, 242, 276];

function Jar({ centre, marbles }: { readonly centre: number; readonly marbles: number }) {
  return (
    <g>
      <path
        className="bridge-jar"
        d={`M ${centre - JAR_HALF} ${JAR_TOP} L ${centre - JAR_HALF} ${JAR_BOTTOM} L ${centre + JAR_HALF} ${JAR_BOTTOM} L ${centre + JAR_HALF} ${JAR_TOP}`}
      />
      {Array.from({ length: marbles }, (_, i) => FIRST_MARBLE - i * MARBLE_STEP).map((cy) => (
        <circle key={cy} className="bridge-marble" cx={centre} cy={cy} r={MARBLE_R} />
      ))}
      <text className="bridge-number" x={centre} y={JAR_BOTTOM + 18} textAnchor="middle">
        {marbles}
      </text>
    </g>
  );
}

export function PourAndShare({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const total = sum(JARS),
    mean = average(JARS),
    shared = JARS.map(() => mean);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-sum-average"
    >
      <Title id={headingId} className="construction-title">
        The four jars, before and after sharing
      </Title>
      <p>
        The same {total} marbles in the same {JARS.length} jars, twice. On the left they are as they
        were found; on the right they have been poured together and shared out equally.
      </p>

      <svg
        className="bridge-figure jars-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Two groups of four jars. On the left the jars hold ${JARS.join(", ")} marbles, so two are full to three and two hold one each. On the right the same ${total} marbles are shared out and every jar holds ${mean}. Both groups hold ${total} marbles in ${JARS.length} jars.`}
      >
        {LEFT_CENTRES.map((centre, i) => (
          <Jar key={centre} centre={centre} marbles={JARS[i] as number} />
        ))}
        {RIGHT_CENTRES.map((centre, i) => (
          <Jar key={centre} centre={centre} marbles={shared[i] as number} />
        ))}
        <line className="bridge-step" x1={142} y1={JAR_BOTTOM - 34} x2={158} y2={JAR_BOTTOM - 34} />
        <path
          className="bridge-marker"
          d={`M 158 ${JAR_BOTTOM - 40} L 166 ${JAR_BOTTOM - 34} L 158 ${JAR_BOTTOM - 28} Z`}
        />
        <text className="bridge-axis-name" x={75} y={20} textAnchor="middle">
          as they were
        </text>
        <text className="bridge-axis-name" x={225} y={20} textAnchor="middle">
          shared equally
        </text>
        <text className="bridge-number" x={75} y={H - 6} textAnchor="middle">
          {JARS.join(" + ")} = {total}
        </text>
        <text className="bridge-number" x={225} y={H - 6} textAnchor="middle">
          {shared.join(" + ")} = {total}
        </text>
      </svg>

      <p className="fine">
        Count them: {total} marbles on the left and {total} on the right, in {JARS.length} jars both
        times. The average is the right-hand picture, and it is {mean} even though no jar on the
        left held {mean}.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          On the left, four jars holding {JARS.join(", ")} marbles: two are filled to three and two
          hold a single marble. On the right, the same {total} marbles in the same {JARS.length}{" "}
          jars, every one holding {mean}. The total is {total} in both pictures and the count of
          jars is {JARS.length} in both, which is everything the average keeps. What the right-hand
          picture has lost is which jar was full and which was nearly empty, and no amount of
          looking at it will bring that back.
        </p>
      </div>
    </section>
  );
}
