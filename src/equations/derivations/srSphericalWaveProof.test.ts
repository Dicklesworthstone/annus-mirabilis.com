import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { srCoordinateSourceStages } from "./srCoordinates.ts";
import {
  srSphericalWaveChain,
  srSphericalWaveConclusion,
  srSphericalWavePremises,
  verifySRSphericalWave,
} from "./srSphericalWaveProof.ts";
import type { DerivationChain } from "./types.ts";

function mapTree(tree: Expression, change: (node: Expression) => Expression): Expression {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const next = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, visit(child)]),
    );
    return typeof next.kind === "string" ? change(next as Expression) : next;
  };
  return visit(tree) as Expression;
}

function wrongPosition(tree: Expression, multiplier: string | "reverse-sign"): Expression {
  assert.equal(tree.kind, "sum");
  if (tree.kind !== "sum") throw new Error("Expected the four moving-wave terms.");
  const first = mapTree(tree.args[0]!, (node) => {
    if (
      node.kind !== "negate" ||
      node.argument.kind !== "product" ||
      !node.argument.args.some(
        (item) => item.kind === "symbol" && item.quantityId === "frameSpeed",
      ) ||
      !node.argument.args.some(
        (item) => item.kind === "symbol" && item.quantityId === "coordinateTimeStationary",
      )
    )
      return node;
    return multiplier === "reverse-sign"
      ? node.argument
      : {
          ...node,
          argument: {
            kind: "product",
            args: [{ kind: "number", value: multiplier }, node.argument],
          },
        };
  });
  return { ...tree, args: [first, ...tree.args.slice(1)] };
}

function changeMap(multiplier: string): DerivationChain {
  const steps = srSphericalWaveChain.steps.map((step, index) =>
    index === 0
      ? {
          ...step,
          from: wrongPosition(step.from, multiplier),
          to: wrongPosition(step.to, multiplier),
        }
      : index === 1
        ? { ...step, from: wrongPosition(step.from, multiplier) }
        : step,
  );
  return { ...srSphericalWaveChain, steps };
}

test("the four actual spherical-wave steps have exact conditional checks without sampled evidence", () => {
  const report = verifySRSphericalWave();
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.equal(report.isPublicationReady, true);
  assert.equal(report.stepReports.length, 4);
  assert.deepEqual(report.errors, []);
  for (const step of report.stepReports) {
    assert.equal(step.verificationStatus, "verified");
    assert.equal(step.ruleOutcome, "pass");
    assert.equal(step.spotCheckResult, undefined);
  }
  assert.ok(
    srSphericalWavePremises.some((premise) =>
      premise.explanation.includes("does not select phi = 1"),
    ),
  );
  assert.ok(
    srSphericalWaveChain.steps.every((step) => step.verification.status === "authored-unverified"),
  );
});

test("a reversed mixing sign and wrong coefficients fail the exact cancellation itself", () => {
  for (const coefficient of ["reverse-sign", "2", "1.0000000000001"]) {
    const report = verifySRSphericalWave(changeMap(coefficient));
    assert.equal(report.passed, false, coefficient);
    assert.equal(report.isPublicationReady, false, coefficient);
    assert.equal(report.stepReports[1]?.ruleOutcome, "fail", coefficient);
    assert.equal(report.stepReports[1]?.verificationStatus, "failed", coefficient);
  }
});

test("a wrong sideways scale cannot hide behind the two longitudinal light directions", () => {
  const doubleY = (tree: Expression): Expression => {
    assert.equal(tree.kind, "sum");
    if (tree.kind !== "sum") throw new Error("Expected the wave residual.");
    const second = tree.args[1]!;
    assert.equal(second.kind, "power");
    if (second.kind !== "power") throw new Error("Expected the squared sideways coordinate.");
    return {
      ...tree,
      args: tree.args.map((term, index) =>
        index === 1
          ? {
              ...second,
              base: { kind: "product", args: [{ kind: "number", value: "2" }, second.base] },
            }
          : term,
      ),
    };
  };
  const steps = srSphericalWaveChain.steps.map((step, index) =>
    index === 0
      ? { ...step, from: doubleY(step.from), to: doubleY(step.to) }
      : index === 1
        ? { ...step, from: doubleY(step.from) }
        : step,
  );
  assert.equal(
    verifySRSphericalWave({ ...srSphericalWaveChain, steps }).stepReports[1]?.ruleOutcome,
    "fail",
  );
});

test("the root reduction requires the declared domain and refuses a changed radicand", () => {
  const domain = "sr-positive-light-speed-subluminal-frame";
  const missingEntry = {
    ...srSphericalWaveChain,
    entryAssumptions: srSphericalWaveChain.entryAssumptions.filter(
      (premise) => premise.ref !== domain,
    ),
  };
  assert.equal(verifySRSphericalWave(missingEntry).passed, false);
  assert.equal(verifySRSphericalWave(missingEntry).stepReports[1]?.ruleOutcome, "fail");
  const missingStep = {
    ...srSphericalWaveChain,
    steps: srSphericalWaveChain.steps.map((step, index) =>
      index === 1
        ? { ...step, premiseRefs: step.premiseRefs.filter((premise) => premise.ref !== domain) }
        : step,
    ),
  };
  assert.equal(verifySRSphericalWave(missingStep).stepReports[1]?.ruleOutcome, "fail");
  const changedRoot = mapTree(srSphericalWaveChain.steps[1]!.from, (node) =>
    node.kind === "root"
      ? {
          ...node,
          radicand: { kind: "sum", args: [node.radicand, { kind: "number", value: "1" }] },
        }
      : node,
  );
  const changed = {
    ...srSphericalWaveChain,
    steps: srSphericalWaveChain.steps.map((step, index) =>
      index === 1 ? { ...step, from: changedRoot } : step,
    ),
  };
  const result = verifySRSphericalWave(changed);
  assert.equal(result.passed, false);
  assert.match(result.stepReports[1]?.ruleReason ?? "", /declared Lorentz radicand/);
});

test("map, finite scale and physical wave premises cannot be removed or relabeled", () => {
  for (const premise of srSphericalWaveChain.entryAssumptions) {
    const changed = {
      ...srSphericalWaveChain,
      entryAssumptions: srSphericalWaveChain.entryAssumptions.filter(
        (candidate) => candidate.ref !== premise.ref,
      ),
    };
    assert.equal(verifySRSphericalWave(changed).passed, false, premise.ref);
  }
  const physical = srSphericalWaveChain.steps[2]!;
  const missingWave = {
    ...srSphericalWaveChain,
    steps: srSphericalWaveChain.steps.map((step) =>
      step.id === physical.id
        ? {
            ...step,
            premiseRefs: step.premiseRefs.filter((premise) => premise.ref !== "eq-s3-d17"),
          }
        : step,
    ),
  };
  assert.equal(verifySRSphericalWave(missingWave).passed, false);
  const relabeled = {
    ...srSphericalWaveChain,
    entryAssumptions: srSphericalWaveChain.entryAssumptions.map((premise) => ({
      ...premise,
      edgeType: "cross-reference" as const,
    })),
  };
  assert.equal(verifySRSphericalWave(relabeled).passed, false);
});

test("truncated, disconnected or reordered work cannot claim the final sphere", () => {
  assert.equal(
    verifySRSphericalWave({
      ...srSphericalWaveChain,
      steps: srSphericalWaveChain.steps.slice(0, 3),
    }).passed,
    false,
  );
  const reversed = [...srSphericalWaveChain.steps].reverse();
  assert.equal(verifySRSphericalWave({ ...srSphericalWaveChain, steps: reversed }).passed, false);
  const disconnected = {
    ...srSphericalWaveChain,
    steps: srSphericalWaveChain.steps.map((step, index) =>
      index === 2 ? { ...step, from: { kind: "number" as const, value: "0" } } : step,
    ),
  };
  assert.equal(verifySRSphericalWave(disconnected).passed, false);
});

test("the canonical conclusion is checked as mathematics and the full Lorentz derivation remains outside scope", () => {
  const wrongConclusion: Expression = {
    ...srSphericalWaveConclusion,
    right: {
      kind: "product",
      args: [{ kind: "number", value: "2" }, srSphericalWaveConclusion.right],
    },
  };
  const wrong = verifySRSphericalWave(srSphericalWaveChain, wrongConclusion);
  assert.equal(wrong.passed, false);
  assert.ok(
    wrong.errors.some((error) => error.includes("moving-frame spherical light-wave equation")),
  );
  const synchronization = srCoordinateSourceStages[0]!.chain;
  assert.equal(verifySRSphericalWave(synchronization).passed, false);
});
