import assert from "node:assert/strict";
import test from "node:test";
import { exportProofGraphs } from "../equations/derivations/exportProofGraph.ts";
import {
  adversarialCyclicRoute,
  adversarialHistoricalCitingModernOracle,
  adversarialIntegrationNoConstantOrBc,
  adversarialLorentzTransverseNoPremises,
  adversarialMassEnergyCircularRestEnergy,
  adversarialSquareRootNoBranch,
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixtureLorentzMapConstruction,
  fixturePaper1WienEntropy,
  fixturePaper4TwoLedgers,
} from "../equations/derivations/fixtures.ts";
import { premiseEdgesForGenealogy } from "../equations/derivations/hooks.ts";
import { DerivationLogger } from "../equations/derivations/logger.ts";
import { auditChainTools } from "../equations/derivations/toolAudit.ts";
import { verifyChain } from "../equations/derivations/verifyChain.ts";

const logger = new DerivationLogger();

test("am-eq-derivation-chains-r4c: complete derivation chain test suite with structured logging", () => {
  const fixtureChains = [
    fixtureBrownianPedagogicalReconstruction,
    fixtureBrownianSourceOrder,
    fixturePaper1WienEntropy,
    fixturePaper4TwoLedgers,
    fixtureLorentzMapConstruction,
  ];

  // 1. Verify all 5 signature fixture chains
  for (const chain of fixtureChains) {
    const t0 = performance.now();
    const report = verifyChain(chain);
    const durationMs = performance.now() - t0;

    for (const stepReport of report.stepReports) {
      const step = chain.steps.find((s) => s.id === stepReport.stepId);
      if (!step) continue;

      logger.log({
        testId: `verify-step-${step.id}`,
        chainId: chain.id,
        proofRouteId: chain.proofRouteId,
        routeKind: chain.routeKind,
        essentialForPrint: chain.essentialForPrint,
        stepId: step.id,
        rule: step.rule.kind,
        verification: stepReport.verificationStatus,
        toolId: step.tool,
        toolStatus: step.tool ? "present" : "pending",
        spotCheckSamples: stepReport.spotCheckResult
          ? stepReport.spotCheckResult.attempts
          : undefined,
        spotCheckMaxRelError: stepReport.spotCheckResult?.diff,
        tolerance: { relative: 1e-10, absolute: 1e-12 },
        seed: stepReport.spotCheckResult?.seed,
        premiseRefs: step.premiseRefs.map((p) => p.ref),
        edgeTypes: step.premiseRefs.map((p) => p.edgeType),
        reviewRecordId: stepReport.reviewRecordId,
        expected: true,
        actual: stepReport.passed,
        comparisonKind: "tolerance",
        durationMs,
        outcome: stepReport.passed ? "pass" : "fail",
        message: stepReport.passed
          ? `Step ${step.id} verified successfully.`
          : `Step ${step.id} failed verification: ${stepReport.error}`,
      });
    }

    assert.equal(report.passed, true, `Chain ${chain.id} failed verification.`);
  }

  // 2. Adversarial chains validation
  const adversarialChains = [
    adversarialIntegrationNoConstantOrBc,
    adversarialHistoricalCitingModernOracle,
    adversarialCyclicRoute,
    adversarialSquareRootNoBranch,
    adversarialLorentzTransverseNoPremises,
    adversarialMassEnergyCircularRestEnergy,
  ];

  for (const adv of adversarialChains) {
    const t0 = performance.now();
    const report = verifyChain(adv);
    const durationMs = performance.now() - t0;

    const failed = !report.passed;
    logger.log({
      testId: `adversarial-${adv.id}`,
      chainId: adv.id,
      proofRouteId: adv.proofRouteId,
      routeKind: adv.routeKind,
      expected: false,
      actual: report.passed,
      comparisonKind: "bitwise",
      durationMs,
      outcome: failed ? "pass" : "fail",
      message: failed
        ? `Adversarial chain ${adv.id} correctly rejected: ${report.errors.concat(report.graphIssues).join("; ")}`
        : `Adversarial chain ${adv.id} was unexpectedly accepted.`,
    });

    assert.equal(report.passed, false, `Adversarial chain ${adv.id} should fail`);
  }

  // 3. Tool audit check
  const toolAudit = auditChainTools(fixtureChains);
  assert.ok(toolAudit.totalSteps > 0);
  logger.log({
    testId: "derivation-tool-audit",
    expected: 0,
    actual: toolAudit.errors.length,
    comparisonKind: "bitwise",
    outcome: toolAudit.errors.length === 0 ? "pass" : "fail",
    message: `Tool audit complete: ${toolAudit.validSteps} valid, ${toolAudit.pending.length} pending, ${toolAudit.errors.length} errors.`,
  });

  // 4. Proof graph acyclicity and multi-route check
  const proofGraphs = exportProofGraphs(fixtureChains);
  assert.ok(proofGraphs.length >= 4);
  for (const pg of proofGraphs) {
    for (const route of pg.routes) {
      assert.equal(route.isAcyclic, true);
    }
  }

  // 5. Genealogy hooks check
  const histEdges = premiseEdgesForGenealogy(fixtureChains, false);
  const modernEdges = premiseEdgesForGenealogy(fixtureChains, true);
  assert.ok(histEdges.length > 0);
  assert.ok(modernEdges.length >= histEdges.length);
});
