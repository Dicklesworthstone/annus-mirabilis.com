"use client";

import { type FormEvent, useId, useState } from "react";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import {
  DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT,
  doubleSignedDisplacements,
  evaluateSignedDisplacementDraft,
  type SignedDisplacementEvaluation,
  type SignedDisplacementSnapshot,
} from "./signedDisplacementExercise.ts";
import { formatSignedDisplacement } from "./signedDisplacements.ts";

const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const draftOf = (snapshot: SignedDisplacementSnapshot) => snapshot.entries.map(String);

/** The signed-displacement first encounter, restricted to the desk's arithmetic question. */
export function SignedDisplacementExercise({
  title = "Zero average is not no movement",
}: {
  title?: string;
}) {
  const id = useId();
  const [accepted, setAccepted] = useState(DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT);
  const [draft, setDraft] = useState(() => draftOf(DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT));
  const [revision, setRevision] = useState(0);
  const [refused, setRefused] = useState<Extract<
    SignedDisplacementEvaluation,
    { kind: "refused" }
  > | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function accept(result: SignedDisplacementEvaluation, replaceDraft = false) {
    if (result.kind === "refused") {
      setRefused(result);
      setAnnouncement("");
      return;
    }
    setAccepted(result.data);
    if (replaceDraft) setDraft(draftOf(result.data));
    setRefused(null);
    setRevision((current) => current + 1);
    setAnnouncement(
      `Coordinates applied. Signed total ${number(result.data.totals.signedSum)} units; mean distance ignoring direction ${number(result.data.totals.meanAbsolute)} units; mean square ${number(result.data.totals.meanSquare)} squared units.`,
    );
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    accept(evaluateSignedDisplacementDraft(draft));
  }

  return (
    <section
      className="encounter"
      aria-labelledby={`${id}-title`}
      data-encounter-id="entrance-brownian-motion"
      data-exercise="signed-displacements"
      data-mode="1904"
      data-accepted-revision={revision}
      data-currency-state={refused ? "refused" : "current"}
    >
      <header>
        <p className="eyebrow">A mathematical observation exercise</p>
        <h3 id={`${id}-title`}>{title}</h3>
        <span className="badge">
          {revision === 0 ? "Static worked example" : "Calculated from your coordinates"}
        </span>
        <p>
          Begin with three steps left, one left, one right, and three right. All four marks have
          moved from their starting point, even though their signed displacements add to zero.
        </p>
        <p className="notice">
          These are authored arithmetic examples in exercise units, not a measured dataset. The
          marks below describe chosen endpoints; no physical motion is simulated.
        </p>
      </header>

      <form onSubmit={apply} aria-label="Signed displacement coordinates">
        <fieldset aria-describedby={`${id}-domain`}>
          <legend>Choose the four signed displacements</legend>
          <p className="fine" id={`${id}-domain`}>
            Use whole numbers from −1,000,000 to +1,000,000 exercise units. A negative number is
            left of the start; a positive number is right. Values outside this arithmetic range are
            refused, never rounded or clamped.
          </p>
          <div className="input-grid">
            {accepted.rows.map((row, index) => (
              <div className="input-field" key={row.id}>
                <label htmlFor={`${id}-${row.id}`}>{row.label} displacement (units)</label>
                <input
                  id={`${id}-${row.id}`}
                  name={row.id}
                  type="text"
                  value={draft[index] ?? ""}
                  aria-invalid={refused?.fieldIndex === index ? true : undefined}
                  aria-describedby={
                    refused?.fieldIndex === index ? `${id}-refusal` : `${id}-domain`
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) =>
                      current.map((entry, at) => (at === index ? value : entry)),
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <div className="actions">
            <button type="submit">Apply coordinates</button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(doubleSignedDisplacements(accepted), true)}
            >
              Double the shown displacements
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                accept({ kind: "accepted", data: DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT }, true)
              }
            >
              Restore the authored example
            </button>
          </div>
        </fieldset>
        {refused ? (
          <p id={`${id}-refusal`} role="alert" className="notice error">
            {refusalSentence(refused.refusal)} The table and totals still show the last accepted
            coordinates.
          </p>
        ) : null}
      </form>

      <noscript>
        <p className="notice">
          JavaScript is off. The authored coordinates and their worked arithmetic remain below.
          Editing the coordinates requires JavaScript.
        </p>
      </noscript>
      <p role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">
        {announcement}
      </p>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need access to this horizontally scrollable table. */}
      <section className="table-scroll" aria-label="Accepted displacements table" tabIndex={0}>
        <table>
          <caption>Accepted displacements and two ways to retain their magnitude</caption>
          <thead>
            <tr>
              <th scope="col">Mark</th>
              <th scope="col">Direction and distance</th>
              <th scope="col">Signed displacement (units)</th>
              <th scope="col">Distance ignoring direction (units)</th>
              <th scope="col">Square (squared units)</th>
            </tr>
          </thead>
          <tbody>
            {accepted.rows.map((row) => (
              <tr key={row.id} data-displacement-row={row.id}>
                <th scope="row">{row.label}</th>
                <td>{row.description}</td>
                <td>{formatSignedDisplacement(row.displacement)}</td>
                <td>{number(row.absolute)}</td>
                <td>{number(row.square)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="table-scroll" aria-label="Displacement summaries table">
        <table>
          <caption>Different summaries answer different questions</caption>
          <tbody>
            <tr>
              <th scope="row">Signed total</th>
              <td data-output="signed-sum">{number(accepted.totals.signedSum)} units</td>
            </tr>
            <tr>
              <th scope="row">Mean signed displacement</th>
              <td data-output="mean-signed">{number(accepted.totals.meanSigned)} units</td>
            </tr>
            <tr>
              <th scope="row">Mean distance, ignoring direction</th>
              <td data-output="mean-absolute">{number(accepted.totals.meanAbsolute)} units</td>
            </tr>
            <tr>
              <th scope="row">Mean square</th>
              <td data-output="mean-square">{number(accepted.totals.meanSquare)} squared units</td>
            </tr>
          </tbody>
        </table>
      </section>

      <details>
        <summary>Why can a zero average hide movement?</summary>
        <p>
          A signed total asks which direction predominates. Equal amounts to the left and right
          cancel. Ignoring direction and squaring are both sensible ways to retain how far the marks
          lie from the start. In the authored example their means are 2 units and 5 squared units.
          Doubling those displacements gives 4 units and 20 squared units.
        </p>
        <p>
          These summaries describe the selected endpoints. They do not identify what caused a
          particle to move. The example supplies no elapsed time, so it also makes no claim about a
          speed or a law of growth in time.
        </p>
      </details>
    </section>
  );
}
