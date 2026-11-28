import { expect, test } from "bun:test";
import { loadResultCards } from "../../content/results/resultCards.ts";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { loadPaperPayload } from "../../content/compiler/serverLoaders.ts";
import { alignChapterResults, loadOfflineSectionSources } from "./SourceSection.tsx";
import { renderChapterResults } from "./resultCards.ts";
import { offlineMarkupIds } from "./sourceProjection.ts";

test("the saved Brownian osmotic-pressure result carries its evidence from the next section in both languages", async () => {
  const paper = "brownian-motion";
  const edition = await loadBilingualEdition(paper);
  const result = loadResultCards(process.cwd(), paper);
  const cards = alignChapterResults(result?.cards ?? [], edition);
  const attachment = await loadOfflineSectionSources(
    process.cwd(),
    edition,
    "s1",
    "scaffold",
    cards,
  );
  expect(attachment).not.toBeNull();
  const ids = offlineMarkupIds(attachment?.html ?? "");
  const card = cards.find(
    (item) => item.section === "s1" && item.printed.some((excerpt) => excerpt.anchor === "s2-p8"),
  );
  expect(card).toBeDefined();
  if (!card) throw Error("The cross-section result is missing.");
  const { paper: payload } = await loadPaperPayload(paper);
  const html = renderChapterResults([card], payload, "s1", ids, (text) => text);
  expect(html).toContain('data-result-source="english"');
  expect(html).not.toContain("(online)");
  for (const match of html.matchAll(/data-result-source="(?:english|german)" href="#([^"]+)"/g)) {
    expect(ids.has(decodeURIComponent(match[1]!))).toBe(true);
  }
  const outside = card.printed.find((excerpt) => excerpt.anchor === "s2-p8")!;
  expect(outside.english?.scope).toBe("quotation");
  expect(html).toContain('href="#en-' + outside.english?.starts[0] + '"');
  expect(ids.has("s2-p8")).toBe(true);
  expect(ids.has("s2-p1")).toBe(false);
});

test("non-contiguous English citations link each run and broader alignment is labeled as context", async () => {
  const paper = "brownian-motion";
  const edition = await loadBilingualEdition(paper);
  const records = loadResultCards(process.cwd(), paper)?.cards ?? [];
  const original = records.find((item) =>
    item.printed.some((excerpt) => (excerpt.publishedSentenceIds?.length ?? 0) >= 3),
  );
  const excerpt = original?.printed.find((p) => (p.publishedSentenceIds?.length ?? 0) >= 3);
  if (!original || !excerpt?.publishedSentenceIds)
    throw Error("Expected a multi-sentence result excerpt");
  const subset = {
    ...excerpt,
    publishedSentenceIds: [excerpt.publishedSentenceIds[0]!, excerpt.publishedSentenceIds.at(-1)!],
  };
  const context = { ...excerpt, publishedSentenceIds: [] };
  const cards = alignChapterResults([{ ...original, printed: [subset, context] }], edition);
  const { paper: payload } = await loadPaperPayload(paper);
  const sources = await loadOfflineSectionSources(
    process.cwd(),
    edition,
    original.section,
    "scaffold",
    cards,
  );
  const html = renderChapterResults(
    cards,
    payload,
    original.section,
    offlineMarkupIds(sources?.html ?? ""),
    (text) => text,
  );
  expect(html).toContain("English translation, passage 1");
  expect(html).toContain("English translation, passage 2");
  expect(html).toContain("English paragraph context");
  expect(html).not.toContain("(online)");
});
