import { describe, expect, it } from "bun:test";
import type { AliasRecord } from "../content/aliases.ts";
import {
  checkRevisionChanges,
  type VersionedRecord,
  validateDistinctIdentities,
  validateRecordLineage,
} from "../content/revisions.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

describe("Revisions, Lineages, and Distinct Identity Dimensions", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  /**
   * TWO RECORDS THAT SHARE AN ID ARE NOT ONE RECORD (am-9755).
   *
   * Measured over content/ on 2026-09-27: 1,816 records carry an id and a revision and use 770
   * distinct ids, so 537 ids name more than one file, `masthead-title` and three others naming
   * twelve each. Keyed by id, this check compared one paper's masthead with another's and reported
   * 223 findings between two commits that touched no content at all, which also means it could
   * never report none. The pairing key is the record's own `key` where its loader sets one, and
   * scripts/check-revisions.ts sets the file path.
   *
   * The first case is the defect. The second is its other half, and it is the one a careless fix
   * would break: the same file, changed without a revision bump, must still be caught.
   */
  it("pairs records by their key, so one paper's record is not compared with another's", () => {
    const a: VersionedRecord = {
      id: "masthead-title",
      key: "content/a/masthead-title.yaml",
      revision: 1,
      text: "On A",
    };
    const b: VersionedRecord = {
      id: "masthead-title",
      key: "content/b/masthead-title.yaml",
      revision: 1,
      text: "On B",
    };
    // THE ORDER IS THE POINT, and the first version of this test did not have it: with both sides
    // in the same order an id-keyed map keeps the same record on each side and the comparison is
    // accidentally right. The real caller reads base from `git ls-tree` and head from a directory
    // walk, which do not agree on order, so the map kept A on one side and B on the other and
    // reported a change nobody made. Planting `return record.id` in pairingKey leaves the
    // same-order case green and turns this one red, which is how the plant was caught.
    const result = checkRevisionChanges([a, b], [b, a]);
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("still catches one keyed file changed without a revision bump", () => {
    const base: VersionedRecord[] = [
      { id: "masthead-title", key: "content/a/masthead-title.yaml", revision: 1, text: "On A" },
      { id: "masthead-title", key: "content/b/masthead-title.yaml", revision: 1, text: "On B" },
    ];
    const head: VersionedRecord[] = [
      { id: "masthead-title", key: "content/a/masthead-title.yaml", revision: 1, text: "On A" },
      {
        id: "masthead-title",
        key: "content/b/masthead-title.yaml",
        revision: 1,
        text: "On B, reworded",
      },
    ];
    const result = checkRevisionChanges(base, head);
    const changed = result.findings.filter((f) => f.kind === "content-changed-revision-unchanged");
    expect(changed.length).toBe(1);
    // The finding names the RECORD, because that is what a reader needs; the key only pairs it.
    expect(changed[0]?.recordId).toBe("masthead-title");
  });

  it("falls back to the id when a loader sets no key", () => {
    const base: VersionedRecord[] = [{ id: "premise-only", revision: 1, text: "before" }];
    const head: VersionedRecord[] = [{ id: "premise-only", revision: 1, text: "after" }];
    const result = checkRevisionChanges(base, head);
    expect(result.findings.map((f) => f.kind)).toEqual(["content-changed-revision-unchanged"]);
  });

  it("fails when content hash changes but revision remains unchanged", () => {
    const baseRecords: VersionedRecord[] = [
      { id: "premise-rayleigh", revision: 1, title: "Original text" },
    ];
    const headRecords: VersionedRecord[] = [
      { id: "premise-rayleigh", revision: 1, title: "Modified text with typo fix" },
    ];

    const result = checkRevisionChanges(baseRecords, headRecords);
    expect(result.ok).toBe(false);

    const finding = result.findings.find((f) => f.kind === "content-changed-revision-unchanged");
    expect(finding).toBeDefined();
    expect(finding?.recordId).toBe("premise-rayleigh");

    logger.log({
      testId: "revision-must-increase-on-content-change",
      beadId: "am-cm-id-scheme-8bn",
      expected: "content-changed-revision-unchanged",
      actual: finding?.kind,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: { rule: "content-change-requires-revision-increment" },
    });
  });

  it("fails when revision decreases from base to head", () => {
    const baseRecords: VersionedRecord[] = [
      {
        id: "premise-rayleigh",
        revision: 3,
        lineage: [
          { revision: 1, reason: "Initial", date: "1905-01-01" },
          { revision: 2, reason: "Update", date: "1905-02-01" },
        ],
      },
    ];
    const headRecords: VersionedRecord[] = [{ id: "premise-rayleigh", revision: 2 }];

    const result = checkRevisionChanges(baseRecords, headRecords);
    expect(result.ok).toBe(false);

    const finding = result.findings.find((f) => f.kind === "revision-decreased");
    expect(finding).toBeDefined();
  });

  it("fails on lineage gap (e.g. [1, 3] for revision 4)", () => {
    const invalidRecord: VersionedRecord = {
      id: "premise-rayleigh",
      revision: 4,
      lineage: [
        { revision: 1, reason: "Initial", date: "1905-01-01" },
        { revision: 3, reason: "Gap skipped rev 2", date: "1905-03-01" },
      ],
    };

    const val = validateRecordLineage(invalidRecord);
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.rule).toBe("lineage-gap");
    }
  });

  it("fails when a record is removed at HEAD without an alias", () => {
    const baseRecords: VersionedRecord[] = [
      { id: "premise-old", revision: 1, text: "Ancient note" },
    ];
    const headRecords: VersionedRecord[] = [];
    const aliases: AliasRecord[] = [];

    const result = checkRevisionChanges(baseRecords, headRecords, aliases);
    expect(result.ok).toBe(false);

    const finding = result.findings.find((f) => f.kind === "record-removed-without-alias");
    expect(finding).toBeDefined();
    expect(finding?.recordId).toBe("premise-old");
  });

  it("enforces distinct identity dimensions and rejects collapsed identities", () => {
    const validIdentities = {
      contentRevision: 2,
      sourceAssetDigest: "a1b2c3d4",
      translationRevision: 1,
      modelVersion: "1.0.0",
      artifactDigest: "e5f6g7h8",
    };
    expect(validateDistinctIdentities(validIdentities).ok).toBe(true);

    const collapsedIdentities = {
      contentRevision: 2,
      unifiedRevision: "2:a1b2c3d4:1.0.0",
    };
    expect(validateDistinctIdentities(collapsedIdentities).ok).toBe(false);
  });
});
