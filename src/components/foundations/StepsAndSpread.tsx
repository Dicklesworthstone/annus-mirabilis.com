"use client";

import { useEffect, useId, useState } from "react";
import {
  STEP_MARKS,
  STEP_METRES,
  TWO_STEP_ENDS,
  typicalDistance,
} from "../../foundations/bridgeFigures.ts";
import {
  type CountedWalkRule,
  INITIAL_COUNTED_WALK,
  MAX_COUNTED_STEPS,
  readCountedWalk,
} from "../../physics/reference/randomWalkCounts.ts";
import { Sci } from "../lab/Sci.tsx";
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
 * The reference curve uses typicalDistance() in bridgeFigures.ts. The applied walk, exact path
 * counts and probability-weighted distances come together from the randomWalkCounts owner.
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
  B_TOP = 24;

const shown = (value: number): string =>
  String(Number(value.toPrecision(5))).replace(/^-/, "−");
const percent = (value: number): string => shown(100 * value) + "%";

function WalkPercentage({ value }: { readonly value: number }) {
  const percentage = 100 * value;
  return percentage !== 0 && percentage < 0.001 ? (
    <>
      <Sci value={percentage} digits={4} />%
    </>
  ) : (
    <>{percent(value)}</>
  );
}

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
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_COUNTED_WALK);
  const [draft, setDraft] = useState(String(INITIAL_COUNTED_WALK.steps));
  const [draftRule, setDraftRule] = useState<CountedWalkRule>("independent");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setReady(true), []);

  function apply(text: string, rule: CountedWalkRule) {
    const result = readCountedWalk(text, rule);
    if (result.kind === "refused") {
      setError(result.message + " The figures and table keep the last applied walk.");
      return;
    }
    setAccepted(result.walk);
    setDraft(String(result.walk.steps));
    setDraftRule(result.walk.rule);
    setError(null);
  }

  const B_STEPS = Math.max(16, accepted.steps);
  const B_METRES = Math.max(5, Math.ceil(Math.max(Math.sqrt(B_STEPS), accepted.rms) * 1.2));
  const bx = (steps: number) => B_LEFT + (steps / B_STEPS) * (B_RIGHT - B_LEFT);
  const by = (metres: number) => B_BASE - (metres / B_METRES) * (B_BASE - B_TOP);
  const marks =
    B_STEPS === 16
      ? [...STEP_MARKS]
      : [0.25, 0.5, 0.75, 1].map((fraction) => Math.round(fraction * B_STEPS));
  const squares = TWO_STEP_ENDS.map((e) => e * e);
  const meanSquare = squares.reduce((a, b) => a + b, 0) / squares.length;
  const curve = Array.from({ length: 129 }, (_, i) => (i / 128) * B_STEPS);
  const straightExit = Math.min(B_STEPS, B_METRES / STEP_METRES);

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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft, draftRule);
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Count the walks, then compare their spread</legend>
          <p>Each step is one metre. Apply the step count and coin rule together.</p>
          <p>
            <label htmlFor={headingId + "-steps"}>Number of steps</label>{" "}
            <input
              id={headingId + "-steps"}
              name="walk-steps"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onInput={(event) => setDraft(event.currentTarget.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? headingId + "-error" : headingId + "-bounds"}
            />
          </p>
          <p id={headingId + "-bounds"} className="fine">
            Whole numbers from 0 to {MAX_COUNTED_STEPS}. Every possible ending is counted.
          </p>
          <p>
            <label htmlFor={headingId + "-rule"}>How each direction is chosen</label>{" "}
            <select
              id={headingId + "-rule"}
              name="walk-rule"
              value={draftRule}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (value === "independent" || value === "same-direction") setDraftRule(value);
              }}
            >
              <option value="independent">A fresh fair coin for every step</option>
              <option value="same-direction">Repeat the first fair coin's direction</option>
            </select>
          </p>
          <button type="submit">Apply walk</button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => apply(String(accepted.steps * 4), accepted.rule)}
            disabled={accepted.steps === 0 || accepted.steps * 4 > MAX_COUNTED_STEPS}
          >
            Four times the steps
          </button>{" "}
          <button type="button" className="secondary" onClick={() => apply("2", "independent")}>
            Restore two steps
          </button>
        </fieldset>
      </form>
      {error ? (
        <p id={headingId + "-error"} role="alert">
          {error}
        </p>
      ) : null}

      <div className="construction-display" role="status" aria-atomic="true">
        <p>
          Applied: {accepted.steps} steps,{" "}
          {accepted.rule === "independent" ? "a fresh coin each time" : "the first direction repeated"}.
        </p>
        <dl className="readout-grid">
          <dt>Average end position</dt>
          <dd data-walk-output="mean">{shown(accepted.mean)} m</dd>
          <dt>Average squared end position</dt>
          <dd data-walk-output="mean-square">{shown(accepted.meanSquare)} m²</dd>
          <dt>Root-mean-square distance</dt>
          <dd data-walk-output="rms">{shown(accepted.rms)} m</dd>
          <dt>Average distance, ignoring direction</dt>
          <dd data-walk-output="mean-distance">{shown(accepted.meanDistance)} m</dd>
          <dt>Chance of ending at the start</dt>
          <dd data-walk-output="return">{percent(accepted.returnProbability)}</dd>
        </dl>
        <p>
          {accepted.steps === 0
            ? "With no steps, the one possible path stays at the start."
            : accepted.rule === "independent"
              ? "The average end stays at zero while the mean square grows with the step count. Four times as many independent steps doubles the root-mean-square distance."
              : "The average end is still zero, but repeating the first direction makes the root-mean-square distance grow with the full step count. Equal chances of left and right do not make steps independent."}
        </p>
      </div>

      <p>
        The curve shows fresh independent directions; the straight line shows every step in one
        direction. The large dot marks the applied walk. The axes include its step count and
        distance, so changing the scale does not hide it.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${B_H}`}
        role="img"
        aria-label={`A graph with steps from 0 to ${B_STEPS} and distance from 0 to ${B_METRES} metres. The independent-step curve passes through 1 metre at 1 step, 2 at 4, 3 at 9 and 4 at 16. A straight line gives one metre for each step in the same direction. The applied ${accepted.steps}-step walk has root-mean-square distance ${shown(accepted.rms)} metres and is marked by the large dot. All its possible ends and their chances are in the table below.`}
      >
        <text className="bridge-axis-name" x="2" y="14">
          metres from the start
        </text>
        {[0.25, 0.5, 0.75, 1].map((fraction) => {
          const m = fraction * B_METRES;
          return (
            <g key={fraction}>
              <line className="bridge-grid" x1={B_LEFT} y1={by(m)} x2={B_RIGHT} y2={by(m)} />
              <text className="bridge-number" x={B_LEFT - 4} y={by(m) + 4} textAnchor="end">
                {shown(m)}
              </text>
            </g>
          );
        })}
        {/* The repeated-direction comparison is clipped only where it leaves the plotted axes. */}
        <line
          className="bridge-step"
          x1={bx(0)}
          y1={by(0)}
          x2={bx(straightExit)}
          y2={by(straightExit * STEP_METRES)}
        />
        <text
          className="bridge-number"
          x={bx(straightExit) - 4}
          y={by(straightExit * STEP_METRES) + 12}
          textAnchor="end"
        >
          all one way
        </text>
        <polyline
          className="bridge-line"
          points={curve.map((n) => `${bx(n)},${by(typicalDistance(n))}`).join(" ")}
        />
        {marks.map((n) => (
          <circle key={n} className="bridge-dot" cx={bx(n)} cy={by(typicalDistance(n))} r="4" />
        ))}
        {marks.map((n) => (
          <text
            key={n}
            className="bridge-number"
            x={bx(n)}
            y={by(typicalDistance(n)) - 9}
            textAnchor="middle"
          >
            {shown(typicalDistance(n))} m
          </text>
        ))}
        <circle
          data-counted-walk-point
          className="bridge-dot"
          cx={bx(accepted.steps)}
          cy={by(accepted.rms)}
          r="6"
        />
        <line className="bridge-axis" x1={B_LEFT} y1={B_TOP - 6} x2={B_LEFT} y2={B_BASE} />
        <line className="bridge-axis" x1={B_LEFT} y1={B_BASE} x2={B_RIGHT} y2={B_BASE} />
        {marks.map((n) => (
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

      <details>
        <summary>Inspect every possible ending and its chance</summary>
        <p>
          These are exact counts of equally likely paths in the stated coin model, not sampled
          measurements. The table combines paths that reach the same end. The count of paths is
          exact; the displayed percentages are rounded.
        </p>
        <p data-walk-total>Possible paths: {accepted.totalPaths}.</p>
        <section
          className="construction-table-wrap"
          aria-label="Random-walk end positions"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the exact path counts can overflow narrow screens, so keyboard readers need to scroll this labelled region.
          tabIndex={0}
        >
          <table className="data-table">
            <caption>All endings after {accepted.steps} steps, each one metre</caption>
            <thead>
              <tr>
                <th scope="col">End position (m)</th>
                <th scope="col">Paths reaching it</th>
                <th scope="col">Chance</th>
              </tr>
            </thead>
            <tbody>
              {accepted.outcomes.map((row) => (
                <tr key={row.displacement} data-walk-ending={row.displacement}>
                  <th scope="row">{shown(row.displacement)}</th>
                  <td>{row.paths}</td>
                  <td>
                    <WalkPercentage value={row.probability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {accepted.steps > 0 ? (
          <p>
            The chance of all steps going in one direction, left or right, is{" "}
            <WalkPercentage value={accepted.allOneWayProbability} />. Root-mean-square distance is a summary of
            all the endings, not a limit on how far one walk can reach.
          </p>
        ) : null}
      </details>

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
          and {typicalDistance(16)} at 16: four times the steps for twice the distance, every
          time. The broken straight line is a walker whose every step went the same way, one metre
          per step. At a hundred independent steps the curve would be at {typicalDistance(100)}
          metres where that line would be at a hundred. This construction counts a fair-coin model;
          it does not model a liquid's molecular collisions. Try the{" "}
          <a href="/lab/bm-05/">random-step laboratory</a> for the route from steps to diffusion.
        </p>
      </div>
    </section>
  );
}
