import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { blockStartPages, storedDisplayPages } from "./blockPages.ts";
import { loadGermanSourceFace, printedUnits } from "./germanSourceFace.ts";
import { PAPER_BIB_KEYS } from "./ledgerPresence.ts";
import type { ProposedBlock } from "./segmentLedger.ts";

const PAPERS = ["light-quanta", "brownian-motion", "mass-energy"] as const;

/** Every display equation on a face, in reading order. */
function displaysOf(blocks: readonly ProposedBlock[]) {
  const ids = blocks.flatMap((b) =>
    b.kind === "equation" ? [b.id] : (b.displayEquationIds ?? []),
  );
  return [...new Set(ids)];
}

/** The ledger the face was built from, found as the loader finds it: through the receipt. */
function ledgerOf(slug: (typeof PAPERS)[number]): string {
  const receiptPath = join(process.cwd(), "docs", "provenance", `${PAPER_BIB_KEYS[slug]}.md`);
  const receipt = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
  const ledgerPath = receipt.frontMatter?.transcription.ledgerPath;
  if (typeof ledgerPath !== "string") throw new Error(`${slug}: the receipt names no ledger`);
  return readFileSync(join(process.cwd(), ledgerPath), "utf8");
}

describe("the page each display equation is printed on (TanElk, 2026-09-24)", () => {
  // Read on the plates on 2026-09-24: each of these displays is printed on the page given here,
  // and each was given the page of the block before it until this change. They are the plant:
  // put that rule back and every one of them is wrong again.
  const PLATE_READ: Record<string, Record<string, number>> = {
    "light-quanta": {
      "s1-eq6": 136,
      "s1-eq7": 136,
      "s5-eq4": 141,
      "s5-eq5": 141,
      "s5-eq6": 141,
      "s6-eq3": 142,
      "s6-eq4": 142,
    },
    "brownian-motion": {
      "s4-eq5": 557,
      "s4-eq6": 557,
      "s4-eq7": 557,
      "s4-eq8": 557,
      "s5-eq5": 560,
    },
    "mass-energy": {},
  };

  for (const slug of PAPERS) {
    test(`${slug}: every display takes the page the manifest stores for it`, () => {
      const face = loadGermanSourceFace(slug);
      if (!face) throw new Error(`${slug}: no German face`);
      const displays = displaysOf(face.blocks);
      // Non-empty on purpose: over no displays the equality below would hold and prove nothing.
      expect(displays.length).toBeGreaterThan(0);
      const stored = storedDisplayPages(face.blocks, printedUnits(process.cwd(), slug));
      // Every display is aligned to a manifest display with a stored page; none is left to infer.
      expect(displays.filter((id) => stored[id] === undefined)).toEqual([]);
      const wrong = displays.filter((id) => face.printedPages.pages[id] !== stored[id]);
      expect(
        wrong.map((id) => `${id}: ${face.printedPages.pages[id]}, stored ${stored[id]}`),
      ).toEqual([]);
      for (const [id, page] of Object.entries(PLATE_READ[slug] ?? {}))
        expect(`${id} ${face.printedPages.pages[id]}`).toBe(`${id} ${page}`);
    });

    test(`${slug}: where nothing is stored, a display's own TeX in the ledger gives the same page`, () => {
      // The fallback has no population on these three faces, since the manifest stores every
      // page, so it is run here without the manifest. Two derivations that share nothing (the
      // plates' reviewed record, and where the ledger prints the display's TeX) must agree.
      const face = loadGermanSourceFace(slug);
      if (!face) throw new Error(`${slug}: no German face`);
      const inferred = blockStartPages(ledgerOf(slug), face.blocks).pages;
      const stored = storedDisplayPages(face.blocks, printedUnits(process.cwd(), slug));
      const displays = displaysOf(face.blocks);
      expect(displays.length).toBeGreaterThan(0);
      const wrong = displays.filter((id) => inferred[id] !== stored[id]);
      expect(wrong.map((id) => `${id}: ${inferred[id]}, stored ${stored[id]}`)).toEqual([]);
    });
  }

  test("a stored page wins over where the ledger prints the display", () => {
    // On the three faces the two agree on every display, so the tests above cannot tell whether
    // the stored page is used at all. Here they disagree.
    const ledger = "[[ANNALEN-PAGE 10]]\nText davor.\n$$\na = b\n$$\n[[ANNALEN-PAGE 11]]\nMehr.";
    const blocks = [
      { id: "s1-p1", kind: "paragraph", text: "Text davor.", sentences: [] },
      { id: "s1-eq1", kind: "equation", text: "a = b", sentences: [] },
    ] as const;
    expect(blockStartPages(ledger, blocks).pages["s1-eq1"]).toBe(10);
    expect(blockStartPages(ledger, blocks, { "s1-eq1": 11 }).pages["s1-eq1"]).toBe(11);
  });

  test("a list that does not line up with the face gives no stored page", () => {
    const blocks = [
      { id: "s1-eq1", kind: "equation", text: "a = b", sentences: [] },
      { id: "s1-eq2", kind: "equation", text: "c = d", sentences: [] },
    ] as const;
    const display = (id: string, page: number, section = "s1") => ({
      id,
      kind: "display-equation",
      section,
      page,
    });
    // One display short: pairing by order would put s1-eq2 on eq-s1-d1's page.
    expect(storedDisplayPages(blocks, [display("eq-s1-d1", 7)])).toEqual({});
    // The right number, filed under another section.
    expect(
      storedDisplayPages(blocks, [display("eq-s1-d1", 7), display("eq-s2-d1", 8, "s2")]),
    ).toEqual({});
    expect(storedDisplayPages(blocks, [display("eq-s1-d1", 7), display("eq-s1-d2", 8)])).toEqual({
      "s1-eq1": 7,
      "s1-eq2": 8,
    });
  });
});

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
