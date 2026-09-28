import { wrongTurnsForLab } from "../../content/labWrongTurns.ts";
import { InlineMathText } from "../../reader/InlineMathText.tsx";

/**
 * A LABORATORY SAYS WHICH WRONG TURNS IT ANSWERS, which is the other half of a link that ran one
 * way (dispatch after 423).
 *
 * A misconception record names its instrument and the callout draws "See it in the instrument".
 * Nothing pointed back: measured on rendered output on 2026-09-28, 14 laboratories were named by 22
 * records and not one of the 14 pages contained the word misconception, a wrong turn, or a link to
 * an entry. This renders the claim as the record states it, the record's own one-breath answer, and
 * a link to the full entry where the sources and the anchors are.
 *
 * THE SHAPE FOLLOWS LabTapes, for the same reason it gives: the laboratory routes are one directory
 * each, so src/app/lab/layout.tsx cannot know which instrument it wraps, and a client component
 * reading the pathname would ship the map to every page. This renders NOTHING for a laboratory no
 * record names, so it is safe on any laboratory page, and labWrongTurns.test.tsx asserts that every
 * laboratory a record names renders a link to that record, so a laboratory that gains a record and
 * not the component is a red test rather than a silence.
 *
 * THE CLAIMS CARRY MATHEMATICS. Eight of the bound records' claim or overview fields hold
 * `\( ... \)` inline mathematics, among them "The paper derives \(E=mc^2\)" and the tau entry, so
 * both fields go through InlineMathText exactly as the callout's do. Printed raw, a reader would
 * have been shown the LaTeX, which is the one thing the edition says never reaches a page.
 *
 * WHAT IT DOES NOT SAY. Not that the laboratory settles the claim, which is a judgement no schema
 * can carry: the heading says these are wrong turns the laboratory speaks to, the answer shown is
 * the record's, and the record is one press away with its own evidence. The records are drafts and
 * none has been reviewed by a person, so nothing here is presented as a verdict.
 */
export function LabWrongTurns({ lab }: { lab: string }) {
  const turns = wrongTurnsForLab(lab);
  if (turns.length === 0) return null;
  return (
    <section className="reading" aria-labelledby={`wrong-turns-${lab}`}>
      <p className="eyebrow">Before you draw a conclusion</p>
      <h2 id={`wrong-turns-${lab}`}>
        {turns.length === 1
          ? "A common wrong turn this instrument speaks to"
          : "Common wrong turns this instrument speaks to"}
      </h2>
      <ul>
        {turns.map((turn) => (
          <li key={turn.id}>
            <p>
              <strong>
                <InlineMathText text={turn.claim} />
              </strong>
            </p>
            <p>
              <InlineMathText text={turn.overview} />
            </p>
            <p>
              <a href={turn.href}>Read the full entry, with its sources</a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
