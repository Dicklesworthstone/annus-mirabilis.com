import { describe, expect, test } from "bun:test";
import { blockStartPages } from "./blockPages.ts";
import { loadGermanSourceFace } from "./germanSourceFace.ts";

describe("the printed page each German block starts on", () => {
  for (const [slug, first, last] of [
    ["light-quanta", 132, 148],
    ["brownian-motion", 549, 560],
    ["mass-energy", 639, 641],
  ] as const) {
    test(`${slug}: every paragraph and heading is placed, in page order, from ${first} to ${last}`, () => {
      const face = loadGermanSourceFace(slug);
      expect(face).not.toBeNull();
      if (!face) return;
      const { pages, printed, unresolved } = face.printedPages;
      expect(printed[0]).toBe(first);
      expect(printed.at(-1)).toBe(last);
      const body = face.blocks.filter((b) => b.kind !== "equation" && b.kind !== "footnote");
      expect(body.length).toBeGreaterThan(0);
      expect(unresolved.filter((id) => body.some((b) => b.id === id))).toEqual([]);
      const sequence = body.map((b) => pages[b.id]);
      expect(sequence.every((p) => p !== undefined && p >= first && p <= last)).toBe(true);
      expect(
        sequence.every((p, i) => i === 0 || (p as number) >= (sequence[i - 1] as number)),
      ).toBe(true);
      // Every printed page is reached by some block, so the plate can show each one.
      expect(new Set(sequence).size).toBe(last - first + 1);
    });
  }

  test("a block whose words are not in the ledger is reported and keeps the page before it", () => {
    const ledger =
      "[[ANNALEN-PAGE 10]]\nErster Absatz auf Seite zehn.\n[[ANNALEN-PAGE 11]]\nZweiter Absatz.";
    const blocks = [
      { id: "a", kind: "paragraph", text: "Erster Absatz auf Seite zehn.", sentences: [] },
      { id: "b", kind: "paragraph", text: "Zweiter Absatz.", sentences: [] },
      { id: "c", kind: "paragraph", text: "Nirgends im Ledger zu finden.", sentences: [] },
    ] as const;
    const result = blockStartPages(ledger, blocks);
    expect(result.pages).toEqual({ a: 10, b: 11, c: 11 });
    expect(result.unresolved).toEqual(["c"]);
  });
});
