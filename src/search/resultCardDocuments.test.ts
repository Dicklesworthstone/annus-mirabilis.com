import { expect, test } from "bun:test";
import { loadResultCards } from "../content/results/resultCards.ts";
import { createSearchEngine, searchResultHref } from "./core.ts";
import { resultCardDocuments } from "./resultCardDocuments.ts";

const root = process.cwd();
const papers = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"];

test("the result filter reaches every authored card on its own results face", () => {
  for (const paper of papers) {
    const records = loadResultCards(root, paper);
    expect(records?.problems).toEqual([]);
    const cards = records?.cards ?? [];
    expect(cards.length).toBeGreaterThan(0);
    const documents = resultCardDocuments(root, paper, paper, "scaffold");
    expect(documents.map(searchResultHref)).toEqual(
      cards.map((card) => `/papers/${paper}/view/results/#result-${card.id}`),
    );
    const engine = createSearchEngine(documents, []);
    for (const card of cards) {
      const hits = engine.search(card.title, { paper, type: "result" });
      expect(hits.some((hit) => hit.document.id === `result:${card.id}`)).toBe(true);
    }
    for (const profile of ["preview", "launch"] as const)
      expect(resultCardDocuments(root, paper, paper, profile)).toEqual([]);
  }
});
