import { describe, expect, test } from "bun:test";
import { aliasElementId, resolveAlias, rewriteHashTarget } from "./aliases";

describe("resolveAlias: unambiguous retired anchors resolve to their real location", () => {
  test("a retired heading anchor resolves to its section", () => {
    const resolution = resolveAlias("#s3-h");
    expect(resolution).toEqual({ from: "#s3-h", to: "#s3" });
  });

  test("a retired footnote-sentence anchor resolves to its footnote block", () => {
    const resolution = resolveAlias("#s3-fn1-s2");
    expect(resolution).toEqual({ from: "#s3-fn1-s2", to: "#s3-fn1" });
  });

  test("accepts a bare id without the leading '#'", () => {
    expect(resolveAlias("s3-h")).toEqual({ from: "#s3-h", to: "#s3" });
  });

  test("a genuinely ambiguous retired form (bare #entrance, which never named a paper) resolves to null, not a guess", () => {
    expect(resolveAlias("#entrance")).toBeNull();
    expect(resolveAlias("#entry")).toBeNull();
  });

  test("an anchor that is not retired at all (parses fine on its own) resolves to null", () => {
    expect(resolveAlias("#s3")).toBeNull();
    expect(resolveAlias("#s3-p2-s1")).toBeNull();
  });

  test("an anchor that is simply invalid, not retired, resolves to null", () => {
    expect(resolveAlias("#not-a-real-anchor-form")).toBeNull();
  });
});

describe("aliasElementId and rewriteHashTarget: the two rendering-side outputs", () => {
  test("aliasElementId returns the bare retired id, for a static element at the new location", () => {
    const resolution = resolveAlias("#s3-h");
    expect(resolution).not.toBeNull();
    if (resolution) expect(aliasElementId(resolution)).toBe("s3-h");
  });

  test("rewriteHashTarget returns the real fragment, for history.replaceState", () => {
    const resolution = resolveAlias("#s3-h");
    expect(resolution).not.toBeNull();
    if (resolution) expect(rewriteHashTarget(resolution)).toBe("#s3");
  });
});
