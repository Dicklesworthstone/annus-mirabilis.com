import assert from "node:assert/strict";
import test from "node:test";
import maximumRecord from "../../../content/equations/light-quanta/eq-model-lq-photoelectric-maximum.json";
import stoppingRecord from "../../../content/equations/light-quanta/eq-model-lq-stopping-energy.json";
import type { Expression } from "../ast.ts";
import {
  createPhotoelectricSetup,
  PhotoelectricDerivationError,
  photoelectricChain,
  photoelectricEquations,
} from "./lightQuantaPhotoelectric.ts";
import { verifyPhotoelectric } from "./lightQuantaPhotoelectricProof.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

test("the full one-quantum argument checks every transformation using exact arithmetic", () => {
  const report = verifyPhotoelectric();
  assert.equal(report.passed, true, report.errors.join("; "));
  assert.equal(report.isPublicationReady, true);
  assert.equal(report.stepReports.length, photoelectricChain.steps.length);
  assert.ok(report.stepReports.length > 0);
  for (const step of report.stepReports) {
    assert.equal(step.ruleOutcome, "pass");
    assert.equal(step.verificationStatus, "verified");
    assert.equal(step.spotCheckResult, undefined, "sampled equality cannot replace exact algebra");
  }
});

function changedStep(index: number, change: Record<string, unknown>): DerivationChain {
  return {
    ...photoelectricChain,
    steps: photoelectricChain.steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
  } as DerivationChain;
}
function refused(chain: DerivationChain): void {
  const report = verifyPhotoelectric(chain);
  assert.equal(report.passed, false);
  assert.equal(report.isPublicationReady, false);
  assert.ok(report.errors.length > 0);
}
function canonicalMismatch(error: unknown): boolean {
  return (
    error instanceof PhotoelectricDerivationError &&
    error.code === "lq-photoelectric-canonical-mismatch"
  );
}

test("the same-unit wrong sign for escape work cannot become a proved canonical result", () => {
  const changed = structuredClone(maximumRecord);
  const right = changed.tree.right as unknown as { args: Expression[] };
  right.args[1] = photoelectricEquations.work;
  assert.throws(() => createPhotoelectricSetup(changed), canonicalMismatch);
});

test("a signed electron charge cannot replace the positive elementary-charge magnitude", () => {
  const changed = structuredClone(stoppingRecord);
  const left = changed.tree.left.left as unknown as { args: Expression[] };
  left.args[0] = { kind: "negate", argument: photoelectricEquations.charge };
  assert.throws(() => createPhotoelectricSetup(maximumRecord, changed), canonicalMismatch);
});

test("the stopping record must use a voltage magnitude with the same state identity", () => {
  const changed = structuredClone(stoppingRecord);
  const left = changed.tree.left.left as unknown as { args: Expression[] };
  left.args[1] = { ...photoelectricEquations.voltage, index: "other" };
  assert.throws(() => createPhotoelectricSetup(maximumRecord, changed), canonicalMismatch);
});

test("canonical record identities cannot be swapped while preserving their equation text", () => {
  assert.throws(
    () => createPhotoelectricSetup({ ...maximumRecord, id: "some-other-result" }),
    canonicalMismatch,
  );
});

for (const premise of photoelectricChain.entryAssumptions) {
  test(`photoelectric equality retains the explicit premise ${premise.ref}`, () => {
    refused({
      ...photoelectricChain,
      entryAssumptions: photoelectricChain.entryAssumptions.filter((p) => p.ref !== premise.ref),
    });
  });
}

test("locally valid algebra with a substituted physical premise still fails the connected proof", () => {
  const step = photoelectricChain.steps[1];
  assert.ok(step);
  const chain = changedStep(1, {
    rule: {
      ...step.rule,
      params: {
        ...step.rule.params,
        citedEquality: "Pretend the quantum hypothesis also establishes the electrical-work law.",
      },
    },
  });
  assert.equal(
    verifyChain(chain, { isPublicationGate: true }).passed,
    true,
    "the generic substitution checker checks syntax, not the physical source of its equality",
  );
  refused(chain);
});

test("a disconnected but individually valid stopping calculation cannot inherit the energy proof", () => {
  const step = photoelectricChain.steps[1];
  assert.ok(step && step.from.kind === "relation" && step.to.kind === "relation");
  const two = { kind: "number", value: "2" } as const;
  refused(
    changedStep(1, {
      from: { ...step.from, right: two },
      to: { ...step.to, right: two },
    }),
  );
});

test("the algebra cannot assume its maximum-energy conclusion as the starting budget", () => {
  refused(changedStep(0, { from: photoelectricEquations.maximum }));
});

test("division must retain the positive-charge condition, not an arbitrary nonempty sentence", () => {
  const step = photoelectricChain.steps[2];
  assert.ok(step);
  refused(
    changedStep(2, {
      rule: { ...step.rule, params: { ...step.rule.params, nonzeroCondition: "Light is bright." } },
    }),
  );
});

test("removing the stopping conversion or reordering the account cannot certify the whole result", () => {
  refused({ ...photoelectricChain, steps: photoelectricChain.steps.slice(0, -1) });
  refused({ ...photoelectricChain, steps: [...photoelectricChain.steps].reverse() });
});

test("a step cannot silently discard the attainability and threshold premises", () => {
  refused(changedStep(0, { premiseRefs: [] }));
});
