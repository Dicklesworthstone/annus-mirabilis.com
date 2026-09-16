import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixturePaper1WienEntropy,
} from "../../equations/derivations/fixtures.ts";
import { parseDerivationStep } from "../../equations/derivations/schema.ts";
import { auditChainTools } from "../../equations/derivations/toolAudit.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";

test("toolAudit: steps lacking tools are reported as pending with metadata", () => {
  const chainWithMissingTools: DerivationChain = {
    ...fixturePaper1WienEntropy,
    steps: fixturePaper1WienEntropy.steps.map((s, idx) => ({
      ...s,
      tool: idx === 0 ? undefined : s.tool,
    })),
  };

  const report = auditChainTools([chainWithMissingTools]);
  assert.ok(report.pending.length > 0);
  const pendingStep1 = report.pending.find((p) => p.stepId === "lq-step-1");
  assert.ok(pendingStep1);
  assert.equal(pendingStep1.chainId, "chain-lq-wien-entropy");
  assert.equal(pendingStep1.reasonKind, "physical-premise");
  assert.equal(pendingStep1.ruleKind, "substitute");
  assert.ok(pendingStep1.r1Excerpt.length > 0);
});

test("toolAudit: full tool attachments clear pending list against registry", () => {
  const registry = new Set([
    "foundation:random-walks",
    "foundation:mean-variance-rms",
    "foundation:probability-independence",
    "foundation:diffusion-equation",
    "foundation:functions-graphs",
  ]);

  const report = auditChainTools([fixtureBrownianPedagogicalReconstruction], registry);
  assert.equal(report.pending.length, 0);
  assert.equal(report.errors.length, 0);
  assert.equal(report.validSteps, fixtureBrownianPedagogicalReconstruction.steps.length);
});

test("toolAudit: unknown tool id against registry is reported as error", () => {
  const registry = new Set(["foundation:other-lesson"]);
  const report = auditChainTools([fixtureBrownianPedagogicalReconstruction], registry);
  assert.ok(report.errors.length > 0);
  const err = report.errors[0];
  assert.ok(err);
  assert.match(err.reason, /does not resolve in foundation registry/);
});

test("toolAudit: malformed tool id fails schema validation", () => {
  const rawStep = {
    id: "step-malformed",
    from: { kind: "symbol", termId: "x", quantityId: "x" },
    to: { kind: "symbol", termId: "y", quantityId: "y" },
    changedSubexpressionIds: ["x"],
    rule: {
      kind: "substitute",
      params: {
        targetId: "x",
        replacement: { kind: "symbol", termId: "y", quantityId: "y" },
        citedEquality: "x=y",
      },
    },
    reasonKind: "algebra",
    reasons: { r0: "a", r1: "b", r2: "c" },
    tool: "taylor expansion", // Malformed: missing foundation: prefix
    premiseRefs: [],
    isMove: false,
    verification: { status: "verified" },
  };

  assert.throws(() => parseDerivationStep(rawStep, "step"), /malformed tool id "taylor expansion"/);
});
