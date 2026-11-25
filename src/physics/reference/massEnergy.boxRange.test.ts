import { expect, test } from "bun:test";
import { ME03_DEFAULTS } from "../../experiments/me03/definition.ts";
import { validateMe03Parameters } from "../../experiments/me03/parameters.ts";
import { createMe03Session, snapshotOutputs } from "../../experiments/me03/session.ts";
import { encodeResult, parseResult } from "../../experiments/results/codec.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { getConstantSet } from "./constants.ts";
import { C_SI, evaluatePhotonBox } from "./massEnergy.ts";

function value(result: ScientificResult): number {
  expect(result.status).toBe("value");
  if (result.status !== "value" || typeof result.value !== "number")
    throw new Error("Expected a scalar value from the real photon-box owner");
  expect(Number.isFinite(result.value)).toBe(true);
  return result.value;
}

test("large representable box outputs survive overflowing intermediate products", () => {
  const box = evaluatePhotonBox({ E: 1e300, M: 1e300, ell: 1e100, assignLightMass: false });
  expect(box.status).toBe("value");
  expect(box.domainRatio).toBeCloseTo(1 / (C_SI * C_SI), 30);
  expect(value(box.recoilSpeed)).toBeCloseTo(1 / C_SI, 22);
  expect(value(box.boxDisplacement) / (-1e100 / (C_SI * C_SI))).toBeCloseTo(1, 14);
  expect(value(box.centerOfMassShift)).toBe(box.displacement);
  expect(value(box.pulseMomentum) / (1e300 / C_SI)).toBeCloseTo(1, 14);
  expect(box.exactRationalCenterOfMassShift.isExactlyZero).toBe(false);
});

test("small representable recoil is retained rather than rounded to a physical zero", () => {
  const box = evaluatePhotonBox({ E: 1e-280, assignLightMass: false });
  expect(box.status).toBe("value");
  expect(value(box.boxDisplacement)).toBeLessThan(0);
  expect(value(box.recoilSpeed)).toBeGreaterThan(0);
  expect(value(box.pulseMomentum)).toBeGreaterThan(0);
});

test("underflowed physical outputs are numerical limits with no false zero or beta repair", () => {
  for (const input of [{ E: Number.MIN_VALUE }, { ell: Number.MIN_VALUE }]) {
    const box = evaluatePhotonBox(input);
    expect(box.status).toBe("outside-domain");
    expect(box.exactRationalCenterOfMassShift.isExactlyZero).toBe(false);
    for (const result of [
      box.boxDisplacement,
      box.centerOfMassShift,
      box.recoilSpeed,
      box.pulseFlightTime,
      box.pulseMomentum,
      box.lightMassAssigned,
    ]) {
      expect(result.status).toBe("outside-domain");
      if (result.status !== "outside-domain") continue;
      expect(result.domainKind).toBe("numerical");
      expect(result).not.toHaveProperty("value");
      expect(result.boundary).not.toHaveProperty("parameterId", "beta");
      expect(parseResult(encodeResult(result))).toEqual(result);
    }
  }
});

test("invalid bounds cannot disable the small-recoil approximation", () => {
  for (const domainBound of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 0.5]) {
    const box = evaluatePhotonBox({ E: 1e14, domainBound });
    expect(box.status).toBe("outside-domain");
    expect(box.condition).toBe("0 < domainBound <= 1e-3");
    expect(box.boxDisplacement.status).toBe("outside-domain");
    if (box.boxDisplacement.status === "outside-domain")
      expect(box.boxDisplacement.domainKind).toBe("input");
  }
  expect(evaluatePhotonBox({ E: 1, domainBound: 1e-20 }).status).toBe("outside-domain");
});

test("rational displacement uses the selected constant without rounding its speed", () => {
  const base = getConstantSet("modern-si-2019");
  const set = {
    ...base,
    entries: base.entries.map((entry) =>
      entry.quantityId === "speedOfLight" ? { ...entry, value: 2.5, exactDecimal: "2.5" } : entry,
    ),
  };
  const box = evaluatePhotonBox({ E: 0.001, set, assignLightMass: false });
  expect(box.status).toBe("value");
  expect(box.displacement).toBe(-0.001 / 6.25);
  const rational = box.exactRationalCenterOfMassShift;
  expect(rational.numerator * 6250n).toBe(-rational.denominator);
});

test("a numerical refusal keeps the same accepted box trial and permits the next valid trial", () => {
  const parameters = { ...ME03_DEFAULTS, mode: "box-1906" as const };
  const session = createMe03Session("photon-box-range", parameters);
  const before = session.getSnapshot();
  let publications = 0;
  const unsubscribe = session.subscribe(() => {
    publications += 1;
  });
  for (const change of [{ pulseEnergy: Number.MIN_VALUE }, { boxLength: Number.MIN_VALUE }]) {
    const requested = { ...parameters, ...change };
    expect(validateMe03Parameters(requested).kind).toBe("refused");
    const outcome = session.apply(requested);
    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.refusal.details?.domainKind).toBe("numerical");
      expect(outcome.refusal.details?.requirements).toContain("underflow");
    }
    expect(session.getSnapshot()).toBe(before);
    expect(publications).toBe(0);
    for (const result of snapshotOutputs(requested))
      expect(parseResult(encodeResult(result)).status).toBe("outside-domain");
  }
  expect(session.apply({ ...parameters, pulseEnergy: 2 }).kind).toBe("accepted");
  expect(session.getSnapshot().accepted?.runId).not.toBe(before.accepted?.runId);
  expect(publications).toBeGreaterThan(0);
  unsubscribe();
});
