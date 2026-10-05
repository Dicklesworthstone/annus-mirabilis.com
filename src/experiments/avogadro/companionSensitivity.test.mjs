import assert from "node:assert/strict";
import test from "node:test";
import { inferMolecularDimensions } from "../../physics/reference/molecularDimensions.ts";
import { AVOGADRO_DEFAULTS } from "./definition.ts";
import { studyAvogadroSensitivity } from "./sensitivity.ts";

// The companion route runs its REAL owner. The other two rows are explicitly inert fixtures;
// full three-route owner/session integration is in historical.integration.test.mjs.
function companionOwner(parameters) {
  const companion = inferMolecularDimensions({
    temperature: parameters.temperature,
    viscosity: parameters.viscosityMpaS * 1e-3,
    diffusion: parameters.soluteDiffusionUm2S * 1e-12,
    molarConcentration: parameters.molarConcentration,
    specificViscosity: parameters.specificViscosity,
    gasConstant: 8.31,
    viscosityCoefficient: parameters.coefficient,
  });
  return { kind: "accepted", parameters, outputs: [
    ...["radiationNumber", "brownianNumber"].map(quantityId => ({ quantityId, status: "value", value: 1, unit: "mol^-1", ownerId: "inert-fixture", semanticKind: "fixture" })),
    companion.molecularNumber,
  ] };
}
const companion = (point) => point.readings.find(reading => reading.result.quantityId === "molecularNumber");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12 * Math.max(1, Math.abs(b)));

test("real companion owner: the viscosity correction changes the inferred number by the predicted factor", () => {
  const got = studyAvogadroSensitivity({ ...AVOGADRO_DEFAULTS, coefficient: 1 }, "coefficient", [1, 2.5], companionOwner);
  assert.equal(got.kind, "accepted");
  close(companion(got.study.points[1]).ratio, Math.sqrt(2.5));
  assert.equal(companion(got.study.points[1]).result.ownerId, "molecular-dimensions");
});
test("real companion owner: doubling solute diffusivity does not get mistaken for a linear inverse", () => {
  const got = studyAvogadroSensitivity(AVOGADRO_DEFAULTS, "soluteDiffusionUm2S", [1000], companionOwner);
  assert.equal(got.kind, "accepted");
  close(companion(got.study.points[0]).ratio, 2 ** -1.5);
});
test("real companion owner: leaving the dilute regime retains the model-domain explanation", () => {
  const got = studyAvogadroSensitivity(AVOGADRO_DEFAULTS, "specificViscosity", [0.2], companionOwner);
  assert.equal(got.kind, "accepted");
  const reading = companion(got.study.points[0]);
  assert.equal(reading.result.status, "outside-domain");
  assert.equal(reading.result.condition, "not-dilute");
  assert.equal(reading.ratio, null);
});
test("real companion owner: absent concentration information stays an identifiable family, not a chosen N", () => {
  const got = studyAvogadroSensitivity({ ...AVOGADRO_DEFAULTS, molarConcentration: 0, specificViscosity: 0 }, "soluteDiffusionUm2S", [250, 1000], companionOwner);
  assert.equal(got.kind, "accepted");
  for (const point of got.study.points) {
    assert.equal(companion(point).result.status, "underdetermined");
    assert.equal(companion(point).ratio, null);
  }
});
