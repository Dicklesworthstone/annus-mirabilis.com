import { loadTeachingTapes } from "../../content/teachingTapes.ts";
import tapeLinks from "../../generated/tape-links.json";
import { tapePath } from "../../reader/sitePaths.ts";
import "./tapes.css";

/**
 * EVERY TEACHING TAPE (am-2rl9).
 *
 * The index for every authored tape, grouped by the instrument each belongs to. It exists because
 * a reader who has not yet chosen an instrument has nowhere else to meet them: the lab routes are
 * one directory each rather than a dynamic segment, so the shared layout cannot know which
 * laboratory it is wrapping, and a reader would have to already be inside the right one.
 *
 * TWO CLAIMS IN THIS BLOCK HAVE SINCE BEEN OVERTAKEN and are corrected rather than left standing.
 * It said "the 21 authored tapes", which drifted the day a 22nd was written; the counts a reader
 * sees are derived and this no longer states one. And it said that listing a lab's own tapes
 * inline "is its own unit", which shipped as bb350fac: LabTapes renders nothing where there is no
 * tape, so it sits on every laboratory page that has one. The two directions are joined at both
 * ends now, and this page is the catalogue rather than the only route.
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
  // DERIVED, because this sentence was wrong for four commits. It read "None of them runs the
  // instrument for you: you set the values and compare", which was true until b5abbea3 gave 20 of
  // the 22 a link that opens their instrument already set up. A count taken from the generated
  // links cannot fall out of step with them the way a sentence did.
  const opening = Object.keys(tapeLinks.links).length;
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
        Each page shows what the author recorded, not a result the page computed. {opening} of them
        open their instrument with the walkthrough&apos;s first settings already in place;{" "}
        {tapes.length - opening === 1
          ? "on the other you set them"
          : `on the other ${tapes.length - opening} you set them`}{" "}
        yourself. Either way the instrument does the calculating and you compare.
      </p>
      {experiments.map((experimentId) => {
        // Every tape in a group names the same instrument, so the first one carries its name.
        const instrument = byExperiment.get(experimentId)?.[0]?.instrument;
        return (
          <section key={experimentId} aria-labelledby={`tapes-${experimentId}`}>
            {/* The instrument's id and the name its manifest gives it (am-2rl9).
              NOT the accessible-name table, whose entries are whole sentences written
              to complete "Try it: ..." and read as broken English in a heading. */}
            <h2 id={`tapes-${experimentId}`}>
              <a href={`/lab/${experimentId}/`}>{instrument?.id ?? experimentId}</a>
              {instrument ? `, ${instrument.name}` : null}
            </h2>
            <ul className="tape-list">
              {(byExperiment.get(experimentId) ?? []).map((tape) => (
                <li key={tape.tapeId}>
                  <a href={tapePath(tape.tapeId)}>{tape.title}</a>
                  {tape.description ? <span className="tape-blurb">{tape.description}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
