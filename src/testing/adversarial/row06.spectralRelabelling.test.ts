/**
 * ROW 6: "A spectral-axis relabelling preserves density" (am-ver-adversarial-audit-1ef).
 *
 * A density is per unit of its own axis, so changing the axis needs the Jacobian
 * |dnu/dlambda| = nu^2/c. Substituting lambda = c/nu alone keeps the NUMBER and changes what it is
 * a density of, and the result still looks like a spectrum.
 *
 * The row names two consequences and both are checked, because they fail independently: matching
 * band energies require u_lambda = u_nu * c / lambda^2, and the PEAKS do not correspond under
 * lambda = c/nu. A fixture that only compared band totals would miss the second, which is the one
 * a reader meets first when they are told the spectrum "peaks at" a value.
 */

import { expect, test } from "bun:test";
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  planckBandEnergyDensity,
  planckWavelengthBandEnergyDensity,
} from "../../physics/reference/radiation/bandIntegration.ts";
import {
  planckFrequencyEnergyDensity,
  planckPeakFrequency,
  planckPeakWavelength,
  planckWavelengthEnergyDensity,
  spectralDensityCoordinateTransform,
} from "../../physics/reference/radiation/spectra.ts";
import { wrongRelabelledDensity } from "./wrongComputations.ts";

const SET = getConstantSet("modern-si-2019");
const T = 3000;
const C = 299792458;

const value = (r: { status: string; value?: number }) => {
  expect(r.status).toBe("value");
  return r.status === "value" ? (r.value as number) : Number.NaN;
};

test("the same band has the same energy on either axis", () => {
  const nuMin = 3e14;
  const nuMax = 4e14;
  const byFrequency = value(planckBandEnergyDensity(nuMin, nuMax, T, SET));
  const byWavelength = value(planckWavelengthBandEnergyDensity(C / nuMax, C / nuMin, T, SET));
  // Measured: both 9.97354212e-3 J/m^3.
  expect(byWavelength).toBeCloseTo(byFrequency, 12);
  expect(byFrequency).toBeCloseTo(9.97354212e-3, 10);
});

test("the WRONG relabelling fails on the density, by exactly the Jacobian", () => {
  const nu = 4e14;
  const lambda = C / nu;
  const uNu = value(planckFrequencyEnergyDensity(nu, T, SET));
  const uLambda = value(planckWavelengthEnergyDensity(lambda, T, SET));

  // The owner's own transform states the factor: nu^2/c, equivalently c/lambda^2.
  const transformed = spectralDensityCoordinateTransform(uNu, nu, SET);
  expect(transformed.jacobian).toBeCloseTo((nu * nu) / C, -8);
  expect(transformed.uLambda).toBeCloseTo(uLambda, 1);

  // Substituting the variable alone keeps u_nu, which is not u_lambda and is not close to it.
  const wrong = wrongRelabelledDensity(uNu);
  expect(wrong).not.toBeCloseTo(uLambda, 1);
  // The two differ by the Jacobian, which is enormous: 21 orders of magnitude here.
  expect(Math.log10(uLambda / wrong)).toBeCloseTo(Math.log10(transformed.jacobian), 6);
});

test("the PEAKS do not correspond under lambda = c/nu, which the band check cannot see", () => {
  const nuPeak = value(planckPeakFrequency(T, SET));
  const lambdaPeak = value(planckPeakWavelength(T, SET));
  // Measured: nu_peak 1.763678e14 Hz, lambda_peak 9.659240e-7 m, and c/nu_peak 1.699814e-6 m.
  expect(C / nuPeak).not.toBeCloseTo(lambdaPeak, 8);
  // The ratio is the standard 4.965/2.821, which is why the mistake is not a rounding matter.
  expect(C / nuPeak / lambdaPeak).toBeCloseTo(1.759781, 5);
});

test("the Jacobian is not a constant, so no single factor repairs the relabelling", () => {
  // A reader who learns there is "a factor" may hope it is one number. It varies as nu^2.
  const factors = [2e14, 4e14, 8e14].map(
    (nu) => spectralDensityCoordinateTransform(1, nu, SET).jacobian,
  );
  expect(factors[1] as number).toBeCloseTo((factors[0] as number) * 4, -20);
  expect(factors[2] as number).toBeCloseTo((factors[1] as number) * 4, -20);
});
