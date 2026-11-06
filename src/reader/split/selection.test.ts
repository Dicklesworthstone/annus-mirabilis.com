import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SELECTION,
  splitSectionDestination,
  splitSelectionFromSearch,
  withSplitSelection,
} from "./selection.ts";

describe("split face choices", () => {
  test("all six supported pairs and their reverse preserve the actual requested faces", () => {
    for (const source of ["parallel", "german", "english"] as const) {
      for (const companion of ["reading", "results"] as const) {
        expect(splitSelectionFromSearch(`?panes=${source},${companion}`)).toEqual({
          selection: { source, companion, reversed: false },
          notice: "",
        });
        expect(splitSelectionFromSearch(`?panes=${companion},${source}`)).toEqual({
          selection: { source, companion, reversed: true },
          notice: "",
        });
      }
    }
  });
  test("missing settings use the documented default; unsupported or malformed pairs say so", () => {
    expect(splitSelectionFromSearch("")).toEqual({ selection: DEFAULT_SELECTION, notice: "" });
    for (const query of [
      "?panes=gloss,facsimile",
      "?panes=german,english",
      "?panes=reading,results",
      "?panes=reading,reading",
      "?panes=wat,results",
      "?panes=german,reading&panes=english,results",
      `?${"x".repeat(4096)}`,
    ]) {
      const parsed = splitSelectionFromSearch(query);
      expect(parsed.selection).toEqual(DEFAULT_SELECTION);
      expect(parsed.notice.length).toBeGreaterThan(0);
    }
  });
  test("changing a pair preserves notation, detail, fragment and the caller's URL", () => {
    const original = new URL(
      "https://annus-mirabilis.com/papers/mass-energy/view/split/?detail=2&notation=printed#s0-p8",
    );
    const changed = withSplitSelection(original, {
      source: "english",
      companion: "results",
      reversed: true,
    });
    expect(changed.searchParams.get("panes")).toBe("results,english");
    expect(changed.searchParams.get("detail")).toBe("2");
    expect(changed.searchParams.get("notation")).toBe("printed");
    expect(changed.hash).toBe("#s0-p8");
    expect(original.searchParams.has("panes")).toBe(false);
  });
});

describe("section-sized split deep links", () => {
  const scope = {
    paper: "special-relativity",
    section: "s0",
    sections: ["s0", "s1", "s10"],
    argumentSections: { "sr-dynamics": "s10" },
    sectionHrefs: {
      s0: "/papers/special-relativity/s0/view/split/",
      s1: "/papers/special-relativity/s1/view/split/",
      s10: "/papers/special-relativity/s10/view/split/",
    },
    faceHrefs: {
      parallel: "/papers/special-relativity/s0/view/parallel/",
      german: "/papers/special-relativity/s0/view/german/",
      english: "/papers/special-relativity/s0/view/english/",
      reading: "/papers/special-relativity/s0/",
      results: "/papers/special-relativity/s0/view/results/",
    },
  };
  test("source, English and secondary explanation anchors reach their existing static section", () => {
    for (const hash of [
      "#s10-p1-s1",
      "#en-s10-p1-s1",
      "#eq-s10-d1",
      "#pane-b--sr-dynamics",
      "#sr-dynamics",
    ]) {
      const next = splitSectionDestination(
        new URL(
          `https://example.test/papers/special-relativity/view/split/?panes=english,reading${hash}`,
        ),
        scope,
      );
      expect(next?.pathname).toBe("/papers/special-relativity/s10/view/split/");
      expect(next?.hash).toBe(hash);
      expect(next?.searchParams.get("panes")).toBe("english,reading");
    }
  });
  test("current, unknown, malformed and invented-section anchors never trigger a redirect", () => {
    for (const hash of [
      "#s0-p1",
      "#s999-p1",
      "#unknown",
      "#%E0%A4%A",
      "#pane-b--missing",
      `#${"s".repeat(241)}`,
    ]) {
      expect(
        splitSectionDestination(
          new URL(`https://example.test/papers/special-relativity/view/split/${hash}`),
          scope,
        ),
      ).toBeNull();
    }
  });
});
