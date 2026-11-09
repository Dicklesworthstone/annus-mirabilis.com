import { expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import {
  createSRLightComplexSubstitution,
  projectSRLightComplexRelation,
} from "./srLightComplex.ts";
import { DerivationSchemaError } from "./types.ts";

test("a canonical equation cannot silently introduce an unmapped quantity into the derivation", () => {
  const tree: Expression = {
    kind: "relation",
    operator: "=",
    left: { kind: "symbol", termId: "unknown.t", quantityId: "unrecognized-density" },
    right: { kind: "number", value: "1" },
  };
  expect(() => projectSRLightComplexRelation({ id: "eq-broken", tree })).toThrow(
    DerivationSchemaError,
  );
  expect(() => projectSRLightComplexRelation({ id: "eq-broken", tree })).toThrow(
    "eq-broken.tree: No derivation glyph for unrecognized-density",
  );
});

test("a non-equation is refused before either side is used as a factor", () => {
  expect(() =>
    projectSRLightComplexRelation({ id: "eq-broken", tree: { kind: "number", value: "1" } }),
  ).toThrow(DerivationSchemaError);
});

test("a substitution cannot invent an address for an unaddressable expression", () => {
  const literal: Expression = { kind: "number", value: "1" };
  expect(() =>
    createSRLightComplexSubstitution(literal, literal, literal, literal, "identity"),
  ).toThrow(DerivationSchemaError);
  expect(() =>
    createSRLightComplexSubstitution(literal, literal, literal, literal, "identity"),
  ).toThrow("sr-light-complex.substitution.target");
});
