import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixtureLorentzMapConstruction,
  fixturePaper1WienEntropy,
  fixturePaper4TwoLedgers,
} from "../../equations/derivations/fixtures.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";

test("verifyChain: five signature fixture chains pass verification", () => {
  const chains = [
    fixtureBrownianPedagogicalReconstruction,
    fixtureBrownianSourceOrder,
    fixturePaper1WienEntropy,
    fixturePaper4TwoLedgers,
    fixtureLorentzMapConstruction,
  ];

  for (const chain of chains) {
    const report = verifyChain(chain);
    assert.equal(
      report.passed,
      true,
      `Chain ${chain.id} should pass verification. Errors: ${report.errors.join(", ")}`,
    );
    assert.equal(report.errors.length, 0);
    assert.equal(report.graphIssues.length, 0);
  }
});

test("verifyChain: seeded perturbation of any step fails with stepId", () => {
  const chain = fixtureBrownianPedagogicalReconstruction;
  const perturbedChain: DerivationChain = {
    ...chain,
    steps: chain.steps.map((step, idx) => {
      if (idx === 2) {
        // Perturb step 3 rule params
        return {
          ...step,
          rule: {
            kind: "registered-identity",
            params: {
              identityId: "independent-zero-mean-product-vanishes",
              citedPremises: [], // Missing required premises!
            },
          },
        };
      }
      return step;
    }),
  };

  const report = verifyChain(perturbedChain);
  assert.equal(report.passed, false, "Perturbed chain should fail");
  const failedStep = report.stepReports.find((s) => s.stepId === "bm-ped-step-3");
  assert.ok(failedStep);
  assert.equal(failedStep.passed, false);
});

test("verifyChain: authored-unverified without reviewRecordId fails publication gate", () => {
  const chain = fixtureBrownianSourceOrder;
  // Step 1 has reviewRecordId: "rr-bm-04-taylor-time". Remove it to test publication gate.
  const unreviewedChain: DerivationChain = {
    ...chain,
    steps: chain.steps.map((step) => {
      if (step.id === "bm-src-step-1") {
        return {
          ...step,
          verification: { status: "authored-unverified" as const }, // No reviewRecordId!
        };
      }
      return step;
    }),
  };

  // Passes regular preview verify
  const previewReport = verifyChain(unreviewedChain, { isPublicationGate: false });
  assert.equal(previewReport.passed, true);
  assert.equal(previewReport.isPublicationReady, false);

  // Fails publication gate
  const pubReport = verifyChain(unreviewedChain, { isPublicationGate: true });
  assert.equal(pubReport.passed, false);
  const step1 = pubReport.stepReports.find((s) => s.stepId === "bm-src-step-1");
  assert.ok(step1);
  assert.equal(step1.passed, false);
  assert.match(step1.error ?? "", /reviewRecordId required for publication gate/);
});

test("verifyChain: chain with steps lacking tool passes verification", () => {
  const chainWithoutTools: DerivationChain = {
    ...fixturePaper1WienEntropy,
    steps: fixturePaper1WienEntropy.steps.map((s) => ({
      ...s,
      tool: undefined, // Strip tool IDs
    })),
  };

  const report = verifyChain(chainWithoutTools);
  assert.equal(report.passed, true, "Chain lacking tools must still pass verification");
});

test("verifyChain: essentialForPrint does not affect verification outcome", () => {
  const base = fixtureBrownianPedagogicalReconstruction;
  const reportBase = verifyChain(base);

  const trueChain: DerivationChain = { ...base, essentialForPrint: true };
  const reportTrue = verifyChain(trueChain);

  const falseChain: DerivationChain = { ...base, essentialForPrint: false };
  const reportFalse = verifyChain(falseChain);

  assert.equal(reportBase.passed, reportTrue.passed);
  assert.equal(reportBase.passed, reportFalse.passed);
  assert.equal(reportTrue.essentialForPrint, true);
  assert.equal(reportFalse.essentialForPrint, false);
});
