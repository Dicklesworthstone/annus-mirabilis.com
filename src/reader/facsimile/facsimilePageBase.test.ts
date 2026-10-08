/**
 * CRITERION 3 OF am-read-anchors-navigation-a6o, AGAINST THE LIVE OWNER: "The facsimile mapping uses
 * 1-based `pdfPageIndex` from validated locators, takes the first locator of a page-crossing block,
 * and fails loudly on a 0-based index rather than landing one page early."
 *
 * IT WAS PROVED ON THE WRONG FUNCTION. The 0-based refusal is asserted in two places --
 * src/reader/anchors/pdfPageBase.test.ts:19 and mapToFace.test.ts:99 -- and both call
 * `mapToFacsimilePage`, which the owner ruled on 2026-10-08 must STAY unwired (am-to1q; see
 * mapToFace.ts's docblock). No reader reaches it. The live owner is `resolveFacsimileTarget`, and
 * nothing asserted anything about its page arithmetic.
 *
 * AND THE LIVE PATH IS SAFER THAN THE CRITERION IMAGINED, which is why this file asserts a
 * different shape of the same property. `projectFacsimileDocument` does not read a `pdfPageIndex`
 * at all: it GENERATES the page map as `pdfPage: i + 1` over the pin's `pageCount`
 * (document.ts:177-181) and resolves a unit by its PRINTED page. So a 0-based index cannot land a
 * reader one page early, because no index is consulted. There is nothing to fail loudly about; the
 * failure mode the criterion names is structurally absent.
 *
 * That guarantee rests entirely on the `i + 1` construction, and NOTHING STATED IT. I first wrote
 * here that no test in the repository would notice if it changed, and that was wrong: planting
 * `pdfPage: i` reddens SEVEN tests across the facsimile suite before this file is counted -- the
 * inline-facsimile viewer, three FacsimilePanel cases, the wire-directory test and two plate-
 * controller cases. So the construction is guarded.
 *
 * It is guarded INCIDENTALLY, which is the gap this file closes. Every one of those seven fails on
 * something downstream -- plate markup, src and srcset moving together, alias uniqueness, a section
 * opening the whole paper -- and a reader of those failures learns that the facsimile panel broke,
 * not that page numbering became 0-based. The first test below states the property itself, so the
 * same plant now names its own cause. Measured both ways rather than assumed: 5 of the 8 tests here
 * go red under that plant, and the 3 that stay green are the refusal cases, which do not depend on
 * the numbering.
 */

import { describe, expect, test } from "bun:test";
import { projectFacsimileDocument, resolveFacsimileTarget } from "./document.ts";

/** The fixture of FacsimilePanel.test.tsx: 3 pinned pages, printed 639-641. */
function build(units: readonly unknown[]) {
  return projectFacsimileDocument(
    "mass-energy",
    "ap-18-639",
    {
      configVersion: 1,
      key: "ap-18-639",
      verifiedAnchor: { parentPageIndex: 233, printedPage: 639, verifiedBy: "test fixture" },
      articlePages: { printedFirst: 639, printedLast: 641, parentPageIndices: [233, 234, 235] },
      rights: { publicationDecision: "publish", rightsStatus: "scan-open-terms" },
      pinned: {
        path: "public/papers/pdfs/ap-18-639.pdf",
        sha256: "a".repeat(64),
        pageCount: 3,
        mimeType: "application/pdf",
        acquisitionDate: "2026-09-18",
        originUrl: "https://archive.org/example.pdf",
      },
    },
    {
      paper: "mass-energy",
      document: "ap-18-639",
      pageCount: 3,
      pageRange: [639, 641],
      status: "in-preparation",
      units,
    },
  );
}

const CROSSING = [
  { id: "s0-p1", kind: "paragraph", locators: [{ page: 639 }] },
  // A page-crossing block: printed 640 and 641, so pdfPage 2 and 3.
  { id: "s1-p1", kind: "paragraph", locators: [{ page: 640 }, { page: 641 }] },
  { id: "eq-s1-d1", kind: "display-equation", locators: [{ page: 641 }] },
] as const;

describe("the live page map is 1-based BY CONSTRUCTION, not by validation", () => {
  test("the pages are exactly 1..pageCount, paired with the printed range", () => {
    const doc = build(CROSSING);
    expect(doc).not.toBeNull();
    const pages = doc?.pages ?? [];
    // The whole of criterion 3's third clause depends on this line. `pdfPage: i + 1` over
    // pageCount is what makes a 0-based reading impossible rather than merely refused.
    expect(pages.map((p) => p.pdfPage)).toEqual([1, 2, 3]);
    expect(pages.map((p) => p.printedPage)).toEqual([639, 640, 641]);
    // And the pairing, because `[1,2,3]` alone would also hold for a map that had drifted against
    // the printed pages.
    expect(pages[0]).toEqual({ pdfPage: 1, printedPage: 639 });
  });

  test("a supplied pdfPageIndex is IGNORED, so a 0-based one cannot land a page early", () => {
    // The plant for the criterion's own failure mode. Both documents must resolve identically: the
    // projection keys on `page` (printed) and never reads an index, so a 0-based index -- the exact
    // defect the criterion warns about -- changes nothing. If this ever diverges, the live path has
    // started consulting an index and the refusal the criterion asks for becomes necessary.
    const clean = build(CROSSING);
    const poisoned = build([
      { id: "s0-p1", kind: "paragraph", locators: [{ page: 639, pdfPageIndex: 0 }] },
      {
        id: "s1-p1",
        kind: "paragraph",
        locators: [
          { page: 640, pdfPageIndex: 0 },
          { page: 641, pdfPageIndex: 0 },
        ],
      },
      { id: "eq-s1-d1", kind: "display-equation", locators: [{ page: 641, pdfPageIndex: -7 }] },
    ]);
    expect(poisoned).not.toBeNull();
    for (const id of ["s0-p1", "s1-p1", "eq-s1-d1"]) {
      expect(resolveFacsimileTarget(poisoned!, id)).toBe(resolveFacsimileTarget(clean!, id));
    }
    // Stated absolutely too, so the test does not merely assert that two broken answers agree.
    expect(resolveFacsimileTarget(poisoned!, "s0-p1")).toBe(1);
  });
});

describe("a page-crossing block resolves to its FIRST page", () => {
  test("printed 640-641 resolves to pdfPage 2, not 3", () => {
    const doc = build(CROSSING);
    expect(resolveFacsimileTarget(doc!, "s1-p1")).toBe(2);
    // The neighbours, so the 2 is not a coincidence of a one-page document.
    expect(resolveFacsimileTarget(doc!, "s0-p1")).toBe(1);
    expect(resolveFacsimileTarget(doc!, "eq-s1-d1")).toBe(3);
  });

  test("and it is the first PAGE, not the first array element", () => {
    // Locators written in reverse. "The first locator of a page-crossing block" has to mean the
    // earlier page, or the answer depends on how an editor happened to order a YAML list.
    const doc = build([
      { id: "s1-p1", kind: "paragraph", locators: [{ page: 641 }, { page: 640 }] },
    ]);
    expect(resolveFacsimileTarget(doc!, "s1-p1")).toBe(2);
  });

  test("a many-to-one edition alias also takes the earliest page", () => {
    const doc = build([
      {
        id: "s1-p1",
        kind: "paragraph",
        locators: [{ page: 640 }, { page: 641 }],
        destination: { editionBlockId: "de-example" },
      },
      {
        id: "eq-s1-d1",
        kind: "display-equation",
        locators: [{ page: 641 }],
        destination: { editionBlockId: "de-example" },
      },
    ]);
    // Two units feed one edition block, spanning pdfPages 2 and 3. The reader goes to 2.
    expect(resolveFacsimileTarget(doc!, "de-example")).toBe(2);
  });
});

describe("what the live path DOES refuse loudly", () => {
  test("a locator outside the pinned paper", () => {
    // The real failure mode in place of the one the criterion names: a printed page the pin does
    // not contain. 642 is one past the pinned range, which is the off-by-one that would otherwise
    // land a reader on nothing.
    expect(() => build([{ id: "s0-p1", kind: "paragraph", locators: [{ page: 642 }] }])).toThrow();
    expect(() => build([{ id: "s0-p1", kind: "paragraph", locators: [{ page: 638 }] }])).toThrow();
  });

  test("a unit with no locator at all", () => {
    expect(() => build([{ id: "s0-p1", kind: "paragraph", locators: [] }])).toThrow();
  });

  test("an unknown fragment resolves to null rather than to page 1", () => {
    // The quiet version of landing on the wrong page: defaulting an unresolvable id to the first
    // page would look like a working link.
    const doc = build(CROSSING);
    for (const id of ["s9-p9", "not-an-anchor", "", "facsimile-page-999"]) {
      expect(resolveFacsimileTarget(doc!, id)).toBeNull();
    }
  });
});
