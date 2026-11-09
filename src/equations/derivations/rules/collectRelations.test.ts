import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { collectRule } from "./collect.ts";

const x: Expression = { kind: "symbol", termId: "x", quantityId: "volume" };
const y: Expression = { kind: "symbol", termId: "y", quantityId: "volume" };
const from: Expression = {
  kind: "relation",
  operator: "=",
  left: y,
  right: { kind: "sum", args: [x, x] },
};
const to: Expression = {
  ...from,
  right: { kind: "product", args: [{ kind: "number", value: "2" }, x] },
};

test("collecting inside a relation checks both sides separately", () => {
  assert.equal(collectRule.check({ from, to, params: {} }).outcome, "pass");
  for (const bad of [
    { ...to, left: { kind: "number", value: "999" } },
    { ...to, right: { kind: "product", args: [{ kind: "number", value: "3" }, x] } },
    { ...to, operator: "approx" },
    to.right,
    from,
  ] as Expression[]) {
    assert.equal(collectRule.check({ from, to: bad, params: {} }).outcome, "fail");
  }
});
