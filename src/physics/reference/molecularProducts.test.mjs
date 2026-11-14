import assert from "node:assert/strict";
import { test } from "node:test";
import { inferMolecularDimensions } from "./molecularDimensions.ts";
import { correctMolecularCoefficient, inferMolecularProducts } from "./molecularProducts.ts";

const value = (result) => {
  assert.equal(result.status, "value");
  assert.ok(Number.isFinite(result.value) && result.value > 0);
  return result.value;
};
const close = (actual, expected) =>
  assert.ok(Math.abs(actual / expected - 1) < 3e-13, `${actual} != ${expected}`);

test("the two printed products determine radius and number without a target molecular number", () => {
  const input = { radiusTimesNumber: 2.08e14, viscosityProduct: 200e-6, viscosityCoefficient: 1 };
  const found = inferMolecularProducts(input);
  const radius = value(found.radius);
  const number = value(found.molecularNumber);
  close(radius * number, input.radiusTimesNumber);
  close(radius ** 3 * number, input.viscosityProduct);
  close(radius, Math.sqrt(200e-6 / 2.08e14));
  assert.ok(number > 2.1e23 && number < 2.13e23);
  assert.equal(found.radius.unit, "m");
  assert.equal(found.molecularNumber.unit, "mol^-1");
  for (const result of Object.values(found)) {
    assert.equal(result.ownerId, "molecular-dimensions");
    assert.ok(Object.isFrozen(result));
  }
  assert.ok(Object.isFrozen(found));
});

test("the product inverse and the observation inverse use the same physical solution", () => {
  for (const viscosityCoefficient of [1, 2.5]) {
    const input = {
      temperature: 291.65,
      viscosity: 0.001,
      diffusion: 5e-10,
      molarConcentration: 10,
      specificViscosity: 0.01,
      gasConstant: 8.31,
      viscosityCoefficient,
    };
    const products = inferMolecularProducts({
      radiusTimesNumber:
        (input.gasConstant * input.temperature) / (6 * Math.PI * input.viscosity * input.diffusion),
      viscosityProduct: (3 * input.specificViscosity) / (4 * Math.PI * input.molarConcentration),
      viscosityCoefficient,
    });
    const observations = inferMolecularDimensions(input);
    close(value(products.radius), value(observations.radius));
    close(value(products.molecularNumber), value(observations.molecularNumber));
  }
});

test("a coefficient correction holds both observations fixed and reverses without losing the pair", () => {
  const radius = 0.78e-9;
  const molecularNumber = 4.15e23;
  const corrected = correctMolecularCoefficient({
    radius,
    molecularNumber,
    fromCoefficient: 1,
    toCoefficient: 2.5,
  });
  close(value(corrected.radius) / radius, 1 / Math.sqrt(2.5));
  close(value(corrected.molecularNumber) / molecularNumber, Math.sqrt(2.5));
  close(value(corrected.radius) * value(corrected.molecularNumber), radius * molecularNumber);
  close(2.5 * value(corrected.radius) ** 3 * value(corrected.molecularNumber), radius ** 3 * molecularNumber);
  const original = correctMolecularCoefficient({
    radius: value(corrected.radius),
    molecularNumber: value(corrected.molecularNumber),
    fromCoefficient: 2.5,
    toCoefficient: 1,
  });
  close(value(original.radius), radius);
  close(value(original.molecularNumber), molecularNumber);
});

test("changing the data and correcting the coefficient cannot be collapsed into one operation", () => {
  const original = inferMolecularProducts({
    radiusTimesNumber: 2.08e14,
    viscosityProduct: 200e-6,
    viscosityCoefficient: 2.5,
  });
  assert.ok(value(original.molecularNumber) < 3.4e23);
  const actualCorrection = correctMolecularCoefficient({
    radius: 0.78e-9,
    molecularNumber: 4.15e23,
    fromCoefficient: 1,
    toCoefficient: 2.5,
  });
  assert.ok(value(actualCorrection.molecularNumber) > 6.5e23);
});

test("invalid or nonrepresentable products and corrections produce typed nonvalues", () => {
  const products = { radiusTimesNumber: 2.08e14, viscosityProduct: 200e-6, viscosityCoefficient: 1 };
  const correction = { radius: 0.78e-9, molecularNumber: 4.15e23, fromCoefficient: 1, toCoefficient: 2.5 };
  for (const key of ["radiusTimesNumber", "viscosityProduct"])
    for (const invalid of [0, -1, NaN, Infinity, "1"])
      assert.equal(inferMolecularProducts({ ...products, [key]: invalid }).radius.status, "outside-domain");
  for (const key of ["radius", "molecularNumber"])
    for (const invalid of [0, -1, NaN, Infinity, "1"])
      assert.equal(correctMolecularCoefficient({ ...correction, [key]: invalid }).molecularNumber.status, "outside-domain");
  for (const invalid of [0, 2, NaN, "1"]) {
    assert.equal(inferMolecularProducts({ ...products, viscosityCoefficient: invalid }).radius.status, "outside-domain");
    assert.equal(correctMolecularCoefficient({ ...correction, toCoefficient: invalid }).radius.status, "outside-domain");
    assert.equal(correctMolecularCoefficient({ ...correction, fromCoefficient: invalid }).radius.status, "outside-domain");
  }
  for (const result of Object.values(inferMolecularProducts({ ...products, radiusTimesNumber: Number.MAX_VALUE, viscosityProduct: Number.MIN_VALUE }))) {
    assert.equal(result.status, "outside-domain");
    assert.equal(result.domainKind, "numerical");
  }
});
