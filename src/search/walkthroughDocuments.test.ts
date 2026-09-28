/**
 * EVERY RECORDED WALKTHROUGH IS FINDABLE BY NAME.
 *
 * Measured 2026-09-28 against the published shards before this landed: 966 documents covering
 * /papers/, /foundations/ and /lab/, and ZERO for /tapes/. The 22 walkthrough pages went live this
 * week and the index never learned about them, so a reader searching "the boost to 0.6c" found
 * nothing while the page sat one link away. The "tour" type had been declared in SEARCH_TYPES and
 * used by no document at all.
 *
 * The population comes from the records, never from a list typed here, so a 23rd walkthrough is
 * covered the day it is authored.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTeachingTapes } from "../content/teachingTapes.ts";
import { tapePath } from "../reader/sitePaths.ts";
import { validateSearchDocument } from "./core.ts";
import { walkthroughDocuments } from "./documents.ts";

const { tapes } = loadTeachingTapes();
const projection = tapes.map((tape) => ({
  id: tape.tapeId,
  title: tape.title,
  description: tape.description ?? "",
  route: tapePath(tape.tapeId),
  paper: tape.passages[0]?.paper ?? "",
  paperTitle: tape.passages[0]?.paperTitle ?? "",
  instrumentId: tape.instrument?.id ?? tape.experimentId,
  sectionTitles: tape.passages.map((passage) => passage.sectionTitle),
}));
const documents = walkthroughDocuments(projection, "scaffold");

describe("recorded walkthroughs are in the search corpus", () => {
  test("one document per authored walkthrough, and there are some", () => {
    console.log(`[walkthrough search] ${documents.length} documents from ${tapes.length} tapes`);
    expect(tapes.length).toBeGreaterThan(15);
    expect(documents.length).toBe(tapes.length);
  });

  test("each carries the tour type, its paper, and a title a reader would type", () => {
    for (const document of documents) {
      expect(document.type).toBe("walkthrough");
      expect(document.paper.length).toBeGreaterThan(0);
      expect(document.title.length).toBeGreaterThan(0);
      expect(document.route.startsWith("/tapes/")).toBe(true);
    }
  });

  test("the dotted id keeps the form the host answers 200 for, and the others keep the slash", () => {
    // The whole point of routing through tapePath rather than a template: a hand-built
    // `/tapes/${id}/` would send every searcher for this walkthrough through a 308 (am-tpzn).
    const dotted = documents.find((d) => d.id === "walkthrough:the-boost-to-0.6c");
    expect(dotted).toBeDefined();
    expect(dotted?.route).toBe("/tapes/the-boost-to-0.6c");
    const plain = documents.find((d) => d.id === "walkthrough:coin-to-bell");
    expect(plain?.route).toBe("/tapes/coin-to-bell/");
  });

  test("every route the builder emits is one the document validator accepts", () => {
    // validateSearchDocument runs inside the builder, so reaching this line already proves it; the
    // assertion is here so a future change that bypasses the validator is caught rather than
    // silently producing links the search page would refuse to render.
    for (const document of documents) expect(() => validateSearchDocument(document)).not.toThrow();
  });

  test("the index builder actually calls this, which the tests above cannot show", () => {
    // Every assertion above drives walkthroughDocuments DIRECTLY, so all of them stay green if the
    // call is deleted from scripts/build-search-index.ts and no walkthrough is ever indexed. That
    // is the self-concealing shape AGENTS.md warns about, so this is the coarse half that watches
    // the wiring: it reads the script's source, which proves the call exists and not that it runs.
    // The half that would prove it runs needs a built index, and the index is gitignored.
    const script = readFileSync(join(process.cwd(), "scripts/build-search-index.ts"), "utf8");
    expect(script).toContain("walkthroughDocuments(walkthroughs, profile)");
    expect(script).toContain("loadTeachingTapes(root)");
  });

  test("a walkthrough that resolves no passage still gets a document, scoped cross-paper", () => {
    // No authored tape is in this state today (all 22 resolve a passage), so this is asserted on
    // the builder rather than through the corpus. A dropped document is a page a reader cannot
    // find, which is the failure this builder exists to end.
    const orphan = walkthroughDocuments(
      [
        {
          id: "orphan-tape",
          title: "An orphan walkthrough",
          description: "",
          route: "/tapes/orphan-tape/",
          paper: "",
          paperTitle: "",
          instrumentId: "bm-01",
          sectionTitles: [],
        },
      ],
      "scaffold",
    );
    expect(orphan.length).toBe(1);
    expect(orphan[0]?.paper).toBe("cross-paper");
  });
});
