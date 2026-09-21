import assert from "node:assert/strict";
import { test } from "node:test";
import { BM04_OUTPUTS, BM04_PRESETS } from "../experiments/bm04/definition.ts";
import { bm04PecletResult } from "../experiments/bm04/diagnostics.ts";
import { ExperimentRuntimeError } from "../experiments/refusal.ts";
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
  for (const [diffusivity, ratio] of [
    [NaN, 0],
    [-1, 0],
    [Infinity, 0],
    [0, NaN],
  ]) {
    assert.throws(() => bm04PecletResult(diffusivity, ratio), ExperimentRuntimeError);
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
    const mass =
      (density.value.reduce((sum, value) => sum + value, 0) * preset.parameters.W) /
      preset.parameters.cells;
    assert.ok(Math.abs(mass - 1) < 1e-10, `mass ${mass}`);
  });
}

/**
 * The Peclet diagnostic's refusals by code and by line (am-p465).
 *
 * The owner ruled "Positional code argument", so these two sites lost their builtin
 * TypeError/RangeError and now throw ExperimentRuntimeError with a kebab code first.
 *
 * diagnostics.ts:9 IS NOT DRIVEN AND IS LEFT COUNTED. It refuses a missing BM-04 Peclet output
 * contract, and BM04_OUTPUTS.pecletNumber is a frozen module constant of definition.ts that is
 * always present; nothing a caller passes can remove it. It guards a future edit to the
 * definition, which is a reason to keep it and not a reason to claim it is tested.
 */
test("the Peclet diagnostic refuses invalid inputs by code (diagnostics.ts:21)", () => {
  for (const [kickDiffusivity, peclet] of [
    [-1, 2],
    [Number.NaN, 2],
    [1, Number.NaN],
  ]) {
    let thrown;
    try {
      bm04PecletResult(kickDiffusivity, peclet);
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown, `expected a refusal for (${kickDiffusivity}, ${peclet})`);
    assert.equal(thrown.code, "peclet-inputs-invalid");
    assert.match(thrown.message, /nonnegative finite diffusivity and a valid ratio/);
  }
});
