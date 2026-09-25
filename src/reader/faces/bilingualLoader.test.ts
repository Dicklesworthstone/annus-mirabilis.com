import { afterEach, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SourceBlock } from "../../content/schemas/source.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import {
  type BilingualEdition,
  loadBilingualEdition,
  paperDateFromReceipt,
  receiptPaperIdentity,
  setBilingualEditionTestOverride,
  sortBlocksByManifest,
} from "./bilingualLoader.ts";

/**
 * A root holding the live condition these tests name: a paper whose frozen manifest has no units
 * and no layer files beside it. They read the real brownian-motion tree until its source blocks
 * landed (dispatch 191), which made that paper's edition real and the premise false.
 */
function rootWithEmptyManifest(slug: string): string {
  const root = mkdtempSync(join(tmpdir(), "am-bilingual-empty-"));
  const dir = join(root, "content/source-blocks", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.yaml"), `paper: ${slug}\nunits: []\n`);
  return root;
}

describe("bilingualLoader", () => {
  afterEach(() => {
    setBilingualEditionTestOverride(null);
  });

  test("live condition: returns null for a paper whose manifest has units: []", async () => {
    const edition = await loadBilingualEdition(
      "brownian-motion",
      rootWithEmptyManifest("brownian-motion"),
    );
    expect(edition).toBeNull();
  });

  test("returns null for nonexistent paper slug", async () => {
    const edition = await loadBilingualEdition("nonexistent-paper");
    expect(edition).toBeNull();
  });

  test("respects test override when provided and returns full edition", async () => {
    const fixtureEdition: BilingualEdition = {
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignment: FIXTURE_BROWNIAN_ALIGNMENT,
      editorialNotes: FIXTURE_EDITORIAL_NOTES,
      reviewRecords: FIXTURE_REVIEW_RECORDS,
    };

    setBilingualEditionTestOverride((paperId) =>
      paperId === "brownian-motion" ? fixtureEdition : null,
    );

    const edition = await loadBilingualEdition("brownian-motion");
    expect(edition).not.toBeNull();
    expect(edition?.paper.slug).toBe("brownian-motion");
    expect(edition?.blocks.length).toBeGreaterThan(0);
    expect(edition?.units.length).toBeGreaterThan(0);
  });

  test("resetting test override restores live filesystem resolution", async () => {
    const root = rootWithEmptyManifest("brownian-motion");
    setBilingualEditionTestOverride(() => ({
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
    }));

    expect(await loadBilingualEdition("brownian-motion", root)).not.toBeNull();

    setBilingualEditionTestOverride(null);
    expect(await loadBilingualEdition("brownian-motion", root)).toBeNull();
  });

  test("blocks render in the frozen manifest's printed order, not their filenames' order", async () => {
    // A block file is named <id>.yaml, and readdir().sort() puts closing-dateline before
    // eq-s0-d1 before masthead-title. The real mass-energy manifest decides instead.
    const root = mkdtempSync(join(tmpdir(), "am-bilingual-order-"));
    const dir = join(root, "content/source-blocks/mass-energy");
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(root, "docs/provenance"), { recursive: true });
    const repo = process.cwd();
    copyFileSync(
      join(repo, "content/source-blocks/mass-energy/manifest.yaml"),
      join(dir, "manifest.yaml"),
    );
    copyFileSync(
      join(repo, "docs/provenance/ap-18-639.md"),
      join(root, "docs/provenance/ap-18-639.md"),
    );
    for (const id of ["closing-dateline", "eq-s0-d1", "masthead-title", "s0-p11", "s0-p2"])
      writeFileSync(join(dir, `${id}.yaml`), `id: "${id}"\nkind: "paragraph"\n`);
    const edition = await loadBilingualEdition("mass-energy", root);
    expect(edition?.blocks.map((b) => b.id)).toEqual([
      "masthead-title",
      "s0-p2",
      "eq-s0-d1",
      "s0-p11",
      "closing-dateline",
    ]);
  });

  test("a block the manifest does not name follows, by its order field and then its id", () => {
    const b = (id: string, order?: number) => ({ id, ...(order ? { order } : {}) }) as SourceBlock;
    const blocks = [b("zz", 2), b("stray"), b("s0-p2"), b("aa", 2), b("masthead-title"), b("x", 1)];
    sortBlocksByManifest(blocks, ["masthead-title", "s0-p2"]);
    expect(blocks.map((x) => x.id)).toEqual(["masthead-title", "s0-p2", "x", "aa", "zz", "stray"]);
  });

  test("the journal record is the paper's own, from its receipt, never a literal", async () => {
    // Two independent sources must agree: the receipt's journal record, as loaded, and the
    // bibliographic key's own grammar, ap-<volume>-<first page>. The literal this replaced gave
    // every paper (4) 17, 1-1.
    const edition = await loadBilingualEdition("mass-energy");
    const paper = edition?.paper;
    expect(paper?.bibKey).toBe("ap-18-639");
    const [, volume, first] = /^ap-(\d+)-(\d+)$/.exec(paper?.bibKey ?? "") ?? [];
    expect(paper?.journal.volume).toBe(Number(volume));
    expect(paper?.journal.pages.first).toBe(Number(first));
    expect(paper?.journal.pages.last).toBeGreaterThan(paper?.journal.pages.first ?? Infinity);
    expect(paper?.journal.series).toBe(4);
    expect(paper?.journal.doi).not.toBe("10.1002/andp.1905");
    // The dated events come from the receipt too, as intervals at the recorded precision.
    const published = paper?.dates.find((d) => d.type === "issue-publication");
    expect(published?.precision).toBe("day");
    expect(published?.earliest).toBe(published?.latest);
    const dateline = paper?.dates.find((d) => d.type === "date-line");
    expect(dateline?.precision).toBe("month");
    expect(dateline?.earliest.slice(0, 7)).toBe(dateline?.latest.slice(0, 7));
    expect((dateline?.earliest ?? "") < (dateline?.latest ?? "")).toBe(true);
  });

  // The loader turns any of these into "no edition" (null); these reach each coded refusal directly.
  const refusalCode = (fn: () => unknown): string => {
    try {
      fn();
    } catch (e) {
      return (e as { code?: string }).code ?? "uncoded";
    }
    return "did-not-throw";
  };
  const emptyRoot = () => mkdtempSync(join(tmpdir(), "am-bilingual-receipt-"));

  test("paper-citation-missing: a paper that names no citation key has no journal record", () => {
    expect(refusalCode(() => receiptPaperIdentity(emptyRoot(), undefined))).toBe(
      "paper-citation-missing",
    );
  });

  test("receipt-missing: a key with no provenance receipt refuses rather than printing a journal", () => {
    expect(refusalCode(() => receiptPaperIdentity(emptyRoot(), "ap-18-639"))).toBe(
      "receipt-missing",
    );
  });

  test("receipt-paper-missing: a receipt with no paper journal record refuses", () => {
    const root = emptyRoot();
    mkdirSync(join(root, "docs/provenance"), { recursive: true });
    writeFileSync(
      join(root, "docs/provenance/ap-18-639.md"),
      "---\nkey: ap-18-639\n---\n\nNo paper.\n",
    );
    expect(refusalCode(() => receiptPaperIdentity(root, "ap-18-639"))).toBe(
      "receipt-paper-missing",
    );
  });

  test("receipt-date-invalid: a receipt date that is not ISO day, month or year refuses", () => {
    const date = {
      type: "date-line",
      iso: "September 1905",
      precision: "month",
      source: "test",
      verifiedAt: "2026-09-24",
    } as const;
    expect(refusalCode(() => paperDateFromReceipt(date))).toBe("receipt-date-invalid");
    // The control: the same date written as ISO converts to the month's interval.
    expect(paperDateFromReceipt({ ...date, iso: "1905-09" })).toMatchObject({
      earliest: "1905-09-01",
      latest: "1905-09-30",
    });
  });
});
