/**
 * THE 1904 SHELF AS SEARCH DOCUMENTS (am-ahgo).
 *
 * `knowledge-card` was the LAST declared search type with real records behind it and no builder:
 * measured on the index of 2026-10-22, `timeline`, `person` and `essay` had no records at all,
 * while these 46 cards had been rendering on the four `/discover/<paper>/` pages since September
 * with `id="card-<id>"` on every one. The reason recorded for the silence, "no page of their own
 * yet", is true of a dedicated route and not of reachability.
 *
 * Two assertions here are worth more than the rest. The ANCHOR, because a wrong one fails
 * invisibly -- the reader lands at the top of a long discover page, which looks like a page rather
 * than like a defect; `src/testing/searchAnchorsResolve.test.ts` holds every indexed anchor to the
 * built HTML, so the spelling is checked against the page and not agreed between two files. And
 * the BIJECTION against the real `JOURNEY_SHELVES`, because a builder that quietly dropped a card
 * would leave a smaller index that looks exactly like a correct one.
 *
 * The counts here are REPORTED, not asserted: a card added to a shelf is correct work and must not
 * turn this red (AGENTS.md, "A Count Is For Reporting, Not For Asserting"). What is asserted is
 * that every card gets exactly one document and no document names a card that does not exist.
 */
import { describe, expect, test } from "bun:test";
import { JOURNEY_SHELVES } from "../discovery/cards/journeyCards.ts";
import { searchResultHref } from "./core.ts";
import {
  knowledgeCardDocuments,
  knowledgeCardTerms,
  type SearchKnowledgeCard,
} from "./documents.ts";
import { TYPE_LABELS } from "./typeLabels.ts";

const SHELF_CARD: SearchKnowledgeCard = Object.freeze({
  id: "stokes-1851-sphere-drag",
  paper: "brownian-motion",
  paperTitle: "Brownian motion",
  proposition:
    "A sphere of radius a moving slowly and uniformly at speed v through a fluid of viscosity eta is held back by a force F = 6 pi eta a v.",
  status: "available",
  dateLine: "Published 1851",
  limits: "He gives it only for motion so slow that the square of the speed may be neglected.",
  onShelf: true,
});

const LATER_CARD: SearchKnowledgeCard = Object.freeze({
  id: "perrin-1909-molecular-reality",
  paper: "brownian-motion",
  paperTitle: "Brownian motion",
  proposition: "Perrin's emulsions gave Avogadro's number from several independent routes.",
  status: "later",
  dateLine: "Published, 1909-09",
  limits: "Four years after the paper, so it is a later check and never one of its premises.",
  onShelf: false,
});

describe("knowledgeCardDocuments", () => {
  test("the card's own heading is the title, and the href reaches its own element", () => {
    const [document] = knowledgeCardDocuments([SHELF_CARD], "scaffold");
    expect(document).toBeDefined();
    expect(document?.type).toBe("knowledge-card");
    expect(document?.title).toBe(SHELF_CARD.proposition);
    expect(document?.text).toBe(SHELF_CARD.limits);
    expect(document?.paper).toBe("brownian-motion");
    expect(searchResultHref(document as NonNullable<typeof document>)).toBe(
      "/discover/brownian-motion/#card-stokes-1851-sphere-drag",
    );
  });

  test("the scope line distinguishes the shelf from later evidence, in the reader's words", () => {
    const [onShelf] = knowledgeCardDocuments([SHELF_CARD], "scaffold");
    const [later] = knowledgeCardDocuments([LATER_CARD], "scaffold");
    expect(onShelf?.scopeLabel).toContain("on the 1904 shelf");
    expect(onShelf?.scopeLabel).toContain("published 1851");
    expect(later?.scopeLabel).toContain("never a premise");
    // The distinction is the epistemic one AGENTS.md draws, so it must not be lost in wording.
    expect(later?.scopeLabel).not.toContain("on the 1904 shelf");
  });

  test("the type has a reader-facing heading already, which is why only the builder was missing", () => {
    expect(TYPE_LABELS["knowledge-card"]).toBe("Knowledge cards");
  });

  test("a profile other than scaffold indexes none, as the unverified records require", () => {
    expect(knowledgeCardDocuments([SHELF_CARD, LATER_CARD], "preview")).toEqual([]);
    expect(knowledgeCardDocuments([SHELF_CARD, LATER_CARD], "launch")).toEqual([]);
  });

  test("documents come back in id order, so a shard's contents do not depend on shelf order", () => {
    const ids = knowledgeCardDocuments([LATER_CARD, SHELF_CARD], "scaffold").map((d) => d.id);
    expect(ids).toEqual([
      "knowledge-card:perrin-1909-molecular-reality",
      "knowledge-card:stokes-1851-sphere-drag",
    ]);
  });
});

describe("knowledgeCardTerms", () => {
  test("a surname and a year come out of an authored id, including a two-word name", () => {
    expect(knowledgeCardTerms("stokes-1851-sphere-drag")).toEqual(["stokes", "1851"]);
    expect(knowledgeCardTerms("michelson-morley-1887-no-drift")).toEqual([
      "michelson morley",
      "1887",
    ]);
    expect(knowledgeCardTerms("de-sitter-1913-double-stars")).toEqual(["de sitter", "1913"]);
  });

  test("a card that names no person yields no name term", () => {
    // The one id of the 46 with no year segment: a concept rather than somebody's result.
    expect(knowledgeCardTerms("equipartition-mean-resonator-energy")).toEqual([]);
    // A defensive case the corpus does not contain: a year with nothing before it is not a name.
    expect(knowledgeCardTerms("1905-something")).toEqual([]);
  });

  test("einstein is excluded from the heaviest field, keeping its year", () => {
    expect(knowledgeCardTerms("einstein-1905-light-complex-transformation")).toEqual(["1905"]);
  });
});

describe("the real shelves, read as the three gates read them", () => {
  const rows: SearchKnowledgeCard[] = JOURNEY_SHELVES.flatMap((shelf) =>
    [[true, shelf.shelf] as const, [false, shelf.laterEvidence] as const].flatMap(
      ([onShelf, cards]) =>
        cards.map((card) => ({
          id: card.id,
          paper: shelf.journey,
          paperTitle: shelf.journey,
          proposition: card.proposition,
          status: card.status,
          dateLine: "Published 1900",
          limits: card.limits ?? "",
          onShelf,
        })),
    ),
  );

  test("every card on every shelf becomes exactly one document, and none is invented", () => {
    const documents = knowledgeCardDocuments(rows, "scaffold");
    const cardIds = new Set(rows.map((row) => row.id));
    const documented = documents.map((d) => d.id.replace(/^knowledge-card:/, ""));
    console.log(
      `[knowledge-card documents] ${rows.length} card(s) on ${JOURNEY_SHELVES.length} shelves ` +
        `-> ${documents.length} document(s); ${rows.filter((r) => r.onShelf).length} on the 1904 shelf, ` +
        `${rows.filter((r) => !r.onShelf).length} later evidence; ` +
        `${documents.filter((d) => d.terms.length > 0).length} carry a name or year a reader might type`,
    );
    // Non-vacuity on purpose: an empty population would satisfy every equality below.
    expect(rows.length).toBeGreaterThan(20);
    expect(documents).toHaveLength(rows.length);
    expect(new Set(documented)).toEqual(cardIds);
    expect(new Set(documents.map((d) => d.id)).size).toBe(documents.length);
  });

  test("every document carries a non-empty heading and its own card anchor", () => {
    for (const document of knowledgeCardDocuments(rows, "scaffold")) {
      const id = document.id.replace(/^knowledge-card:/, "");
      expect(document.anchor).toBe(`card-${id}`);
      expect(document.route).toMatch(/^\/discover\/[a-z-]+\/$/);
      expect(document.title.trim().length).toBeGreaterThan(0);
    }
  });

  test("the 46 propositions are long, which is why the title is not shortened here", () => {
    // Recorded rather than asserted as a ceiling: the title IS the card's summary heading, and
    // `validateSearchDocument` bounds a title at 1000 characters, so a long one is admitted.
    const lengths = rows.map((row) => row.proposition.length).sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)] as number;
    console.log(
      `[knowledge-card titles] proposition length min ${lengths[0]} median ${median} max ${lengths[lengths.length - 1]}`,
    );
    expect(median).toBeGreaterThan(100);
    expect(lengths[lengths.length - 1]).toBeLessThan(1000);
  });
});
