"use client";

import { useId, useState } from "react";
import {
  compareSteps,
  type IndependentStepChoice,
  independentSteps,
  STEP_DEPENDENCE_CHOICES,
  signedStepNumber,
  stepNumber,
} from "../../foundations/independentSteps.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

const coordinate = (metres: number) => 150 + 54 * metres;

/** Two separated arrows keep an out-and-back walk visible instead of drawing over itself. */
function StepArrow({ from, to, y }: { from: number; to: number; y: number }) {
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

/** An operable counterexample to dropping the mixed term merely because both steps average zero. */
export function IndependentSteps({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId();
  const groupName = useId();
  const chanceId = useId();
  const errorId = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [dependence, setDependence] = useState<IndependentStepChoice>("independent");
  const [rightPercent, setRightPercent] = useState(50);
  const [typedChance, setTypedChance] = useState("50");
  const [error, setError] = useState("");
  const state = independentSteps(dependence, rightPercent);
  const choice = STEP_DEPENDENCE_CHOICES.find((entry) => entry.id === dependence);
  const axisY = state.rows.length * 44 + 20;
  const centred = state.firstMean === 0 && state.secondMean === 0;

  function apply(chance: string) {
    const result = compareSteps(chance, dependence);
    if (result.kind === "invalid") {
      setError(result.reason);
      return;
    }
    setRightPercent(result.comparison.rightPercent);
    setTypedChance(String(result.comparison.rightPercent));
    setError("");
  }

  return (
    <section
      className="foundation-construction independent-steps"
      aria-labelledby={headingId}
      data-foundation-construction="probability-independence"
    >
      <Title id={headingId} className="construction-title">
        Try it: does the next step remember the first?
      </Title>
      <p>
        Take two one-metre steps. Start with a fair coin choosing the first, left or right. Choose
        how the second is decided, then change the chance of going right. Every possible walk is
        listed, with its chance; these are exact counts, not a random sample or a recording of a
        particle.
      </p>

      <fieldset className="construction-controls">
        <legend>How the second step is chosen</legend>
        {STEP_DEPENDENCE_CHOICES.map((entry) => (
          <label className="check" key={entry.id}>
            <input
              type="radio"
              name={groupName}
              value={entry.id}
              checked={dependence === entry.id}
              onChange={() => setDependence(entry.id)}
            />
            {entry.id === "independent" && rightPercent !== 50
              ? "Choose independently with the same chance"
              : entry.label}
          </label>
        ))}
      </fieldset>

      <form
        className="independent-steps-chance"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply(typedChance);
        }}
      >
        <label htmlFor={chanceId}>Chance of a rightward first step, in percent</label>
        <div className="independent-steps-entry">
          <input
            id={chanceId}
            type="number"
            min="0"
            max="100"
            step="1"
            required
            value={typedChance}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onInput={(event) => {
              setTypedChance(event.currentTarget.value);
              setError("");
            }}
          />
          <button type="submit">Apply chance</button>
          <button type="button" className="secondary" onClick={() => apply("50")}>
            50%: balanced
          </button>
          <button type="button" className="secondary" onClick={() => apply("75")}>
            75%: rightward drift
          </button>
        </div>
        <p className="fine">
          Whole percentages from 0 to 100. An independent second step uses the same chance. Copying
          or reversing follows the first direction instead.
        </p>
        {error ? (
          <p id={errorId} role="alert">
            {error}
          </p>
        ) : null}
        {typedChance !== String(rightPercent) && !error ? (
          <p className="fine">
            The comparison still uses {rightPercent}%. Apply your new chance to change it.
          </p>
        ) : null}
      </form>

      <div className="construction-display" role="status" aria-atomic="true">
        <p>
          <strong>{choice?.title}.</strong> {rightPercent === 50 ? choice?.explanation : null}
        </p>
        <p>
          The first step averages {signedStepNumber(state.firstMean)} m; the second averages{" "}
          {signedStepNumber(state.secondMean)} m.{" "}
          {state.independent && centred
            ? "The steps are independent and each averages zero, so the mixed term averages zero."
            : state.independent
              ? "The steps are independent here, but they do not each average zero. Independence alone does not remove the mixed term."
              : centred
                ? "Each step averages zero, but the second depends on the first. Zero means alone do not remove the mixed term."
                : "The second step depends on the first, and the steps do not each average zero. The independent, zero-mean rule does not apply."}
        </p>
        <dl className="readout-grid">
          <dt>Average end position</dt>
          <dd>{signedStepNumber(state.mean)} m</dd>
          <dt>Average squared end position</dt>
          <dd>{state.meanSquare} m²</dd>
          <dt>Average product of the two steps</dt>
          <dd>{signedStepNumber(state.meanProduct)} m²</dd>
          <dt>Twice that product: the mixed term</dt>
          <dd>{signedStepNumber(state.meanCrossTerm)} m²</dd>
        </dl>
      </div>

      {rightPercent === 50 ? (
        <p>
          After a right first step, {state.followsRight} of the {state.startsRight} possible walks
          go right next. Before seeing the first step, the second still has one chance in two of
          going right, in all three models. That is the distinction between knowing each step’s
          chances and knowing how the two are related.
        </p>
      ) : (
        <p>
          Before seeing the first step, the second has a {stepNumber(state.secondRightPercent)}%
          chance of going right.{" "}
          {state.chanceRightAfterRight === null
            ? "A rightward first step is impossible at this setting, so there is no conditional chance after that event."
            : `After a rightward first step, the chance of going right next is ${stepNumber(state.chanceRightAfterRight)}%.`}{" "}
          The chances below weight each path’s contribution to the averages.
        </p>
      )}

      <svg
        className="bridge-figure"
        viewBox={`0 0 300 ${axisY + 52}`}
        role="img"
        aria-label={`${choice?.title}: ${state.rows.length} walks${rightPercent === 50 ? `, equally likely with one chance in ${state.denominator}` : ", weighted by the chances in the table below"}. Each row starts at zero; the upper arrow is the first step and the lower arrow the second. The dots end at ${state.rows.map((row) => signedStepNumber(row.displacement)).join(", ")} metres. The table below gives each walk's product and squared end position.`}
      >
        {state.rows.map((row, index) => {
          const y = 26 + index * 44;
          return (
            <g key={row.id}>
              <text className="bridge-number" x={4} y={y + 4}>
                {index + 1}
              </text>
              <StepArrow from={coordinate(0)} to={coordinate(row.first)} y={y - 7} />
              <line
                className="bridge-grid"
                x1={coordinate(row.first)}
                y1={y - 7}
                x2={coordinate(row.first)}
                y2={y + 7}
              />
              <StepArrow from={coordinate(row.first)} to={coordinate(row.displacement)} y={y + 7} />
              <circle className="bridge-dot" cx={coordinate(row.displacement)} cy={y + 7} r={4} />
            </g>
          );
        })}
        <line
          className="bridge-axis"
          x1={coordinate(-2)}
          y1={axisY}
          x2={coordinate(2)}
          y2={axisY}
        />
        {[-2, -1, 0, 1, 2].map((metres) => (
          <g key={metres}>
            <line
              className="bridge-tick"
              x1={coordinate(metres)}
              y1={axisY}
              x2={coordinate(metres)}
              y2={axisY + 6}
            />
            <text
              className="bridge-number"
              x={coordinate(metres)}
              y={axisY + 23}
              textAnchor="middle"
            >
              {signedStepNumber(metres)}
            </text>
          </g>
        ))}
        <text className="bridge-axis-name" x={150} y={axisY + 44} textAnchor="middle">
          metres from the start
        </text>
      </svg>

      <p className="fine">
        The upper arrow is the first step; the lower arrow is the second. A dot marks the end. Right
        is positive and left negative. Multiplying the two signed steps gives the product; squaring
        the final position removes its sign.
      </p>
      <table className="data-table">
        <caption>Every possible two-step walk, in the drawing’s row order</caption>
        <thead>
          <tr>
            <th scope="col">Steps</th>
            <th scope="col">Chance and outcome</th>
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row, index) => (
            <tr key={row.id}>
              <th scope="row">
                {index + 1}. {row.label}
              </th>
              <td>
                Chance:{" "}
                {rightPercent === 50
                  ? `1 in ${state.denominator}`
                  : `${stepNumber(100 * row.probability)}%${row.probability === 0 ? " (impossible here)" : ""}`}
                <br />
                End: {signedStepNumber(row.displacement)} m
                <br />
                Squared end: {row.square} m²
                <br />
                Product: {signedStepNumber(row.product)} m²
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="independent-steps-spread">
        <summary>Separate the average position from the spread</summary>
        <p>
          The end position averages {signedStepNumber(state.mean)} m. Its variance, the mean square
          distance from that average, is {stepNumber(state.variance)} m². The mean square distance
          from the start is {stepNumber(state.meanSquare)} m². A drifting walk can therefore have a
          nonzero average position as well as a spread.
        </p>
        <p>
          The covariance of the two steps is {signedStepNumber(state.covariance)} m². It measures
          their shared variation after subtracting each step’s average. Independent steps have zero
          covariance, even when they drift.
        </p>
      </details>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          With fresh fair coins, the four walks are equally likely. Their ends are −2, 0, 0 and +2
          metres. The squared ends are 4, 0, 0 and 4 square metres, averaging 2. The two positive
          and two negative products cancel, so each step contributes its own 1 square metre and
          nothing more.
        </p>
        <p>
          Copying the first step leaves two walks, both ending 2 metres from the start. Their
          squared ends average 4. Reversing it also leaves two walks, but both return to the start,
          so their squared ends average 0. Each step still averages zero in both cases. Zero
          averages alone do not let you drop the mixed term: independence is the missing condition
          in that argument.
        </p>
        <p>
          With independent steps and a 75% rightward chance, each step averages +0.5 m. Their
          product averages +0.25 m², so the mixed term adds +0.5 m² and the squared ends average 2.5
          m². Independence and zero mean do different jobs in the argument. The variance is 1.5 m²
          and the covariance remains zero.{" "}
          <a href="/foundations/mean-variance-rms/">Compare the three averages</a>.
        </p>
        <p>
          These fixed-length coin steps illustrate one assumption; they are not a molecular model of
          Brownian motion.{" "}
          <a href="/papers/brownian-motion/s4/#arg-bm-independent-steps">
            Return to the paper’s independent-step argument
          </a>
          , or <a href="/lab/bm-05/">compare many random steps in the laboratory</a>.
        </p>
      </div>
    </section>
  );
}
