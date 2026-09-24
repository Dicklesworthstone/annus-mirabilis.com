/**
 * Does search find what a reader types? (am-plat-search-index-snx1)
 *
 * Measured on live on 2026-09-24 through the palette, Chromium and WebKit at 390 and 1440, forty
 * queries a reader would type: 30 of 40 landed in the top three. These are the ten that missed, each
 * with the place a reader wants to land, plus the one diacritic fold the dispatch named. Each names
 * the part of the index or query layer that makes it land, so a red names what broke:
 *
 * - β, beta, gamma, N, k, V: the notation concordance, one document per printed glyph
 *   (notationDocuments) and its modern names as aliases (notationAliases). N, k and V also rely on
 *   a printed letter keeping its own document first, and on the exact spelling breaking the tie
 *   that case folding makes between k, K and k*.
 * - brownain, relativty: typo tolerance in createSearchEngine.
 * - Lichtquanten, Relativitätsprinzip, Lichtgeschwindigkeit: the German face's passages
 *   (germanSourceDocuments).
 * - Warme: the umlaut fold in normalizeSearchText.
 *
 * Two of these rest on a pair of rules, either of which is enough, so taking out one rule leaves
 * them green. That is redundancy, not a vacuous test. The umlaut is folded twice, by the explicit
 * ä-to-a replacement and again by stripping marks after NFD; "Warme" goes red only with both
 * removed. N lands through the printed-letter rule in notationAliases or the exact-spelling bonus
 * in createSearchEngine; with both removed, N, k and V go red, and with the bonus alone removed,
 * k and V do. Measured by planting each removal on 2026-09-24.
 *
 * "Top three" is what the palette shows first: repeats dropped, then grouped by kind in order of
 * first appearance (CommandPalette.ts), which is not always the engine's first three.
 */
import { expect, test } from "bun:test";
import { loadSearchCorpus } from "../../scripts/build-search-index.ts";
import { dropRepeatedHits } from "./CommandPalette.ts";
import {
  createSearchEngine,
  editDistance,
  normalizeSearchText,
  SEARCH_LIMITS,
  type SearchDocument,
  type SearchHit,
} from "./core.ts";

const { documents, aliases } = await loadSearchCorpus(process.cwd(), "scaffold");
const engine = createSearchEngine(documents, aliases);

function topThree(query: string): readonly SearchDocument[] {
  const groups = new Map<string, SearchHit[]>();
  for (const hit of dropRepeatedHits(engine.search(query, { limit: SEARCH_LIMITS.results })))
    groups.set(hit.document.type, [...(groups.get(hit.document.type) ?? []), hit]);
  return [...groups.values()]
    .flat()
    .slice(0, 3)
    .map((hit) => hit.document);
}

const printed = (glyph: string) => (d: SearchDocument) =>
  d.type === "glossary" && d.terms.includes(glyph);
const germanPassage = (paper: string | null, word: string) => (d: SearchDocument) =>
  d.type === "sentence-de" && (paper === null || d.paper === paper) && d.text.includes(word);

/** [query, what the reader should reach first, why]. */
const FIRST: readonly (readonly [string, (d: SearchDocument) => boolean, string])[] = [
  ["β", printed("β"), "the printed β, whose meanings say it is the modern γ"],
  ["beta", printed("β"), "the Greek name folds to the letter"],
  ["gamma", printed("β"), "the concordance's modern name for the relativity paper's β"],
  ["N", printed("N"), "the printed N (Avogadro's number), not ν or f renamed to a modern n"],
  ["k", printed("k"), "the printed k (viscosity in paper 2), not K or k*"],
  ["V", printed("V"), "the printed V (the light speed in paper 3), not v or V*"],
  ["brownain", (d) => d.id === "paper:brownian-motion", "one swapped pair from Brownian"],
  ["relativty", (d) => d.id === "paper:special-relativity", "one letter short of relativity"],
  ["Lichtquanten", germanPassage("light-quanta", "Lichtquant"), "the passages that print it"],
  [
    "Relativitätsprinzip",
    germanPassage("mass-energy", "Relativitätsprinzip"),
    "the passage that prints it",
  ],
  ["Lichtgeschwindigkeit", germanPassage(null, "Lichtgeschwindigkeit"), "a passage that prints it"],
];

test("the corpus holds the notation and the German passages these queries need", () => {
  // Explicit non-vacuity: with either kind absent, every query below would fail for a reason that
  // says nothing about ranking.
  expect(documents.filter((d) => d.type === "glossary").length).toBeGreaterThan(0);
  expect(documents.filter((d) => d.type === "sentence-de").length).toBeGreaterThan(0);
  expect(aliases.some((a) => a.label === "modern term")).toBe(true);
});

for (const [query, isTarget, why] of FIRST) {
  test(`"${query}" lands first on ${why}`, () => {
    const shown = topThree(query);
    expect(shown.map((d) => d.id)).not.toEqual([]);
    expect({ query, first: shown[0]?.id, reached: isTarget(shown[0] as SearchDocument) }).toEqual({
      query,
      first: shown[0]?.id,
      reached: true,
    });
  });
}

test('"Warme" without its umlaut reaches the Brownian paper\'s Wärme', () => {
  const reached = topThree("Warme")
    .filter(
      (d) =>
        d.paper === "brownian-motion" &&
        [d.title, d.text, ...d.terms].some((field) => field.includes("Wärme")),
    )
    .map((d) => d.id);
  expect(reached).not.toEqual([]);
});

test("a word spelled as the index spells it is never widened to its neighbours", () => {
  // Typo tolerance stands in only when a term matches nothing. Applied to every term, "Wien" would
  // also match German passages that print "wie" and never "Wien".
  const hits = engine.search("Wien", { limit: SEARCH_LIMITS.results });
  expect(hits.length).toBeGreaterThan(0);
  const strays = hits
    .map((hit) => hit.document)
    .filter((d) => !normalizeSearchText([d.title, d.text, ...d.terms].join(" ")).includes("wien"))
    .map((d) => d.id);
  expect(strays).toEqual([]);
});

test("edit distance counts a swapped pair as one edit and stops past its limit", () => {
  expect(editDistance("brownain", "brownian", 2)).toBe(1);
  expect(editDistance("relativty", "relativity", 2)).toBe(1);
  expect(editDistance("wien", "wien", 1)).toBe(0);
  expect(editDistance("wien", "wein", 1)).toBe(1);
  expect(editDistance("photon", "proton", 1)).toBe(1);
  expect(editDistance("entropy", "energy", 1)).toBeGreaterThan(1);
});
