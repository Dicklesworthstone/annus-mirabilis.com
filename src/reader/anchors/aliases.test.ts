import { describe, expect, test } from "bun:test";
import type { AliasRecord } from "../../content/aliases.ts";
import { aliasIdsForLocation, resolveNavigationAlias, rewrittenHashFor } from "./aliases.ts";

function record(overrides: Partial<AliasRecord> & Pick<AliasRecord, "retiredId">): AliasRecord {
  return {
    kind: "retired",
    replacementIds: [],
    reason: "test fixture",
    date: "2026-01-01",
    editor: "test",
    ...overrides,
  };
}

describe("resolveNavigationAlias", () => {
  test("an id with no alias record is reported no-alias, not a redirect to itself", () => {
    expect(resolveNavigationAlias("s3-p2-s1", []).kind).toBe("no-alias");
  });

  test("a simple retired-to-one-replacement id redirects", () => {
    const aliases = [record({ retiredId: "s3-h", kind: "retired", replacementIds: ["s3"] })];
    const outcome = resolveNavigationAlias("s3-h", aliases);
    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") throw new Error("expected redirect");
    expect(outcome.redirect.resolvedId).toBe("s3");
    expect(outcome.redirect.note).toBeUndefined();
  });

  test("a split id (multiple replacements) resolves to the first successor, with a note", () => {
    const aliases = [
      record({
        retiredId: "s3-p2-old",
        kind: "split",
        replacementIds: ["s3-p2-s1", "s3-p2-s2"],
      }),
    ];
    const outcome = resolveNavigationAlias("s3-p2-old", aliases);
    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") throw new Error("expected redirect");
    expect(outcome.redirect.resolvedId).toBe("s3-p2-s1");
    expect(outcome.redirect.allTargetIds).toEqual(["s3-p2-s1", "s3-p2-s2"]);
    expect(outcome.redirect.note).toMatch(/first of 2/);
  });

  test("an alias chain resolves to the final successor", () => {
    const aliases = [
      record({ retiredId: "a", kind: "retired", replacementIds: ["b"] }),
      record({ retiredId: "b", kind: "retired", replacementIds: ["c"] }),
    ];
    const outcome = resolveNavigationAlias("a", aliases);
    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") throw new Error("expected redirect");
    expect(outcome.redirect.resolvedId).toBe("c");
  });

  test("a cycle is reported as an error, never an infinite loop", () => {
    const aliases = [
      record({ retiredId: "a", kind: "retired", replacementIds: ["b"] }),
      record({ retiredId: "b", kind: "retired", replacementIds: ["a"] }),
    ];
    const outcome = resolveNavigationAlias("a", aliases);
    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.code).toBe("cycle");
  });

  test("a dangling replacement outside the known corpus is reported as an error", () => {
    const aliases = [record({ retiredId: "a", kind: "retired", replacementIds: ["nowhere"] })];
    const outcome = resolveNavigationAlias("a", aliases, new Set(["s1"]));
    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.code).toBe("dangling");
  });
});

describe("aliasIdsForLocation: static alias anchors emitted at the new location", () => {
  test("every retired id whose resolution lands here is listed", () => {
    const aliases = [
      record({ retiredId: "s3-h", kind: "retired", replacementIds: ["s3"] }),
      record({ retiredId: "sec-3", kind: "retired", replacementIds: ["s3"] }),
      record({ retiredId: "s4-h", kind: "retired", replacementIds: ["s4"] }),
    ];
    expect(aliasIdsForLocation("s3", aliases).sort()).toEqual(["s3-h", "sec-3"]);
  });

  test("a location with no retired ids pointing at it gets an empty list", () => {
    expect(aliasIdsForLocation("s9", [])).toEqual([]);
  });

  test("a chained alias's static anchor is placed at the FINAL location, not an intermediate one", () => {
    const aliases = [
      record({ retiredId: "a", kind: "retired", replacementIds: ["b"] }),
      record({ retiredId: "b", kind: "retired", replacementIds: ["c"] }),
    ];
    expect(aliasIdsForLocation("b", aliases)).toEqual([]);
    expect(aliasIdsForLocation("c", aliases)).toEqual(["a", "b"]);
  });
});

describe("rewrittenHashFor: the JavaScript-enabled history.replaceState target", () => {
  test("a retired hash rewrites to its resolved location", () => {
    const aliases = [record({ retiredId: "s3-h", kind: "retired", replacementIds: ["s3"] })];
    expect(rewrittenHashFor("#s3-h", aliases)).toBe("#s3");
  });

  test("a current (non-retired) hash needs no rewrite", () => {
    expect(rewrittenHashFor("#s3", [])).toBeNull();
  });

  test("an empty hash needs no rewrite", () => {
    expect(rewrittenHashFor("", [])).toBeNull();
  });

  test("works whether or not the caller included the leading #", () => {
    const aliases = [record({ retiredId: "s3-h", kind: "retired", replacementIds: ["s3"] })];
    expect(rewrittenHashFor("s3-h", aliases)).toBe("#s3");
  });
});
