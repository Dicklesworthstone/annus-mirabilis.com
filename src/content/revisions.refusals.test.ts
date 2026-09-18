/**
 * Refusal site coverage for src/content/revisions.ts (am-muyh).
 *
 * Covers all 7 refusal return sites (6 unique rules/codes across 7 sites) in revisions.ts:
 * 1. (revisions.ts:54) distinct-identity-dimensions
 * 2. (revisions.ts:74) revision-positive-integer
 * 3. (revisions.ts:86) lineage-required
 * 4. (revisions.ts:100) lineage-gap (loop gap where entry.revision !== expectedRevision)
 * 5. (revisions.ts:107) lineage-reason
 * 6. (revisions.ts:114) lineage-date
 * 7. (revisions.ts:124) lineage-gap (terminal gap where maxLineageRev is not current or current - 1)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type VersionedRecord,
  validateDistinctIdentities,
  validateRecordLineage,
} from "./revisions.ts";

describe("Revision Refusal Sites (revisions.ts)", () => {
  // 1. (revisions.ts:54) distinct-identity-dimensions
  describe("Site (revisions.ts:54): distinct-identity-dimensions", () => {
    it("rejects collapsed identity fields with rule distinct-identity-dimensions (revisions.ts:54)", () => {
      const res = validateDistinctIdentities({
        contentRevision: 1,
        compositeVersion: "1:hash",
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "distinct-identity-dimensions");
        assert.ok(res.error.includes("Forbidden collapsed identity field 'compositeVersion'"));
      }
    });

    it("accepts separate uncollapsed identity fields (revisions.ts:54)", () => {
      const res = validateDistinctIdentities({
        contentRevision: 1,
        sourceAssetDigest: "a1b2c3d4",
        translationRevision: 1,
        modelVersion: "1.0.0",
        artifactDigest: "e5f6g7h8",
      });
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });

  // 2. (revisions.ts:74) revision-positive-integer
  describe("Site (revisions.ts:74): revision-positive-integer", () => {
    it("rejects non-positive integer revision with rule revision-positive-integer (revisions.ts:74)", () => {
      const record: VersionedRecord = {
        id: "rec-zero",
        revision: 0,
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "revision-positive-integer");
        assert.ok(res.error.includes("must be a positive integer >= 1"));
      }
    });

    it("accepts valid positive integer revision (revisions.ts:74)", () => {
      const record: VersionedRecord = {
        id: "rec-valid-int",
        revision: 1,
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });

  // 3. (revisions.ts:86) lineage-required
  describe("Site (revisions.ts:86): lineage-required", () => {
    it("rejects missing lineage when revision > 1 with rule lineage-required (revisions.ts:86)", () => {
      const record: VersionedRecord = {
        id: "rec-no-lineage",
        revision: 2,
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lineage-required");
        assert.ok(res.error.includes("requires a lineage array documenting earlier revisions"));
      }
    });

    it("accepts revision 1 without lineage array (revisions.ts:86)", () => {
      const record: VersionedRecord = {
        id: "rec-initial",
        revision: 1,
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });

  // 4. (revisions.ts:100) lineage-gap (loop gap)
  describe("Site (revisions.ts:100): lineage-gap (loop gap)", () => {
    it("rejects non-sequential lineage entry with rule lineage-gap (revisions.ts:100)", () => {
      const record: VersionedRecord = {
        id: "rec-gap-seq",
        revision: 4,
        lineage: [
          { revision: 1, reason: "initial", date: "2026-01-01" },
          { revision: 3, reason: "skipped 2", date: "2026-01-02" },
        ],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lineage-gap");
        assert.ok(res.error.includes("lineage gap at index 1: expected revision 2, got 3"));
      }
    });

    it("accepts sequential lineage entries (revisions.ts:100)", () => {
      const record: VersionedRecord = {
        id: "rec-seq",
        revision: 3,
        lineage: [
          { revision: 1, reason: "initial", date: "2026-01-01" },
          { revision: 2, reason: "update", date: "2026-01-02" },
        ],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });

  // 5. (revisions.ts:107) lineage-reason
  describe("Site (revisions.ts:107): lineage-reason", () => {
    it("rejects empty or whitespace reason with rule lineage-reason (revisions.ts:107)", () => {
      const record: VersionedRecord = {
        id: "rec-empty-reason",
        revision: 2,
        lineage: [{ revision: 1, reason: "   ", date: "2026-01-01" }],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lineage-reason");
        assert.ok(res.error.includes("requires a non-empty reason string"));
      }
    });

    it("accepts non-empty reason string (revisions.ts:107)", () => {
      const record: VersionedRecord = {
        id: "rec-good-reason",
        revision: 2,
        lineage: [{ revision: 1, reason: "documented correction", date: "2026-01-01" }],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });

  // 6. (revisions.ts:114) lineage-date
  describe("Site (revisions.ts:114): lineage-date", () => {
    it("rejects non-ISO date with rule lineage-date (revisions.ts:114)", () => {
      const record: VersionedRecord = {
        id: "rec-bad-date",
        revision: 2,
        lineage: [{ revision: 1, reason: "init", date: "2026/01/01" }],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lineage-date");
        assert.ok(res.error.includes("must be YYYY-MM-DD"));
      }
    });

    it("accepts ISO format YYYY-MM-DD date (revisions.ts:114)", () => {
      const record: VersionedRecord = {
        id: "rec-good-date",
        revision: 2,
        lineage: [{ revision: 1, reason: "init", date: "2026-01-01" }],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });

  // 7. (revisions.ts:124) lineage-gap (terminal gap)
  describe("Site (revisions.ts:124): lineage-gap (terminal gap)", () => {
    it("rejects lineage terminating before current revision with rule lineage-gap (revisions.ts:124)", () => {
      const record: VersionedRecord = {
        id: "rec-early-termination",
        revision: 4,
        lineage: [
          { revision: 1, reason: "initial", date: "2026-01-01" },
          { revision: 2, reason: "update", date: "2026-01-02" },
        ],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lineage-gap");
        assert.ok(
          res.error.includes("lineage terminates at revision 2, but current revision is 4"),
        );
      }
    });

    it("accepts lineage terminating at revision - 1 (revisions.ts:124)", () => {
      const record: VersionedRecord = {
        id: "rec-valid-terminal",
        revision: 3,
        lineage: [
          { revision: 1, reason: "initial", date: "2026-01-01" },
          { revision: 2, reason: "update", date: "2026-01-02" },
        ],
      };
      const res = validateRecordLineage(record);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value, true);
      }
    });
  });
});
