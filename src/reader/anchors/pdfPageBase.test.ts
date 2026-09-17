import { describe, expect, test } from "bun:test";
import { mapToFacsimilePage, type StructureIndex } from "./mapToFace.ts";

describe("pdfPageIndex is 1-based", () => {
  test("a validated 1-based locator is accepted", () => {
    const index: StructureIndex = {
      units: [{ id: "s4-p2-s1" }],
      pdfPageByUnit: { "s4-p2-s1": 1 },
    };
    expect(mapToFacsimilePage("s4-p2-s1", index)).toEqual({ page: 1, exact: true });
  });

  test("PLANTED: a 0-based locator fails loudly, naming the block, rather than landing one page early", () => {
    const index: StructureIndex = {
      units: [{ id: "s4-p2-s1" }],
      pdfPageByUnit: { "s4-p2-s1": 0 },
    };
    expect(() => mapToFacsimilePage("s4-p2-s1", index)).toThrow(/s4-p2-s1/);
    expect(() => mapToFacsimilePage("s4-p2-s1", index)).toThrow(/1-based/);
  });

  test("a page-crossing block uses the first locator already chosen by the manifest", () => {
    const index: StructureIndex = {
      units: [{ id: "s4-p2" }, { id: "s4-p2-s1", parentId: "s4-p2" }],
      pdfPageByUnit: { "s4-p2": 891 },
    };
    expect(mapToFacsimilePage("s4-p2-s1", index)).toEqual({ page: 891, exact: false });
  });
});
