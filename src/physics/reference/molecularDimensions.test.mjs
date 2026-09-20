import assert from "node:assert/strict";
import { test } from "node:test";
import { inferMolecularDimensions } from "./molecularDimensions.ts";

const input = Object.freeze({ temperature: 293.15, viscosity: 0.001, diffusion: 5e-10,
  molarConcentration: 20, specificViscosity: 0.01, gasConstant: 8.31446261815324,
  viscosityCoefficient: 2.5 });
const value = (r) => { assert.equal(r.status, "value"); assert.ok(Number.isFinite(r.value)); return r.value; };
const close = (a, b) => assert.ok(Math.abs(a / b - 1) < 2e-13, `${a} != ${b}`);

test("joint inversion satisfies both independently evaluated forward equations", () => {
  for (const viscosityCoefficient of [1, 2.5]) {
    const p = { ...input, viscosityCoefficient };
    const s = inferMolecularDimensions(p);
    const a = value(s.radius); const N = value(s.molecularNumber);
    close(p.gasConstant * p.temperature / (6 * Math.PI * p.viscosity * a * N), p.diffusion);
    close(viscosityCoefficient * (4 * Math.PI / 3) * p.molarConcentration * N * a ** 3, p.specificViscosity);
    close(value(s.radiusTimesMolecularNumber), a * N);
    close(value(s.volumeFraction), p.specificViscosity / viscosityCoefficient);
    assert.ok(Object.isFrozen(s));
    for (const r of Object.values(s)) { assert.ok(Object.isFrozen(r)); assert.equal(r.ownerId, "molecular-dimensions"); }
  }
});

test("coefficient correction at fixed observations changes N by sqrt(2.5), not 2.5", () => {
  const old = inferMolecularDimensions({ ...input, viscosityCoefficient: 1 });
  const corrected = inferMolecularDimensions(input);
  close(value(corrected.molecularNumber) / value(old.molecularNumber), Math.sqrt(2.5));
  close(value(corrected.radius) / value(old.radius), 1 / Math.sqrt(2.5));
  close(value(corrected.radiusTimesMolecularNumber), value(old.radiusTimesMolecularNumber));
});

test("radius and N are recovered without a target Avogadro number or Boltzmann constant", () => {
  for (const a of [1e-10, 3e-10, 1e-9]) for (const N of [2e23, 6e23, 1e24]) {
    const p = { ...input, diffusion: input.gasConstant * input.temperature / (6 * Math.PI * input.viscosity * a * N),
      molarConcentration: 0.1, specificViscosity: 2.5 * (4 * Math.PI / 3) * 0.1 * N * a ** 3 };
    const s = inferMolecularDimensions(p);
    close(value(s.radius), a); close(value(s.molecularNumber), N);
  }
});

test("missing viscosity information exposes the compatible family, not a fitted target", () => {
  const s = inferMolecularDimensions({ ...input, molarConcentration: 0, specificViscosity: 0 });
  assert.equal(s.radius.status, "underdetermined"); assert.equal(s.molecularNumber.status, "underdetermined");
  value(s.radiusTimesMolecularNumber); assert.equal(value(s.volumeFraction), 0);
  assert.ok(Object.isFrozen(s.radius.neededInformation));
});

test("inconsistent zero pairs and concentrated solutions refuse explicitly", () => {
  for (const patch of [{ molarConcentration: 0 }, { specificViscosity: 0 }, { specificViscosity: 0.126 }]) {
    for (const r of Object.values(inferMolecularDimensions({ ...input, ...patch }))) {
      assert.equal(r.status, "outside-domain"); assert.equal(r.domainKind, "model");
    }
  }
  value(inferMolecularDimensions({ ...input, specificViscosity: 0.125 }).radius);
});

test("invalid and nonfinite inputs never become numeric outputs", () => {
  for (const key of Object.keys(input).filter((k) => k !== "viscosityCoefficient")) {
    for (const n of [-1, NaN, Infinity, -Infinity, "2", undefined]) {
      for (const r of Object.values(inferMolecularDimensions({ ...input, [key]: n }))) {
        assert.equal(r.status, "outside-domain"); assert.equal(r.domainKind, "input");
      }
    }
  }
  for (const viscosityCoefficient of [0, 2, 3, NaN, "2.5"]) {
    assert.equal(inferMolecularDimensions({ ...input, viscosityCoefficient }).radius.status, "outside-domain");
  }
});

test("extreme scales are rejected numerically instead of publishing infinity or zero", () => {
  for (const patch of [{ diffusion: Number.MIN_VALUE }, { gasConstant: Number.MIN_VALUE },
    { molarConcentration: Number.MIN_VALUE, specificViscosity: Number.MIN_VALUE }]) {
    const s = inferMolecularDimensions({ ...input, ...patch });
    for (const r of Object.values(s)) {
      if (r.status === "value") assert.ok(Number.isFinite(r.value) && r.value > 0);
      else { assert.equal(r.status, "outside-domain"); assert.equal(r.domainKind, "numerical"); }
    }
  }
});
