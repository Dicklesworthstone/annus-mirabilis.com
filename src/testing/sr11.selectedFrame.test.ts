import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { SR11_DEFAULTS } from "../experiments/sr11/definition.ts";
import { createSr11Session } from "../experiments/sr11/session.ts";
import { C_SI } from "../physics/reference/fields.ts";
import { evaluateSr11 } from "../physics/reference/waves.ts";

const oblique = {
  beta: 3 / 5,
  incidentAngleDeg: (Math.acos(4 / 5) * 180) / Math.PI,
  incidentEnergyDensity: 2,
  mirrorArea: 3,
} as const;

test("SR11 reflects the normal component and preserves frequency in the mirror rest frame", () => {
  for (const beta of [-0.6, 0, 0.6]) {
    const result = evaluateSr11({ ...SR11_DEFAULTS, beta, frame: "mirror" });
    expect(result.status).toBe("value");
    expect(result.incidentAngleInFrameDeg).toBe(0);
    expect(result.cosPhiReflected).toBe(-1);
    expect(result.phiReflectedDeg).toBe(180);
    // Both readings share the original K frequency as their reference.
    expect(result.frequencyRatio).toBeCloseTo(result.incidentFrequencyRatio, 12);
    expect(result.amplitudeRatio).toBeCloseTo(result.incidentFrequencyRatio, 12);
    expect(result.reflectedPower).toBeCloseTo(result.incidentPower, 6);
    expect(result.workRate).toBe(0);
  }
});

test("SR11's oblique frame change keeps incoming and reflected directions in the selected frame", () => {
  // beta=3/5 and cos(phi)=4/5 give exact rational values in both frames.
  const rest = evaluateSr11({ ...oblique, frame: "mirror" });
  expect(rest.status).toBe("value");
  expect(Math.cos((rest.incidentAngleInFrameDeg * Math.PI) / 180)).toBeCloseTo(5 / 13, 12);
  expect(rest.cosPhiReflected).toBeCloseTo(-5 / 13, 12);
  expect(rest.phiReflectedDeg + rest.incidentAngleInFrameDeg).toBeCloseTo(180, 12);
  expect(rest.incidentFrequencyRatio).toBeCloseTo(13 / 20, 12);
  expect(rest.frequencyRatio).toBeCloseTo(13 / 20, 12);
  expect(rest.radiationForce).toBeCloseTo(
    (oblique.incidentEnergyDensity * oblique.mirrorArea) / 8,
    12,
  );
  const power = (13 * oblique.incidentEnergyDensity * C_SI * oblique.mirrorArea) / 80;
  expect(rest.incidentPower).toBeCloseTo(power, 5);
  expect(rest.reflectedPower).toBeCloseTo(power, 5);
  expect(rest.workRate).toBe(0);

  const lab = evaluateSr11({ ...oblique, frame: "lab" });
  expect(lab.status).toBe("value");
  expect(lab.incidentAngleInFrameDeg).toBe(oblique.incidentAngleDeg);
  expect(lab.incidentFrequencyRatio).toBe(1);
  expect(lab.cosPhiReflected).toBeCloseTo(7 / 25, 12);
  expect(lab.frequencyRatio).toBeCloseTo(5 / 8, 12);
  expect(lab.incidentPower).toBeCloseTo(
    (oblique.incidentEnergyDensity * C_SI * oblique.mirrorArea) / 5,
    5,
  );
  expect(lab.reflectedPower).toBeCloseTo(
    (oblique.incidentEnergyDensity * C_SI * oblique.mirrorArea) / 8,
    5,
  );
  expect(lab.workRate).toBeCloseTo(
    (3 * oblique.incidentEnergyDensity * C_SI * oblique.mirrorArea) / 40,
    5,
  );
});

test("SR11 publishes the selected-frame geometry through the actual accepted session", () => {
  const session = createSr11Session("selected-mirror-frame");
  const runId = session.getSnapshot().accepted?.runId;
  expect(session.apply({ ...SR11_DEFAULTS, frame: "mirror" }).kind).toBe("accepted");
  const snapshot = session.getSnapshot().accepted;
  assert.ok(snapshot);
  expect(snapshot.runId).toBe(runId);
  const outputs = new Map(snapshot.outputs.map((output) => [output.quantityId, output]));
  expect(outputs.get("incidentAngleInFrameDeg")).toMatchObject({ status: "value", value: 0 });
  expect(outputs.get("incidentFrequencyRatio")).toMatchObject({ status: "value", value: 0.5 });
  expect(outputs.get("cosPhiReflected")).toMatchObject({ status: "value", value: -1 });
  expect(outputs.get("phiReflectedDeg")).toMatchObject({ status: "value", value: 180 });
});

test("SR11 never substitutes laboratory geometry for unavailable rest-frame readings", () => {
  for (const frame of ["lab", "mirror"] as const) {
    const result = evaluateSr11({ ...SR11_DEFAULTS, frame, incidentAngleDeg: 60 });
    expect(result.status).toBe("not-applicable");
    for (const id of ["incidentAngleInFrameDeg", "incidentFrequencyRatio", "cosPhiReflected"]) {
      const output = result.results.find((candidate) => candidate.quantityId === id);
      expect(output?.status).toBe("not-applicable");
      expect(output && "value" in output).toBe(false);
    }
  }
  const refused = evaluateSr11({ ...SR11_DEFAULTS, frame: "mirror", beta: 1 });
  expect(refused.status).toBe("outside-domain");
  for (const id of ["incidentAngleInFrameDeg", "incidentFrequencyRatio"]) {
    expect(refused.results.find((output) => output.quantityId === id)?.status).toBe(
      "outside-domain",
    );
  }
});

test("SR11 preserves numerical uncertainty at the interception boundary in accepted outputs", () => {
  for (const frame of ["lab", "mirror"] as const) {
    const result = evaluateSr11({
      ...SR11_DEFAULTS,
      frame,
      incidentAngleDeg: (Math.acos(SR11_DEFAULTS.beta) * 180) / Math.PI,
    });
    expect(result.status).toBe("indeterminate");
    for (const output of result.results) {
      expect(output).toMatchObject({
        status: "outside-domain",
        domainKind: "numerical",
        condition: "interception-boundary-within-numerical-tolerance",
        reason: result.reason,
        boundary: { parameterId: "incidentAngleDeg", value: 0 },
      });
      expect("value" in output).toBe(false);
    }
    expect(evaluateSr11({ ...SR11_DEFAULTS, frame, incidentAngleDeg: 0 }).status).toBe("value");
  }
});
