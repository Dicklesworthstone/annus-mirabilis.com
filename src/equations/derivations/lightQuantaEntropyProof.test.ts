import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { lqWienEntropyDerivation as chain, lqWienProofInputs as p } from "./lightQuantaEntropy.ts";
import { verifyLqWienEntropy } from "./lightQuantaEntropyProof.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
const relation = (expression: Expression): Relation => {
  if (expression.kind !== "relation") throw new Error("Expected the proof's equation.");
  return expression;
};
const number = (value: string): Expression => ({ kind: "number", value });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const difference = (left: Expression, right: Expression): Expression =>
  ({ kind: "sum", args: [left, negative(right)] });
const rhs = (index: number): Expression => relation(chain.steps[index]!.to).right;
function changeStep(index: number, edit: (step: DerivationStep) => DerivationStep): DerivationChain {
  return { ...chain, steps: chain.steps.map((step, i) => i === index ? edit(step) : step) };
}
/** Relay a changed producer to its consumer so rejection cannot rely only on broken adjacency. */
function changedResult(index: number, right: Expression): DerivationChain {
  const to: Relation = { ...relation(chain.steps[index]!.to), right };
  return {
    ...chain,
    steps: chain.steps.map((step, i) => i === index ? { ...step, to }
      : i === index + 1 ? { ...step, from: to } : step),
  };
}
function failsAt(changed: DerivationChain, index: number): void {
  const report = verifyLqWienEntropy(changed);
  expect(report.passed).toBe(false);
  expect(report.isPublicationReady).toBe(false);
  expect(report.stepReports[index]?.verificationStatus).toBe("failed");
}

describe("the conditional Wien-to-entropy proof owner", () => {
  test("all eleven transformations are executable while the authored scientific record stays draft", () => {
    const report = verifyLqWienEntropy();
    expect(report.errors).toEqual([]);
    expect(report.graphIssues).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports).toHaveLength(11);
    expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
    expect(chain.steps.every((step) => step.verification.status === "authored-unverified"))
      .toBe(true);
    // The generic integrator has not acquired an assertion-based publication escape hatch.
    expect(verifyChain(chain, { isPublicationGate: true }).passed).toBe(false);
    expect(chain.entryAssumptions.some((premise) => premise.ref === "lq-nontrivial-volume-ratio"))
      .toBe(false);
  });

  test("skipping, disconnecting or reordering any producer cannot retain checked support", () => {
    for (let index = 0; index < chain.steps.length; index++) {
      const removed = { ...chain, steps: chain.steps.filter((_, i) => i !== index) };
      expect(verifyLqWienEntropy(removed).passed).toBe(false);
      if (index === 0) continue;
      const disconnected = changeStep(index, (step) => ({ ...step, from: chain.steps[0]!.from }));
      expect(verifyLqWienEntropy(disconnected).passed).toBe(false);
      const reordered = [...chain.steps];
      [reordered[index - 1], reordered[index]] = [reordered[index]!, reordered[index - 1]!];
      expect(verifyLqWienEntropy({ ...chain, steps: reordered }).passed).toBe(false);
    }
  });

  test("none of the empirical, thermodynamic, domain, boundary or fixed-band premises is optional", () => {
    for (const premise of chain.entryAssumptions) {
      expect(verifyLqWienEntropy({
        ...chain,
        entryAssumptions: chain.entryAssumptions.filter((entry) => entry.ref !== premise.ref),
      }).passed).toBe(false);
      expect(verifyLqWienEntropy({
        ...chain,
        entryAssumptions: chain.entryAssumptions.map((entry) => entry.ref === premise.ref
          ? { ...entry, edgeType: "cross-reference" as const } : entry),
      }).passed).toBe(false);
    }
  });

  test("normalization and inversion cannot introduce an incorrect multiplier or sign", () => {
    failsAt(changedResult(0, product(number("2"), rhs(0))), 0);
    failsAt(changedResult(3, negative(rhs(3))), 3);
    failsAt(changeStep(3, (step) => ({
      ...step, rule: { ...step.rule, params: { ...step.rule.params, quantity: p.betaNu } },
    })), 3);
    failsAt(changeStep(1, (step) => ({
      ...step,
      rule: { ...step.rule, params: { ...step.rule.params, positiveArguments: { left: "positive" } } },
    })), 1);
  });

  test("the entropy derivative must preserve its frequency constraint and independent premise", () => {
    const derivative = relation(chain.steps[4]!.to).left;
    if (derivative.kind !== "derivative") throw new Error("Expected the entropy derivative.");
    const to = { ...relation(chain.steps[4]!.to), left: { ...derivative, heldFixed: [p.V] } };
    const changed = {
      ...chain,
      steps: chain.steps.map((step, i) => i === 4 ? { ...step, to }
        : i === 5 ? { ...step, from: to } : step),
    };
    failsAt(changed, 4);
    failsAt(changeStep(4, (step) => ({
      ...step, premiseRefs: step.premiseRefs.filter((entry) => entry.ref !== "arg-lq-entropy-temperature"),
    })), 4);
  });

  test("the antiderivative must have the right slope and keep exactly its frequency-dependent constant", () => {
    failsAt(changedResult(5, negative(rhs(5))), 5);
    for (const replacement of [
      number("0"),
      { ...p.C, at: p.rho },
      { kind: "symbol", termId: p.C.termId, quantityId: p.C.quantityId },
      product(p.C, p.nu),
    ] as Expression[])
      failsAt(changedResult(5, substituteNode(rhs(5), p.C.termId, replacement)), 5);
    failsAt(changeStep(5, (step) => ({
      ...step, rule: { ...step.rule, params: { ...step.rule.params, variable: p.nu.termId } },
    })), 5);
  });

  test("the zero-density boundary cannot be omitted, replaced by a nonzero constant or asserted elsewhere", () => {
    failsAt(changeStep(6, (step) => ({ ...step, premiseRefs: [] })), 6);
    failsAt(changeStep(6, (step) => ({ ...step, reasonKind: "algebra" })), 6);
    failsAt(changeStep(6, (step) => ({
      ...step, rule: { ...step.rule, params: { ...step.rule.params, replacement: number("1") } },
    })), 6);
    failsAt(changedResult(6, rhs(5)), 6);
    failsAt(changedResult(7, { kind: "sum", args: [rhs(7), p.C] }), 7);
  });

  test("total entropy must substitute E/(VΔν), not hold density fixed when volume changes", () => {
    const fixedDensity = product(p.V, p.dNu, relation(chain.steps[8]!.from).right);
    failsAt(changedResult(8, fixedDensity), 8);
    failsAt(changedResult(8, substituteNode(rhs(8), p.E.termId, product(number("2"), p.E))), 8);
    failsAt(changeStep(8, (step) => ({
      ...step, premiseRefs: step.premiseRefs.filter((entry) => entry.ref !== "lq-fixed-energy-frequency-band"),
    })), 8);
  });

  test("the reference state must share the energy, frequency and bandwidth of the first state", () => {
    const total = rhs(8);
    const reference = substituteNode(total, p.V.termId, p.V0);
    for (const quantity of [p.E, p.nu, p.dNu]) {
      const wrongReference = substituteNode(reference, quantity.termId, product(number("2"), quantity));
      failsAt(changedResult(9, difference(total, wrongReference)), 9);
    }
    failsAt(changedResult(9, difference(reference, total)), 9);
    failsAt(changedResult(9, difference(total, total)), 9);
  });

  test("the conclusion cannot invert the log ratio, erase the energy coefficient or replace the target", () => {
    for (const changed of [
      changedResult(10, negative(rhs(10))),
      changedResult(10, substituteNode(rhs(10), p.E.termId, number("1"))),
      { ...chain, target: "eq-model-lq-energy-per-point" },
      { ...chain, targetStepId: chain.steps[9]!.id },
    ]) {
      const report = verifyLqWienEntropy(changed);
      expect(report.passed).toBe(false);
      expect(report.isPublicationReady).toBe(false);
    }
  });
});
