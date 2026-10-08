/**
 * Refusal site coverage for src/content/anchors.ts (am-muyh).
 *
 * Covers the refusal return sites in anchors.ts:
 * 1. (anchors.ts:225) retired-heading-anchor
 * 2. (anchors.ts:233) retired-footnote-sentence-anchor
 * 3. (anchors.ts:269) result-anchor-grammar
 * 4. (anchors.ts:290) argument-anchor-grammar
 * 5. (anchors.ts:307) lab-anchor-grammar
 * 6. (anchors.ts:324) card-anchor-grammar
 * 7. (anchors.ts:341) object-anchor-grammar
 * 8. (anchors.ts:207) anchor-grammar, the empty or non-string input
 * 9. (anchors.ts:384) anchor-grammar, the fall-through for a fragment no arm recognized
 *
 * LINE NUMBERS SHIFTED BY +47 ON 2026-10-08, when sectionAnchorOf was added above parseAnchor.
 * The refusal ratchet caught it: two `anchor-grammar` sites share one code, and a site under a
 * repeated code is credited only by an exact CITATION, so the stale numbers read as two new
 * untested refusals against a baseline of 0. The seven single-occurrence codes were credited by
 * code alone and their citations were quietly wrong. Every number above was re-verified against
 * the rule string at its new line rather than shifted arithmetically on faith.
 *
 * 8 and 9 were added for am-r3qt and are the two ends of parseAnchor rather than two more arms:
 * 160 refuses before any grammar is consulted and 337 refuses after every arm has declined. They
 * SHARE the rule `anchor-grammar`, so each case asserts its own message; naming the rule alone
 * would credit both sites from either case. The header said "all 7" while carrying nine sites,
 * which is why it now names the sites instead of counting them.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAnchor } from "./anchors.ts";

describe("Anchor Refusal Sites (anchors.ts)", () => {
  // 1. (anchors.ts:225) retired-heading-anchor
  describe("Site (anchors.ts:225): retired-heading-anchor", () => {
    it("rejects legacy heading anchor ending in -h with rule retired-heading-anchor (anchors.ts:225)", () => {
      const res = parseAnchor("#s1-h");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "retired-heading-anchor");
        assert.ok(res.error.includes("Retired heading anchor"));
      }
    });

    it("accepts canonical section anchor without -h suffix (anchors.ts:225)", () => {
      const res = parseAnchor("#s1");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "section");
        assert.equal(res.value.targetId, "s1");
      }
    });
  });

  // 2. (anchors.ts:233) retired-footnote-sentence-anchor
  describe("Site (anchors.ts:233): retired-footnote-sentence-anchor", () => {
    it("rejects footnote sentence anchor with rule retired-footnote-sentence-anchor (anchors.ts:233)", () => {
      const res = parseAnchor("#s1-fn1-s1");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "retired-footnote-sentence-anchor");
        assert.ok(res.error.includes("Retired footnote sentence anchor"));
      }
    });

    it("accepts block-level footnote anchor without sentence index (anchors.ts:233)", () => {
      const res = parseAnchor("#s1-fn1");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "footnote");
        assert.equal(res.value.targetId, "s1-fn1");
      }
    });
  });

  // 3. (anchors.ts:269) result-anchor-grammar
  describe("Site (anchors.ts:269): result-anchor-grammar", () => {
    it("rejects result anchor with invalid slug syntax with rule result-anchor-grammar (anchors.ts:269)", () => {
      const res = parseAnchor("#result-INVALID_UPPERCASE");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "result-anchor-grammar");
        assert.ok(res.error.includes("Invalid result anchor"));
      }
    });

    it("accepts result anchor with valid lowercase kebab-case slug (anchors.ts:269)", () => {
      const res = parseAnchor("#result-energy-quanta");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "result");
        assert.equal(res.value.targetId, "result-energy-quanta");
      }
    });
  });

  // 4. (anchors.ts:290) argument-anchor-grammar
  describe("Site (anchors.ts:290): argument-anchor-grammar", () => {
    it("rejects argument anchor not matching paperCode and slug grammar with rule argument-anchor-grammar (anchors.ts:290)", () => {
      const res = parseAnchor("#arg-unknown-paper-slug");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "argument-anchor-grammar");
        assert.ok(res.error.includes("Invalid argument anchor"));
      }
    });

    it("accepts valid argument anchor with standard paper code and step (anchors.ts:290)", () => {
      const res = parseAnchor("#arg-sr-03");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "argument");
        assert.equal(res.value.targetId, "arg-sr-03");
      }
    });
  });

  // 5. (anchors.ts:307) lab-anchor-grammar
  describe("Site (anchors.ts:307): lab-anchor-grammar", () => {
    it("rejects lab anchor with undeclared instrument ID with rule lab-anchor-grammar (anchors.ts:307)", () => {
      const res = parseAnchor("#lab-invalid-nonexistent-instrument");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lab-anchor-grammar");
        assert.ok(res.error.includes("Invalid lab anchor"));
      }
    });

    it("accepts lab anchor with valid registered instrument ID (anchors.ts:307)", () => {
      const res = parseAnchor("#lab-bm-01");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "lab");
        assert.equal(res.value.targetId, "bm-01");
      }
    });
  });

  // 6. (anchors.ts:324) card-anchor-grammar
  describe("Site (anchors.ts:324): card-anchor-grammar", () => {
    it("rejects card anchor with invalid premise syntax with rule card-anchor-grammar (anchors.ts:324)", () => {
      const res = parseAnchor("#card-INVALID PREMISE!");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "card-anchor-grammar");
        assert.ok(res.error.includes("Invalid card anchor"));
      }
    });

    it("accepts card anchor with valid premise ID (anchors.ts:324)", () => {
      const res = parseAnchor("#card-rayleigh-1900-radiation-law");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "card");
        assert.equal(res.value.targetId, "rayleigh-1900-radiation-law");
      }
    });
  });

  // 7. (anchors.ts:341) object-anchor-grammar
  describe("Site (anchors.ts:341): object-anchor-grammar", () => {
    it("rejects object anchor with invalid slug syntax with rule object-anchor-grammar (anchors.ts:341)", () => {
      const res = parseAnchor("#object-INVALID_OBJECT_NAME");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "object-anchor-grammar");
        assert.ok(res.error.includes("Invalid object anchor"));
      }
    });

    it("accepts object anchor with valid lowercase slug (anchors.ts:341)", () => {
      const res = parseAnchor("#object-desk-mirror");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "object");
        assert.equal(res.value.targetId, "object-desk-mirror");
      }
    });
  });

  // 8. (anchors.ts:207) anchor-grammar, before any grammar is consulted
  describe("Site (anchors.ts:207): anchor-grammar on empty input", () => {
    it("refuses the empty string with rule anchor-grammar (anchors.ts:207)", () => {
      const res = parseAnchor("");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "anchor-grammar");
        assert.match(res.error, /non-empty string/);
        // NOT the fall-through message: that one belongs to :337, and an empty anchor reaching
        // it would mean parseAnchor had tried to parse "#" as a fragment.
        assert.doesNotMatch(res.error, /Unknown anchor format/);
      }
    });

    it("accepts a fragment the anchor-grammar guard must not swallow (anchors.ts:207)", () => {
      // The negative: a guard written as `if (!raw.startsWith("#"))` would refuse this too.
      const res = parseAnchor("s3-p2-s1");
      assert.equal(res.ok, true);
    });
  });

  // 9. (anchors.ts:384) anchor-grammar, after every arm has declined
  describe("Site (anchors.ts:384): anchor-grammar fall-through", () => {
    it("refuses an unrecognized fragment with rule anchor-grammar (anchors.ts:384)", () => {
      const res = parseAnchor("#not-a-real-anchor-shape");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "anchor-grammar");
        assert.match(res.error, /Unknown anchor format '#not-a-real-anchor-shape'/);
        // NOT the empty-input message: that one belongs to :160.
        assert.doesNotMatch(res.error, /non-empty string/);
      }
    });

    it("names the normalized fragment, not the raw input, in its message (anchors.ts:384)", () => {
      // parseAnchor prepends the '#' before reporting, so a reader copying the message back
      // into a URL gets a fragment rather than a bare word.
      const res = parseAnchor("not-a-real-anchor-shape");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "anchor-grammar");
        assert.match(res.error, /'#not-a-real-anchor-shape'/);
      }
    });

    it("catches a bare '#', which survives the empty-input guard (anchors.ts:384)", () => {
      // Which site catches a bare hash is the kind of thing a reader would guess wrong, so it is
      // asserted rather than assumed, and it lives HERE rather than beside :160 because planting
      // :337 is what reddens it. A citation is an attribution, and attributing this case to :160
      // because "#" looks empty would be the positional attribution the scanner warns about.
      const res = parseAnchor("#");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "anchor-grammar");
        assert.match(res.error, /Unknown anchor format/);
      }
    });

    it("lets a closing anchor through rather than refusing anchor-grammar (anchors.ts:384)", () => {
      // The negative for :337: if the arms above it stopped matching, every anchor on the site
      // would arrive here and this suite would still be green on the refusal cases alone.
      const res = parseAnchor("#closing-dateline");
      assert.equal(res.ok, true);
      if (res.ok) assert.equal(res.value.kind, "closing");
    });
  });
});
