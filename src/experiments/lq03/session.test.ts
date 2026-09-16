import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  planckBandEnergyDensity,
  planckFrequencyEnergyDensity,
  planckPeakFrequency,
  planckPeakLogInterval,
  planckPeakWavelength,
  planckTotalEnergyDensity,
  planckWavelengthBandEnergyDensity,
  planckWavelengthEnergyDensity,
  regimeRelativeErrors,
  spectralDensityCoordinateTransform,
} from "../../physics/reference/radiation.ts";
import { planckFrequencyBandSeries } from "../../testing/references/radiationSeries.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { LQ03_DEFAULTS } from "./definition.ts";
import { evaluateLq03 } from "./session.ts";

const SET = getConstantSet("modern-si-2019");
const C = 299792458;

function rel(a: number, b: number, tol = 1e-6): boolean {
  return withinTolerance(a, b, { relative: tol }).ok;
}

describe("LQ-03 session against the bead's own worked numbers (am-lq-03-spectrum-08vz)", () => {
  test("band invariance at T=5000K, 400-600 THz: frequency and wavelength integrals agree", () => {
    const nu1 = 400e12;
    const nu2 = 600e12;
    const fromNu = planckBandEnergyDensity(nu1, nu2, 5000, SET);
    const fromLambda = planckWavelengthBandEnergyDensity(C / nu2, C / nu1, 5000, SET);
    expect(fromNu.status).toBe("value");
    expect(fromLambda.status).toBe("value");
    if (fromNu.status !== "value" || fromLambda.status !== "value") return;
    expect(rel(fromNu.value, fromLambda.value)).toBe(true);
    expect(rel(fromNu.value, 0.1286853)).toBe(true);

    const total = planckTotalEnergyDensity(5000, SET);
    expect(total.status).toBe("value");
    if (total.status !== "value") return;
    expect(rel(total.value, 0.4728583)).toBe(true);
    expect(rel(fromNu.value / total.value, 0.2721, 1e-3)).toBe(true);
  });

  test("independent high-precision series reference agrees with the owner's adaptive quadrature to 1e-9 relative", () => {
    const nu1 = 400e12;
    const nu2 = 600e12;
    const owner = planckBandEnergyDensity(nu1, nu2, 5000, SET);
    const reference = planckFrequencyBandSeries(nu1, nu2, 5000, SET);
    expect(owner.status).toBe("value");
    if (owner.status !== "value") return;
    expect(rel(owner.value, reference, 1e-9)).toBe(true);
  });

  test("peaks at T=5000K: nu_peak, lambda_peak, and the mismatch c/lambda_peak != nu_peak", () => {
    const nuPeak = planckPeakFrequency(5000, SET);
    const lambdaPeak = planckPeakWavelength(5000, SET);
    expect(nuPeak.status).toBe("value");
    expect(lambdaPeak.status).toBe("value");
    if (nuPeak.status !== "value" || lambdaPeak.status !== "value") return;
    expect(rel(nuPeak.value, 293.946e12, 1e-4)).toBe(true);
    expect(rel(lambdaPeak.value, 579.554e-9, 1e-4)).toBe(true);

    const cOverLambdaPeak = C / lambdaPeak.value;
    expect(rel(cOverLambdaPeak, 517.281e12, 1e-4)).toBe(true);
    expect(rel(cOverLambdaPeak, nuPeak.value)).toBe(false);
    expect(rel(cOverLambdaPeak / nuPeak.value, 1.75978, 1e-4)).toBe(true);

    const logPeak = planckPeakLogInterval(5000, SET);
    expect(rel(logPeak.x, 3.920690394872886)).toBe(true);
    expect(rel(logPeak.peakFrequency, 408.47e12, 1e-4)).toBe(true);
  });

  test("regime boundaries: Wien 1% at x=ln100, 5% at x=ln20; classical 1% at x=0.01986777", () => {
    const T = 5000;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;
    const nuAtX = (x: number) => (x * kB * T) / h;

    const wien1 = regimeRelativeErrors(nuAtX(Math.log(100)), T, SET, { epsilonW: 0.01 });
    expect(rel(wien1.x, Math.log(100))).toBe(true);
    expect(rel(wien1.wienRelativeError, 0.01)).toBe(true);

    const wien5 = regimeRelativeErrors(nuAtX(Math.log(20)), T, SET, { epsilonW: 0.05 });
    expect(rel(wien5.x, Math.log(20))).toBe(true);
    expect(rel(wien5.wienRelativeError, 0.05)).toBe(true);

    const classical1 = regimeRelativeErrors(nuAtX(0.01986777), T, SET, { epsilonRJ: 0.01 });
    expect(rel(classical1.x, 0.01986777)).toBe(true);
  });

  test("probe: T=5000K, nu=600THz gives x=5.759092, wien error 3.1540e-3, inside Wien and outside classical at 1%", () => {
    const report = regimeRelativeErrors(600e12, 5000, SET, { epsilonW: 0.01, epsilonRJ: 0.01 });
    expect(rel(report.x, 5.759092)).toBe(true);
    expect(rel(report.wienRelativeError, 3.154e-3, 1e-3)).toBe(true);
    expect(report.wienAdmitted).toBe(true);
    expect(report.rayleighJeansAdmitted).toBe(false);
  });

  test("stability: x=1e-8 returns a finite, linearly representable density", () => {
    // Calls the owner's density function directly at a small x, rather than through
    // evaluateLq03 (which also computes a band-energy integral over the default 400-600 THz
    // band regardless of the probe point): DEFECT FOUND (reported to BoldHarbor, not fixed
    // here -- src/physics/reference/radiation/bandIntegration.ts is am-ref-radiation-15c's
    // file, not this bead's) -- planckBandEnergyDensity's adaptive quadrature hangs when the
    // band's dimensionless x-range is small (deep Rayleigh-Jeans regime, large T relative to
    // the band), already visibly slow (~1s) at T=10000K (the top of this bead's own suggested
    // teaching range) and non-terminating by T=1e5K with the default band. This bead's own
    // parameter validation now refuses T outside [500, 10000] K for exactly this reason (see
    // parameters.test.ts), which keeps every value reachable through this instrument's UI
    // clear of the defect without patching another bead's file.
    const T = 5000;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;
    const nu = (1e-8 * kB * T) / h;
    const density = planckFrequencyEnergyDensity(nu, T, SET);
    expect(density.status).toBe("value");
    if (density.status !== "value") return;
    expect(density.linearRepresentable).toBe(true);
    expect(Number.isFinite(density.value)).toBe(true);
  });

  test("stability: T=500K, x=800 (nu=8.3346476e15 Hz) is not linearly representable; logFrequencyEnergyDensity = -821.75092", () => {
    const nu = 8.3346476e15;
    const T = 500;
    const evaluation = evaluateLq03({ ...LQ03_DEFAULTS, T, probeNu: nu });
    const density = evaluation.planck.frequency;
    expect(density.status).toBe("value");
    if (density.status !== "value") return;
    expect(density.linearRepresentable).toBe(false);
    expect(density.logFrequencyEnergyDensity).toBeDefined();
    if (density.logFrequencyEnergyDensity === undefined) return;
    // The bead prints -821.75092 (8 significant figures); the owner's full-precision value is
    // -821.7509151759423, which rounds to the printed figure -- checked at 1e-7 relative
    // (matching the printed precision), not 1e-9 (which the printed digit count can't support).
    expect(rel(density.logFrequencyEnergyDensity, -821.75092, 1e-7)).toBe(true);

    const x = (6.62607015e-34 * nu) / (1.380649e-23 * T);
    const naive = (8 * Math.PI * 6.62607015e-34 * nu ** 3) / 299792458 ** 3 / Math.expm1(x);
    expect(naive === 0 || !Number.isFinite(naive)).toBe(true);
  });

  test("where both forms are representable, the log-space density matches direct evaluation to 1e-12 relative", () => {
    const evaluation = evaluateLq03({ ...LQ03_DEFAULTS, T: 5000, probeNu: 600e12 });
    const density = evaluation.planck.frequency;
    expect(density.status).toBe("value");
    if (density.status !== "value" || !density.linearRepresentable) return;
    if (density.logFrequencyEnergyDensity !== undefined) {
      expect(rel(Math.exp(density.logFrequencyEnergyDensity), density.value, 1e-12)).toBe(true);
    }
  });

  test("ADVERSARIAL: relabeling the spectral axis without the Jacobian breaks density agreement", () => {
    // "A spectral density is not a total": u_nu(nu0) and u_lambda(nu0) at the SAME numeric
    // value nu0 -- one read as a frequency in Hz, the other (wrongly) read as a wavelength in
    // meters with no Jacobian applied -- must disagree, because u_lambda = u_nu * (c / lambda^2)
    // is a nonzero, nu0-dependent rescaling, never the identity. This demonstrates the trap
    // directly on the density functions rather than integrating over a nonphysical band (an
    // interval of "wavelengths" between 4e14 m and 6e14 m sends the adaptive quadrature into
    // runaway recursion on an interval where the integrand is flat over most of its span).
    const T = 5000;
    const nu0 = 5e14;
    const correctFrequencyDensity = planckFrequencyEnergyDensity(nu0, T, SET);
    const naiveRelabeledAsWavelength = planckWavelengthEnergyDensity(nu0, T, SET);
    expect(correctFrequencyDensity.status).toBe("value");
    expect(naiveRelabeledAsWavelength.status).toBe("value");
    if (correctFrequencyDensity.status !== "value" || naiveRelabeledAsWavelength.status !== "value")
      return;
    if (
      !correctFrequencyDensity.linearRepresentable ||
      !naiveRelabeledAsWavelength.linearRepresentable
    )
      return;
    expect(rel(correctFrequencyDensity.value, naiveRelabeledAsWavelength.value)).toBe(false);

    // The correctly Jacobian-transformed density from u_nu DOES agree with the owner's own
    // direct wavelength-density evaluation at the corresponding physical wavelength c/nu0.
    const { uLambda, wavelength } = spectralDensityCoordinateTransform(
      correctFrequencyDensity.value,
      nu0,
      SET,
    );
    const directAtCorrespondingWavelength = planckWavelengthEnergyDensity(wavelength, T, SET);
    expect(directAtCorrespondingWavelength.status).toBe("value");
    if (directAtCorrespondingWavelength.status !== "value") return;
    if (!directAtCorrespondingWavelength.linearRepresentable) return;
    expect(rel(uLambda, directAtCorrespondingWavelength.value)).toBe(true);
  });

  test("ADVERSARIAL: substituting lambda = c/nu_peak does not give lambda_peak", () => {
    const T = 5000;
    const nuPeak = planckPeakFrequency(T, SET);
    const lambdaPeak = planckPeakWavelength(T, SET);
    expect(nuPeak.status).toBe("value");
    expect(lambdaPeak.status).toBe("value");
    if (nuPeak.status !== "value" || lambdaPeak.status !== "value") return;
    const naiveSubstitution = C / nuPeak.value;
    expect(rel(naiveSubstitution, lambdaPeak.value)).toBe(false);
  });

  test("coordinateTransform: the correct Jacobian-transformed wavelength density differs from the naive one", () => {
    const evaluation = evaluateLq03({ ...LQ03_DEFAULTS, T: 5000, probeNu: 600e12 });
    const { correctWavelengthDensity, naiveWavelengthDensity } = evaluation.coordinateTransform;
    expect(Number.isFinite(correctWavelengthDensity)).toBe(true);
    expect(rel(correctWavelengthDensity, naiveWavelengthDensity)).toBe(false);
  });

  test("spectralDensityCoordinateTransform is consistent with the owner's own wavelength density function", () => {
    const T = 5000;
    const nu = 600e12;
    const uNuResult = evaluateLq03({ ...LQ03_DEFAULTS, T, probeNu: nu }).planck.frequency;
    expect(uNuResult.status).toBe("value");
    if (uNuResult.status !== "value" || !uNuResult.linearRepresentable) return;
    const { uLambda, wavelength } = spectralDensityCoordinateTransform(uNuResult.value, nu, SET);
    const direct = evaluateLq03({ ...LQ03_DEFAULTS, T, probeNu: nu }).planck.wavelength;
    expect(direct.status).toBe("value");
    if (direct.status !== "value" || !direct.linearRepresentable) return;
    expect(rel(wavelength, C / nu)).toBe(true);
    expect(rel(uLambda, direct.value)).toBe(true);
  });
});
