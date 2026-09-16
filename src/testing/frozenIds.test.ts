import { describe, expect, it } from "bun:test";
import type { AliasRecord } from "../content/aliases.ts";
import { parseIdSnapshot, validateFrozenIds } from "../content/frozenIds.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

describe("Frozen ID Snapshots and Stability Gate", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  it("parses snapshots ignoring comments and section markers like '# s4-s5'", () => {
    const rawWithMarkers = `
# Sections 1 to 3
s1-p1
s1-p2
# s4-s5
s4-p1
s5-p1
`;
    const rawWithoutMarkers = `
s1-p1
s1-p2
s4-p1
s5-p1
`;
    const parsed1 = parseIdSnapshot(rawWithMarkers);
    const parsed2 = parseIdSnapshot(rawWithoutMarkers);

    expect(parsed1).toEqual(parsed2);
    expect(parsed1).toEqual(["s1-p1", "s1-p2", "s4-p1", "s5-p1"]);
  });

  it("reports frozen-id-missing for missing IDs and new-id for added IDs without aliases", () => {
    const snapshotText = "s1-p1\ns1-p2\n";
    const currentIds = ["s1-p1", "s1-p3"];
    const aliases: AliasRecord[] = [];

    const result = validateFrozenIds(snapshotText, currentIds, aliases);

    expect(result.ok).toBe(false);
    expect(result.missingCount).toBe(1);
    expect(result.newCount).toBe(1);

    const missing = result.findings.find((f) => f.kind === "frozen-id-missing");
    expect(missing?.id).toBe("s1-p2");

    const newId = result.findings.find((f) => f.kind === "new-id");
    expect(newId?.id).toBe("s1-p3");

    logger.log({
      testId: "frozen-id-missing-detection",
      beadId: "am-cm-id-scheme-8bn",
      expected: "frozen-id-missing",
      actual: missing?.kind,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: { rule: "frozen-snapshot-missing-without-alias-fails" },
    });
  });

  it("clears error when missing ID has a valid registered alias", () => {
    const snapshotText = "s1-p1\ns1-p2\n";
    const currentIds = ["s1-p1", "s1-p3"];
    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-p2",
        kind: "retired",
        replacementIds: ["s1-p3"],
        reason: "Replaced s1-p2 with s1-p3",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];

    const result = validateFrozenIds(snapshotText, currentIds, aliases);

    expect(result.ok).toBe(true);
    expect(result.missingCount).toBe(0);
  });

  it("reports retired-id-reused when a current ID reuses a previously retired ID", () => {
    const snapshotText = "s1-p1\ns1-p2\n";
    const currentIds = ["s1-p1", "s1-p2", "s1-p3"];
    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-p2",
        kind: "retired",
        replacementIds: ["s1-p3"],
        reason: "Retired s1-p2",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];

    const result = validateFrozenIds(snapshotText, currentIds, aliases);

    expect(result.ok).toBe(false);
    expect(result.reusedCount).toBe(1);
    const reused = result.findings.find((f) => f.kind === "retired-id-reused");
    expect(reused?.id).toBe("s1-p2");
  });
});
