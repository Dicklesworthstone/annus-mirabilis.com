import { describe, expect, test } from "bun:test";
import {
  applyViewToUrl,
  canonicalHref,
  parseSplitPanesFromSearch,
  parseViewFromSearch,
  viewModeFromSearch,
} from "./viewMode";

describe("parseViewFromSearch", () => {
  test("parses every known face", () => {
    for (const view of [
      "german",
      "english",
      "gloss",
      "parallel",
      "reading",
      "results",
      "facsimile",
      "split",
    ]) {
      expect(parseViewFromSearch(`?view=${view}`)).toBe(view);
    }
  });

  test("falls back to reading for an unknown value", () => {
    expect(parseViewFromSearch("?view=bogus")).toBe("reading");
  });

  test("falls back to reading when the parameter is absent", () => {
    expect(parseViewFromSearch("")).toBe("reading");
    expect(parseViewFromSearch("?detail=2")).toBe("reading");
  });

  test("falls back to reading when the parameter is repeated", () => {
    expect(parseViewFromSearch("?view=german&view=english")).toBe("reading");
  });

  test("ignores other query keys", () => {
    expect(parseViewFromSearch("?detail=2&view=results&lens=modern")).toBe("results");
  });
});

describe("parseSplitPanesFromSearch", () => {
  test("parses a valid pane pair", () => {
    expect(parseSplitPanesFromSearch("?panes=german,results")).toEqual(["german", "results"]);
  });

  test("falls back to the default pair when absent", () => {
    expect(parseSplitPanesFromSearch("")).toEqual(["parallel", "reading"]);
  });

  test("falls back to the default pair for a malformed value", () => {
    expect(parseSplitPanesFromSearch("?panes=german")).toEqual(["parallel", "reading"]);
    expect(parseSplitPanesFromSearch("?panes=german,results,facsimile")).toEqual([
      "parallel",
      "reading",
    ]);
  });

  test("falls back to the default pair when a pane is not splittable", () => {
    expect(parseSplitPanesFromSearch("?panes=split,reading")).toEqual(["parallel", "reading"]);
    expect(parseSplitPanesFromSearch("?panes=bogus,reading")).toEqual(["parallel", "reading"]);
  });

  test("falls back to the default pair when both panes are the same", () => {
    expect(parseSplitPanesFromSearch("?panes=reading,reading")).toEqual(["parallel", "reading"]);
  });
});

describe("viewModeFromSearch", () => {
  test("combines view and panes", () => {
    expect(viewModeFromSearch("?view=split&panes=german,results")).toEqual({
      view: "split",
      panes: ["german", "results"],
    });
  });
});

describe("applyViewToUrl", () => {
  test("sets view and preserves other query keys and the hash", () => {
    const next = applyViewToUrl("/papers/brownian-motion/?detail=2&lens=modern#s4-p1", {
      view: "german",
    });
    expect(next).toBe("/papers/brownian-motion/?detail=2&lens=modern&view=german#s4-p1");
  });

  test("removes the view parameter entirely when returning to the default face", () => {
    const next = applyViewToUrl("/papers/brownian-motion/?view=german&detail=2", {
      view: "reading",
    });
    expect(next).toBe("/papers/brownian-motion/?detail=2");
  });

  test("adds panes only for split, and removes them for every other face", () => {
    const toSplit = applyViewToUrl("/papers/brownian-motion/", {
      view: "split",
      panes: ["german", "results"],
    });
    expect(toSplit).toBe("/papers/brownian-motion/?view=split&panes=german%2Cresults");

    const awayFromSplit = applyViewToUrl(
      "/papers/brownian-motion/?view=split&panes=german,results",
      { view: "english" },
    );
    expect(awayFromSplit).toBe("/papers/brownian-motion/?view=english");
  });

  test("never mutates the input string", () => {
    const input = "/papers/brownian-motion/?detail=2";
    applyViewToUrl(input, { view: "german" });
    expect(input).toBe("/papers/brownian-motion/?detail=2");
  });

  test("is idempotent: applying the same view twice yields the same href", () => {
    const once = applyViewToUrl("/papers/brownian-motion/", { view: "german" });
    const twice = applyViewToUrl(once, { view: "german" });
    expect(twice).toBe(once);
  });
});

describe("canonicalHref", () => {
  test("strips every state parameter", () => {
    const href =
      "/papers/brownian-motion/?view=german&detail=2&lens=modern&notation=modern&units=si&open=foundation%3Ax&tape=abc&panes=german,results#s4-p1";
    expect(canonicalHref(href)).toBe("/papers/brownian-motion/#s4-p1");
  });

  test("leaves an already-canonical href unchanged", () => {
    expect(canonicalHref("/papers/brownian-motion/#s4-p1")).toBe("/papers/brownian-motion/#s4-p1");
  });

  test("preserves unrelated query keys", () => {
    expect(canonicalHref("/papers/brownian-motion/?embed=1&view=german")).toBe(
      "/papers/brownian-motion/?embed=1",
    );
  });
});
