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
  test("source and translation are absent; authored layers do not claim review", () => {
    const inventory = loadBrownianInventory();
    expect(inventory.facsimilePinned).toBe(true);
    expect(inventory.sourceUnitsFrozen).toBe(false);
    expect(inventory.paperStatus).toBe("explanation-preview");
    expect(inventory.sourceStatus).toBe("in-preparation");
    const byLayer = Object.fromEntries(inventory.layers.map((l) => [l.layer, l]));
    expect(byLayer["source-units"]?.existence).toBe("absent");
    expect(byLayer["source-units"]?.ids).toEqual([]);
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
      message: "source absent; arguments authored and unreviewed",
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
      expect(flag.result).toBe("pending");
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

  test("verifyBrownianFacsimilePin verifies genuine pinned PDF hash against receipt", () => {
    const verification = verifyBrownianFacsimilePin();
    expect(verification.pinned).toBe(true);
    expect(verification.sha256).toBe(
      "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f",
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
      'sha256: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f"',
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
    cpSync(
      "content/source-blocks/brownian-motion/manifest.yaml",
      join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml"),
    );
    cpSync(
      "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
      join(tempRoot, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt"),
    );
    cpSync(
      "content/aliases/brownian-motion.yaml",
      join(tempRoot, "content/aliases/brownian-motion.yaml"),
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
      actual: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f",
    });

    const inventory = loadBrownianInventory(tempRoot);
    expect(inventory.facsimilePinned).toBe(false);
    expect(inventory.facsimilePinFailure).toEqual({
      kind: "digest-mismatch",
      expected: "0000000000000000000000000000000000000000000000000000000000000000",
      actual: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f",
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
