import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import inferenceRecord from "../../../content/equations/brownian-motion/eq-model-bm-avogadro-inference.json";
import molarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import momentRecord from "../../../content/equations/brownian-motion/eq-model-bm-mean-square-growth.json";
import { walk } from "../ast.ts";
import {
  BrownianInferenceError,
  brownianInferenceChain,
  brownianInferenceEquations,
  brownianInferenceMetadata,
  brownianInferenceReadingSet,
  createBrownianInferenceSetup,
  presentBrownianInferenceExpression,
} from "./brownianInference.ts";
import { verifyBrownianInference } from "./brownianInferenceProof.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";

test("the admitted moment fit reaches the canonical estimate through three executable exact steps", () => {
  const report = verifyBrownianInference();
  assert.equal(report.passed, true, JSON.stringify(report.errors));
  assert.equal(report.isPublicationReady, true);
  assert.equal(report.stepReports.length, 3);
  assert.ok(report.stepReports.every((step) => step.verificationStatus === "verified"));
  for (let index = 1; index < brownianInferenceChain.steps.length; index++)
    assert.ok(
      structurallyEqual(
        brownianInferenceChain.steps[index - 1]!.to,
        brownianInferenceChain.steps[index]!.from,
      ),
    );
  const model = walk(brownianInferenceEquations.modelDiffusivity);
  assert.ok(model.some((node) => node.kind === "symbol" && node.quantityId === "avogadroConstant"));
  for (const step of brownianInferenceChain.steps) {
    const quantities = [...walk(step.from), ...walk(step.to)]
      .filter((node) => node.kind === "symbol")
      .map((node) => node.quantityId);
    assert.ok(quantities.includes("avogadroNumberEstimate"));
    assert.ok(!quantities.includes("avogadroConstant"));
    assert.ok(!quantities.includes("boltzmannConstant"));
  }
  const result = brownianInferenceEquations.result;
  assert.ok(result.left.kind === "symbol" && result.left.quantityId === "avogadroNumberEstimate");
  const shown = presentBrownianInferenceExpression(result);
  assert.equal(shown.kind, "relation");
  assert.ok(shown.kind === "relation" && shown.left.kind === "symbol");
  assert.equal(shown.left.termId, "\\widehat{N}");
  assert.equal(shown.left.quantityId, "avogadroNumberEstimate");
});

test("bm-inference-canonical-mismatch refuses wrong coefficients and same-unit semantic substitutions", () => {
  const changedMolar = [
    JSON.parse(JSON.stringify(molarRecord).replace('"value":"6"', '"value":"12"')),
    JSON.parse(JSON.stringify(molarRecord).replaceAll('"particleRadius"', '"displacement1d"')),
  ];
  const changedMoment = [
    JSON.parse(JSON.stringify(momentRecord).replace('"value":"2"', '"value":"6"')),
    JSON.parse(JSON.stringify(momentRecord).replaceAll('"observationInterval"', '"fieldTimeCoordinate"')),
  ];
  const changedEstimate = JSON.parse(
    JSON.stringify(inferenceRecord).replaceAll('"avogadroNumberEstimate"', '"avogadroConstant"'),
  );
  for (const [molar, moment, estimate] of [
    ...changedMolar.map((record) => [record, momentRecord, inferenceRecord]),
    ...changedMoment.map((record) => [molarRecord, record, inferenceRecord]),
    [molarRecord, momentRecord, changedEstimate],
  ])
    assert.throws(
      () => createBrownianInferenceSetup(molar, moment, estimate),
      (error) =>
        error instanceof BrownianInferenceError &&
        error.code === "bm-inference-canonical-mismatch",
    );
});

test("missing, reordered and disconnected inference stages cannot retain checked support", () => {
  const chain = brownianInferenceChain;
  for (const removed of chain.steps)
    assert.equal(
      verifyBrownianInference({
        ...chain,
        steps: chain.steps.filter((step) => step.id !== removed.id),
      }).passed,
      false,
    );
  assert.equal(verifyBrownianInference({ ...chain, steps: [] }).passed, false);
  assert.equal(
    verifyBrownianInference({ ...chain, steps: [...chain.steps].reverse() }).passed,
    false,
  );
  const disconnected: DerivationChain = {
    ...chain,
    steps: chain.steps.map((step, index) =>
      index === 1 ? { ...step, from: brownianInferenceEquations.matching } : step,
    ),
  };
  assert.equal(verifyBrownianInference(disconnected).passed, false);
  assert.equal(verifyBrownianInference({ ...chain, target: molarRecord.id }).passed, false);
});

test("the owner retains fitting, independent radius, positive domain and exact checking", () => {
  const chain = brownianInferenceChain;
  for (const premise of chain.entryAssumptions)
    assert.equal(
      verifyBrownianInference({
        ...chain,
        entryAssumptions: chain.entryAssumptions.filter((item) => item.ref !== premise.ref),
      }).passed,
      false,
    );
  const missingLocalPremises = {
    ...chain,
    steps: chain.steps.map((step) => ({ ...step, premiseRefs: [] })),
  };
  assert.equal(verifyBrownianInference(missingLocalPremises).passed, false);
  for (const [index, params] of [
    [0, { exact: false }],
    [1, { simplify: false }],
    [2, { nonzeroCondition: "" }],
  ] as const)
    assert.equal(
      verifyBrownianInference({
        ...chain,
        steps: chain.steps.map((step, current) =>
          current === index
            ? { ...step, rule: { ...step.rule, params: { ...step.rule.params, ...params } } }
            : step,
        ),
      }).passed,
      false,
    );
  const wrongCoefficient = JSON.parse(
    JSON.stringify(chain).replaceAll('"value":"3"', '"value":"6"'),
  ) as DerivationChain;
  assert.equal(verifyBrownianInference(wrongCoefficient).passed, false);
  const wrongQuantity = JSON.parse(
    JSON.stringify(chain).replaceAll("avogadroNumberEstimate", "avogadroConstant"),
  ) as DerivationChain;
  assert.equal(verifyBrownianInference(wrongQuantity).passed, false);
});

test("the inference's R0–R3 ownership is synchronized with the actual chain", () => {
  const owner = yaml.load(
    readFileSync(
      "content/editorial/readings-owners/" + brownianInferenceMetadata.ownerBeadId + ".yaml",
      "utf8",
    ),
  ) as { targets: { id: string; readings: unknown }[] };
  for (const step of brownianInferenceChain.steps) {
    const entry = owner.targets.find((target) => target.id === brownianInferenceChain.id + "/" + step.id);
    assert.ok(entry, step.id);
    assert.deepEqual(entry.readings, brownianInferenceReadingSet(step));
  }
});
