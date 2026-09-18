import assert from "node:assert/strict";
import test from "node:test";
import { exportProofGraphs } from "../../equations/derivations/exportProofGraph.ts";
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
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixtureLorentzMapConstruction,
  fixturePaper1WienEntropy,
  fixturePaper4TwoLedgers,
} from "../../equations/derivations/fixtures.ts";
import { parseDerivationChain } from "../../equations/derivations/schema.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";

test("chains.compiler.integration: parses, exports, and verifies all fixtures", () => {
  const validChains = [
    fixtureBrownianPedagogicalReconstruction,
    fixtureBrownianSourceOrder,
    fixturePaper1WienEntropy,
    fixturePaper4TwoLedgers,
    fixtureLorentzMapConstruction,
  ];

  for (const chain of validChains) {
    // Roundtrip parse
    const parsed = parseDerivationChain(chain);
    assert.equal(parsed.id, chain.id);

    // Verify
    const report = verifyChain(parsed);
    assert.equal(report.passed, true, `Chain ${chain.id} should pass verification.`);
  }

  // Export grouped proof graphs
  const graphExports = exportProofGraphs(validChains);
  assert.ok(graphExports.length >= 4);
});

test("chains.compiler.integration: rejects all adversarial chains", () => {
  const adversarialChains = [
    adversarialIntegrationNoConstantOrBc,
    adversarialHistoricalCitingModernOracle,
    adversarialCyclicRoute,
    adversarialSquareRootNoBranch,
    adversarialLorentzTransverseNoPremises,
    adversarialMassEnergyCircularRestEnergy,
    adversarialMassEnergyGammaMc2,
    adversarialLorentzDiscoveryMinkowskiAxiom,
    adversarialProofRelyingOnConclusion,
    adversarialEntryAssumptionSelfCitation,
  ];

  for (const adv of adversarialChains) {
    const report = verifyChain(adv);
    assert.equal(report.passed, false, `Adversarial chain ${adv.id} must fail verification`);
  }
});
