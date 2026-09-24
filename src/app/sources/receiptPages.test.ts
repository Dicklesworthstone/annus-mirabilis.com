import { describe, expect, test } from "bun:test";
import { receiptHref, receiptPageSlug } from "./receiptPages.ts";
import { SourcesError } from "./refusals.ts";

/** Which paper's page a receipt is on: the route slug it equals, or extends with a hyphen. */
describe("receiptPageSlug", () => {
  test("a paper's own receipt is on its page, and a companion on the paper it extends", () => {
    expect(receiptPageSlug("brownian-motion")).toBe("brownian-motion");
    expect(receiptPageSlug("molecular-dimensions")).toBe("molecular-dimensions");
    expect(receiptPageSlug("molecular-dimensions-correction")).toBe("molecular-dimensions");
    expect(receiptHref("molecular-dimensions-correction")).toBe(
      "/sources/molecular-dimensions/#molecular-dimensions-correction",
    );
    expect(receiptHref("light-quanta")).toBe("/sources/light-quanta/");
  });

  test('a receipt slug that names no paper route refuses with "receipt-page-unknown"', () => {
    for (const slug of ["relativity", "molecular", "mass-energyx", ""]) {
      let caught: unknown;
      try {
        receiptPageSlug(slug);
      } catch (error) {
        caught = error;
      }
      expect({ slug, code: caught instanceof SourcesError ? caught.code : String(caught) }).toEqual(
        { slug, code: "receipt-page-unknown" },
      );
    }
  });
});
