import { inlineMathPlain } from "../content/inlineMath.ts";
import { loadResultCards } from "../content/results/resultCards.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

/** Project the same records and fragment identifiers as the paper's results face. */
export function resultCardDocuments(
  root: string,
  paper: string,
  paperTitle: string,
  profile: SearchProfile,
): readonly SearchDocument[] {
  if (searchProfile(profile) !== "scaffold") return [];
  const edition = loadResultCards(root, paper);
  if (!edition) return [];
  if (edition.problems.length > 0)
    throw new TypeError(`Unresolved results for ${paper}: ${edition.problems.join("\n")}`);

  return edition.cards.map((card) =>
    validateSearchDocument({
      id: `result:${card.id}`,
      type: "result",
      paper,
      section: card.section,
      lang: "en",
      route: `/papers/${paper}/view/results/`,
      anchor: `result-${card.id}`,
      face: "",
      title: card.title,
      text: [
        card.oneSentence,
        ...card.qualifications.map((item) => item.text),
        ...card.probes.map((item) => item.question),
      ]
        .map(inlineMathPlain)
        .join(" "),
      terms: card.probes.map((item) => item.instrumentId),
      scopeLabel: `${paperTitle} · result card`,
    }),
  );
}
