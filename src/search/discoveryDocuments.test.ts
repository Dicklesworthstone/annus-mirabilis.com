/**
 * THE FOUR DISCOVERY ROUTES ARE FINDABLE BY NAME.
 *
 * AGENTS.md calls the discovery journeys the site's signature content. Measured 2026-09-28 against
 * the published shards, /discover/ had ZERO documents: the routes were reachable only by browsing to
 * them, and as of bd1743eb from the foot of their own paper.
 *
 * The population is ROUTE_INDEX itself, so a fifth route is covered the day it is written.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSearchCorpus } from "../../scripts/build-search-index.ts";
import { ROUTE_INDEX } from "../discovery/routeIndex.ts";
import { createSearchEngine, SEARCH_LIMITS, validateSearchDocument } from "./core.ts";
import { discoveryDocuments } from "./documents.ts";

const documents = discoveryDocuments(ROUTE_INDEX, "scaffold");

describe("discovery routes are in the search corpus", () => {
  test("one document per route, and there are some", () => {
    console.log(
      `[discovery search] ${documents.length} documents from ${ROUTE_INDEX.length} routes`,
    );
    expect(ROUTE_INDEX.length).toBeGreaterThan(3);
    expect(documents.length).toBe(ROUTE_INDEX.length);
  });

  test("each carries the discovery type, its paper, and the route's own address", () => {
    for (const route of ROUTE_INDEX) {
      const document = documents.find((d) => d.id === `discovery:${route.slug}`);
      expect(document).toBeDefined();
      expect(document?.type).toBe("discovery");
      expect(document?.paper).toBe(route.slug);
      expect(document?.route).toBe(`/discover/${route.slug}/`);
      expect(document?.title).toBe(route.name);
    }
  });

  test("a reader searching a STEP's words reaches the route that contains it", () => {
    // The steps have names and no addresses of their own, so they are in the document's text rather
    // than being documents. Without this the route would only be findable by its own title, which is
    // the name of the paper and already matches a dozen other documents.
    let checked = 0;
    for (const route of ROUTE_INDEX) {
      const document = documents.find((d) => d.id === `discovery:${route.slug}`);
      for (const step of route.steps) {
        expect(document?.text).toContain(step);
        checked += 1;
      }
    }
    // Floored on a measured count: 8 to 9 steps on each of four routes.
    expect(checked).toBeGreaterThan(25);
  });

  test("every document the builder emits is one the validator accepts", () => {
    for (const document of documents) expect(() => validateSearchDocument(document)).not.toThrow();
  });

  test("a reader can actually reach a route through the engine, not just through the corpus", async () => {
    // The assertions above prove the documents EXIST and are well formed. None of them proves a
    // reader finds one, and the fix that made "brownain" land on the paper again works by removing
    // weight from these documents, so the obvious way to over-correct is to make them unreachable.
    // This searches the real corpus through the real engine.
    const { documents: corpus, aliases } = await loadSearchCorpus(process.cwd(), "scaffold");
    const engine = createSearchEngine(corpus, aliases);
    const route = ROUTE_INDEX.find((entry) => entry.slug === "special-relativity");
    expect(route).toBeDefined();
    const step = route?.steps[0] ?? "";
    expect(step.length).toBeGreaterThan(8);
    const hits = engine.search(step, { limit: SEARCH_LIMITS.results });
    expect(hits.some((hit) => hit.document.id === "discovery:special-relativity")).toBe(true);
  }, 120_000);

  test("the index builder actually calls this, which the tests above cannot show", () => {
    // The coarse half, as in walkthroughDocuments.test.ts: every assertion above drives the builder
    // directly and stays green if the call is deleted from the script. Reading the source proves the
    // call exists, not that it runs; proving it runs needs a built index, and the index is
    // gitignored.
    const script = readFileSync(join(process.cwd(), "scripts/build-search-index.ts"), "utf8");
    expect(script).toContain("discoveryDocuments(ROUTE_INDEX, profile)");
  });
});
