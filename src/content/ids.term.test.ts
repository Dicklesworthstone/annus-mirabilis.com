/**
 * Acceptance test suite for equation term, operation, alternate-form, and qualified IDs.
 * Specified in am-eq-expression-tree-8kl (AC1) and docs/CONTENT_IDS.md §4.1.
 */
import { describe, expect, test } from "bun:test";
import {
  parseAlternateFormId,
  parseOperationId,
  parseQualifiedId,
  parseSelectableEquationId,
  parseTermId,
} from "./ids.ts";

describe("Equation Term, Operation, Alternate-Form, and Qualified ID Grammar", () => {
  describe("Acceptance test vectors (AC1)", () => {
    test("accepts term ID on displayed equation: eq-s3-d4.t.viscosity", () => {
      const res = parseTermId("eq-s3-d4.t.viscosity");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe("eq-s3-d4.t.viscosity");
      }
    });

    test("accepts operation ID on displayed equation: eq-12.op.denominator", () => {
      const res = parseOperationId("eq-12.op.denominator");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe("eq-12.op.denominator");
      }
    });

    test("accepts term ID on substantive inline math: s3-p2-s1-m1.t.x", () => {
      const res = parseTermId("s3-p2-s1-m1.t.x");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe("s3-p2-s1-m1.t.x");
      }
    });

    test("accepts alternate-form ID: eq-s6-d3.alt.si", () => {
      const res = parseAlternateFormId("eq-s6-d3.alt.si");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe("eq-s6-d3.alt.si");
      }
    });

    test("accepts qualified ID: brownian-motion/eq-s3-d4.t.viscosity", () => {
      const res = parseQualifiedId("brownian-motion/eq-s3-d4.t.viscosity");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe("brownian-motion/eq-s3-d4.t.viscosity");
      }
    });
  });

  describe("Rejection test vectors (AC1)", () => {
    test("rejects uppercase initial letter in name: eq-s3-d4.t.Viscosity (ids.ts:796)", () => {
      const res = parseTermId("eq-s3-d4.t.Viscosity");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("term-id-grammar");
        expect(res.error).toContain("must be lower camelCase");
      }
    });

    test("rejects comma in name: eq-s3-d4.t.visc,osity", () => {
      const res = parseTermId("eq-s3-d4.t.visc,osity");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("term-id-grammar");
        expect(res.error).toContain("no commas");
      }
    });

    test("rejects invalid segment tag 'x': eq-s3-d4.x.viscosity", () => {
      const termRes = parseTermId("eq-s3-d4.x.viscosity");
      expect(termRes.ok).toBe(false);

      const selRes = parseSelectableEquationId("eq-s3-d4.x.viscosity");
      expect(selRes.ok).toBe(false);
      if (!selRes.ok) {
        expect(selRes.rule).toBe("selectable-equation-id-grammar");
        expect(selRes.error).toContain("must contain '.t.', '.op.', or '.alt.'");
      }
    });

    test("rejects empty name: eq-s3-d4.t. (ids.ts:780)", () => {
      const res = parseTermId("eq-s3-d4.t.");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("term-id-grammar");
      }
    });

    test("rejects short/unknown paper slug in qualified ID: bm/eq-s3-d4.t.viscosity", () => {
      const res = parseQualifiedId("bm/eq-s3-d4.t.viscosity");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("qualified-id-grammar");
        expect(res.error).toContain("unknown route slug 'bm'");
      }
    });

    test("rejects 49-character name exceeding 48-char maximum limit", () => {
      const name48 = "a" + "b".repeat(47); // exactly 48 chars
      const name49 = "a" + "b".repeat(48); // 49 chars

      const res48 = parseTermId(`eq-s3-d4.t.${name48}`);
      expect(res48.ok).toBe(true);

      const res49 = parseTermId(`eq-s3-d4.t.${name49}`);
      expect(res49.ok).toBe(false);
      if (!res49.ok) {
        expect(res49.rule).toBe("term-id-grammar");
        expect(res49.error).toContain("1–48 chars");
      }
    });
  });
});
