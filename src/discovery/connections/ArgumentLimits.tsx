import { citationTitleClose } from "../../content/citationTitle.ts";
import type { CitationRole } from "../../content/schemas/reading.ts";
import { InlineMathText } from "../../reader/InlineMathText.tsx";
import { ARGUMENT_LIMIT_LABELS, type ArgumentLimit } from "./argumentLimits.ts";

const SOURCE_ROLE_LABELS: Readonly<Record<CitationRole, string>> = {
  primary: "Primary source",
  "comparison-witness": "Comparison witness",
  secondary: "Later scholarship",
  technical: "Reference data",
};

function passageLabel(id: string): string {
  const match = /^s(\d+)-p(\d+)$/.exec(id);
  if (!match) return id;
  return match[1] === "0" ? `Paragraph ${match[2]}` : `§${match[1]}, paragraph ${match[2]}`;
}

/** Full source-derived notes in native disclosures: readable before JavaScript runs. */
export function ArgumentLimits({ entries }: { entries: readonly ArgumentLimit[] }) {
  return (
    <section
      className="reading page-flush"
      id="argument-limits"
      aria-labelledby="argument-limits-heading"
    >
      <p className="eyebrow">Four papers · Assumptions, conventions and later debate</p>
      <h2 id="argument-limits-heading">Where the arguments reach their limits</h2>
      <p>
        Six notes from the papers’ margins: an approximation, a step beyond a model, a convention,
        a disputed argument and the scope of the historical claims. Open a note to read its full
        account and follow the cited passages.
      </p>
      {entries.map((entry) => {
        const id = `argument-limit-${entry.id}`;
        const { note } = entry;
        return (
          <article
            key={note.id}
            id={id}
            aria-labelledby={`${id}-heading`}
            data-paper={entry.paper}
            data-limit-kind={entry.kind}
            data-note-id={note.id}
            data-note-kind={note.kind}
            data-historical-statement={note.historicalStatement}
            data-review-state={note.reviewState}
          >
            <p className="eyebrow">
              {entry.paperLabel} · {ARGUMENT_LIMIT_LABELS[entry.kind]}
            </p>
            <h3 id={`${id}-heading`}>{entry.heading}</h3>
            <details>
              <summary>Read the note and its sources</summary>
              {note.historicalStatement === "site-reconstruction" && (
                <p className="eyebrow">A route you could take</p>
              )}
              <p>
                <InlineMathText text={note.claim} />
              </p>
              <h4 id={`${id}-sources`}>Sources</h4>
              <ul className="fine" aria-labelledby={`${id}-sources`}>
                {entry.sources.map(({ citation, locator }, index) => {
                  const where = locator
                    ? `${citation.locator.replace(/\.$/, "")}, ${locator}.`
                    : citation.locator;
                  return (
                    <li
                      key={`${citation.id}-${index}`}
                      data-citation-id={citation.id}
                      data-citation-role={citation.role}
                    >
                      <cite>
                        <a href={citation.url}>{citation.title}</a>
                      </cite>
                      {citationTitleClose(citation.title)} {where}{" "}
                      {SOURCE_ROLE_LABELS[citation.role]}.
                    </li>
                  );
                })}
              </ul>
              <h4 id={`${id}-passages`}>Return to the paper</h4>
              <ul aria-labelledby={`${id}-passages`}>
                {note.affectedIds.map((passage) => (
                  <li key={passage}>
                    <a href={`/papers/${entry.paper}/view/english/#${passage}`}>
                      {entry.paperLabel}: {passageLabel(passage)}
                    </a>
                  </li>
                ))}
                <li>
                  <a href={`/papers/${entry.paper}/#note-${note.id}`}>
                    Read “{entry.heading}” in the {entry.paperLabel} margin
                  </a>
                </li>
              </ul>
            </details>
          </article>
        );
      })}
    </section>
  );
}
