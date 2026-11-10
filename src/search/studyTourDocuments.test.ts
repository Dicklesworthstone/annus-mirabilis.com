import { describe, expect, test } from "bun:test";
import { loadSearchCorpus } from "../../scripts/build-search-index.ts";
import sitemap from "../app/sitemap.ts";
import { loadStudyTours } from "../discovery/tours/studyTours.ts";
import { createSearchEngine, SEARCH_LIMITS, validateSearchDocument } from "./core.ts";

const root = process.cwd();

describe("evening paths and the full course are discoverable", () => {
  test("the production corpus indexes every authored study path and its session names", async () => {
    const tours = await loadStudyTours(root);
    expect(tours.some((tour) => tour.id === "full-course")).toBe(true);
    for (const paper of ["brownian-motion", "mass-energy", "special-relativity", "light-quanta"]) {
      expect(tours.some((tour) => tour.id === `one-evening-${paper}`)).toBe(true);
    }
    const { documents } = await loadSearchCorpus(root, "scaffold");
    for (const tour of tours) {
      const matches = documents.filter((document) => document.id === `tour:${tour.id}`);
      expect(matches.length).toBe(1);
      const document = matches[0];
      if (!document) throw new Error(`Missing study path ${tour.id}`);
      expect(document.route).toBe(`/tours/${tour.id}/`);
      expect(document.paper).toBe(tour.paper === "all" ? "cross-paper" : tour.paper);
      expect(() => validateSearchDocument(document)).not.toThrow();
      for (const session of tour.sessions) {
        expect(document.text).toContain(session.title);
        for (const step of session.steps) expect(document.text).toContain(step.title);
      }
    }
  }, 120_000);

  test("searching full course reaches its canonical outline", async () => {
    const { documents, aliases } = await loadSearchCorpus(root, "scaffold");
    const engine = createSearchEngine(documents, aliases);
    const hits = engine.search("full course", { type: "tour", limit: SEARCH_LIMITS.results });
    expect(hits.some((hit) => hit.document.id === "tour:full-course")).toBe(true);
    const filtered = engine.search("full course", {
      type: "tour",
      paper: "brownian-motion",
      limit: SEARCH_LIMITS.results,
    });
    expect(filtered.some((hit) => hit.document.id === "tour:full-course")).toBe(false);
  }, 120_000);

  test("the sitemap advertises the complete outlines and printable syllabus once", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const tours = await loadStudyTours(root);
    expect(tours.length).toBeGreaterThan(0);
    const paths = [...tours.map((tour) => `/tours/${tour.id}/`), "/tours/full-course/syllabus/"];
    for (const path of paths) {
      const url = `https://annus-mirabilis.com${path}`;
      expect(urls.filter((entry) => entry === url).length).toBe(1);
    }
    expect(urls.some((url) => url.includes("?tour=") || url.includes("?step="))).toBe(false);
  }, 120_000);
});
