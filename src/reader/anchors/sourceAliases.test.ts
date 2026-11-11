import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import type { AliasRecord } from "../../content/aliases.ts";
import { resolvedSourceAliases, SourceAliasError } from "./sourceAliases.ts";

const alias = (retiredId: string, replacementIds: string[]): AliasRecord => ({
  retiredId,
  replacementIds,
  kind: replacementIds.length > 1 ? "split" : "merged",
  date: "2026-11-11",
  reason: "A source correction preserves the old address.",
  editor: "source alias navigation regression",
});

describe("source aliases shared by reading faces", () => {
  test("a chain ending in a split uses its first live successor, in reading order", () => {
    const result = resolvedSourceAliases(
      [alias("s3-p8", ["s3-p9"]), alias("s3-p9", ["s3-p10-s1", "s3-p10-s2"])],
      new Set(["s3-p10-s1", "s3-p10-s2"]),
    );
    expect(result).toEqual({ "s3-p8": "s3-p10-s1", "s3-p9": "s3-p10-s1" });
    expect(Object.isFrozen(result)).toBe(true);
  });

  test("a page never publishes a dead destination, replaces a live id, or treats a revision as an address", () => {
    expect(
      resolvedSourceAliases(
        [
          alias("s1-p3", ["s1-p2"]),
          alias("s2-p3", ["s2-p2"]),
          alias("s1-p4", ["s1-p2"]),
          alias("s1-p3-s1-r1", ["s1-p2-s1-r3"]),
        ],
        new Set(["s1-p2", "s1-p4", "s1-p2-s1-r3"]),
      ),
    ).toEqual({ "s1-p3": "s1-p2" });
  });

  test("source-alias-collection-invalid: malformed collections cannot silently drop old links", () => {
    assert.throws(
      () => resolvedSourceAliases({}, new Set()),
      (error: unknown) => {
        expect(error).toBeInstanceOf(SourceAliasError);
        expect((error as SourceAliasError).rule).toBe("source-alias-collection-invalid");
        return true;
      },
    );
  });

  test("source-alias-record-invalid: malformed records fail through the existing validator", () => {
    assert.throws(
      () => resolvedSourceAliases([{ retiredId: "s1-p3" }], new Set()),
      (error: unknown) => {
        expect(error).toBeInstanceOf(SourceAliasError);
        expect((error as SourceAliasError).rule).toBe("source-alias-record-invalid");
        return true;
      },
    );
  });

  test("source-alias-resolution-failed: an alias cycle cannot publish an apparently working address", () => {
    assert.throws(
      () =>
        resolvedSourceAliases(
          [alias("s1-p3", ["s1-p4"]), alias("s1-p4", ["s1-p3"])],
          new Set(["s1-p2"]),
        ),
      (error: unknown) => {
        expect(error).toBeInstanceOf(SourceAliasError);
        expect((error as SourceAliasError).rule).toBe("source-alias-resolution-failed");
        expect((error as SourceAliasError).message).toContain("cycle");
        return true;
      },
    );
  });
});
