/**
 * The derived face-availability table (pane28).
 *
 * These assert PROPERTIES rather than a census: the empty/available boundary per face,
 * that parallel and gloss need both sides, and that facsimile is never claimed from
 * counts. A count of the faces would break the first time one is added and would
 * prove nothing about the question this module answers.
 */

import { describe, expect, test } from "bun:test";
import {
  editionBlocksReviewed,
  englishFaceHasContent,
  type FaceContentCounts,
  faceAvailability,
  germanFaceHasContent,
  germanFaceRendersEdition,
  glossFaceHasContent,
  parallelFaceHasContent,
} from "./faceAvailability.ts";

const counts = (over: Partial<FaceContentCounts> = {}): FaceContentCounts => ({
  blocks: 0,
  units: 0,
  glossUnits: 0,
  germanDraftBlocks: 0,
  ...over,
});

describe("faceAvailability", () => {
  test("a paper with no edition at all offers only the two non-source faces", () => {
    const a = faceAvailability(counts());
    expect(a.reading).toBe("available");
    expect(a.results).toBe("available");
    // Split's default pair is parallel + explanation; with no parallel face its page is a
    // notice and a link back, so it is not offered as a face.
    expect(a.split).toBe("empty");
    expect(a.german).toBe("empty");
    expect(a.english).toBe("empty");
    expect(a.parallel).toBe("empty");
    expect(a.gloss).toBe("empty");
  });

  test("German is available from a DRAFT alone, which is how three of four papers have it", () => {
    // brownian-motion, light-quanta and mass-energy reach their German face through
    // loadGermanSourceFace, not through a compiled bilingual edition.
    expect(faceAvailability(counts({ germanDraftBlocks: 87 })).german).toBe("available");
    expect(faceAvailability(counts({ blocks: 87 })).german).toBe("available");
    expect(germanFaceHasContent(0, 87)).toBe(true);
    expect(germanFaceHasContent(87, 0)).toBe(true);
    expect(germanFaceHasContent(0, 0)).toBe(false);
  });

  test("a German draft alone never makes English, parallel or gloss available", () => {
    // The negative a naive implementation fails: "the paper has source text" is not
    // "the paper has a translation". Every one of these is a stub today.
    const a = faceAvailability(counts({ germanDraftBlocks: 87 }));
    expect(a.english).toBe("empty");
    expect(a.parallel).toBe("empty");
    expect(a.gloss).toBe("empty");
  });

  test("split follows its source pane: available exactly when parallel is", () => {
    // The positive case the change must not lose, and the German-draft case that must not
    // be read as a pairable source.
    expect(faceAvailability(counts({ blocks: 10, units: 10 })).split).toBe("available");
    expect(faceAvailability(counts({ blocks: 10 })).split).toBe("empty");
    expect(faceAvailability(counts({ germanDraftBlocks: 87 })).split).toBe("empty");
    for (const c of [counts(), counts({ blocks: 3, units: 3 }), counts({ units: 5 })])
      expect(faceAvailability(c).split).toBe(faceAvailability(c).parallel);
  });

  test("parallel and gloss need BOTH sides, not either", () => {
    expect(faceAvailability(counts({ blocks: 10 })).parallel).toBe("empty");
    expect(faceAvailability(counts({ units: 10 })).parallel).toBe("empty");
    expect(faceAvailability(counts({ blocks: 10, units: 10 })).parallel).toBe("available");

    expect(faceAvailability(counts({ blocks: 10 })).gloss).toBe("empty");
    expect(faceAvailability(counts({ glossUnits: 10 })).gloss).toBe("empty");
    expect(faceAvailability(counts({ blocks: 10, glossUnits: 10 })).gloss).toBe("available");

    expect(parallelFaceHasContent(10, 0)).toBe(false);
    expect(parallelFaceHasContent(0, 10)).toBe(false);
    expect(parallelFaceHasContent(10, 10)).toBe(true);
    expect(glossFaceHasContent(10, 0)).toBe(false);
    expect(glossFaceHasContent(10, 10)).toBe(true);
    expect(englishFaceHasContent(0)).toBe(false);
    expect(englishFaceHasContent(1)).toBe(true);
  });

  test("facsimile is never claimed from counts, and is passed through when a caller knows", () => {
    // Deciding it costs a SHA-256 over the whole pinned PDF. Guessing from counts
    // would claim a scan this module has not seen.
    expect(faceAvailability(counts({ blocks: 87, units: 87, glossUnits: 87 })).facsimile).toBe(
      "unknown",
    );
    expect(faceAvailability(counts({ facsimile: "available" })).facsimile).toBe("available");
    expect(faceAvailability(counts({ facsimile: "empty" })).facsimile).toBe("empty");
  });

  test("the table is frozen, so a caller cannot edit one face's answer in place", () => {
    const a = faceAvailability(counts());
    expect(Object.isFrozen(a)).toBe(true);
  });
});

describe("FaceChooser's tab order", () => {
  test("names every fallback face exactly once, Results before German source", async () => {
    // TAB_ORDER is a hand-written list; a fallback face missing from it would silently
    // vanish from the chooser. Rendered rather than imported, so the check is on the page.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { FaceChooser } = await import("./FaceChooser.tsx");
    const { FACE_FALLBACK_IDS } = await import("./paperRoutes.ts");
    const html = renderToStaticMarkup(createElement(FaceChooser, { paperId: "mass-energy" }));
    const order = [...html.matchAll(/data-view-link="([a-z]+)"/g)].map((m) => m[1]);
    expect(order[0]).toBe("reading");
    expect([...order.slice(1)].sort()).toEqual([...FACE_FALLBACK_IDS].sort());
    expect(order.indexOf("results")).toBeLessThan(order.indexOf("german"));
    expect(order.indexOf("german")).toBeLessThan(order.indexOf("facsimile"));
  });
});

describe("which German renderer: the edition's blocks, or the ledger draft", () => {
  const block = (transcription: string, review: string) => ({ status: { transcription, review } });
  const reviewed = block("reviewed", "accepted");

  test("the blocks take the German face whenever there are any, reviewed or not (dispatch 255)", () => {
    // Until dispatch 255 a machine-draft edition kept the draft face, for its draft label, plates
    // and chooser. The label went with D-2026-09-25-no-review-status-banners, and GermanFace now
    // carries the plates and the chooser, so review no longer chooses the renderer (mail 40854).
    expect(germanFaceRendersEdition([reviewed, block("reviewed", "reviewed")], 25)).toBe(true);
    expect(germanFaceRendersEdition([block("draft", "draft")], 25)).toBe(true);
    expect(germanFaceRendersEdition([reviewed, block("draft", "draft")], 25)).toBe(true);
    expect(germanFaceRendersEdition([{}], 25)).toBe(true);
  });

  test("with no draft to fall back on the blocks render; with no blocks they never do", () => {
    expect(germanFaceRendersEdition([block("draft", "draft")], 0)).toBe(true);
    expect(germanFaceRendersEdition([], 25)).toBe(false);
    expect(germanFaceRendersEdition([], 0)).toBe(false);
    // An empty edition is not a reviewed one, so the draft is still consulted for it.
    expect(editionBlocksReviewed([])).toBe(false);
    expect(editionBlocksReviewed([reviewed])).toBe(true);
  });
});
