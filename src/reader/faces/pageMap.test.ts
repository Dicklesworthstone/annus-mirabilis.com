import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseReceipt } from "../../content/provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../../content/provenance/receiptToSourceAsset.ts";
import { buildPageMapIndex, formatPrintedPageLabel } from "./pageMap.ts";
import type { PageMapEntry } from "../../content/provenance/receiptSchema.ts";

describe("pageMap lookups and indexing (am-read-facsimile-face-er0)", () => {
  const fixturePath = join(process.cwd(), "src/testing/fixtures/provenance/ap-99-001.md");
  const parsed = parseReceipt(readFileSync(fixturePath, "utf8"), fixturePath);
  const sourceAsset = receiptToSourceAsset(parsed.frontMatter!);

  it("indexes pages and lookups correctly from ap-99-001 fixture", () => {
    const index = buildPageMapIndex(sourceAsset.pageMapping);
    expect(index.totalPages).toBe(4);

    const page1 = index.getPage(1);
    expect(page1).toBeDefined();
    expect(page1?.printedPage).toBe(1);
    expect(page1?.printedPageLabel).toBe("1");
    expect(page1?.sectionIds).toEqual(["s1"]);
    expect(page1?.displayEquations.numbered).toEqual(["(1)"]);
    expect(page1?.footnoteMarks).toEqual(["1)"]);

    const page2 = index.getPage(2);
    expect(page2?.sectionIds).toEqual(["s1", "s2"]);
    expect(page2?.displayEquations.numbered).toEqual(["(2)"]);

    // Section lookups
    expect(index.getSectionPages("s1")).toEqual([1, 2]);
    expect(index.getSectionPages("s2")).toEqual([2, 3]);
    expect(index.getSectionPages("s3")).toEqual([4]);
    expect(index.getSectionPages("s999")).toEqual([]);

    // Equation lookups
    expect(index.getEquationPage("(1)")).toBe(1);
    expect(index.getEquationPage("(2)")).toBe(2);
    expect(index.getEquationPage("(3)")).toBe(3);
    expect(index.getEquationPage("(99)")).toBeNull();
  });

  it("handles distinct PDF and printed page labels and special content types", () => {
    expect(formatPrintedPageLabel(549)).toBe("549");
    expect(formatPrintedPageLabel(null, ["front-matter"])).toBe("Front matter");
    expect(formatPrintedPageLabel(null, ["back-matter"])).toBe("Back matter");
    expect(formatPrintedPageLabel(null, ["plate"])).toBe("Plate");
    expect(formatPrintedPageLabel(null, ["usage-notice"])).toBe("Notice");
    expect(formatPrintedPageLabel(null, [])).toBe("Cover");
  });

  it("handles other-article pages correctly", () => {
    const mockPageMap: PageMapEntry[] = [
      {
        pdfPageIndex: 1,
        printedPage: 100,
        contents: ["other-article"],
        sectionIds: [],
        displayEquations: { numbered: [] },
        footnoteMarks: [],
      },
      {
        pdfPageIndex: 2,
        printedPage: 101,
        contents: ["article-text"],
        sectionIds: ["s1"],
        displayEquations: { numbered: ["(1)"] },
        footnoteMarks: [],
      },
    ];

    const index = buildPageMapIndex(mockPageMap);
    expect(index.isOtherArticle(1)).toBe(true);
    expect(index.isOtherArticle(2)).toBe(false);
    expect(index.getPage(1)?.isOtherArticle).toBe(true);
  });

  it("clamps page numbers within valid 1..totalPages bounds", () => {
    const index = buildPageMapIndex(sourceAsset.pageMapping);
    expect(index.clampPage(0)).toBe(1);
    expect(index.clampPage(-5)).toBe(1);
    expect(index.clampPage(1)).toBe(1);
    expect(index.clampPage(3)).toBe(3);
    expect(index.clampPage(4)).toBe(4);
    expect(index.clampPage(5)).toBe(4);
    expect(index.clampPage(100)).toBe(4);
    expect(index.clampPage(NaN)).toBe(1);
  });
});
