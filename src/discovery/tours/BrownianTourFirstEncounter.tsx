"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import type { EntranceRecord } from "../../content/entrances/entranceRecord.ts";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import {
  doubleSignedDisplacements,
  evaluateSignedDisplacementDraft,
  evaluateSignedDisplacements,
  type SignedDisplacementEvaluation,
  type SignedDisplacementSnapshot,
} from "../../reader/entrances/signedDisplacementExercise.ts";
import { AUTHORED_BROWNIAN_DISPLACEMENTS } from "../../reader/entrances/signedDisplacements.ts";
import "./massEnergyTour.css";

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
const draftOf = (snapshot: SignedDisplacementSnapshot) => snapshot.entries.map(String);
type Refused = Extract<SignedDisplacementEvaluation, { kind: "refused" }>;

function summaries(snapshot: SignedDisplacementSnapshot) {
  return [
    { id: "mean-signed", label: "Average shift, with direction", value: snapshot.totals.meanSigned, unit: "units" },
    { id: "mean-absolute", label: "Average distance, ignoring direction", value: snapshot.totals.meanAbsolute, unit: "units" },
    { id: "mean-square", label: "Square each distance, then average", value: snapshot.totals.meanSquare, unit: "squared units" },
    { id: "typical-distance", label: "Typical distance from the square-first method", value: snapshot.totals.rootMeanSquare, unit: "units" },
  ] as const;
}

/**
 * The Brownian tour's first encounter. All arithmetic, typed input admission and doubling belong
 * to the existing signed-displacement owner. This view shows words and numbers, including its
 * initial worked comparison; it never mounts the full entrance's algebra or hidden formula panels.
 */
export function BrownianTourFirstEncounter({ record }: { record: EntranceRecord }) {
  const id = useId();
  const [initial] = useState(() =>
    evaluateSignedDisplacements(record.authoredEntries ?? AUTHORED_BROWNIAN_DISPLACEMENTS),
  );
  const [accepted, setAccepted] = useState<SignedDisplacementSnapshot | null>(
    initial.kind === "accepted" ? initial.data : null,
  );
  const [draft, setDraft] = useState(() =>
    initial.kind === "accepted" ? draftOf(initial.data) : [],
  );
  const [refused, setRefused] = useState<Refused | null>(
    initial.kind === "refused" ? initial : null,
  );
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => setReady(true), []);

  function accept(result: SignedDisplacementEvaluation) {
    if (result.kind === "refused") {
      setRefused(result);
      setAnnouncement("");
      return;
    }
    setAccepted(result.data);
    setDraft(draftOf(result.data));
    setRefused(null);
    setAnnouncement(
      "Positions applied. Average signed shift: " + number.format(result.data.totals.meanSigned) +
      " units. Average distance ignoring direction: " + number.format(result.data.totals.meanAbsolute) +
      " units. Average squared distance: " + number.format(result.data.totals.meanSquare) + " squared units.",
    );
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    accept(evaluateSignedDisplacementDraft(draft));
  }

  if (initial.kind === "refused" || !accepted)
    return (
      <section id="entry-brownian-motion" className="encounter">
        <h3>{record.question}</h3>
        <p className="notice">
          This arithmetic example could not be prepared.{" "}
          {initial.kind === "refused" ? refusalSentence(initial.refusal) : null}
        </p>
        <a href="/papers/brownian-motion/s5/#s5">Read the section 5 passage (this shows equations)</a>
      </section>
    );

  const doubled = doubleSignedDisplacements(initial.data);
  const workedRows = summaries(initial.data);
  const doubledRows = doubled.kind === "accepted" ? summaries(doubled.data) : null;
  const dirty = draft.some((entry, index) => entry !== String(accepted.entries[index]));

  return (
    <section
      id="entry-brownian-motion"
      className="encounter mass-energy-tour-instrument"
      aria-labelledby={id + "-title"}
      data-encounter-id={record.id}
      data-tour-entrance="brownian-motion"
    >
      <header>
        <p className="eyebrow">First encounter · Words and numbers</p>
        <h3 id={id + "-title"}>{record.question}</h3>
        <p>{record.story}</p>
        <p className="notice">
          An authored arithmetic example in exercise units, not a measured dataset. These are
          chosen endpoints; no physical motion or elapsed time is simulated.
        </p>
      </header>

      <form onSubmit={apply}>
        <fieldset className="mass-energy-tour-controls" disabled={!ready} aria-describedby={id + "-domain"}>
          <legend>Try different endpoints</legend>
          <p id={id + "-domain"} className="fine">
            Enter whole numbers from negative one million to positive one million. Negative
            means left; positive means right. Nothing changes until you apply the positions.
          </p>
          <div className="input-grid">
            {accepted.rows.map((row, index) => (
              <label key={row.id} htmlFor={id + "-" + row.id}>
                {row.label}
                <input
                  id={id + "-" + row.id}
                  name={row.id}
                  type="text"
                  inputMode="text"
                  value={draft[index] ?? ""}
                  aria-invalid={refused?.fieldIndex === index ? true : undefined}
                  aria-describedby={refused?.fieldIndex === index ? id + "-refusal" : id + "-domain"}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) => current.map((entry, at) => at === index ? value : entry));
                  }}
                />
              </label>
            ))}
          </div>
          <button type="submit">Apply positions</button>
          <button type="button" onClick={() => accept(doubleSignedDisplacements(accepted))}>
            Double the shown distances
          </button>
          <button type="button" onClick={() => accept(initial)}>
            Restore the authored example
          </button>
        </fieldset>
        {dirty ? <p className="fine">Draft positions have not been applied. The tables still show the accepted example.</p> : null}
        {refused ? (
          <p id={id + "-refusal"} role="alert" className="notice">
            {refusalSentence(refused.refusal)} The tables still show the last accepted positions.
          </p>
        ) : null}
      </form>
      <noscript>
        <p>The worked tables are available without JavaScript. Editing the positions requires JavaScript.</p>
      </noscript>
      <p role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">{announcement}</p>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the table may scroll at narrow widths and must remain keyboard-reachable. */}
      <section className="mass-energy-tour-table" aria-label="Accepted endpoints" tabIndex={0}>
        <table>
          <caption>Where the chosen endpoints lie</caption>
          <thead><tr><th scope="col">Mark</th><th scope="col">Direction and distance</th></tr></thead>
          <tbody>
            {accepted.rows.map((row) => (
              <tr key={row.id} data-displacement-row={row.id}>
                <th scope="row">{row.label}</th><td>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the summary table remains reachable if its text needs horizontal scrolling. */}
      <section className="mass-energy-tour-table" aria-label="Accepted spread summaries" tabIndex={0}>
        <table data-brownian-tour-current>
          <caption>Different summaries of the accepted endpoints</caption>
          <tbody>
            {summaries(accepted).map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td data-output={row.id} data-value={row.value}>{number.format(row.value)} {row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details open>
        <summary>Compare the original example with doubled distances</summary>
        <p>
          Inspect how these summaries describe the chosen endpoints. Opposite directions can
          cancel in the average signed shift even when the marks lie away from the start.
          Ignoring direction and squaring first both retain distance, but answer different questions.
        </p>
        {doubledRows ? (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the three-column worked comparison may scroll on a narrow device.
          <section className="mass-energy-tour-table" aria-label="Worked distance comparison" tabIndex={0}>
            <table data-brownian-tour-worked>
              <caption>Authored endpoints, then every distance doubled</caption>
              <thead><tr><th scope="col">Summary</th><th scope="col">Original</th><th scope="col">Doubled</th></tr></thead>
              <tbody>
                {workedRows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td>{number.format(row.value)} {row.unit}</td>
                    <td>{number.format(doubledRows[index]!.value)} {row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : <p>The doubled example is outside this arithmetic exercise's range.</p>}
        <p>
          Doubling every distance doubles the average distance, while the average squared distance
          becomes four times as large. Taking the square root brings that last summary back to
          distance units. This comparison changes the chosen endpoints; it does not by itself
          establish a law about time.
        </p>
      </details>

      <section className="entrance-bridge" aria-labelledby={id + "-bridge"}>
        <h4 id={id + "-bridge"}>Carry the question into the paper</h4>
        <p>New skill: {record.bridge.newSkill}</p>
        <p>{record.bridge.whyUsefulHere}</p>
        <p>
          Independent steps that favor neither direction have a useful additive rule for their
          mean squares. The next part of the tour asks what that implies about spreading over time.
        </p>
        <div className="guided-tour-actions">
          <a href="/foundations/mean-variance-rms/" data-foundation="mean-variance-rms" data-return-caption="Back to the Brownian entrance">
            Explore averages and spread (this leaves the equation-free path)
          </a>
          <a href="/lab/bm-01/">Open the tracer laboratory in full (this shows equations)</a>
          <a href="/papers/brownian-motion/s5/#s5">Read the section 5 passage (this shows equations)</a>
        </div>
      </section>
    </section>
  );
}
