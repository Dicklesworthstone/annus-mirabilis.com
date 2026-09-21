import assert from "node:assert/strict";
import { test } from "node:test";
import { BM04_OUTPUTS, BM04_PRESETS } from "../experiments/bm04/definition.ts";
import { bm04PecletResult } from "../experiments/bm04/diagnostics.ts";
import { decodeResult } from "../experiments/results/codec.ts";
import { evaluateBm04 } from "../workers/operations/bm04.ts";

for (const peclet of [-Infinity, 0, Infinity]) {
  test(`BM-04 zero-kick Peclet ${peclet} is explicitly inapplicable, not a fake number`, () => {
    const result = bm04PecletResult(0, peclet);
    assert.equal(result.status, "not-applicable");
    assert.ok(!("value" in result));
    assert.ok(BM04_OUTPUTS.pecletNumber.statuses.includes(result.status));
    decodeResult(result);
  });
}

test("BM-04 finite signed Peclet ratios remain numerical results", () => {
  for (const ratio of [-10, 0, 10]) {
    const result = bm04PecletResult(1, ratio);
    assert.equal(result.status, "value");
    assert.equal(result.value, ratio);
    decodeResult(result);
  }
});

test("BM-04 unrepresentable nonzero-diffusion ratios retain a numerical domain explanation", () => {
  for (const ratio of [-Infinity, Infinity]) {
    const result = bm04PecletResult(Number.MIN_VALUE, ratio);
    assert.equal(result.status, "outside-domain");
    assert.equal(result.domainKind, "numerical");
    assert.ok(!("value" in result));
    decodeResult(result);
  }
});

test("BM-04 invalid diagnostic inputs are not presented as valid limiting cases", () => {
  for (const [diffusivity, ratio] of [[NaN, 0], [-1, 0], [Infinity, 0], [0, NaN]]) {
    assert.throws(() => bm04PecletResult(diffusivity, ratio), RangeError);
  }
});

for (const [name, preset] of Object.entries(BM04_PRESETS)) {
  test(`BM-04 advertised preset ${name} publishes every declared output`, async () => {
    const evaluated = await evaluateBm04(preset.parameters, { yieldControl: async () => {} });
    assert.equal(evaluated.kind, "accepted", JSON.stringify(evaluated));
    const outputs = evaluated.data.outputs;
    assert.equal(outputs.length, Object.keys(BM04_OUTPUTS).length);
    assert.equal(new Set(outputs.map((output) => output.quantityId)).size, outputs.length);
    for (const output of outputs) {
      const contract = BM04_OUTPUTS[output.quantityId];
      assert.ok(contract, output.quantityId);
      assert.ok(contract.statuses.includes(output.status), output.quantityId);
      assert.equal(output.unit, contract.unit);
      assert.equal(output.ownerId, contract.ownerId);
      assert.equal(output.semanticKind, contract.semanticKind);
      decodeResult(output);
    }
    const peclet = outputs.find((output) => output.quantityId === "pecletNumber");
    assert.equal(peclet.status, preset.parameters.m === 0 ? "not-applicable" : "value");
    const density = outputs.find((output) => output.quantityId === "densityProfile");
    assert.equal(density.status, "value");
    const mass = density.value.reduce((sum, value) => sum + value, 0)
      * preset.parameters.W / preset.parameters.cells;
    assert.ok(Math.abs(mass - 1) < 1e-10, `mass ${mass}`);
  });
}
