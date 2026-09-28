import { useId } from "react";
import { average, PARTICLE_ENDS, WALK, walkSpeeds } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-a-graph asks for (dispatch 401).
 *
 * The lesson is titled "Reading a graph" and its own prose told the reader to "draw a line along
 * the bottom of a page for time and one up the side for distance", then to "mark those positions
 * along the bottom and draw a bar one particle tall above each". A reader who opened this lesson
 * did so because prose was not enough, so both drawings are here. Every number comes from
 * src/foundations/bridgeFigures.ts and is recomputed by its test.
 *
 * Nothing is interactive: these are two static figures, drawn into the static HTML, so the lesson
 * reads the same with JavaScript off. The reading of each is given in words under it.
 */

const W = 300;

/** The walk plot: seconds across, metres up. */
const WALK_H = 186,
  LEFT = 44,
  RIGHT = 292,
  TOP = 26,
  BASE = 150;
const LAST = WALK[WALK.length - 1] as (typeof WALK)[number];
const tx = (seconds: number) => LEFT + (seconds / LAST.seconds) * (RIGHT - LEFT);
const ty = (metres: number) => BASE - (metres / LAST.metres) * (BASE - TOP);

/** The particle plot: micrometres across, one bar of one particle up. */
const BARS_H = 150,
  BAR_BASE = 104,
  BAR_TOP = 30,
  SPAN = 4,
  MID = W / 2,
  UNIT = (W - 60) / (2 * SPAN);
const px = (micrometres: number) => MID + micrometres * UNIT;

export function ReadingAGraph({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const speeds = walkSpeeds();
  const speed = speeds[0] as number;
  const mean = average(PARTICLE_ENDS);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-a-graph"
    >
      <Title id={headingId} className="construction-title">
        The two graphs this lesson describes
      </Title>
      <p>
        Both are drawn here rather than left to the reader. The first is the walk: each dot is one
        moment, read across for the time and up for the distance.
      </p>

      <svg
        className="bridge-figure walk-figure"
        viewBox={`0 0 ${W} ${WALK_H}`}
        role="img"
        aria-label={`A graph with time in seconds along the bottom from 0 to ${LAST.seconds} and distance in metres up the side from 0 to ${LAST.metres}. Seven dots, one every ten seconds, lie on a straight line rising from the corner. Between the dot at thirty seconds and the dot at forty, a step is marked: ten seconds across and fourteen metres up.`}
      >
        <text className="bridge-axis-name" x="2" y="12">
          distance, metres
        </text>
        {WALK.filter((_, i) => i % 2 === 0).map((point) => (
          <g key={`y${point.metres}`}>
            <line
              className="bridge-grid"
              x1={LEFT}
              y1={ty(point.metres)}
              x2={RIGHT}
              y2={ty(point.metres)}
            />
            <text className="bridge-number" x={LEFT - 6} y={ty(point.metres) + 4} textAnchor="end">
              {point.metres}
            </text>
          </g>
        ))}
        {WALK.filter((_, i) => i % 2 === 0).map((point) => (
          <text
            key={`x${point.seconds}`}
            className="bridge-number"
            x={tx(point.seconds)}
            y={BASE + 16}
            textAnchor="middle"
          >
            {point.seconds}
          </text>
        ))}
        <line className="bridge-axis" x1={LEFT} y1={TOP - 8} x2={LEFT} y2={BASE} />
        <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />

        {/* The step that reads the rate off the line: ten across, fourteen up. */}
        <line className="bridge-step" x1={tx(30)} y1={ty(42)} x2={tx(40)} y2={ty(42)} />
        <line className="bridge-step" x1={tx(40)} y1={ty(42)} x2={tx(40)} y2={ty(56)} />
        <text
          className="bridge-number"
          x={(tx(30) + tx(40)) / 2}
          y={ty(42) + 15}
          textAnchor="middle"
        >
          10 s
        </text>
        <text className="bridge-number" x={tx(40) + 6} y={(ty(42) + ty(56)) / 2 + 4}>
          14 m
        </text>

        <polyline
          className="bridge-line"
          points={WALK.map((p) => `${tx(p.seconds)},${ty(p.metres)}`).join(" ")}
        />
        {WALK.map((p) => (
          <circle
            key={p.seconds}
            className="bridge-dot"
            cx={tx(p.seconds)}
            cy={ty(p.metres)}
            r="4.5"
          />
        ))}
        <text className="bridge-axis-name" x={(LEFT + RIGHT) / 2} y={BASE + 32} textAnchor="middle">
          time, seconds
        </text>
      </svg>

      <p className="fine">
        The dots fall on a straight line, so the walk is steady. The step drawn on it reads the rate
        off the line: {WALK[1]?.metres} metres for every {WALK[1]?.seconds} seconds, which is{" "}
        {speed} metres per second. A steeper line would be a faster walk, a flat one would be
        standing still.
      </p>

      <p>
        The second is the worked example: four particles, and a bar one particle tall above each
        place one of them stopped.
      </p>

      <svg
        className="bridge-figure particles-figure"
        viewBox={`0 0 ${W} ${BARS_H}`}
        role="img"
        aria-label={`Four bars, each one particle tall, standing above ${PARTICLE_ENDS.join(", ")} micrometres on a line running from minus four to plus four. Two stand left of zero and two right of it, at matching distances. No bar stands at zero, and a mark under zero labels the average position.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          particles
        </text>
        {PARTICLE_ENDS.map((end) => (
          <rect
            key={end}
            className="bridge-bar"
            x={px(end) - 12}
            y={BAR_TOP}
            width="24"
            height={BAR_BASE - BAR_TOP}
          />
        ))}
        <line className="bridge-axis" x1={px(-SPAN)} y1={BAR_BASE} x2={px(SPAN)} y2={BAR_BASE} />
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((u) => (
          <line
            key={u}
            className="bridge-tick"
            x1={px(u)}
            y1={BAR_BASE}
            x2={px(u)}
            y2={BAR_BASE + (u === 0 ? 10 : 5)}
          />
        ))}
        {[-3, -1, 0, 1, 3].map((u) => (
          <text key={u} className="bridge-number" x={px(u)} y={BAR_BASE + 24} textAnchor="middle">
            {u > 0 ? `+${u}` : u}
          </text>
        ))}
        <path
          className="bridge-marker"
          d={`M ${px(mean) - 7} ${BAR_BASE + 32} L ${px(mean) + 7} ${BAR_BASE + 32} L ${px(mean)} ${BAR_BASE + 22} Z`}
        />
        <text className="bridge-number" x={px(mean)} y={BAR_BASE + 44} textAnchor="middle">
          average
        </text>
        <text className="bridge-axis-name" x={MID} y={BARS_H - 4} textAnchor="middle">
          where each particle ended, micrometres
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          In the first graph the seven dots of the walk lie on one straight line rising from the
          corner: 0 metres at 0 seconds, 14 at 10 seconds, and on to {LAST.metres} metres at{" "}
          {LAST.seconds} seconds. Stepping 10 seconds across the line and {WALK[1]?.metres} metres
          up it gives the same {speed} metres per second wherever the step is taken, which is what
          makes the walk steady.
        </p>
        <p>
          In the second graph four bars of equal height stand above {PARTICLE_ENDS.join(", ")}{" "}
          micrometres. Two are left of zero and two are right of it, at matching distances, so the
          picture is symmetric and the average position is {mean}. No bar stands at zero: every one
          of the four particles moved. That is the thing the average leaves out and the graph keeps.
        </p>
      </div>
    </section>
  );
}
