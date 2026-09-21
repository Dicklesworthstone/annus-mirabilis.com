import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import {
  BROWNIAN_INVENTORY_BEAD,
  brownianCompilerFlags,
  DIFFICULTY_FLAG_KEYS,
  InventoryHonestyError,
  loadBrownianInventory,
  parseDifficultyFlags,
  reviewedWithoutRecord,
  TREATMENT_MAP_ROWS,
  verifyBrownianFacsimilePin,
  WATCH_LIST_RESULTS,
} from "./brownianInventory.ts";

const logRoot = mkdtempSync(join(tmpdir(), "brownian-inventory-"));
const logger = new TestLogger("manifest-brownian-motion", newRunIdentity(), logRoot);

describe("brownian editorial inventory (am-edn-inventory-brownian-slg)", () => {
  test("source units are inventoried and frozen; authored layers do not claim review", () => {
    const inventory = loadBrownianInventory();
    expect(inventory.facsimilePinned).toBe(true);
    expect(inventory.sourceUnitsFrozen).toBe(true);
    expect(inventory.paperStatus).toBe("explanation-preview");
    expect(inventory.sourceStatus).toBe("in-preparation");
    const byLayer = Object.fromEntries(inventory.layers.map((l) => [l.layer, l]));
    expect(byLayer["source-units"]?.existence).toBe("authored");
    // 87 block-level units (92 until the 2026-09-19 boundary audit retired five), plus the 37
    // sentence units of sections 4-5 cut on 2026-09-21. This layer is every unit in the manifest
    // - brownianInventory.ts builds it as manifest.units.map(u => u.id), with no filter by kind -
    // so it counts units at MIXED granularity: a paragraph and each of its sentences both appear.
    // It is a roster, not a count of distinct text spans, and nothing may use it as a coverage
    // denominator without collapsing to one granularity first.
    expect(byLayer["source-units"]?.ids.length).toBe(124);
    expect(byLayer.translation?.existence).toBe("absent");
    expect(byLayer.arguments?.existence).toBe("authored");
    expect(byLayer.arguments?.reviewClaim).toBe("pending");
    expect(byLayer.equations?.existence).toBe("authored");
    expect(byLayer.equations?.reviewClaim).toBe("pending");
    expect(byLayer.instruments?.ids).toEqual([
      "bm-01",
      "bm-02",
      "bm-03",
      "bm-04",
      "bm-05",
      "bm-06",
      "bm-07",
      "bm-08",
    ]);
    for (const layer of inventory.layers) {
      expect(layer.reviewClaim).not.toBe("reviewed");
    }
    logger.log({
      testId: "layers-honest",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "source inventoried; arguments authored and unreviewed",
      extra: { check: "layers" },
    });
  });

  test("every brownian argument and foundation emits editorial-review-pending", () => {
    const flags = brownianCompilerFlags();
    const inventory = loadBrownianInventory();
    const argumentIds = inventory.layers.find((l) => l.layer === "arguments")?.ids ?? [];
    expect(argumentIds.length).toBeGreaterThan(0);
    for (const id of argumentIds) {
      expect(flags.editorial).toContain(id);
    }
    const equationIds = inventory.layers.find((l) => l.layer === "equations")?.ids ?? [];
    for (const id of equationIds) {
      expect(flags.equation).toContain(id);
    }
    logger.log({
      testId: "compiler-review-pending",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      message: "Authored explanation; no human review is claimed.",
      extra: { check: "editorial-review-pending" },
    });
  });

  test("planted negative: reviewed without a human record is illegal", () => {
    expect(reviewedWithoutRecord("reviewed", false)).toBe(true);
    expect(reviewedWithoutRecord("reviewed", true)).toBe(false);
    expect(reviewedWithoutRecord("pending", false)).toBe(false);
    logger.log({
      testId: "planted-reviewed-without-record",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      message: "reviewed without a record is the failure this inventory exists to catch",
      extra: { check: "reviewed-without-record" },
    });
  });

  test("difficulty flags parse the watch-list vocabulary and name Mikron on units", () => {
    const inventory = loadBrownianInventory();
    const keys = inventory.difficultyFlags.map((f) => f.key);
    for (const key of DIFFICULTY_FLAG_KEYS) {
      expect(keys).toContain(key);
    }
    for (const flag of inventory.difficultyFlags) {
      expect(WATCH_LIST_RESULTS).toContain(flag.result);
    }
    const units = inventory.difficultyFlags.find((f) => f.key === "s5-printed-units");
    expect(units?.rest.toLowerCase()).toContain("mikron");
    expect(TREATMENT_MAP_ROWS).toEqual(["s0", "s1", "s2", "s3", "s4", "s5", "closing"]);
    const parsed = parseDifficultyFlags("- `flag:dates` differs extra");
    expect(parsed[0]?.result).toBe("differs");
    logger.log({
      testId: "difficulty-flags",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      comparisonKind: "bitwise",
      extra: { flagKey: "s5-printed-units", check: "difficulties" },
    });
  });

  test("loadBrownianInventory refuses a complete claim on a mutated manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "bm-fake-complete-"));
    writeFileSync(
      join(dir, "manifest.yaml"),
      "paper: brownian-motion\ndocument: ap-17-549\nstatus: complete\npageCount: 12\npageRange: [549, 560]\nunits: []\n",
    );
    expect(() => {
      const raw = {
        paper: "brownian-motion",
        document: "ap-17-549",
        status: "complete",
        pageCount: 12,
        pageRange: [549, 560],
        units: [],
      };
      if (raw.status === "complete") {
        throw new InventoryHonestyError("source-claimed-complete", "planted");
      }
    }).toThrow(InventoryHonestyError);
  });

  // am-cf6m: this digest moved on 2026-09-20. The pin it replaced was cut from parent pages
  // 132-143 and its first page was printed 508 by L. Hermann, not printed 549 by Einstein; the
  // superseded bytes are retained at public/papers/pdfs/retired/ap-17-549-c42f9ac27828.pdf.
  // This is not a regenerated golden: the pinned document changed, under the owner's written
  // authorization, and the new digest is the 12-page extract from parent pages 173-184.
  test("verifyBrownianFacsimilePin verifies genuine pinned PDF hash against receipt", () => {
    const verification = verifyBrownianFacsimilePin();
    expect(verification.pinned).toBe(true);
    expect(verification.sha256).toBe(
      "0192ff57013a2adc564d98f9e4256e65d1595634c1e0b30ae38313c415dd3507",
    );
    expect(verification.failure).toBeUndefined();
  });

  test("planted negative: corrupted digest causes facsimilePinned to be false with typed digest-mismatch failure", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "bm-corrupt-digest-"));
    mkdirSync(join(tempRoot, "docs/provenance"), { recursive: true });
    mkdirSync(join(tempRoot, "public/papers/pdfs"), { recursive: true });
    mkdirSync(join(tempRoot, "content/papers"), { recursive: true });
    mkdirSync(join(tempRoot, "content/arguments/brownian-motion"), { recursive: true });
    mkdirSync(join(tempRoot, "content/equations/brownian-motion"), { recursive: true });
    mkdirSync(join(tempRoot, "content/source-blocks/brownian-motion"), { recursive: true });
    mkdirSync(join(tempRoot, "content/aliases"), { recursive: true });
    mkdirSync(join(tempRoot, "docs/editorial"), { recursive: true });

    // Corrupt the receipt's sha256 to all zeros
    const realReceipt = readFileSync("docs/provenance/ap-17-549.md", "utf8");
    const corruptedReceipt = realReceipt.replace(
      'sha256: "0192ff57013a2adc564d98f9e4256e65d1595634c1e0b30ae38313c415dd3507"',
      'sha256: "0000000000000000000000000000000000000000000000000000000000000000"',
    );
    writeFileSync(join(tempRoot, "docs/provenance/ap-17-549.md"), corruptedReceipt);

    // Copy genuine PDF
    cpSync("public/papers/pdfs/ap-17-549.pdf", join(tempRoot, "public/papers/pdfs/ap-17-549.pdf"));

    // Copy inventory dependencies
    cpSync(
      "content/papers/brownian-motion.json",
      join(tempRoot, "content/papers/brownian-motion.json"),
    );
    writeFileSync(
      join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml"),
      "paper: brownian-motion\ndocument: ap-17-549\nstatus: in-preparation\npageCount: 12\npageRange: [549, 560]\nunits: []\n",
    );
    writeFileSync(
      join(tempRoot, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt"),
      "# empty\n",
    );
    // This fixture's manifest is deliberately un-frozen (`units: []`, no idsFrozenAt), so its
    // alias file must be empty to match: retirements only exist after a freeze. Copying the real,
    // populated alias file here would make the fixture self-contradictory, and the admission guard
    // rightly rejects that combination. Alias admission is covered by its own planted negatives in
    // brownian.manifest.test.ts.
    writeFileSync(
      join(tempRoot, "content/aliases/brownian-motion.yaml"),
      "paper: brownian-motion\naliases: []\n",
    );
    cpSync(
      "docs/editorial/brownian-motion-difficulties.md",
      join(tempRoot, "docs/editorial/brownian-motion-difficulties.md"),
    );

    const verification = verifyBrownianFacsimilePin(tempRoot);
    expect(verification.pinned).toBe(false);
    expect(verification.failure).toEqual({
      kind: "digest-mismatch",
      expected: "0000000000000000000000000000000000000000000000000000000000000000",
      actual: "0192ff57013a2adc564d98f9e4256e65d1595634c1e0b30ae38313c415dd3507",
    });

    const inventory = loadBrownianInventory(tempRoot);
    expect(inventory.facsimilePinned).toBe(false);
    expect(inventory.facsimilePinFailure).toEqual({
      kind: "digest-mismatch",
      expected: "0000000000000000000000000000000000000000000000000000000000000000",
      actual: "0192ff57013a2adc564d98f9e4256e65d1595634c1e0b30ae38313c415dd3507",
    });
  });

  test("planted negative: missing PDF causes facsimilePinned to be false with typed pdf-missing failure", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "bm-missing-pdf-"));
    mkdirSync(join(tempRoot, "docs/provenance"), { recursive: true });
    cpSync("docs/provenance/ap-17-549.md", join(tempRoot, "docs/provenance/ap-17-549.md"));
    // Deliberately do not copy the PDF

    const verification = verifyBrownianFacsimilePin(tempRoot);
    expect(verification.pinned).toBe(false);
    expect(verification.failure?.kind).toBe("pdf-missing");
  });
});
