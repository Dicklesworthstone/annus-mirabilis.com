/**
 * Search reaches the translation and the German a reader can open (dispatch 214).
 *
 * The index held the explanations and the German of three papers, and no English at all: a search
 * for "principle of relativity" found explanation passages and never the translation, and special
 * relativity's German, which its face renders from the edition because the paper has no drafted
 * ledger, was not indexed either. Each language face is now indexed through its own loader
 * (scripts/build-search-index.ts), one document per heading, paragraph and footnote.
 *
 * What this watches, from the page a hit opens rather than from the index's own fields: every
 * English and German document lands on an id its face really renders, an English query finds the
 * translation, and every language face of the registry is classified for search.
 */
import { describe, expect, test } from "bun:test";
import { loadSearchCorpus } from "../../scripts/build-search-index.ts";
import type { Inline } from "../content/schemas/inlines.ts";
import { loadBilingualEdition } from "../reader/faces/bilingualLoader.ts";
import { FACE_IDS, FACE_REGISTRY } from "../reader/faces/registry.ts";
import { PaperPage } from "../reader/PaperPage.tsx";
import { exportMarkup } from "../testing/exportMarkup.ts";
import {
  createSearchEngine,
  SEARCH_LIMITS,
  type SearchDocument,
  searchResultHref,
} from "./core.ts";
import { assertSearchFaceCoverage, SEARCH_LANGUAGE_FACES } from "./documents.ts";

const { documents, aliases } = await loadSearchCorpus(process.cwd(), "scaffold");
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

/** The element ids a paper's face renders, from its exported page. */
const faceIds = new Map<string, Set<string>>();
async function idsOn(paperId: string, face: "english" | "german"): Promise<Set<string>> {
  const key = `${paperId}:${face}`;
  const cached = faceIds.get(key);
  if (cached) return cached;
  const html = await exportMarkup(await PaperPage({ paperId, face } as never));
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] as string));
  faceIds.set(key, ids);
  return ids;
}

const of = (type: SearchDocument["type"], paper: string) =>
  documents.filter((d) => d.type === type && d.paper === paper);

describe("search reaches the language faces", () => {
  test("every paper's English is indexed, and each document lands on an id the English face renders", async () => {
    for (const paper of PAPERS) {
      const english = of("sentence-en", paper);
      // Non-vacuity: all four papers' English is final, so each has documents to check.
      expect(english.length).toBeGreaterThan(0);
      const ids = await idsOn(paper, "english");
      for (const d of english) {
        expect(searchResultHref(d)).toBe(`/papers/${paper}/view/english/#${d.anchor}`);
        expect(ids.has(d.anchor)).toBe(true);
        expect(d.lang).toBe("en");
        expect(d.scopeLabel).toContain(FACE_REGISTRY.english.label);
        // The review line keeps its capitals: "checked by AI agents", never "ai agents".
        expect(/\bai\b/u.test(d.scopeLabel)).toBe(false);
      }
    }
  });

  test('"principle of relativity" finds special relativity\'s English translation', async () => {
    const engine = createSearchEngine(documents, aliases);
    const hits = engine
      .search("principle of relativity", { limit: SEARCH_LIMITS.results })
      .map((hit) => hit.document);
    const translation = hits.find(
      (d) => d.type === "sentence-en" && d.paper === "special-relativity",
    );
    expect(translation).toBeDefined();
    const [path, anchor] = searchResultHref(translation as SearchDocument).split("#");
    expect(path).toBe("/papers/special-relativity/view/english/");
    expect((await idsOn("special-relativity", "english")).has(anchor ?? "")).toBe(true);
    // The document says what it is: the translation, not an explanation of it.
    expect(translation?.scopeLabel).toContain("English translation");
  });

  test("special relativity's German is indexed from the edition its face renders, at ids that face has", async () => {
    const german = of("sentence-de", "special-relativity");
    expect(german.length).toBeGreaterThan(0);
    const ids = await idsOn("special-relativity", "german");
    for (const d of german) {
      expect(ids.has(d.anchor)).toBe(true);
      // The face labels its unreviewed edition, and so does every hit.
      expect(d.scopeLabel.toLowerCase()).toContain("not reviewed");
    }
  });

  test("a term's and a reference's own words are searchable in the English, as the face prints them", async () => {
    // Read through the English face's own loader. A first draft of the text helper kept only
    // "text" inlines, so mass-energy's "(l. c. § 8)" dropped out of its paragraph's document.
    let checked = 0;
    for (const paper of PAPERS) {
      const edition = await loadBilingualEdition(paper);
      const texts = of("sentence-en", paper).map((d) => d.text);
      const walk = (inlines: readonly Inline[]): void => {
        for (const node of inlines) {
          if (node.kind === "emphasis") walk(node.inlines);
          else if (node.kind === "term" || node.kind === "reference") {
            expect(texts.some((t) => t.includes(node.text))).toBe(true);
            checked += 1;
          }
        }
      };
      for (const unit of edition?.units ?? []) walk(unit.inlines);
    }
    // Non-vacuity: mass-energy's English carries references.
    expect(checked).toBeGreaterThan(0);
  });

  test("every language face of the registry is classified for search, and an unknown one refuses", () => {
    const language = FACE_IDS.filter((id) => FACE_REGISTRY[id].isLanguageFace);
    expect(language.length).toBeGreaterThan(0);
    expect(() => assertSearchFaceCoverage(language)).not.toThrow();
    expect(Object.keys(SEARCH_LANGUAGE_FACES).sort()).toEqual([...language].sort());
    expect(() => assertSearchFaceCoverage(["latin"])).toThrow(/latin/u);
  });
});
