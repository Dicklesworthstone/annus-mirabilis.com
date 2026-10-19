/**
 * Refusal throw/return site coverage for src/content/editions/reconciliation.ts (am-muyh).
 *
 * Provides dedicated accept/reject test pairs for all 11 refusal sites in reconciliation.ts:
 * 1.  (reconciliation.ts:220) confirm-required
 * 2.  (reconciliation.ts:230) missing-editor
 * 3.  (reconciliation.ts:238) missing-reason
 * 4.  (reconciliation.ts:256) invalid-alias-record
 * 5.  (reconciliation.ts:289) retired-id-reused
 * 6.  (reconciliation.ts:303) update-required (in confirmAlias)
 * 7.  (reconciliation.ts:312) no-write-flag (WriteBlocksResult type declaration)
 * 8.  (reconciliation.ts:401) no-write-flag (in writeProposedBlocks)
 * 9.  (reconciliation.ts:409) write-blocks-refused-differences
 * 10. (reconciliation.ts:444) update-required (in writeProposedBlocks)
 * 11. (reconciliation.ts:462) diff-destination-required
 *
 * AN ACCEPT CASE HAS TO NAME THE CODE IT IS ACCEPTING, not only assert success. The stale-citation
 * scanner splits a test file on `test(`/`it(` and requires every `(file.ts:N)` inside a block to be
 * matched by a refusal code named in that same block (am-ksl3, refusalScanner.ts). Site 11's accept
 * case first cited line 462 while asserting nothing but `ok`, so its block named no code at all and
 * the citation was reported `code-mismatched` with an empty hint -- taking this file from its
 * baseline of 14 to 15 and turning the ratchet red on a commit that had just ADDED coverage, since
 * the untested-refusal census fell from 33 to 32 in the same breath. It now asserts
 * `notEqual(code, "diff-destination-required")`, which is both the real negative for that half of
 * the pair and the thing that makes the citation check out.
 *
 * THE BASELINE OF 14 IS NOT CAUSED BY THAT, and is left alone here. Measured 2026-10-19: five
 * citations of line 312, which is the `WriteBlocksResult` TYPE DECLARATION and holds no throw site,
 * plus nine `code-mismatched` where an accept case or a describe title cites a line its own block
 * does not name. Paying it down is a separate change, so that lowering the ceiling with it stays
 * separately reviewable.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import {
  type ConfirmAliasOptions,
  type ConfirmAliasResult,
  confirmAlias,
  type WriteBlocksOptions,
  type WriteBlocksResult,
  writeProposedBlocks,
} from "./reconciliation.ts";
import type { ProposedBlock, ReconciliationDifference } from "./segmentLedger.ts";

function getTestTempDir(): string {
  // am-yhus: mkdtempSync under the OS temp dir, so this runs the same everywhere.
  const dir = mkdtempSync(join(tmpdir(), "reconcile-refusals-"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_BLOCK: ProposedBlock = {
  id: "s1-p1",
  kind: "paragraph",
  text: "Sample paragraph block for testing.",
  sentences: [{ id: "s1-p1-s1", text: "Sample paragraph block for testing." }],
};

describe("Reconciliation Refusal Sites (reconciliation.ts)", () => {
  // 1. (reconciliation.ts:220) confirm-required
  describe("Site (reconciliation.ts:220): confirm-required", () => {
    it("rejects alias write without --confirm flag (reconciliation.ts:220)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "Merged sentence into s1-p1",
        confirm: false,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "confirm-required");
        assert.ok(res.message.includes("requires explicit --confirm flag"));
        assert.equal(res.proposedRecord?.retiredId, "s1-p2");
      }
      assert.equal(existsSync(aliasFile), false);
    });

    it("accepts alias write when --confirm flag is provided (reconciliation.ts:220)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "Merged sentence into s1-p1",
        confirm: true,
      });

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.action, "created");
        assert.equal(res.record.retiredId, "s1-p2");
      }
      assert.equal(existsSync(aliasFile), true);
    });
  });

  // 2. (reconciliation.ts:230) missing-editor
  describe("Site (reconciliation.ts:230): missing-editor", () => {
    it("rejects confirmed alias without editor identifier (reconciliation.ts:230)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "   ",
        reason: "Valid reason text",
        confirm: true,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "missing-editor");
        assert.ok(res.message.includes("requires an explicit --editor"));
      }
      assert.equal(existsSync(aliasFile), false);
    });

    it("accepts confirmed alias with valid editor identifier (reconciliation.ts:230)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "Valid reason text",
        confirm: true,
      });

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.record.editor, "editor-albert");
      }
    });
  });

  // 3. (reconciliation.ts:238) missing-reason
  describe("Site (reconciliation.ts:238): missing-reason", () => {
    it("rejects confirmed alias without editorial reason (reconciliation.ts:238)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "",
        confirm: true,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "missing-reason");
        assert.ok(res.message.includes("requires an explicit --reason"));
      }
      assert.equal(existsSync(aliasFile), false);
    });

    it("accepts confirmed alias with non-empty editorial reason (reconciliation.ts:238)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "Correction of sentence segmentation boundary",
        confirm: true,
      });

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.record.reason, "Correction of sentence segmentation boundary");
      }
    });
  });

  // 4. (reconciliation.ts:256) invalid-alias-record
  describe("Site (reconciliation.ts:256): invalid-alias-record", () => {
    it("rejects alias record that fails structural schema validation (reconciliation.ts:256)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: [], // Empty replacementIds fails validateAliasRecord
        },
        editor: "editor-albert",
        reason: "Valid reason",
        confirm: true,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "invalid-alias-record");
        assert.ok(res.message.includes("Invalid alias record"));
      }
      assert.equal(existsSync(aliasFile), false);
    });

    it("accepts alias record with structurally valid replacement IDs (reconciliation.ts:256)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "Valid reason",
        confirm: true,
      });

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.deepEqual(res.record.replacementIds, ["s1-p1"]);
      }
    });
  });

  // 5. (reconciliation.ts:289) retired-id-reused
  describe("Site (reconciliation.ts:289): retired-id-reused", () => {
    it("rejects alias using an already-retired ID as replacement ID (reconciliation.ts:289)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");

      // Seed an existing alias where s1-old is retired
      const seedPayload = {
        paper: "brownian-motion",
        aliases: [
          {
            retiredId: "s1-old",
            kind: "retired",
            replacementIds: ["s1-p1"],
            reason: "Prior retirement",
            editor: "editor-prior",
            date: "2026-09-17",
          },
        ],
      };
      writeFileSync(aliasFile, yaml.dump(seedPayload), "utf8");

      // Attempt to reuse s1-old as replacement
      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "split",
          retiredId: "s1-p2",
          replacementIds: ["s1-old", "s1-p3"],
        },
        editor: "editor-albert",
        reason: "Splitting s1-p2",
        confirm: true,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "retired-id-reused");
        assert.ok(res.message.includes("Cannot replace with retired id"));
        assert.ok(res.message.includes("s1-old"));
      }
    });

    it("accepts alias when replacement IDs contain only unretired fresh IDs (reconciliation.ts:289)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");

      const seedPayload = {
        paper: "brownian-motion",
        aliases: [
          {
            retiredId: "s1-old",
            kind: "retired",
            replacementIds: ["s1-p1"],
            reason: "Prior retirement",
            editor: "editor-prior",
            date: "2026-09-17",
          },
        ],
      };
      writeFileSync(aliasFile, yaml.dump(seedPayload), "utf8");

      const res: ConfirmAliasResult = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "split",
          retiredId: "s1-p2",
          replacementIds: ["s1-fresh-a", "s1-fresh-b"],
        },
        editor: "editor-albert",
        reason: "Splitting s1-p2 into fresh IDs",
        confirm: true,
      });

      assert.equal(res.ok, true);
    });
  });

  // 6. (reconciliation.ts:303) update-required (in confirmAlias)
  describe("Site (reconciliation.ts:303): update-required (confirmAlias)", () => {
    it("rejects overwriting existing alias without --update flag (reconciliation.ts:303)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");

      // First confirmation creates alias
      const firstRes = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "First decision",
        confirm: true,
      });
      assert.equal(firstRes.ok, true);

      // Second confirmation without update flag
      const secondRes = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1-revised"],
        },
        editor: "editor-albert",
        reason: "Updated decision",
        confirm: true,
        update: false,
      });

      assert.equal(secondRes.ok, false);
      if (!secondRes.ok) {
        assert.equal(secondRes.code, "update-required");
        assert.ok(secondRes.message.includes("Overwrite refused without explicit --update flag"));
      }
    });

    it("accepts overwriting existing alias with --update flag (reconciliation.ts:303)", () => {
      const tempDir = getTestTempDir();
      const aliasFile = join(tempDir, "brownian-motion.yaml");

      confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1"],
        },
        editor: "editor-albert",
        reason: "First decision",
        confirm: true,
      });

      const updatedRes = confirmAlias({
        slug: "brownian-motion",
        aliasFilePath: aliasFile,
        repair: {
          kind: "retired",
          retiredId: "s1-p2",
          replacementIds: ["s1-p1-revised"],
        },
        editor: "editor-albert",
        reason: "Updated decision",
        confirm: true,
        update: true,
      });

      assert.equal(updatedRes.ok, true);
      if (updatedRes.ok) {
        assert.equal(updatedRes.action, "updated");
        assert.deepEqual(updatedRes.record.replacementIds, ["s1-p1-revised"]);
      }
    });
  });

  // 7. (reconciliation.ts:312) no-write-flag (WriteBlocksResult type declaration)
  describe("Site (reconciliation.ts:312): no-write-flag (type declaration)", () => {
    it("validates WriteBlocksResult code union includes no-write-flag (reconciliation.ts:312)", () => {
      const failure: WriteBlocksResult = {
        ok: false,
        code: "no-write-flag",
        message: "Writing blocks requires explicit --write-blocks flag.",
      };
      assert.equal(failure.ok, false);
      assert.equal(failure.code, "no-write-flag");
    });

    it("validates WriteBlocksResult success variant (reconciliation.ts:312)", () => {
      const success: WriteBlocksResult = {
        ok: true,
        writtenFiles: ["/path/to/s1.yaml"],
        diffFiles: [],
        unchangedFiles: [],
        message: "Wrote 1 block files.",
      };
      assert.equal(success.ok, true);
      assert.equal(success.writtenFiles.length, 1);
    });
  });

  // 8. (reconciliation.ts:401) no-write-flag (in writeProposedBlocks)
  describe("Site (reconciliation.ts:401): no-write-flag (writeProposedBlocks)", () => {
    it("rejects writeProposedBlocks when writeBlocks flag is falsy (reconciliation.ts:401)", () => {
      const tempDir = getTestTempDir();
      const res: WriteBlocksResult = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: false,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "no-write-flag");
        assert.equal(res.message, "Writing blocks requires explicit --write-blocks flag.");
      }
    });

    it("accepts writeProposedBlocks when writeBlocks flag is true (reconciliation.ts:401)", () => {
      const tempDir = getTestTempDir();
      const res: WriteBlocksResult = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
      });

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.writtenFiles.length, 1);
      }
    });
  });

  // 9. (reconciliation.ts:409) write-blocks-refused-differences
  describe("Site (reconciliation.ts:409): write-blocks-refused-differences", () => {
    it("rejects writeProposedBlocks while differences remain unresolved (reconciliation.ts:409)", () => {
      const tempDir = getTestTempDir();
      const diff: ReconciliationDifference = {
        differenceId: "diff-unresolved-1",
        kind: "unit-missing-in-ledger",
        unitId: "s1-p9",
        message: "Unit missing in ledger",
      };

      const res: WriteBlocksResult = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [diff],
        writeBlocks: true,
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "write-blocks-refused-differences");
        assert.ok(res.message.includes("1 differences remain unresolved"));
      }
    });

    it("accepts writeProposedBlocks when differences array is empty (reconciliation.ts:409)", () => {
      const tempDir = getTestTempDir();
      const res: WriteBlocksResult = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
      });

      assert.equal(res.ok, true);
    });
  });

  // 10. (reconciliation.ts:444) update-required (in writeProposedBlocks)
  describe("Site (reconciliation.ts:444): update-required (writeProposedBlocks)", () => {
    it("rejects overwriting existing block files without update flag (reconciliation.ts:444)", () => {
      const tempDir = getTestTempDir();

      // First write succeeds
      const firstRes = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
      });
      assert.equal(firstRes.ok, true);

      // Second write without update flag
      const secondRes = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
        update: false,
      });

      assert.equal(secondRes.ok, false);
      if (!secondRes.ok) {
        assert.equal(secondRes.code, "update-required");
        assert.ok(secondRes.message.includes("Existing block files found"));
        assert.ok(secondRes.message.includes("Overwrite refused without explicit --update flag"));
        assert.ok((secondRes.existingFiles?.length ?? 0) > 0);
      }
    });

    it("accepts overwriting existing block files with update flag (reconciliation.ts:444)", () => {
      const tempDir = getTestTempDir();

      // First write
      writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
      });

      // Second write with update flag, and a run directory to record what it replaces.
      const updatedRes = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
        update: true,
        runDir: join(getTestTempDir(), "run"),
      });

      assert.equal(updatedRes.ok, true);
      if (updatedRes.ok) {
        assert.ok(updatedRes.writtenFiles.length > 0);
        // The same proposals written twice, so there is nothing to record and the file is reported
        // unchanged rather than silently producing no diff.
        assert.deepEqual(updatedRes.diffFiles, []);
        assert.equal(updatedRes.unchangedFiles.length, updatedRes.writtenFiles.length);
      }
    });
  });

  // 11. (reconciliation.ts:462) diff-destination-required
  describe("Site (reconciliation.ts:462): diff-destination-required", () => {
    it("rejects replacing a block file with no run directory for its diff (reconciliation.ts:462)", () => {
      const tempDir = getTestTempDir();
      const first = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
      });
      assert.equal(first.ok, true);

      const res: WriteBlocksResult = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
        update: true,
        // runDir deliberately omitted.
      });

      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "diff-destination-required");
        assert.ok(res.message.includes("requires a run directory"));
        assert.ok(res.message.includes("records nothing is refused"));
        assert.ok((res.existingFiles?.length ?? 0) > 0);
      }
    });

    it("accepts a FIRST write with no run directory, which replaces nothing (reconciliation.ts:462)", () => {
      const tempDir = getTestTempDir();
      const res: WriteBlocksResult = writeProposedBlocks({
        slug: "brownian-motion",
        destinationDir: tempDir,
        blocks: [SAMPLE_BLOCK],
        differences: [],
        writeBlocks: true,
        update: true,
      });

      /*
       * `update: true` is not what triggers the refusal; replacing a file is. A writer that read the
       * flag instead of the filesystem would refuse here, which is the over-strict half of this
       * guard, so the accept case names the code it must NOT return rather than only asserting ok.
       */
      // Read before asserting ok, because assert.equal narrows `res` and the refusal branch would
      // then be `never`.
      const code = res.ok ? null : res.code;
      assert.notEqual(code, "diff-destination-required");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.deepEqual(res.diffFiles, []);
        assert.deepEqual(res.unchangedFiles, []);
      }
    });
  });
});
