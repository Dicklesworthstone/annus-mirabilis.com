import assert from "node:assert/strict";
import test from "node:test";
import {
  adversarialCyclicRoute,
  adversarialEntryAssumptionSelfCitation,
  adversarialHistoricalCitingModernOracle,
  adversarialIntegrationNoConstantOrBc,
  adversarialLorentzDiscoveryMinkowskiAxiom,
  adversarialLorentzTransverseNoPremises,
  adversarialMassEnergyCircularRestEnergy,
  adversarialMassEnergyGammaMc2,
  adversarialProofRelyingOnConclusion,
  adversarialSquareRootNoBranch,
  adversarialStepSelfCitation,
  fixtureEntryAssumptionCrossReferenceTarget,
  fixtureStepCrossReferenceTarget,
} from "../../equations/derivations/fixtures.ts";
import { citesForbiddenBodyEnergy, verifyChain } from "../../equations/derivations/verifyChain.ts";

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

test("adversarial.test: step citing chain.target as premise is rejected, naming the step", () => {
  const report = verifyChain(adversarialStepSelfCitation);
  assert.equal(report.passed, false);
  const expectedMsg = `derivation step "adv-step-cite-target-1" relies on its own conclusion "eq-adv-conclusion-target" as a premise.`;
  assert.ok(report.errors.includes(expectedMsg), `Expected error: ${expectedMsg}`);
});

test("adversarial.test: step citing chain.target with edgeType 'cross-reference' is accepted", () => {
  const report = verifyChain(fixtureStepCrossReferenceTarget);
  assert.equal(report.passed, true);
  assert.equal(report.errors.length, 0);
});

test("adversarial.test: entry assumption citing chain.target as premise is rejected, naming the chain", () => {
  const report = verifyChain(adversarialEntryAssumptionSelfCitation);
  assert.equal(report.passed, false);
  const expectedMsg = `derivation chain "chain-adv-entry-assumption-self-citation" entry assumption relies on its own conclusion "eq-adv-entry-target".`;
  assert.ok(report.errors.includes(expectedMsg), `Expected error: ${expectedMsg}`);
});

test("adversarial.test: entry assumption citing chain.target with edgeType 'cross-reference' is accepted", () => {
  const report = verifyChain(fixtureEntryAssumptionCrossReferenceTarget);
  assert.equal(report.passed, true);
  assert.equal(report.errors.length, 0);
});

// am-qiv8. The guard used to match five spellings of mc², so `E_0 = M c^2` in ordinary notation
// passed the check that exists to stop the derivation assuming what it proves. These two lock in
// both halves: the ordinary spelling is refused, and a genuinely symbolic rest energy is not.
test("adversarial.test: E_0 = M c^2 in ordinary notation is refused, not only the mc² spelling", () => {
  for (const spelling of [
    "Assume E_0 = M c^2 at start",
    "E0 = m*c^2",
    "E_0 = c^2 M",
    "E_0 = \\gamma M c^2",
    "E_0 = M \\cdot c^{2}",
  ]) {
    assert.equal(
      citesForbiddenBodyEnergy(spelling),
      true,
      `"${spelling}" initializes body energy with a mass times c squared and must be refused`,
    );
  }
});

test("adversarial.test: a symbolic rest energy and the mass definition still pass", () => {
  for (const legitimate of [
    "E_0 - E_1 = L(1/sqrt(1-v^2/c^2) - 1)",
    "M = E_0/c^2",
    "E_1 = E_0 - L",
    "K_0 - K_1 = L",
  ]) {
    assert.equal(
      citesForbiddenBodyEnergy(legitimate),
      false,
      `"${legitimate}" does not assume mass-energy equivalence and must not be refused`,
    );
  }
});
