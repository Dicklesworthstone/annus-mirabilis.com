import assert from "node:assert/strict";
import test from "node:test";
import { type Expression, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";

test("the derivation notation projection preserves quantities, arguments, scales, and operators", () => {
  const tree: Expression = {
    kind: "relation",
    operator: "=",
    opId: "eq-model.op.relation",
    left: {
      kind: "symbol",
      termId: "eq-model.t.entropy",
      quantityId: "radiationEntropy",
      scale: { num: 1, den: 2 },
      index: "0",
      at: { kind: "symbol", termId: "eq-model.t.volume", quantityId: "volume" },
    },
    right: {
      kind: "derivative",
      expression: { kind: "symbol", termId: "eq-model.t.energy", quantityId: "radiationEnergy" },
      variable: { kind: "symbol", termId: "eq-model.t.temperature", quantityId: "temperature" },
      order: 1,
      partial: true,
      heldFixed: [{ kind: "symbol", termId: "eq-model.t.band", quantityId: "bandwidth" }],
    },
  };
  const original = structuredClone(tree);
  const projected = projectDerivationSymbols(tree, (symbol) => `glyph(${symbol.quantityId})`);
  assert.deepEqual(tree, original);
  assert.notEqual(projected, tree);
  const before = walk(tree);
  const after = walk(projected);
  assert.equal(after.length, before.length);
  for (const [index, node] of before.entries()) {
    const next = after[index];
    assert.equal(next?.kind, node.kind);
    if (node.kind === "symbol" && next?.kind === "symbol") {
      assert.equal(next.quantityId, node.quantityId);
      assert.equal(next.termId, `glyph(${node.quantityId})`);
      assert.deepEqual(next.scale, node.scale);
      assert.equal(next.index, node.index);
    }
  }
  assert.equal(projected.kind, "relation");
  assert.equal("opId" in projected ? projected.opId : undefined, "eq-model.op.relation");
});
