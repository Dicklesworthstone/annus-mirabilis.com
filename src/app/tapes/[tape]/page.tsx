import { notFound } from "next/navigation";
import { loadTeachingTapes } from "../../../content/teachingTapes.ts";
import "../tapes.css";

/**
 * ONE TEACHING TAPE, AS A WALKTHROUGH A READER CAN FOLLOW (am-tape-reader-page).
 *
 * AGENTS.md names five teaching tapes as a feature and describes a scrubber that restores one.
 * Measured 2026-09-27, all 21 authored tapes reached no reader by any route: the replayer and the
 * recorder had no non-test consumer, no tour cited a tape, and the only implementation of the
 * replayer's `resolveTeachingTape` hook was a test fixture. The records were complete and nothing
 * read them.
 *
 * WHY A PAGE AND NOT A BUTTON. A tape is already a worked walkthrough on paper: initial conditions,
 * a sequence of changes each carrying the command class it belongs to, and at the checkpoints a
 * label, a teaching note and the numbers the author says to expect, with the unit and the constant
 * set each was computed under. Rendered as a page, all of that reaches a reader with no JavaScript,
 * on a slow phone, and through a shared link, which a control inside an instrument does not. The
 * instrument is one press away at the top and the bottom.
 *
 * WHAT THE PAGE DOES NOT CLAIM. It does not run anything. Every number here is the number the author
 * recorded, shown as an expectation, and the page says so rather than presenting it as a result.
 * Making the instrument replay the tape is the next unit and needs the hook implemented against
 * these records; until then this page says plainly that the reader sets the values.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return loadTeachingTapes().tapes.map((tape) => ({ tape: tape.tapeId }));
}

export async function generateMetadata({ params }: { params: Promise<{ tape: string }> }) {
  const { tape: tapeId } = await params;
  const tape = loadTeachingTapes().tapes.find((t) => t.tapeId === tapeId);
  if (!tape) return {};
  return {
    title: `${tape.title}: a teaching tape`,
    description: (tape.description ?? `A recorded walkthrough of ${tape.experimentId}.`).slice(
      0,
      160,
    ),
  };
}

export default async function Page({ params }: { params: Promise<{ tape: string }> }) {
  const { tape: tapeId } = await params;
  const tape = loadTeachingTapes().tapes.find((t) => t.tapeId === tapeId);
  if (!tape) notFound();
  const conditions = Object.entries(tape.initialConditions);
  const lab = `/lab/${tape.experimentId}/`;
  return (
    <main className="tape-page">
      <p className="eyebrow">A teaching tape for {tape.experimentId}</p>
      <h1>{tape.title}</h1>
      {tape.description ? <p className="tape-description">{tape.description}</p> : null}
      <p className="tape-to-lab">
        <a href={lab}>Open {tape.experimentId} and follow it</a>
      </p>

      {conditions.length > 0 ? (
        <section aria-labelledby="tape-start">
          <h2 id="tape-start">Where it starts</h2>
          <table className="tape-table">
            <caption>
              The settings the tape begins from
              {tape.constantSetId ? `, under the constant set ${tape.constantSetId}` : ""}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Setting</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map(([name, value]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section aria-labelledby="tape-steps">
        <h2 id="tape-steps">What it changes, and what to expect</h2>
        <ol className="tape-steps">
          {tape.steps.map((step) => (
            <li key={step.actionIndex}>
              <p className="tape-change">
                {step.parameterId ? (
                  <>
                    Set <b>{step.parameterId}</b>
                    {step.value === undefined ? null : <> to {step.value}</>}
                  </>
                ) : (
                  <>Step {step.actionIndex}</>
                )}
                {step.commandClass ? (
                  <span className="tape-command-class"> ({step.commandClass})</span>
                ) : null}
              </p>
              {step.label ? <p className="tape-step-label">{step.label}</p> : null}
              {step.teachingNote ? <p className="tape-note">{step.teachingNote}</p> : null}
              {step.expected.length > 0 ? (
                <table className="tape-table">
                  <caption>What the author recorded that a reader should see here.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Quantity</th>
                      <th scope="col">Expected</th>
                      <th scope="col">Under</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.expected.map((value) => (
                      <tr key={value.label}>
                        <th scope="row">{value.label}</th>
                        <td>
                          {value.value}
                          {value.unit ? ` ${value.unit}` : ""}
                        </td>
                        <td>{value.constantSetId ?? tape.constantSetId ?? "the lab's own set"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="tape-honesty">
        These are the values the tape&apos;s author recorded, not a result this page computed.
        Nothing here runs the instrument. Set them yourself in <a href={lab}>{tape.experimentId}</a>{" "}
        and compare what it gives you.
      </p>
      <p className="tape-to-lab">
        <a href="/tapes/">Every teaching tape</a>
      </p>
    </main>
  );
}
