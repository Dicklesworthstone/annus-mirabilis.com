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
