import { useId } from "react";
import {
  FAST_READING,
  fastBy,
  reflectionTime,
  SIGNAL_DISTANCE,
  SYNC,
  signalSpeed,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * §1's clock rule, drawn as the signal exchange it is (dispatch 440).
 *
 * The obvious figure for a lesson about frames and events is a spacetime diagram, and AGENTS.md
 * forbids one use of those by name: they may not stand as the paper's presentation, being a later
 * geometric aid (Minkowski, 1908). Reading the lesson settles it more simply than the rule does.
 * foundation:frames-events is §1's rule for setting clocks WITHIN ONE FRAME, not simultaneity
 * between two, so there is no second observer, no rotated axes and no light cone to draw. What it
 * needs is the procedure: a flash from A to B and back, and three readings.
 *
 * So this is two clocks and three arrows. Time runs down the page because the flash has an order,
 * not because the page is a coordinate plane; there are no axes and nothing is measured off them.
 * The numbers are the lesson's own worked example, and the half-way reading is computed by
 * reflectionTime() rather than typed, since that halving IS the rule.
 */

const W = 300,
  H = 214;
const A_X = 78,
  B_X = 222,
  TOP = 42,
  PER_SECOND = 13;
const at = (seconds: number) => TOP + seconds * PER_SECOND;
const BOTTOM = at(SYNC.returns) + 12;

function Flash({
  from,
  to,
  fromTime,
  toTime,
}: {
  readonly from: number;
  readonly to: number;
  readonly fromTime: number;
  readonly toTime: number;
}) {
  const dx = to > from ? -1 : 1;
  return (
    <g>
      <line className="bridge-arrow" x1={from} y1={at(fromTime)} x2={to + dx * 8} y2={at(toTime)} />
      <path
        className="bridge-marker"
        d={`M ${to} ${at(toTime)} L ${to + dx * 11} ${at(toTime) - 5} L ${to + dx * 11} ${at(toTime) + 5} Z`}
      />
    </g>
  );
}

function Exchange({ reading, label }: { readonly reading: number; readonly label: string }) {
  const mid = reflectionTime();
  return (
    <svg
      className="bridge-figure"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Two clocks drawn as vertical lines with time running downwards, clock A on the left and clock B on the right. A flash leaves A when A reads ${SYNC.leaves}, reaches B, and returns to A when A reads ${SYNC.returns}. At the turn-round B reads ${reading}. ${label}`}
    >
      <text className="bridge-axis-name" x={A_X} y={24} textAnchor="middle">
        clock A
      </text>
      <text className="bridge-axis-name" x={B_X} y={24} textAnchor="middle">
        clock B
      </text>
      <line className="bridge-axis" x1={A_X} y1={TOP - 10} x2={A_X} y2={BOTTOM} />
      <line className="bridge-axis" x1={B_X} y1={TOP - 10} x2={B_X} y2={BOTTOM} />

      <Flash from={A_X} to={B_X} fromTime={SYNC.leaves} toTime={mid} />
      <Flash from={B_X} to={A_X} fromTime={mid} toTime={SYNC.returns} />

      {/* The half-way mark on A, which is the whole of the rule. */}
      <line className="bridge-step" x1={A_X - 14} y1={at(mid)} x2={B_X} y2={at(mid)} />

      {[SYNC.leaves, mid, SYNC.returns].map((t) => (
        <circle key={t} className="bridge-dot" cx={A_X} cy={at(t)} r="4" />
      ))}
      <circle className="bridge-dot" cx={B_X} cy={at(mid)} r="4" />

      <text className="bridge-number" x={A_X - 10} y={at(SYNC.leaves) + 4} textAnchor="end">
        {SYNC.leaves}
      </text>
      <text className="bridge-number" x={A_X - 10} y={at(mid) - 4} textAnchor="end">
        {mid}
      </text>
      <text className="bridge-number" x={A_X - 10} y={at(SYNC.returns) + 4} textAnchor="end">
        {SYNC.returns}
      </text>
      <text className="bridge-number" x={B_X + 10} y={at(mid) + 4}>
        {reading}
      </text>

      <text className="bridge-number" x={(A_X + B_X) / 2} y={at(2.2)} textAnchor="middle">
        light out
      </text>
      <text className="bridge-number" x={(A_X + B_X) / 2} y={at(8.4)} textAnchor="middle">
        and back
      </text>
      <text className="bridge-axis-name" x={W / 2} y={H - 6} textAnchor="middle">
        time, downwards
      </text>
    </svg>
  );
}

export function TwoClocksOneFlash({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const mid = reflectionTime();

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="frames-events"
    >
      <Title id={headingId} className="construction-title">
        One flash, out and back
      </Title>
      <p>
        A flash leaves clock A, turns round at clock B and comes back. By the rule the two trips
        take equal times, so the turn-round happened half way between leaving and returning: at{" "}
        {mid} on A's clock.
      </p>

      <Exchange
        reading={mid}
        label={`Because ${mid} is half way between ${SYNC.leaves} and ${SYNC.returns}, the two clocks are synchronous by the rule.`}
      />

      <p className="fine">
        B reads {mid} at the turn-round, which is what A's clock says the moment was. The two are
        synchronous.
      </p>

      <p>Now the same flash, against a clock that is running ahead.</p>

      <Exchange
        reading={FAST_READING}
        label={`Because ${FAST_READING} is ${fastBy()} more than the half-way reading of ${mid}, clock B is ${fastBy()} seconds fast and setting it back by ${fastBy()} makes the two agree.`}
      />

      <p className="fine">
        B reads {FAST_READING} where the rule says {mid}, so it is {fastBy()} seconds fast. Set it
        back {fastBy()} and the two agree. Nothing about the flash changed between the drawings;
        only what B's hands were showing.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Two clocks stand apart, drawn as vertical lines with time running down the page. A flash
          leaves A when A reads {SYNC.leaves}, reaches B, is reflected, and returns to A when A
          reads {SYNC.returns}. The rule says the trip out took as long as the trip back, so the
          turn-round was half way between: {mid} by A's clock. In the first drawing B reads {mid} at
          that moment and the clocks are synchronous. In the second B reads {FAST_READING}, which is{" "}
          {fastBy()} seconds more, so B is {fastBy()} seconds fast and setting it back {fastBy()}{" "}
          makes them agree.
        </p>
        <p>
          The same round trip also measures light, if the distance is known separately: with B at{" "}
          {SIGNAL_DISTANCE / 1e9} × 10⁹ metres, a there-and-back of {SYNC.returns} seconds gives{" "}
          {signalSpeed() / 1e8} × 10⁸ metres per second.
        </p>
        <p>
          What it does not show, and this is the lesson's own point rather than a limitation of the
          drawing: the rule is a definition, and no picture can show it being tested. Checking that
          the trip out really took as long as the trip back would need two clocks already
          synchronised, which is the thing the rule exists to supply. Nor is there a second observer
          anywhere here. Only one frame is drawn, so nothing in it bears on how someone moving past
          would time the same three events; that question needs the paper's §2, and the geometric
          aid usually reached for is Minkowski's of 1908, which is later than the argument and not
          its presentation.
        </p>
      </div>
    </section>
  );
}
