/**
 * A paper's common wrong turns and historian's margin, as two sections at the end of its
 * explanation page (dispatch 163). Static markup: the callouts are <details>, and nothing here
 * needs JavaScript. Each section renders only when the paper has records, so a paper without them
 * is unchanged.
 *
 * No entry says it is a draft (D-2026-09-25-no-review-status-banners). A callout's instrument link
 * carries the gate's "not-yet-reviewed" verdict as data, because no review record covers any entry
 * yet, and shows no words about it; the build gate that would refuse an
 * unreviewed entry (misconceptions/interventionGate.ts) belongs to the callout bead and is not
 * wired here. The callout shows the Full-explanation reading; following the reader's Detail
 * setting is the callout bead's too.
 */
import { citationTitleClose } from "../content/citationTitle.ts";
import type { EditorialNoteKind } from "../content/schemas/source.ts";
import misconceptionLinks from "../generated/misconception-links.json";
import { labName } from "./actions/labNames.ts";
import { InlineMathText } from "./InlineMathText.tsx";
import type { PaperMargins as Margins } from "./marginRecords.ts";
import { MisconceptionCallout } from "./misconceptions/MisconceptionCallout.tsx";

/**
 * What scripts/generate-misconception-links.ts writes for a record whose instrument accepts the
 * settings of the preset it names. A record with no entry has a recorded cause in that same file.
 */
type MisconceptionLinkMap = Readonly<
  Record<string, Readonly<{ href: string; presetId: string; kind: string }> | undefined>
>;

const NOTE_LABELS: Readonly<Record<EditorialNoteKind, string>> = {
  "historian-margin": "Historian’s margin",
  correction: "Correction",
  typographical: "Typographical note",
  dispute: "A disputed point, as the record stands",
  "side-note": "Editorial note",
};

/**
 * WHICH REGISTER A NOTE IS WRITTEN IN, WHERE A READER NEEDS TO BE TOLD (am-me-margin-entries-kfg5,
 * dispatch 337). AGENTS.md keeps four historical statements apart and says of the fourth, the site's
 * own reconstruction: it "is always labeled 'A route you could take,' never 'What Einstein thought'".
 * The corpus has carried the register since ce87e624 and no reader was shown it.
 *
 * THE CHOICE, STATED RATHER THAN DEFAULTED. Only `site-reconstruction` is given words. The other
 * three - what the paper asserts, what was publicly available, what there is evidence Einstein knew
 * or used - are all claims ABOUT THE HISTORICAL RECORD, which is what this section's own opening
 * line already promises a reader. Labelling each of them would put three chips on the page to
 * distinguish cases a reader is not at risk of confusing, and would dilute the one distinction that
 * matters here: between the record and this site's reconstruction of a route through it. So they
 * render nothing visible.
 *
 * Every note carries its register as `data-historical-statement` whether or not it is shown, so the
 * page keeps what the corpus knows, a test can read it, and a later bead that wants the other three
 * on the page does not have to re-derive them. A note with no register - every margin record of the
 * other three papers today - carries no attribute and shows nothing.
 */
const REGISTER_LABELS: Readonly<Record<string, string | undefined>> = {
  "site-reconstruction": "A route you could take",
  "paper-asserts": undefined,
  "publicly-available": undefined,
  "einstein-knew-or-used": undefined,
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
            later evidence support.
          </p>
          {misconceptions.map((m) => {
            const instrument = m.intervention.instrumentId ?? m.instrumentIds?.[0];
            // THE SETTING THAT SHOWS THE POINT, WHERE ONE EXISTS (dispatch 331). AGENTS.md says a
            // misconception "opens an instrument preset that shows it", and this link was a bare
            // `/lab/<id>/`: the reader landed on the default view and had to find the setting
            // themselves. scripts/generate-misconception-links.ts builds a `?tape=` link from the
            // preset the record names, through the LABORATORY'S OWN binding and validator, so a link
            // exists only where that instrument accepts those settings. 12 of the 17 callouts that
            // name an instrument carry one; the other 5 fall back to the plain path here, and the
            // generated file records the cause for each (three laboratories have no shared-link
            // binding at all, two records name no registered preset).
            const settingsHref = instrument
              ? (misconceptionLinks.links as MisconceptionLinkMap)[m.id]?.href
              : undefined;
            return (
              <MisconceptionCallout
                key={m.id}
                misconception={m}
                detail={1}
                modernLens={false}
                interventionStatus={{ state: "not-yet-reviewed" }}
                instrumentHref={settingsHref ?? (instrument ? `/lab/${instrument}/` : undefined)}
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
            What was written, by whom and when, from the sources cited. A note that is this
            site&rsquo;s own reconstruction rather than the record says so under its heading.
          </p>
          {notes.map((note) => (
            <article
              key={note.id}
              id={`note-${note.id}`}
              data-note-id={note.id}
              data-note-kind={note.kind}
              data-historical-statement={note.historicalStatement}
              data-review-state={note.reviewState}
            >
              <h3>{NOTE_LABELS[note.kind]}</h3>
              {note.historicalStatement && REGISTER_LABELS[note.historicalStatement] ? (
                <p className="eyebrow">{REGISTER_LABELS[note.historicalStatement]}</p>
              ) : null}
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
