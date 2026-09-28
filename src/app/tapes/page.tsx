import { loadTeachingTapes } from "../../content/teachingTapes.ts";
import "./tapes.css";

/**
 * EVERY TEACHING TAPE (am-tape-reader-page).
 *
 * The index for the 21 authored tapes, grouped by the instrument each belongs to. It exists because
 * a laboratory page cannot list its own tapes without editing 44 hand-written pages: the lab routes
 * are one directory each rather than a dynamic segment, and the shared layout does not know which
 * laboratory it is wrapping. One link from that layout reaches here, and every tape here links back
 * to its instrument, so the two directions are joined at this page rather than at 44 of them.
 * Listing a lab's tapes inline on the lab page is a better reader experience and is its own unit.
 */
export const metadata = {
  title: "Teaching tapes",
  description:
    "Recorded walkthroughs of the instruments: what each one changes, in what order, and the numbers to expect.",
};

export default function Page() {
  const { tapes } = loadTeachingTapes();
  const byExperiment = new Map<string, typeof tapes>();
  for (const tape of tapes)
    byExperiment.set(tape.experimentId, [...(byExperiment.get(tape.experimentId) ?? []), tape]);
  const experiments = [...byExperiment.keys()].sort();
  const withNumbers = tapes.reduce(
    (n, t) => n + t.steps.filter((s) => s.expected.length > 0).length,
    0,
  );
  return (
    <main className="tape-page">
      <p className="eyebrow">Instruments</p>
      <h1>Teaching tapes</h1>
      <p className="tape-description">
        A teaching tape is a recorded walk through one instrument: where to start, what to change,
        in what order, and the numbers its author says you should see. {tapes.length} tapes cover{" "}
        {experiments.length} instruments, and {withNumbers} of their {""}
        {tapes.reduce((n, t) => n + t.steps.length, 0)} steps carry a number to check against.
      </p>
      <p className="tape-honesty">
        Each page shows what the author recorded. None of them runs the instrument for you: you set
        the values and compare.
      </p>
      {experiments.map((experimentId) => (
        <section key={experimentId} aria-labelledby={`tapes-${experimentId}`}>
          <h2 id={`tapes-${experimentId}`}>
            <a href={`/lab/${experimentId}/`}>{experimentId}</a>
          </h2>
          <ul className="tape-list">
            {(byExperiment.get(experimentId) ?? []).map((tape) => (
              <li key={tape.tapeId}>
                <a href={`/tapes/${tape.tapeId}/`}>{tape.title}</a>
                {tape.description ? <span className="tape-blurb">{tape.description}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
