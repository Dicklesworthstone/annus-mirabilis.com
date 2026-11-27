import type { ResultCardRecord } from "../../content/results/resultCards.ts";
import type { Paper } from "../../content/schemas/reading.ts";
import { sourceUnitLabel } from "../../reader/facsimile/sourceUnitLabel.ts";
import { SITE_ORIGIN } from "../app-bridge/schemas.ts";

/** A result travels with the section that owns it. Link to the exact printed passage
 * inside the download when available, even if the paper's online face uses another URL.
 */
export function renderChapterResults(
  cards: readonly ResultCardRecord[],
  paper: Paper,
  sectionId: string,
  printedIds: ReadonlySet<string>,
  prose: (text: string) => string,
): string {
  const resultCards = cards
    .filter((card) => card.paper === paper.id && card.section === sectionId)
    .map((card) => {
      const references = card.printed.map((excerpt) => {
        const anchor = excerpt.sentenceIds?.length === 1 ? excerpt.sentenceIds[0]! : excerpt.anchor;
        const local = printedIds.has(anchor);
        const fragment = "#" + encodeURIComponent(anchor);
        const href = local ? fragment : `${SITE_ORIGIN}/papers/${paper.id}/view/german/${fragment}`;
        const place = sourceUnitLabel(anchor, excerpt.kind, paper.sections.length > 1);
        const page = excerpt.page === undefined ? "" : excerpt.lastPage && excerpt.lastPage !== excerpt.page
          ? `, pp. ${excerpt.page}–${excerpt.lastPage}` : `, p. ${excerpt.page}`;
        return `<li><a href="${href}">${prose(place + page)}${local ? "" : " (online)"}</a></li>`;
      });
      const qualifications = card.qualifications.map((item) =>
        `<li><strong>${prose(item.kind[0]!.toUpperCase() + item.kind.slice(1))}</strong> — ${prose(item.text)}</li>`,
      );
      const cardId = "result-" + encodeURIComponent(card.id);
      return `<article id="${cardId}"><h3>${prose(card.title)}</h3><p>${prose(card.oneSentence)}</p>${
        qualifications.length ? "<ul>" + qualifications.join("") + "</ul>" : ""
      }<h4>Where the paper states it</h4><ul>${references.join("")}</ul><a href="${SITE_ORIGIN}/papers/${paper.id}/view/results/#${cardId}">Full result card online</a></article>`;
    });
  return resultCards.length
    ? `<section id="chapter-results"><h2>Results in this section</h2>${resultCards.join("\n")}</section>`
    : "";
}
