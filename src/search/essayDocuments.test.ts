import { describe, expect, test } from "bun:test";
import { loadEssays } from "../content/essays/load.ts";
import { essayDocuments } from "./essayDocuments.ts";

describe("essay search projection", () => {
  test("every essay and transfer resolves to its own stable rendered anchor", () => {
    const essays = loadEssays();
    const docs = essayDocuments(essays, "scaffold");
    expect(docs.length).toBe(8);
    expect(new Set(docs.map((doc) => doc.id)).size).toBe(docs.length);
    for (const essay of essays) {
      const main = docs.find((doc) => doc.id === "essay:" + essay.slug);
      expect(main?.text).toContain(essay.r0Summary);
      expect(main?.route).toBe("/essays/" + essay.slug + "/");
      for (const transfer of essay.transferExamples) {
        const doc = docs.find((entry) => entry.id === "essay-transfer:" + transfer.id);
        expect(doc?.anchor).toBe("transfer-" + transfer.id);
        expect(doc?.text).toContain(transfer.whereItStops);
      }
    }
  });

  test("new draft essays do not acquire reviewed publication status through search", () => {
    const essays = loadEssays();
    expect(essayDocuments(essays, "preview")).toEqual([]);
    expect(essayDocuments(essays, "launch")).toEqual([]);
  });
});
