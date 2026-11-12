import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { BM04_DEFAULTS, BM04_OUTPUTS } from "../../experiments/bm04/definition.ts";
import { BM05_DEFAULTS, BM05_OUTPUTS } from "../../experiments/bm05/definition.ts";
import { BM07_DEFAULTS, BM07_OUTPUTS } from "../../experiments/bm07/definition.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import type { SnapshotOutput } from "../../experiments/weave/types.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { evaluateBm04 } from "../../workers/operations/bm04.ts";
import { createBm05Recording, measureBm05 } from "../../workers/operations/bm05.ts";
import { createBm07Recording, measureBm07 } from "../../workers/operations/bm07.ts";
import { BM04_READER_WEAVE } from "./driftPassages.ts";
import { BM07_READER_WEAVE } from "./inferencePassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";
import { BM05_READER_WEAVE } from "./walkPassages.ts";

function flags(binding: ReaderWeaveBinding, results: readonly ScientificResult[]) {
  assert.equal(
    typeof binding.constantSetId,
    "string",
    "These Brownian bindings use fixed constants",
  );
  const outputs: Record<string, SnapshotOutput> = {};
  for (const result of results) {
    outputs[result.quantityId] = {
      quantityId: result.quantityId,
      status: result.status,
      ...(result.status === "value" && typeof result.value === "number"
        ? { value: result.value }
        : {}),
    };
  }
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: "brownian-source-comparison",
    snapshotVersion: 1,
    constantSetId: binding.constantSetId as string,
    outputs,
    refused: false,
  }).flags;
}

for (const [binding, outputs] of [
  [BM04_READER_WEAVE, BM04_OUTPUTS],
  [BM05_READER_WEAVE, BM05_OUTPUTS],
  [BM07_READER_WEAVE, BM07_OUTPUTS],
] as const) {
  test(`${binding.instrumentId}: source links, declared outputs and pointer voice resolve`, () => {
    const targets = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(`../../../content/source-blocks/brownian-motion/${block}.yaml`, import.meta.url),
          "utf8",
        ),
      ) as { sentenceSpans: readonly { id: string }[] };
      assert.ok(source.sentenceSpans.some(({ id }) => id === passage.sentenceId));
      targets.add(passage.sentenceId);
    }
    expect(binding.predicates.length).toBeGreaterThan(0);
    for (const predicate of binding.predicates) {
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(outputs)),
          resolvableTargetIds: targets,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
  });
}

test("BM-04: matched kicks need the owner's stationary state before claiming flux balance", async () => {
  for (const [profile, m, equilibrium] of [
    ["uniform", 1, false],
    ["equilibrium", 1, true],
    ["equilibrium", 2, false],
  ] as const) {
    const result = await evaluateBm04({ ...BM04_DEFAULTS, profile, m, dt: 0.001 });
    assert.equal(result.kind, "accepted");
    if (result.kind !== "accepted") return;
    const state = flags(BM04_READER_WEAVE, result.data.outputs);
    expect(state["bm04-s3-diffusion-coefficient"]?.lit).toBe(true);
    expect(state["bm04-s3-force-balance"]?.lit).toBe(equilibrium);
  }
});

test("BM-04: changing force leaves thermal D unchanged; absent steady-state output cannot light balance", async () => {
  const left = await evaluateBm04(BM04_DEFAULTS);
  const right = await evaluateBm04({ ...BM04_DEFAULTS, F: 2 * BM04_DEFAULTS.F });
  assert.equal(left.kind, "accepted");
  assert.equal(right.kind, "accepted");
  if (left.kind !== "accepted" || right.kind !== "accepted") return;
  expect(left.data.outputs.find(({ quantityId }) => quantityId === "diffusionCoefficient")).toEqual(
    right.data.outputs.find(({ quantityId }) => quantityId === "diffusionCoefficient"),
  );
  expect(flags(BM04_READER_WEAVE, right.data.outputs)["bm04-s3-diffusion-coefficient"]?.lit).toBe(
    true,
  );
  const missing = right.data.outputs.filter(({ quantityId }) => quantityId !== "steadyState");
  expect(flags(BM04_READER_WEAVE, missing)["bm04-s3-force-balance"]?.state).toBe("not-evaluable");
});

test("BM-05: live finite-step shape and sample bounds decide the pointer", async () => {
  for (const [n, walkers, expected] of [
    [4, 2000, true],
    [0, 2000, false],
    [4, 399, false],
  ] as const) {
    const parameters = { ...BM05_DEFAULTS, n, walkers, runSteps: 4 };
    const recording = await createBm05Recording(parameters, { yieldControl: async () => {} });
    assert.equal(recording.kind, "accepted");
    if (recording.kind !== "accepted") return;
    const result = await measureBm05(recording.data, parameters, false);
    assert.equal(result.kind, "accepted");
    if (result.kind !== "accepted") return;
    expect(flags(BM05_READER_WEAVE, result.data.outputs)["bm05-s4-second-moment"]?.lit).toBe(
      expected,
    );
    const missing = result.data.outputs.filter(({ quantityId }) => quantityId !== "shapeTerm");
    expect(flags(BM05_READER_WEAVE, missing)["bm05-s4-second-moment"]?.state).toBe("not-evaluable");
  }
});

test("BM-07: measured spreading alone cannot identify molecular number without radius", async () => {
  const recording = await createBm07Recording(BM07_DEFAULTS, { yieldControl: async () => {} });
  assert.equal(recording.kind, "accepted");
  if (recording.kind !== "accepted") return;
  for (const radiusKnown of [false, true]) {
    const result = await measureBm07(recording.data, { ...BM07_DEFAULTS, radiusKnown }, true);
    assert.equal(result.kind, "accepted");
    if (result.kind !== "accepted") return;
    expect(
      result.data.outputs.find(({ quantityId }) => quantityId === "radiusNumberProduct")?.status,
    ).toBe("value");
    expect(flags(BM07_READER_WEAVE, result.data.outputs)["bm07-s5-inversion"]?.lit).toBe(
      radiusKnown,
    );
  }
});
