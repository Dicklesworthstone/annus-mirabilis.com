/**
 * THE GUIDED READING PATHS ARE FINDABLE BY NAME, FROM BOTH SOURCES.
 *
 * The last of the three guided layers to be indexed. Measured 2026-09-28, /tours/ had ZERO search
 * documents while the "tour" type sat in SEARCH_TYPES describing exactly these and holding nothing.
 *
 * THE POINT OF THIS FILE IS THE POPULATION. /tours/ renders two sources: the YAML records through
 * tourIds and requireTour, and the GUIDED_TOURS catalogue in code. Indexing only the catalogue would
 * have covered four of the five paths a reader can see and looked complete, which is the same
 * two-source error that hid twelve broken kernel bindings for weeks.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSearchCorpus } from "../../scripts/build-search-index.ts";
import { requireTour, tourIds } from "../content/tours/tours.ts";
import { GUIDED_TOURS } from "../discovery/tours/catalogue.ts";
import { createSearchEngine, SEARCH_LIMITS, validateSearchDocument } from "./core.ts";
import { tourDocuments } from "./documents.ts";

const root = process.cwd();
const fromRecords = tourIds(root).flatMap((id) => {
  const tour = requireTour(root, id);
  return tour
    ? [
        {
          id: tour.id,
          title: tour.title,
          paper: tour.paper,
          introduction: tour.introduction,
          stopTitles: tour.steps.map((step) => step.title),
        },
      ]
    : [];
});
const fromCatalogue = GUIDED_TOURS.map((tour) => ({
  id: tour.id,
  title: tour.title,
  paper: tour.paper,
  introduction: tour.introduction,
  stopTitles: tour.stops.map((stop) => stop.title),
}));
const documents = tourDocuments([...fromRecords, ...fromCatalogue], "scaffold");

describe("guided reading paths are in the search corpus", () => {
  test("both sources are non-empty, so neither can be silently dropped", () => {
    console.log(
      `[tour search] ${documents.length} documents: ${fromRecords.length} from content/tours/*.yaml, ` +
        `${fromCatalogue.length} from GUIDED_TOURS`,
    );
    expect(fromRecords.length).toBeGreaterThan(0);
    expect(fromCatalogue.length).toBeGreaterThan(2);
    expect(documents.length).toBe(fromRecords.length + fromCatalogue.length);
  });

  test("the YAML-sourced path is indexed, not just the ones written in code", () => {
    // Named by identity, because this is the path a catalogue-only implementation would miss and
    // counting would not reveal.
    const yamlTour = documents.find((d) => d.id === "tour:fifteen-minutes-mass-energy");
    expect(yamlTour).toBeDefined();
    expect(yamlTour?.route).toBe("/tours/fifteen-minutes-mass-energy/");
    expect(yamlTour?.type).toBe("tour");
  });

  test("each carries the tour type, its paper and its own address", () => {
    for (const document of documents) {
      expect(document.type).toBe("tour");
      expect(document.paper.length).toBeGreaterThan(0);
      expect(document.route.startsWith("/tours/")).toBe(true);
      expect(() => validateSearchDocument(document)).not.toThrow();
    }
  });

  test("a reader searching a STOP's words reaches the path that contains it", () => {
    let checked = 0;
    for (const tour of [...fromRecords, ...fromCatalogue]) {
      const document = documents.find((d) => d.id === `tour:${tour.id}`);
      for (const stop of tour.stopTitles) {
        expect(document?.text).toContain(stop);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  test("a reader can reach a path through the engine, not just through the corpus", async () => {
    const { documents: corpus, aliases } = await loadSearchCorpus(root, "scaffold");
    const engine = createSearchEngine(corpus, aliases);
    const stop = fromCatalogue[0]?.stopTitles[0] ?? "";
    expect(stop.length).toBeGreaterThan(8);
    const hits = engine.search(stop, { limit: SEARCH_LIMITS.results });
    expect(hits.some((hit) => hit.document.id === `tour:${fromCatalogue[0]?.id}`)).toBe(true);
  }, 120_000);

  test("the index builder calls this with BOTH sources, which the tests above cannot show", () => {
    const script = readFileSync(join(root, "scripts/build-search-index.ts"), "utf8");
    expect(script).toContain("tourDocuments(guidedTours, profile)");
    expect(script).toContain("tourIds(root)");
    expect(script).toContain("GUIDED_TOURS.map");
  });
});
