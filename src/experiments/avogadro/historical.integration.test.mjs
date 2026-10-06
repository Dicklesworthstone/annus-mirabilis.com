import assert from "node:assert/strict";
import test from "node:test";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { AVOGADRO_DEFAULTS } from "./definition.ts";
import { avogadroBasis } from "./basis.ts";
import { createAvogadroSession, evaluateAvogadro } from "./session.ts";
import { studyAvogadroSensitivity } from "./sensitivity.ts";

const scalar = (evaluation, id) => {
  assert.equal(evaluation.kind, "accepted");
  const matches = evaluation.outputs.filter((result) => result.quantityId === id);
  assert.equal(matches.length, 1);
  const result = matches[0];
  assert.equal(result.status, "value", id);
  assert.equal(typeof result.value, "number", id);
  return result;
};
const close = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) <= 1e-12 * Math.max(Math.abs(expected), 1e-300),
    `${actual} differs from ${expected}`,
  );

test("both diffusion routes use the selected registered R, never the historical estimate of N", () => {
  const modern = evaluateAvogadro(AVOGADRO_DEFAULTS);
  const historicalParameters = { ...AVOGADRO_DEFAULTS, constantBasis: 1 };
  const historical = evaluateAvogadro(historicalParameters);
  const modernSet = getConstantSet(avogadroBasis(AVOGADRO_DEFAULTS).setId);
  const historicalSet = getConstantSet(avogadroBasis(historicalParameters).setId);
  const scale =
    constantValue(historicalSet, "molarGasConstant").value /
    constantValue(modernSet, "molarGasConstant").value;
  assert.equal(historicalSet.gasConstantProvenance, "measured-without-counting-molecules");
  for (const id of ["brownianNumber", "brownianRadiusProduct", "radiusTimesMolecularNumber"]) {
    close(scalar(historical, id).value / scalar(modern, id).value, scale);
  }
  close(
    scalar(historical, "molecularRadius").value / scalar(modern, "molecularRadius").value,
    1 / Math.sqrt(scale),
  );
  close(
    scalar(historical, "molecularNumber").value / scalar(modern, "molecularNumber").value,
    scale ** 1.5,
  );
  for (const id of ["radiationNumber", "definedNumber", "soluteVolumeFraction"])
    assert.equal(scalar(historical, id).value, scalar(modern, id).value, id);
  for (const endpoint of ["lower", "upper"])
    close(
      scalar(historical, "brownianNumber").uncertainty[endpoint] /
        scalar(modern, "brownianNumber").uncertainty[endpoint],
      scale,
    );
});
test("a basis change publishes one complete new revision; an invalid change retains it", () => {
  const session = createAvogadroSession("historical-basis-integration");
  const before = session.getSnapshot().accepted;
  assert.equal(session.apply({ ...AVOGADRO_DEFAULTS, constantBasis: 1 }).kind, "accepted");
  const after = session.getSnapshot().accepted;
  assert.ok(after.snapshotVersion > before.snapshotVersion);
  assert.equal(after.parameters.constantBasis, 1);
  assert.notEqual(after.runId, before.runId);
  assert.equal(session.apply({ ...AVOGADRO_DEFAULTS, constantBasis: 0.5 }).kind, "refused");
  assert.equal(session.getSnapshot().accepted, after);
  assert.equal(session.getSnapshot().pending, false);
});
test("real radiation-only sensitivity leaves both diffusion results unchanged", () => {
  const got = studyAvogadroSensitivity(AVOGADRO_DEFAULTS, "alphaScale", [0.5, 2], evaluateAvogadro);
  assert.equal(got.kind, "accepted");
  for (const point of got.study.points) {
    for (const reading of point.readings) {
      close(
        reading.ratio,
        reading.result.quantityId === "radiationNumber" ? 1 / point.parameterValue : 1,
      );
    }
  }
});
test("real sensitivity does not manufacture a molecular number without an independent radius", () => {
  const got = studyAvogadroSensitivity(AVOGADRO_DEFAULTS, "radiusKnown", [0, 1], evaluateAvogadro);
  assert.equal(got.kind, "accepted");
  const missingRadius = got.study.points.find((point) => point.parameterValue === 0);
  const brownian = missingRadius.readings.find(
    (reading) => reading.result.quantityId === "brownianNumber",
  );
  assert.equal(brownian.result.status, "underdetermined");
  assert.equal(brownian.ratio, null);
  assert.ok(brownian.result.neededInformation.some((text) => /radius/i.test(text)));
});
