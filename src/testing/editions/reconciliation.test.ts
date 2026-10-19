import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
      runDir: join(tempDir, "run"),
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

/**
 * THE DIFF IS WHAT MAKES AN OVERWRITE REVERSIBLE, AND IT HAD NO TEST.
 *
 * Scope B.6: "Existing block files are never overwritten without `--update`, which writes a unified
 * diff to the run directory first. The tool never deletes a file." The criterion's test-plan line is
 * "`--update` writes a diff before replacing, and no file is deleted", and before 2026-10-19 the
 * test covering it asserted only that the second write returned ok and that its files still existed
 * -- true of a writer that recorded nothing, which is what this one did.
 *
 * "BEFORE REPLACING" is the clause that needs proving, and the diff's own content proves it: a diff
 * can only name the previous bytes on its `-` lines if those bytes were read before the write. So
 * the assertions below are on the recorded text, not on the file's existence.
 */
describe("--update records a unified diff of what it replaced, before replacing it", () => {
  const firstThenSecond = (): Readonly<{
    destDir: string;
    runDir: string;
    first: ReturnType<typeof writeProposedBlocks>;
    second: ReturnType<typeof writeProposedBlocks>;
    beforeBytes: string;
    sectionFile: string;
  }> => {
    const tempDir = getTempDir();
    const destDir = join(tempDir, "blocks");
    const runDir = join(tempDir, "run");

    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    if (proposed.status !== "proposed") throw new Error("fixture ledger did not segment");

    const first = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: true,
      destinationDir: destDir,
    });
    if (!first.ok) throw new Error(`first write refused: ${first.code}`);
    const sectionFile = first.writtenFiles.find((f) => f.endsWith("s1.yaml")) ?? "";
    const beforeBytes = readFileSync(sectionFile, "utf8");

    /*
     * A real editorial change to the same section: one paragraph re-read off the plate, text and
     * sentences together. Revising only `text` left the old wording standing in `sentences`, so the
     * replaced file still contained it and "the previous bytes are gone from disk" could not be
     * asserted -- the first draft of this test failed on exactly that.
     */
    const revised = proposed.blocks.map((block) =>
      block.id === "s1-p1"
        ? {
            ...block,
            text: "Die Bewegung ist regelmäßig. Sie hört auf.",
            sentences: [
              { id: "s1-p1-s1", text: "Die Bewegung ist regelmäßig." },
              { id: "s1-p1-s2", text: "Sie hört auf." },
            ],
          }
        : block,
    );
    const second = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: revised,
      differences: [],
      writeBlocks: true,
      update: true,
      destinationDir: destDir,
      runDir,
    });
    return { destDir, runDir, first, second, beforeBytes, sectionFile };
  };

  test("the diff names the bytes that were there before, so it was taken before the write", () => {
    const { runDir, second, beforeBytes, sectionFile } = firstThenSecond();
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.diffFiles.length).toBeGreaterThan(0);
    const diffPath = second.diffFiles.find((f) => f.endsWith("s1.yaml.diff"));
    expect(diffPath).toBeDefined();
    if (diffPath === undefined) return;
    expect(diffPath.startsWith(runDir)).toBe(true);

    const diff = readFileSync(diffPath, "utf8");
    expect(diff.startsWith("--- a/s1.yaml\n+++ b/s1.yaml\n@@ ")).toBe(true);
    // The removed line is the previous text, which only the pre-write bytes contain: the file on
    // disk no longer holds it.
    expect(diff).toContain("unregelmäßig");
    expect(beforeBytes).toContain("unregelmäßig");
    expect(readFileSync(sectionFile, "utf8")).not.toContain("unregelmäßig");
    // And the added line is the new text.
    expect(diff).toContain("Die Bewegung ist regelmäßig");

    const removed = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
    const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);

    logger.log({
      testId: "update-writes-a-diff-first",
      beadId: BEAD,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `recorded ${String(removed.length)} removed and ${String(added.length)} added line(s) for s1.yaml before replacing it`,
    });
  });

  test("CONTROL: the same assertion fails when nothing changed, so it is reading the diff", () => {
    // The identical proposals written twice record no diff, because there is nothing to record.
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
    const again = writeProposedBlocks({
      slug: "brownian-motion",
      blocks: proposed.blocks,
      differences: [],
      writeBlocks: true,
      update: true,
      destinationDir: destDir,
      runDir: join(tempDir, "run"),
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.diffFiles).toEqual([]);
    // Reported as unchanged rather than left as an empty list a reader cannot interpret.
    expect(again.unchangedFiles.length).toBe(again.writtenFiles.length);
  });

  test("no file is deleted: every path present before the update is present after it", () => {
    const { destDir, first, second } = firstThenSecond();
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    for (const path of first.writtenFiles) {
      expect(existsSync(path)).toBe(true);
    }
    // And the writer added no section file and removed none: the same set, before and after.
    expect([...second.writtenFiles].sort()).toEqual([...first.writtenFiles].sort());
    expect(existsSync(destDir)).toBe(true);
  });
});

/**
 * "OUTPUT ORDERING IS DETERMINISTIC, SO TWO RUNS ON THE SAME INPUTS PRODUCE IDENTICAL BYTES"
 * (scope B.6). The OUTPUTS are files. Until 2026-10-19 the only test of this criterion called
 * `segmentLedger` twice in one process and compared `JSON.stringify` of the two returns, which is a
 * real check of the proposal but not of the subject: nothing written to disk was ever compared, so
 * a serializer that stamped a date or a run id into a block file would have been invisible to it.
 *
 * Both halves are kept below, and the first is renamed to say which half it answers.
 */
describe("segment-ledger byte-determinism across runs", () => {
  test("the in-memory proposal is identical across two calls", () => {
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

  /** Write the fixture's proposals into a fresh directory and digest every file that lands. */
  const writeRun = (
    order: "proposed" | "reversed",
  ): Readonly<{
    files: readonly string[];
    digests: readonly string[];
    texts: readonly string[];
  }> => {
    const destDir = join(getTempDir(), "blocks");
    const proposed = segmentLedger({ ledgerText: FIXTURE_LEDGER });
    if (proposed.status !== "proposed") throw new Error("fixture ledger did not segment");
    const blocks = order === "reversed" ? [...proposed.blocks].reverse() : proposed.blocks;
    const result = writeProposedBlocks({
      slug: "brownian-motion",
      blocks,
      differences: [],
      writeBlocks: true,
      destinationDir: destDir,
    });
    if (!result.ok) throw new Error(`write refused: ${result.code}`);
    const texts = result.writtenFiles.map((f) => readFileSync(f, "utf8"));
    return {
      // Relative to each run's own directory, since the temp path differs by construction.
      files: result.writtenFiles.map((f) => f.slice(destDir.length)),
      digests: texts.map((text) => createHash("sha256").update(text, "utf8").digest("hex")),
      texts,
    };
  };

  test("two runs write the same files, in the same order, with the same bytes", () => {
    const first = writeRun("proposed");
    const second = writeRun("proposed");

    expect(second.files).toEqual(first.files);
    expect(second.digests).toEqual(first.digests);
    expect(second.texts).toEqual(first.texts);
    // Not vacuous: something was written, and its digest is a real digest.
    expect(first.files.length).toBeGreaterThan(0);
    expect(first.digests.every((d) => /^[0-9a-f]{64}$/.test(d))).toBe(true);

    logger.log({
      testId: "segment-written-bytes-determinism",
      beadId: BEAD,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `${String(first.files.length)} written block file(s) byte-identical across two runs; digests ${first.digests.join(",")}`,
    });
  });

  test("CONTROL: the comparison is live, because a different block order writes different bytes", () => {
    /*
     * The determinism claim is only worth asserting if the output is order-sensitive. A writer that
     * sorted everything into a canonical form would satisfy the test above no matter what order it
     * was handed, and the comparison would prove nothing about ordering. Feeding the same blocks
     * reversed must therefore change the bytes.
     */
    const forward = writeRun("proposed");
    const backward = writeRun("reversed");

    /*
     * It is order-sensitive in BOTH ways, which is more than the control set out to show. The
     * section files come out in the order their first block was met, so reversing the blocks
     * reverses the file list: masthead, s1, closing becomes closing, s1, masthead.
     */
    expect(backward.files).not.toEqual(forward.files);
    expect([...backward.files].sort()).toEqual([...forward.files].sort());

    // And within a section the blocks keep the order they arrived in, so the bytes differ too.
    const digestOf = (
      run: Readonly<{ files: readonly string[]; digests: readonly string[] }>,
      name: string,
    ): string | undefined => run.digests[run.files.indexOf(name)];
    expect(digestOf(backward, "/s1.yaml")).toBeDefined();
    expect(digestOf(backward, "/s1.yaml")).not.toBe(digestOf(forward, "/s1.yaml"));
  });
});
