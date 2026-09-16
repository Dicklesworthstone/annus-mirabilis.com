import { describe, expect, it } from "bun:test";
import {
  type AliasRecord,
  explainGap,
  resolveAlias,
  validateAliasRecord,
} from "../content/aliases.ts";
import { TestLogger, newRunIdentity } from "./log/logger.ts";

describe("Alias Records, Chain Resolution, and Gap Explanation", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  it("validates split, merged, and retired alias records", () => {
    const validSplit: AliasRecord = {
      retiredId: "s1-p2-s1",
      kind: "split",
      replacementIds: ["s1-p2-s1a", "s1-p2-s1b"],
      reason: "Split German sentence into two English sentences",
      date: "1905-05-11",
      editor: "ed-einstein",
    };
    const res = validateAliasRecord(validSplit);
    expect(res.ok).toBe(true);

    // Merged record with 2 replacements must fail
    const invalidMerged = {
      retiredId: "s2-p2",
      kind: "merged",
      replacementIds: ["s2-p1", "s2-p3"],
      reason: "Invalid merge",
      date: "1905-05-11",
      editor: "ed-einstein",
    };
    const mergedRes = validateAliasRecord(invalidMerged);
    expect(mergedRes.ok).toBe(false);

    // Record with a Date object instead of string YYYY-MM-DD must fail
    const invalidDate = {
      retiredId: "s2-p2",
      kind: "retired",
      replacementIds: ["s2-p1"],
      reason: "Retired",
      date: new Date() as unknown as string,
      editor: "ed-einstein",
    };
    const dateRes = validateAliasRecord(invalidDate);
    expect(dateRes.ok).toBe(false);
  });

  it("resolves a chain: retired, then split resolves to final IDs in reading order", () => {
    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-p1",
        kind: "retired",
        replacementIds: ["s1-p2"],
        reason: "Replaced with p2",
        date: "1905-05-11",
        editor: "ed-test",
      },
      {
        retiredId: "s1-p2",
        kind: "split",
        replacementIds: ["s1-p2a", "s1-p2b"],
        reason: "Split p2",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];

    const result = resolveAlias("s1-p1", aliases);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targetIds).toEqual(["s1-p2a", "s1-p2b"]);
    }
  });

  it("fails on two-node alias cycle", () => {
    const aliases: AliasRecord[] = [
      {
        retiredId: "A",
        kind: "retired",
        replacementIds: ["B"],
        reason: "A to B",
        date: "1905-05-11",
        editor: "ed-test",
      },
      {
        retiredId: "B",
        kind: "retired",
        replacementIds: ["A"],
        reason: "B to A",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];

    const result = resolveAlias("A", aliases);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("cycle");
      expect(result.error).toContain("cycle");
    }
  });

  it("fails when a replacement is missing from the fixture corpus", () => {
    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-p1",
        kind: "retired",
        replacementIds: ["s1-missing"],
        reason: "Replaced with missing ID",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];
    const corpus = new Set(["s1-p2", "s1-p3"]);

    const result = resolveAlias("s1-p1", aliases, corpus);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("dangling");
      expect(result.error).toContain("missing from the corpus");
    }
  });

  it("explains sequence gaps using explainGap", () => {
    const aliases: AliasRecord[] = [
      {
        retiredId: "s2-p2",
        kind: "merged",
        replacementIds: ["s2-p1"],
        reason: "Merged p2 into p1",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];

    const explained = explainGap("s2-p2", aliases);
    expect(explained.status).toBe("explained");
    if (explained.status === "explained") {
      expect(explained.alias.retiredId).toBe("s2-p2");
    }

    const unexplained = explainGap("s2-p3", aliases);
    expect(unexplained.status).toBe("unexplained");
  });
});
