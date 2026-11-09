import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import type { Expression } from "../ast.ts";
import {
  createSRLightComplexSubstitution,
  projectSRLightComplexRelation,
  SRLightComplexError,
} from "./srLightComplex.ts";
import { DerivationSchemaError } from "./types.ts";

test("a canonical equation cannot silently introduce an unmapped quantity into the derivation", () => {
  const tree: Expression = {
    kind: "relation",
    operator: "=",
    left: { kind: "symbol", termId: "unknown.t", quantityId: "unrecognized-density" },
    right: { kind: "number", value: "1" },
  };
  assert.throws(
    () => projectSRLightComplexRelation({ id: "eq-broken", tree }),
    (error) => {
      expect(error).toBeInstanceOf(SRLightComplexError);
      expect(error).toBeInstanceOf(DerivationSchemaError);
      expect(error).toMatchObject({
        code: "sr-light-complex-missing-glyph",
        name: "DerivationSchemaError",
        path: "eq-broken.tree",
        message: "[derivation] eq-broken.tree: No derivation glyph for unrecognized-density.",
      });
      return true;
    },
  );
});

test("a non-equation is refused before either side is used as a factor", () => {
  assert.throws(
    () => projectSRLightComplexRelation({ id: "eq-broken", tree: { kind: "number", value: "1" } }),
    (error) => {
      expect(error).toBeInstanceOf(SRLightComplexError);
      expect(error).toBeInstanceOf(DerivationSchemaError);
      expect(error).toMatchObject({
        code: "sr-light-complex-relation-required",
        name: "DerivationSchemaError",
        path: "eq-broken.tree",
        message: "[derivation] eq-broken.tree: Expected a relation.",
      });
      return true;
    },
  );
});

test("a substitution cannot invent an address for an unaddressable expression", () => {
  const literal: Expression = { kind: "number", value: "1" };
  assert.throws(
    () => createSRLightComplexSubstitution(literal, literal, literal, literal, "identity"),
    (error) => {
      expect(error).toBeInstanceOf(SRLightComplexError);
      expect(error).toBeInstanceOf(DerivationSchemaError);
      expect(error).toMatchObject({
        code: "sr-light-complex-unaddressable-target",
        name: "DerivationSchemaError",
        path: "sr-light-complex.substitution.target",
        message:
          "[derivation] sr-light-complex.substitution.target: SR §8 substitution needs an addressable expression.",
      });
      return true;
    },
  );
});
