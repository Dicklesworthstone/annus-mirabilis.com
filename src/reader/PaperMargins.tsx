/**
 * A paper's common wrong turns and historian's margin, as two sections at the end of its
 * explanation page (dispatch 163). Static markup: the callouts are <details>, and nothing here
 * needs JavaScript. Each section renders only when the paper has records, so a paper without them
 * is unchanged.
 *
 * Every entry is a draft and says so. A callout's instrument link carries the "not yet reviewed"
 * marker because no review record covers any entry yet; the build gate that would refuse an
 * unreviewed entry (misconceptions/interventionGate.ts) belongs to the callout bead and is not
 * wired here. The callout shows the Full-explanation reading; following the reader's Detail
 * setting is the callout bead's too.
 */
import { citationTitleClose } from "../content/citationTitle.ts";
import type { EditorialNoteKind } from "../content/schemas/source.ts";
import { labName } from "./actions/labNames.ts";
import { InlineMathText } from "./InlineMathText.tsx";
import type { PaperMargins as Margins } from "./marginRecords.ts";
import { MisconceptionCallout } from "./misconceptions/MisconceptionCallout.tsx";

const NOTE_LABELS: Readonly<Record<EditorialNoteKind, string>> = {
  "historian-margin": "Historian’s margin",
  correction: "Correction",
  typographical: "Typographical note",
  dispute: "A disputed point, as the record stands",
  "side-note": "Editorial note",
};

export function PaperMargins({ margins }: { margins: Margins }) {
  const { misconceptions, notes, citations } = margins;
  return (
    <>
      {misconceptions.length > 0 && (
        <section
          className="reading reading-column"
          id="common-wrong-turns"
          aria-labelledby="common-wrong-turns-heading"
        >
          <h2 id="common-wrong-turns-heading">Common wrong turns</h2>
          <p className="fine">
            Things often said about this paper, what makes each one tempting, and what the paper and
            later evidence support. Drafts, not yet reviewed.
          </p>
          {misconceptions.map((m) => {
            const instrument = m.intervention.instrumentId ?? m.instrumentIds?.[0];
            return (
              <MisconceptionCallout
                key={m.id}
                misconception={m}
                detail={1}
                modernLens={false}
                interventionStatus={{ state: "not-yet-reviewed" }}
                instrumentHref={instrument ? `/lab/${instrument}/` : undefined}
                instrumentName={instrument ? labName(instrument) : undefined}
              />
            );
          })}
        </section>
      )}
      {notes.length > 0 && (
        <section
          className="reading reading-column"
          id="historians-margin"
          aria-labelledby="historians-margin-heading"
        >
          <h2 id="historians-margin-heading">Historian’s margin</h2>
          <p className="fine">
            What was written, by whom and when, from the sources cited. Drafts, not yet reviewed.
          </p>
          {notes.map((note) => (
            <article
              key={note.id}
              id={`note-${note.id}`}
              data-note-id={note.id}
              data-note-kind={note.kind}
              data-review-state={note.reviewState}
            >
              <h3>{NOTE_LABELS[note.kind]}</h3>
              <p>
                <InlineMathText text={note.claim} />
              </p>
              <p className="fine">
                Sources:{" "}
                {note.sourceSupport.map((source, n) => {
                  const c = citations.get(source.citationId);
                  if (!c) return null;
                  // Each source reads as one sentence: title, locator, the note's own page, and
                  // one full stop. A locator already ends in one, so it is dropped before the page.
                  const where = source.locator
                    ? `${c.locator.replace(/\.$/, "")}, ${source.locator}.`
                    : c.locator;
                  return (
                    <span key={`${source.citationId}-${source.locator ?? n}`}>
                      {n > 0 && " "}
                      <cite>
                        <a href={c.url}>{c.title}</a>
                      </cite>
                      {citationTitleClose(c.title)} {where}
                    </span>
                  );
                })}
              </p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
