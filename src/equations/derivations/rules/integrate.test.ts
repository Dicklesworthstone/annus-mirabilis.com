import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { integrateRule } from "./integrate.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

test("integrate without a constant or a boundary condition fails", () => {
  const result = integrateRule.check({
    from: sym("f", "q"),
    to: sym("F", "q"),
    params: { variable: "nu" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /integration constant or cite the boundary condition/);
});

test("integrate with a named integration constant present in the result is unverifiable (spot check + review required)", () => {
  const to: Expression = { kind: "sum", args: [sym("F", "q"), sym("Cnu", "q")] };
  const result = integrateRule.check({
    from: sym("f", "q"),
    to,
    params: { variable: "nu", integrationConstant: "Cnu" },
  });
  assert.equal(result.outcome, "unverifiable");
});

test("integrate with a named constant that does not appear in the result fails", () => {
  const result = integrateRule.check({
    from: sym("f", "q"),
    to: sym("F", "q"),
    params: { variable: "nu", integrationConstant: "Cnu" },
  });
  assert.equal(result.outcome, "fail");
});

test("integrate with a boundary condition instead of a constant is unverifiable", () => {
  const result = integrateRule.check({
    from: sym("f", "q"),
    to: sym("F", "q"),
    params: { variable: "nu", boundaryCondition: "S -> 0 as rho -> 0" },
  });
  assert.equal(result.outcome, "unverifiable");
});
