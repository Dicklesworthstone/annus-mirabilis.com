import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import {
  confirmAlias,
  reconcileManifest,
  segmentLedger,
  writeProposedBlocks,
} from "../../content/editions/segmentLedger.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

const FIXTURE_LEDGER = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---
[[TITLE]]
Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung
[[AUTHOR]]
von A. Einstein
[[HEADING s1]] § 1.
Die Bewegung ist unregelmäßig. Sie hört nicht auf.
[[DATELINE]] Bern, Mai 1905.
`;

function getTempDir(): string {
  // am-yhus: mkdtempSync under the OS temp dir, so this runs the same everywhere.
  return mkdtempSync(join(tmpdir(), "reconcile-test-"));
}

describe("reconciliation: manifest differences and boundaries", () => {
  test("identical inputs yield zero differences (all match)", () => {
    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    const manifestUnits = [
      { id: "masthead-title" },
      { id: "masthead-author" },
      { id: "s1" },
      { id: "s1-p1-s1" },
      { id: "s1-p1-s2" },
      { id: "closing-dateline" },
    ];
    const diffs = reconcileManifest({ blocks: proposed.blocks, manifestUnits });
    expect(diffs).toEqual([]);
    logger.log({
      testId: "reconcile-match",
      beadId: BEAD,
      outcome: "passed",
      message: "identical inputs yield zero reconciliation differences",
    });
  });

  test("PLANTED: a manifest boundary at vgl. yields boundary-differs with a proposed merged alias", () => {
    // Ledger has a single sentence containing vgl. (abbreviation rule kept it whole)
    const ledgerWithVgl = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---
[[HEADING s1]] § 1.
Siehe vgl. A. Einstein hierzu.
`;
    const proposed = segmentLedger({ ledgerText: ledgerWithVgl });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    // Manifest erroneously had two sentences split at vgl.
    const manifestUnits = [
      { id: "s1" },
      { id: "s1-p1-s1", text: "Siehe" },
      { id: "s1-p1-s2", text: "vgl. A. Einstein hierzu." },
    ];
    const diffs = reconcileManifest({ blocks: proposed.blocks, manifestUnits });
    const boundaryDiff = diffs.find((d) => d.kind === "boundary-differs");
    expect(boundaryDiff).toBeDefined();
    expect(boundaryDiff?.unitId).toBe("s1-p1-s2");
    expect(boundaryDiff?.proposedRepair?.kind).toBe("merged");
    expect(boundaryDiff?.proposedRepair?.replacementIds).toContain("s1-p1-s1");
  });
});

describe("alias confirmation guards: --confirm, --editor, --reason, and --update", () => {
  test("PLANTED: write without --confirm refuses naming what it would have written", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    const result = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: {
        kind: "retired",
        retiredId: "s1-p2",
        replacementIds: ["s1-p1"],
      },
      editor: "jemanuel",
      reason: "Paragraph boundary correction",
      confirm: false, // write without --confirm
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("confirm-required");
      expect(result.message).toContain("requires explicit --confirm flag");
      expect(result.message).toContain("s1-p2");
      expect(result.proposedRecord?.retiredId).toBe("s1-p2");
      expect(result.proposedRecord?.editor).toBe("jemanuel");
    }
    expect(existsSync(aliasFile)).toBe(false);
  });

  test("PLANTED: --confirm without --editor refuses unattributed editorial decision", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    const result = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: {
        kind: "retired",
        retiredId: "s1-p2",
        replacementIds: ["s1-p1"],
      },
      editor: "", // missing editor
      reason: "Boundary fix",
      confirm: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-editor");
      expect(result.message).toContain("requires an explicit --editor");
    }
  });

  test("PLANTED: --confirm without --reason refuses unattributed editorial decision", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    const result = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: {
        kind: "retired",
        retiredId: "s1-p2",
        replacementIds: ["s1-p1"],
      },
      editor: "jemanuel",
      reason: "", // missing reason
      confirm: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-reason");
      expect(result.message).toContain("requires an explicit --reason");
    }
  });

  test("write WITH --confirm, editor, and reason succeeds and records both", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    const result = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: {
        kind: "retired",
        retiredId: "s1-p2",
        replacementIds: ["s1-p1"],
      },
      editor: "jemanuel",
      reason: "Merged short sentence into s1-p1",
      confirm: true,
      date: "2026-09-18",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action).toBe("created");
      expect(result.record.editor).toBe("jemanuel");
      expect(result.record.reason).toBe("Merged short sentence into s1-p1");
      expect(result.record.retiredId).toBe("s1-p2");
    }

    expect(existsSync(aliasFile)).toBe(true);
    const raw = yaml.load(readFileSync(aliasFile, "utf8")) as Record<string, unknown>;
    expect(raw.paper).toBe("brownian-motion");
    expect(Array.isArray(raw.aliases)).toBe(true);
    const aliases = raw.aliases as Record<string, unknown>[];
    expect(aliases).toHaveLength(1);
    expect(aliases[0]?.editor).toBe("jemanuel");
    expect(aliases[0]?.reason).toBe("Merged short sentence into s1-p1");
  });

  test("PLANTED: overwrite existing alias without --update refuses", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    // First write:
    confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: { kind: "retired", retiredId: "s1-p2", replacementIds: ["s1-p1"] },
      editor: "jemanuel",
      reason: "Initial reason",
      confirm: true,
    });

    // Overwrite attempt without update:
    const overwrite = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: { kind: "retired", retiredId: "s1-p2", replacementIds: ["s1-p1"] },
      editor: "jemanuel",
      reason: "Updated reason",
      confirm: true,
      update: false,
    });

    expect(overwrite.ok).toBe(false);
    if (!overwrite.ok) {
      expect(overwrite.code).toBe("update-required");
      expect(overwrite.message).toContain("Overwrite refused without explicit --update flag");
    }
  });

  test("overwrite existing alias WITH --update succeeds", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: { kind: "retired", retiredId: "s1-p2", replacementIds: ["s1-p1"] },
      editor: "jemanuel",
      reason: "Initial reason",
      confirm: true,
    });

    const updated = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: { kind: "retired", retiredId: "s1-p2", replacementIds: ["s1-p1"] },
      editor: "jemanuel",
      reason: "Revised explanation for retirement",
      confirm: true,
      update: true,
    });

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.action).toBe("updated");
      expect(updated.record.reason).toBe("Revised explanation for retirement");
    }
  });

  test("PLANTED: reusing an existing retired id as a replacement fails", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    // Retire s1-p2
    confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: { kind: "retired", retiredId: "s1-p2", replacementIds: ["s1-p1"] },
      editor: "jemanuel",
      reason: "Retire s1-p2",
      confirm: true,
    });

    // Try to use s1-p2 as a replacement in another alias:
    const reuse = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: { kind: "retired", retiredId: "s1-p3", replacementIds: ["s1-p2"] },
      editor: "jemanuel",
      reason: "Cannot replace with retired id",
      confirm: true,
    });

    expect(reuse.ok).toBe(false);
    if (!reuse.ok) {
      expect(reuse.code).toBe("retired-id-reused");
      expect(reuse.message).toContain("reusing a retired id is forbidden");
    }
  });

  test("PLANTED: an invalid alias record structure (split with only one replacement) refuses with invalid-alias-record", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    const result = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: {
        kind: "split",
        retiredId: "s1-p2",
        replacementIds: ["s1-p2a"], // invalid: split requires at least two replacement IDs
      },
      editor: "jemanuel",
      reason: "Split paragraph into sentences",
      confirm: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-alias-record");
      expect(result.message).toContain("must specify at least two replacement IDs");
    }
    expect(existsSync(aliasFile)).toBe(false);
  });

  test("valid split alias with at least two replacements passes alias validation and writes record", () => {
    const tempDir = getTempDir();
    const aliasFile = join(tempDir, "brownian-motion.yaml");

    const result = confirmAlias({
      slug: "brownian-motion",
      aliasFilePath: aliasFile,
      repair: {
        kind: "split",
        retiredId: "s1-p2",
        replacementIds: ["s1-p2a", "s1-p2b"],
      },
      editor: "jemanuel",
      reason: "Split paragraph into two sentences",
      confirm: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action).toBe("created");
      expect(result.record.kind).toBe("split");
      expect(result.record.replacementIds).toEqual(["s1-p2a", "s1-p2b"]);
    }
    expect(existsSync(aliasFile)).toBe(true);
  });
});

describe("block writer guards: --write-blocks and --update", () => {
  test("PLANTED: writeProposedBlocks without --write-blocks flag refuses with no-write-flag", () => {
    const tempDir = getTempDir();
    const destDir = join(tempDir, "blocks");

    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    const result = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: false,
      destinationDir: destDir,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("no-write-flag");
      expect(result.message).toContain("requires explicit --write-blocks flag");
    }
    expect(existsSync(destDir)).toBe(false);
  });

  test("PLANTED: --write-blocks refuses while differences remain unresolved", () => {
    const tempDir = getTempDir();
    const destDir = join(tempDir, "blocks");

    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    const diffs = [
      {
        differenceId: "unit-missing-in-ledger:s1-p9",
        kind: "unit-missing-in-ledger" as const,
        unitId: "s1-p9",
        message: "Unresolved missing block",
      },
    ];

    const result = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: diffs,
      writeBlocks: true,
      destinationDir: destDir,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("write-blocks-refused-differences");
      expect(result.message).toContain("--write-blocks refused while 1 differences remain");
    }
    expect(existsSync(destDir)).toBe(false);
  });

  test("PLANTED: overwrite existing block files without --update refuses", () => {
    const tempDir = getTempDir();
    const destDir = join(tempDir, "blocks");

    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    // First write: clean
    const firstWrite = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: true,
      destinationDir: destDir,
    });
    expect(firstWrite.ok).toBe(true);

    // Second write without update flag refuses
    const secondWrite = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: true,
      update: false,
      destinationDir: destDir,
    });

    expect(secondWrite.ok).toBe(false);
    if (!secondWrite.ok) {
      expect(secondWrite.code).toBe("update-required");
      expect(secondWrite.message).toContain("Overwrite refused without explicit --update flag");
    }
  });

  test("writing with --update succeeds over existing files and does not delete files", () => {
    const tempDir = getTempDir();
    const destDir = join(tempDir, "blocks");

    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    expect(proposed.status).toBe("proposed");
    if (proposed.status !== "proposed") return;

    writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: true,
      destinationDir: destDir,
    });

    const secondWrite = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: true,
      update: true,
      destinationDir: destDir,
    });

    expect(secondWrite.ok).toBe(true);
    if (secondWrite.ok) {
      expect(secondWrite.writtenFiles.length).toBeGreaterThan(0);
      for (const f of secondWrite.writtenFiles) {
        expect(existsSync(f)).toBe(true);
      }
    }
  });
});

describe("segment-ledger byte-determinism across runs", () => {
  test("two runs over the same fixture produce identical bytes (comparing digests)", () => {
    const run1 = JSON.stringify(segmentLedger({ ledgerText: FIXTURE_LEDGER }));
    const run2 = JSON.stringify(segmentLedger({ ledgerText: FIXTURE_LEDGER }));

    const digest1 = createHash("sha256").update(run1, "utf8").digest("hex");
    const digest2 = createHash("sha256").update(run2, "utf8").digest("hex");

    expect(digest1).toBe(digest2);
    expect(run1).toBe(run2);
    logger.log({
      testId: "segment-byte-determinism",
      beadId: BEAD,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "two runs on the fixture ledger produce bitwise-identical serialization",
    });
  });
});
