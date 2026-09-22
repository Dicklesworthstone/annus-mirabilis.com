import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mayPublish, PagePlateError, receiptPageMap } from "./generate-page-plates.ts";

describe("the page plates' page map and rights gate", () => {
  test("each pinned German-face paper maps every PDF page to consecutive printed pages", () => {
    for (const [key, first, count] of [
      ["ap-17-132", 132, 17],
      ["ap-17-549", 549, 12],
      ["ap-18-639", 639, 3],
    ] as const) {
      const map = receiptPageMap(readFileSync(`docs/provenance/${key}.md`, "utf8"));
      expect(map.length).toBe(count);
      map.forEach((p, i) => {
        expect(p.pdfPageIndex).toBe(i + 1);
        expect(p.printedPage).toBe(first + i);
      });
    }
  });

  test("a page listed twice with two printed numbers is refused, not guessed", () => {
    const receipt =
      "  - pdfPageIndex: 1\n    printedPage: 639\n  - pdfPageIndex: 1\n    printedPage: 640\n";
    let code = "";
    try {
      receiptPageMap(receipt);
    } catch (error) {
      expect(error).toBeInstanceOf(PagePlateError);
      code = (error as PagePlateError).code;
    }
    expect(code).toBe("page-map-conflict");
  });

  test("only a scan with open terms and a publish decision is rendered", () => {
    expect(mayPublish("rightsStatus: scan-open-terms\npublicationDecision: publish")).toBe(true);
    expect(
      mayPublish("rightsStatus: scan-terms-restrict-redistribution\npublicationDecision: publish"),
    ).toBe(false);
    expect(mayPublish("rightsStatus: scan-open-terms\npublicationDecision: pin-local-only")).toBe(
      false,
    );
  });
});
