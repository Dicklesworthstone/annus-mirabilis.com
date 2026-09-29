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

/**
 * THE COMPARISON A RECORD PROMISED AND NO READER WAS SHOWN (am-me-margin-entries-kfg5, dispatch 357).
 *
 * note-me-g-argument-comparison holds five questions against three arguments, fifteen authored cells,
 * and its own claim ends "The table below asks each of them the same five questions." Measured
 * 2026-09-28, nothing rendered it: marginRecords.ts validated the body and the only other file that
 * mentioned the record was its test. The prose promised a reader a table and showed them nothing.
 *
 * ROWS ARE QUESTIONS, COLUMNS ARE ARGUMENTS, which is the record's own shape and the one that survives
 * a narrow screen without reordering the DOM. At 560 px and below the cells become blocks, so the page
 * reads as five labelled groups of three answers; each cell therefore names its argument in words
 * (`comparison-which`), hidden where the column heading already says it. That label is real text in the
 * markup, not generated content, so it is found by the browser's own search and read by a screen reader.
 *
 * WHY NOT ONE STACKED BLOCK PER ARGUMENT at narrow width, which is the obvious alternative: it needs the
 * opposite DOM order from the matrix, so one of the two widths would read against the source order. The
 * comparison's value is reading three answers to ONE question together, and grouping by question keeps
 * that at every width.
 *
 * TWO COLUMNS SHARE ONE INSTRUMENT, and the link text is where that is made honest. Both the 1906 box and
 * the four-momentum reading are formalisms ME-03 selects with its own `mode` control, and ME-03 DECLARES
 * NO MODE, so neither is addressable and both rows resolve only as the bare `me-03` (4d1100c9).
 * `/lab/me-03/` opens at its 1905 ledger default, so a link promising the box or the four-momentum view
 * would not keep its word. Each link instead says which mode the reader must choose once there, which
 * distinguishes the two and tells the truth about the extra step. When me-03 declares its modes, as
 * sr-02 declares `apparatus`, these become deep addresses and the sentence gets shorter.
 *
 * NO REVIEW STATE REACHES THE READER (D-2026-09-25-no-review-status-banners): the record is
 * `reviewState: draft` and that word appears nowhere in the markup, only in `data-review-state` on the
 * note, where it already was. The no-claim line below says what is unreviewed in the site's own voice.
 */
function ComparisonTable({
  note,
  comparison,
}: {
  note: string;
  comparison: NonNullable<Margins["notes"][number]["comparison"]>;
}) {
  return (
    <figure className="margin-comparison">
      <table>
        <caption>
          Three routes to the same conclusion, each asked the same five questions. The cells are
          this site&rsquo;s own reading of the three arguments, not a verdict on which is better,
          and no physicist has reviewed them.
        </caption>
        <thead>
          <tr>
            <th scope="col">The question</th>
            {comparison.arguments.map((argument) => (
              <th key={argument.id} scope="col" data-argument-id={argument.id}>
                {argument.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.questions.map((question) => (
            <tr key={question.id} data-question-id={question.id}>
              <th scope="row">
                {question.label}
                {question.scopeCritical ? (
                  // A word, never a tint alone: this is the one question where the three routes
                  // genuinely differ in what they cover.
                  <span className="comparison-scope"> Where the three routes differ in scope.</span>
                ) : null}
              </th>
              {comparison.arguments.map((argument) => (
                <td key={argument.id} data-argument-id={argument.id}>
                  <b className="comparison-which">{argument.label}: </b>
                  <InlineMathText text={argument.cells[question.id] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fine">
        {comparison.arguments.map((argument, n) => (
          <span key={argument.id}>
            {n > 0 && " "}
            {argument.label}:{" "}
            <a href={`/lab/${argument.instrumentRef}/`}>{openingWords(argument)}</a>, and{" "}
            {/* Each link names its own row. Three links reading "the note this row cites" would be
                three different destinations under one name, which the link-name gate refuses and a
                screen reader cannot tell apart (WCAG 2.4.4); the misconception callouts carry the
                same rule for the same reason. */}
            <a href={`#note-${argument.sourceNoteId}`}>
              {argument.label}
              {"’"}s sources
            </a>
            {argument.sourceNoteId === note ? ", which is this note" : ""}.
          </span>
        ))}
      </p>
    </figure>
  );
}

/**
 * What a row's instrument link says. Two of the three rows address the same instrument because their
 * formalisms are its modes and no mode is addressable yet, so the words carry the difference and name
 * the step the reader still has to take. A row whose instrument needs no mode says so plainly.
 */
function openingWords(argument: { id: string; instrumentRef: string }): string {
  const instrument = argument.instrumentRef.toUpperCase();
  if (argument.id === "box-1906") return `Open ${instrument} and choose the 1906 box`;
  if (argument.id === "four-momentum-modern")
    return `Open ${instrument} and choose the four-momentum formalism`;
  return `Open ${instrument}`;
}

/**
 * The bibliography ids that denote the paper a margin is printed on (dispatch 546).
 *
 * Each paper record's own `citation` field is the authority. ONE paper needs more than that field
 * gives: mass-energy's `citation` is `ap-18-639`, whose bibliography record is the 1923
 * Perrett-Jeffery English translation and says so, while every margin record on that paper cites
 * `cit-einstein-1905-inertia`, the German original. Two records, one work. Keyed on `citation`
 * alone this repair would silently do nothing on the one paper whose margin is 16% of its page, so
 * the second id is named here with its reason rather than left to fail quietly.
 *
 * The duplication itself is not repaired here: which key names the mass-energy paper is an
 * editorial decision, and thirteen content files already cite `ap-18-639`.
 */
export const PAPER_OWN_CITATIONS: Readonly<Record<string, readonly string[]>> = {
  "light-quanta": ["ap-17-132"],
  "brownian-motion": ["ap-17-549"],
  "special-relativity": ["ap-17-891"],
  "mass-energy": ["ap-18-639", "cit-einstein-1905-inertia"],
};

export function PaperMargins({
  margins,
  paperId,
}: {
  margins: Margins;
  /** Omitted, every source prints in full, which is what a surface outside a paper page needs. */
  paperId?: string;
}) {
  const { misconceptions, notes, citations } = margins;
  const own = new Set(paperId ? (PAPER_OWN_CITATIONS[paperId] ?? []) : []);
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
              {note.comparison ? (
                <ComparisonTable note={note.id} comparison={note.comparison} />
              ) : null}
              <p className="fine">
                Sources:{" "}
                {note.sourceSupport.map((source, n) => {
                  const c = citations.get(source.citationId);
                  if (!c) return null;
                  // A source that IS this page's paper prints the journal locator alone. Measured on
                  // 1ec891a0: each of light-quanta's five entries opened with the paper's full
                  // German title, the title of the page the reader is standing on, before the volume
                  // line and the six words that locate the passage. The title goes; the journal
                  // locator stays, because volume and pages are what a reader carries to a library,
                  // and it carries the link out.
                  //
                  // A record citing its own paper as a WHOLE, with no locator, keeps the full
                  // citation: the journal line alone would not say which work it names.
                  const isOwnPaper = own.has(source.citationId) && Boolean(source.locator);
                  // Each source reads as one sentence: title, locator, the note's own page, and
                  // one full stop. A locator already ends in one, so it is dropped before the page.
                  const where = source.locator
                    ? `${c.locator.replace(/\.$/, "")}, ${source.locator}.`
                    : c.locator;
                  return (
                    <span key={`${source.citationId}-${source.locator ?? n}`}>
                      {n > 0 && " "}
                      {isOwnPaper ? (
                        <a href={c.url}>{where}</a>
                      ) : (
                        <>
                          <cite>
                            <a href={c.url}>{c.title}</a>
                          </cite>
                          {citationTitleClose(c.title)} {where}
                        </>
                      )}
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
