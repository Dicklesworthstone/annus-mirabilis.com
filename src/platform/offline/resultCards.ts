import type { PrintedExcerpt, ResultCardRecord } from "../../content/results/resultCards.ts";
import type { Paper } from "../../content/schemas/reading.ts";
import { sourceUnitLabel } from "../../reader/facsimile/sourceUnitLabel.ts";
import { SITE_ORIGIN } from "../app-bridge/schemas.ts";

import { OFFLINE_ENGLISH_PREFIX } from "./sourceProjection.ts";

export type OfflineResultCard = Omit<ResultCardRecord, "printed"> & Readonly<{
  printed: readonly (PrintedExcerpt & Readonly<{
    english?: Readonly<{ scope: "quotation" | "paragraph"; starts: readonly string[] }>;
  }>)[];
}>;

/** A result travels with the section that owns it. Link to the exact printed passage
 * inside the download when available, even if the paper's online face uses another URL.
 */
export function renderChapterResults(
  cards: readonly OfflineResultCard[],
  paper: Paper,
  sectionId: string,
  printedIds: ReadonlySet<string>,
  prose: (text: string) => string,
): string {
  const resultCards = cards
    .filter((card) => card.paper === paper.id && card.section === sectionId)
    .map((card) => {
      const references = card.printed.map((excerpt) => {
        const anchors = excerpt.publishedSentenceIds?.length ? excerpt.publishedSentenceIds
          : excerpt.sentenceIds?.length ? excerpt.sentenceIds : [excerpt.anchor];
        const page = excerpt.page === undefined ? "" : excerpt.lastPage && excerpt.lastPage !== excerpt.page
          ? `, pp. ${excerpt.page}–${excerpt.lastPage}` : `, p. ${excerpt.page}`;
        function passageLink(anchor: string, language: "german" | "english", label: string) {
          const localId = (language === "english" ? OFFLINE_ENGLISH_PREFIX : "") + anchor;
          const local = printedIds.has(localId);
          const href = local ? "#" + encodeURIComponent(localId)
            : `${SITE_ORIGIN}/papers/${paper.id}/view/${language}/#${encodeURIComponent(anchor)}`;
          return `<a data-result-source="${language}" href="${href}">${prose(label)}${local ? "" : " (online)"}</a>`;
        }
        const links = anchors.map((anchor) =>
          passageLink(anchor, "german", "German, " + sourceUnitLabel(anchor, excerpt.kind, paper.sections.length > 1) + page),
        );
        if (excerpt.english) {
          const label = excerpt.english.scope === "paragraph" ? "English paragraph context" : "English translation";
          for (const [index, anchor] of excerpt.english.starts.entries()) {
            const part = excerpt.english.starts.length > 1 ? `, passage ${index + 1}` : "";
            links.push(passageLink(anchor, "english", label + part + page));
          }
        }
        return `<li>${links.join(" · ")}</li>`;
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
