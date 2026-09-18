/**
 * Refusal site coverage for src/content/anchors.ts (am-muyh).
 *
 * Covers all 7 refusal return sites in anchors.ts:
 * 1. (anchors.ts:178) retired-heading-anchor
 * 2. (anchors.ts:186) retired-footnote-sentence-anchor
 * 3. (anchors.ts:222) result-anchor-grammar
 * 4. (anchors.ts:243) argument-anchor-grammar
 * 5. (anchors.ts:260) lab-anchor-grammar
 * 6. (anchors.ts:277) card-anchor-grammar
 * 7. (anchors.ts:294) object-anchor-grammar
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAnchor } from "./anchors.ts";

describe("Anchor Refusal Sites (anchors.ts)", () => {
  // 1. (anchors.ts:178) retired-heading-anchor
  describe("Site (anchors.ts:178): retired-heading-anchor", () => {
    it("rejects legacy heading anchor ending in -h with rule retired-heading-anchor (anchors.ts:178)", () => {
      const res = parseAnchor("#s1-h");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "retired-heading-anchor");
        assert.ok(res.error.includes("Retired heading anchor"));
      }
    });

    it("accepts canonical section anchor without -h suffix (anchors.ts:178)", () => {
      const res = parseAnchor("#s1");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "section");
        assert.equal(res.value.targetId, "s1");
      }
    });
  });

  // 2. (anchors.ts:186) retired-footnote-sentence-anchor
  describe("Site (anchors.ts:186): retired-footnote-sentence-anchor", () => {
    it("rejects footnote sentence anchor with rule retired-footnote-sentence-anchor (anchors.ts:186)", () => {
      const res = parseAnchor("#s1-fn1-s1");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "retired-footnote-sentence-anchor");
        assert.ok(res.error.includes("Retired footnote sentence anchor"));
      }
    });

    it("accepts block-level footnote anchor without sentence index (anchors.ts:186)", () => {
      const res = parseAnchor("#s1-fn1");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "footnote");
        assert.equal(res.value.targetId, "s1-fn1");
      }
    });
  });

  // 3. (anchors.ts:222) result-anchor-grammar
  describe("Site (anchors.ts:222): result-anchor-grammar", () => {
    it("rejects result anchor with invalid slug syntax with rule result-anchor-grammar (anchors.ts:222)", () => {
      const res = parseAnchor("#result-INVALID_UPPERCASE");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "result-anchor-grammar");
        assert.ok(res.error.includes("Invalid result anchor"));
      }
    });

    it("accepts result anchor with valid lowercase kebab-case slug (anchors.ts:222)", () => {
      const res = parseAnchor("#result-energy-quanta");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "result");
        assert.equal(res.value.targetId, "result-energy-quanta");
      }
    });
  });

  // 4. (anchors.ts:243) argument-anchor-grammar
  describe("Site (anchors.ts:243): argument-anchor-grammar", () => {
    it("rejects argument anchor not matching paperCode and slug grammar with rule argument-anchor-grammar (anchors.ts:243)", () => {
      const res = parseAnchor("#arg-unknown-paper-slug");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "argument-anchor-grammar");
        assert.ok(res.error.includes("Invalid argument anchor"));
      }
    });

    it("accepts valid argument anchor with standard paper code and step (anchors.ts:243)", () => {
      const res = parseAnchor("#arg-sr-03");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "argument");
        assert.equal(res.value.targetId, "arg-sr-03");
      }
    });
  });

  // 5. (anchors.ts:260) lab-anchor-grammar
  describe("Site (anchors.ts:260): lab-anchor-grammar", () => {
    it("rejects lab anchor with undeclared instrument ID with rule lab-anchor-grammar (anchors.ts:260)", () => {
      const res = parseAnchor("#lab-invalid-nonexistent-instrument");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "lab-anchor-grammar");
        assert.ok(res.error.includes("Invalid lab anchor"));
      }
    });

    it("accepts lab anchor with valid registered instrument ID (anchors.ts:260)", () => {
      const res = parseAnchor("#lab-bm-01");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "lab");
        assert.equal(res.value.targetId, "bm-01");
      }
    });
  });

  // 6. (anchors.ts:277) card-anchor-grammar
  describe("Site (anchors.ts:277): card-anchor-grammar", () => {
    it("rejects card anchor with invalid premise syntax with rule card-anchor-grammar (anchors.ts:277)", () => {
      const res = parseAnchor("#card-INVALID PREMISE!");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "card-anchor-grammar");
        assert.ok(res.error.includes("Invalid card anchor"));
      }
    });

    it("accepts card anchor with valid premise ID (anchors.ts:277)", () => {
      const res = parseAnchor("#card-rayleigh-1900-radiation-law");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "card");
        assert.equal(res.value.targetId, "rayleigh-1900-radiation-law");
      }
    });
  });

  // 7. (anchors.ts:294) object-anchor-grammar
  describe("Site (anchors.ts:294): object-anchor-grammar", () => {
    it("rejects object anchor with invalid slug syntax with rule object-anchor-grammar (anchors.ts:294)", () => {
      const res = parseAnchor("#object-INVALID_OBJECT_NAME");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.rule, "object-anchor-grammar");
        assert.ok(res.error.includes("Invalid object anchor"));
      }
    });

    it("accepts object anchor with valid lowercase slug (anchors.ts:294)", () => {
      const res = parseAnchor("#object-desk-mirror");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.kind, "object");
        assert.equal(res.value.targetId, "object-desk-mirror");
      }
    });
  });
});
