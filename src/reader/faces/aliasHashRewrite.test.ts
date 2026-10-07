/**
 * `rewrittenAliasHash` is the decision half of the alias address-bar rewrite
 * (am-read-anchors-navigation-a6o, acceptance criterion 5). The island around it is four lines and
 * a `history.replaceState`; every branch worth arguing about is here.
 *
 * A fragment is untrusted input, so the refusals are the point rather than an afterthought: this
 * runs on the German face, where the fragment may be anything a link ever carried.
 */
import { describe, expect, test } from "bun:test";
import { rewrittenAliasHash } from "./AliasHashRewrite.tsx";

/** The shape GermanFace receives: retired id to the published id that absorbed it. */
const ALIASES = Object.freeze({
  "s0-p8": "s0-p7",
  "s0-p9": "s0-p7",
  "s3-p8-s3": "s3-p8-s2",
});

describe("rewrittenAliasHash rewrites a retired fragment and nothing else", () => {
  test("a retired id becomes its successor, with the leading hash", () => {
    expect(rewrittenAliasHash("#s0-p8", ALIASES)).toBe("#s0-p7");
    expect(rewrittenAliasHash("#s3-p8-s3", ALIASES)).toBe("#s3-p8-s2");
    // Two retired ids absorbed by one successor both arrive at it, which is the merged case the
    // real corpus is mostly made of.
    expect(rewrittenAliasHash("#s0-p9", ALIASES)).toBe("#s0-p7");
  });

  test("a bare id with no leading hash is accepted, because location.hash is not the only caller", () => {
    expect(rewrittenAliasHash("s0-p8", ALIASES)).toBe("#s0-p7");
  });

  test("a percent-encoded retired id is decoded before lookup", () => {
    // A fragment may arrive encoded from a copied URL; without decoding, the lookup silently misses
    // and the retired spelling survives in the bar.
    expect(rewrittenAliasHash("#s0%2Dp8", ALIASES)).toBe("#s0-p7");
  });
});

describe("what it must leave alone, which is every case but one", () => {
  test("a LIVE id is not rewritten", () => {
    // The commonest fragment by far. Rewriting here would be a bug with no upper bound on damage.
    expect(rewrittenAliasHash("#s0-p7", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#s1-p1-s1", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#eq-s0-d1", ALIASES)).toBeNull();
  });

  test("an empty or hash-only fragment is not rewritten", () => {
    expect(rewrittenAliasHash("", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#", ALIASES)).toBeNull();
  });

  test("a malformed percent-escape is refused rather than guessed", () => {
    // decodeURIComponent throws on these. Returning null leaves the bar untouched; throwing would
    // break the island's effect on a page whose reading is otherwise fine.
    expect(rewrittenAliasHash("#%", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#%E0%A4%A", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#s0-p8%", ALIASES)).toBeNull();
  });

  test("a record pointing at itself is not rewritten, so the island cannot loop", () => {
    expect(rewrittenAliasHash("#s0-p8", { "s0-p8": "s0-p8" })).toBeNull();
  });

  test("an empty target is treated as no target", () => {
    // A map built from a filtered server-side list can carry an empty string if the filter ever
    // changes shape; rewriting to "#" would strip the reader's place.
    expect(rewrittenAliasHash("#s0-p8", { "s0-p8": "" })).toBeNull();
  });

  test("an empty alias map rewrites nothing, which is the state of most faces", () => {
    expect(rewrittenAliasHash("#s0-p8", {})).toBeNull();
  });

  test("an inherited Object property is not a target", () => {
    // `aliases["toString"]` is a function on a plain object literal. Without this the island would
    // rewrite `#toString` to a stringified function and move the reader nowhere.
    expect(rewrittenAliasHash("#toString", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#constructor", ALIASES)).toBeNull();
    expect(rewrittenAliasHash("#__proto__", ALIASES)).toBeNull();
  });
});
