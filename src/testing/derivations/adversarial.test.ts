import assert from "node:assert/strict";
import test from "node:test";
import {
  adversarialCyclicRoute,
  adversarialHistoricalCitingModernOracle,
  adversarialIntegrationNoConstantOrBc,
  adversarialLorentzDiscoveryMinkowskiAxiom,
  adversarialLorentzTransverseNoPremises,
  adversarialMassEnergyCircularRestEnergy,
  adversarialMassEnergyGammaMc2,
  adversarialProofRelyingOnConclusion,
  adversarialSquareRootNoBranch,
} from "../../equations/derivations/fixtures.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";

test("adversarial.test: integration without constant or boundary condition fails", () => {
  const report = verifyChain(adversarialIntegrationNoConstantOrBc);
  assert.equal(report.passed, false);
  const step = report.stepReports.find((s) => s.stepId === "adv-step-int-1");
  assert.ok(step);
  assert.equal(step.passed, false);
  assert.match(step.error ?? "", /constant or cite the boundary condition/);
});

test("adversarial.test: historical route citing modern verification oracle fails", () => {
  const report = verifyChain(adversarialHistoricalCitingModernOracle);
  assert.equal(report.passed, false);
  assert.ok(report.graphIssues.length > 0);
  assert.match(report.graphIssues[0] ?? "", /cites modern-verification-oracle/);
});

test("adversarial.test: cyclic premise graph fails with cycle detection error", () => {
  const report = verifyChain(adversarialCyclicRoute);
  assert.equal(report.passed, false);
  assert.ok(report.graphIssues.length > 0);
  assert.match(report.graphIssues[0] ?? "", /directed cycle on premise edges/);
});

test("adversarial.test: square root without branch condition fails", () => {
  const report = verifyChain(adversarialSquareRootNoBranch);
  assert.equal(report.passed, false);
  const step = report.stepReports.find((s) => s.stepId === "adv-step-sqrt-1");
  assert.ok(step);
  assert.equal(step.passed, false);
  assert.match(step.error ?? "", /branch/);
});

test("adversarial.test: Lorentz transverse step without required premises fails", () => {
  const report = verifyChain(adversarialLorentzTransverseNoPremises);
  assert.equal(report.passed, false);
  assert.ok(report.errors.length > 0);
  assert.match(report.errors[0] ?? "", /Lorentz transverse step .* lacks required premises/);
});

test("adversarial.test: mass-energy chain initializing rest energy as Mc² fails", () => {
  const report = verifyChain(adversarialMassEnergyCircularRestEnergy);
  assert.equal(report.passed, false);
  assert.ok(report.errors.length > 0);
  assert.match(report.errors[0] ?? "", /initializes body energy with Mc² or γMc²/);
});

test("adversarial.test: mass-energy chain initializing body energy as γMc² fails", () => {
  const report = verifyChain(adversarialMassEnergyGammaMc2);
  assert.equal(report.passed, false);
  assert.ok(report.errors.length > 0);
  assert.match(report.errors[0] ?? "", /initializes body energy with Mc² or γMc²/);
});

test("adversarial.test: Lorentz discovery route requiring Minkowski interval as axiom fails", () => {
  const report = verifyChain(adversarialLorentzDiscoveryMinkowskiAxiom);
  assert.equal(report.passed, false);
  assert.ok(report.errors.length > 0);
  assert.match(report.errors[0] ?? "", /illegally requires Minkowski interval/);
});

test("adversarial.test: derivation chain relying on its own conclusion fails", () => {
  const report = verifyChain(adversarialProofRelyingOnConclusion);
  assert.equal(report.passed, false);
  assert.ok(report.errors.length > 0);
  assert.match(report.errors[0] ?? "", /relies on its own conclusion/);
  // Also caught by directed cycle detection in proof graph
  assert.ok(report.graphIssues.length > 0);
  assert.match(report.graphIssues[0] ?? "", /directed cycle on premise edges/);
});
