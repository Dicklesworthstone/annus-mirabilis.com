import { afterAll, describe, expect, it } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  logIntervalEnergyDensity,
  planckBandEnergyDensity,
  planckFrequencyEnergyDensity,
  planckPeakFrequency,
  planckPeakLogInterval,
  planckPeakWavelength,
  planckTotalEnergyDensity,
  planckWavelengthBandEnergyDensity,
  planckWavelengthEnergyDensity,
  rayleighJeansFrequencyEnergyDensity,
  rayleighJeansWavelengthEnergyDensity,
  regimeRelativeErrors,
  spectralDensityCoordinateTransform,
  wienBandEnergyDensity,
  wienFrequencyEnergyDensity,
  wienWavelengthEnergyDensity,
  X_PEAK_FREQUENCY,
  X_PEAK_LOG_INTERVAL,
  X_PEAK_WAVELENGTH,
} from "../physics/reference/radiation.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";
import {
  planckFrequencyBandSeries,
  planckWavelengthBandSeries,
  wienFrequencyBandSeries,
} from "./references/radiationSeries.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.spectra (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("Planck, Wien, and Rayleigh-Jeans in frequency basis satisfy high and low frequency limits", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1500;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;

    // High frequency (x = 10, Wien regime)
    const nuHigh = (10 * kB * T) / h;
    const pHigh = planckFrequencyEnergyDensity(nuHigh, T, set);
    const wHigh = wienFrequencyEnergyDensity(nuHigh, T, set);
    expect(pHigh.status).toBe("value");
    expect(wHigh.status).toBe("value");
    if (pHigh.status === "value" && wHigh.status === "value") {
      // At x = 10, e^-10 ~= 4.54e-5
      expect(withinTolerance(wHigh.value, pHigh.value, { relative: 1e-4 }).ok).toBe(true);
    }

    // Wavelength basis Wien vs Planck in short-wavelength regime (e.g. 0.5 um at 1500 K => x ~= 19.2)
    const lambdaShort = 0.5e-6;
    const pWaveShort = planckWavelengthEnergyDensity(lambdaShort, T, set);
    const wWaveShort = wienWavelengthEnergyDensity(lambdaShort, T, set);
    expect(pWaveShort.status).toBe("value");
    expect(wWaveShort.status).toBe("value");
    if (pWaveShort.status === "value" && wWaveShort.status === "value") {
      expect(withinTolerance(wWaveShort.value, pWaveShort.value, { relative: 1e-4 }).ok).toBe(true);
    }

    // Low frequency (x = 0.001, Rayleigh-Jeans regime)
    const nuLow = (0.001 * kB * T) / h;
    const pLow = planckFrequencyEnergyDensity(nuLow, T, set);
    const rjLow = rayleighJeansFrequencyEnergyDensity(nuLow, T, set);
    expect(pLow.status).toBe("value");
    expect(rjLow.status).toBe("value");
    if (pLow.status === "value" && rjLow.status === "value") {
      // At x = 0.001, |1 - x/(e^x - 1)| ~= x/2 = 5e-4
      expect(withinTolerance(rjLow.value, pLow.value, { relative: 1e-3 }).ok).toBe(true);
    }

    // Long wavelength RJ vs Planck (e.g. 1000 um at 1500 K => x ~= 0.0096)
    const lambdaLong = 1000e-6;
    const pWaveLong = planckWavelengthEnergyDensity(lambdaLong, T, set);
    const rjWaveLong = rayleighJeansWavelengthEnergyDensity(lambdaLong, T, set);
    expect(pWaveLong.status).toBe("value");
    expect(rjWaveLong.status).toBe("value");
    if (pWaveLong.status === "value" && rjWaveLong.status === "value") {
      expect(withinTolerance(rjWaveLong.value, pWaveLong.value, { relative: 0.01 }).ok).toBe(true);
    }

    logger.log({
      testId: "spectra-limits-frequency-basis",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Coordinate transform: u_lambda = u_nu * |dnu/dlambda| = u_nu * (c / lambda^2)", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 2000;
    const lambda = 1.5e-6; // 1.5 um
    const c = 299792458;
    const nu = c / lambda;

    const uNuRes = planckFrequencyEnergyDensity(nu, T, set);
    const uLambdaRes = planckWavelengthEnergyDensity(lambda, T, set);

    expect(uNuRes.status).toBe("value");
    expect(uLambdaRes.status).toBe("value");

    if (uNuRes.status === "value" && uLambdaRes.status === "value") {
      const transform = spectralDensityCoordinateTransform(uNuRes.value, nu, set);
      expect(transform.wavelength).toBeCloseTo(lambda, 12);
      expect(transform.jacobian).toBeCloseTo((nu * nu) / c, 6);
      expect(withinTolerance(transform.uLambda, uLambdaRes.value, { relative: 1e-12 }).ok).toBe(
        true,
      );
    }

    logger.log({
      testId: "spectra-coordinate-transform-jacobian",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Log-interval spectral energy density: nu * u_nu == lambda * u_lambda", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 2500;
    const lambda = 1.0e-6;
    const c = 299792458;
    const nu = c / lambda;

    const freqLog = logIntervalEnergyDensity(nu, T, set, "frequency", "planck");
    const waveLog = logIntervalEnergyDensity(lambda, T, set, "wavelength", "planck");

    expect(freqLog.status).toBe("value");
    expect(waveLog.status).toBe("value");

    if (freqLog.status === "value" && waveLog.status === "value") {
      expect(withinTolerance(waveLog.value, freqLog.value, { relative: 1e-12 }).ok).toBe(true);
    }

    logger.log({
      testId: "spectra-log-interval-basis-invariance",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Spectral peak roots match exact transcendental solutions x_3, x_5, x_4", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 5800; // Sun surface approx
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;
    const c = 299792458;

    const nuPeakRes = planckPeakFrequency(T, set);
    const lambdaPeakRes = planckPeakWavelength(T, set);
    const logPeak = planckPeakLogInterval(T, set);

    expect(nuPeakRes.status).toBe("value");
    expect(lambdaPeakRes.status).toBe("value");

    if (nuPeakRes.status === "value" && lambdaPeakRes.status === "value") {
      const x3Expected = X_PEAK_FREQUENCY;
      const x5Expected = X_PEAK_WAVELENGTH;
      const x4Expected = X_PEAK_LOG_INTERVAL;

      const nuFromX3 = (x3Expected * kB * T) / h;
      expect(nuPeakRes.value).toBeCloseTo(nuFromX3, 4);

      const lambdaFromX5 = (h * c) / (x5Expected * kB * T);
      expect(lambdaPeakRes.value).toBeCloseTo(lambdaFromX5, 12);

      expect(logPeak.x).toBeCloseTo(x4Expected, 9);
      expect(logPeak.peakFrequency).toBeCloseTo((x4Expected * kB * T) / h, 4);

      // Note: nu_peak * lambda_peak != c because frequency and wavelength distributions peak at different physical photons
      const product = nuPeakRes.value * lambdaPeakRes.value;
      expect(product).not.toBeCloseTo(c, 0);
      expect(product / c).toBeCloseTo(x3Expected / x5Expected, 5);
    }

    logger.log({
      testId: "spectra-peaks-transcendental-roots",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Regime relative error reports correct bounds and classifications", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1000;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;

    // Wien regime: x = 6 >= ln(100) ~= 4.605
    const nuWien = (6 * kB * T) / h;
    const reportWien = regimeRelativeErrors(nuWien, T, set, { epsilonW: 0.01, epsilonRJ: 0.01 });
    expect(reportWien.regime).toBe("wien");
    expect(reportWien.wienAdmitted).toBe(true);
    expect(reportWien.rayleighJeansAdmitted).toBe(false);
    expect(reportWien.wienRelativeError).toBeLessThan(0.01);

    // RJ regime: x = 0.01
    const nuRJ = (0.01 * kB * T) / h;
    const reportRJ = regimeRelativeErrors(nuRJ, T, set, { epsilonW: 0.01, epsilonRJ: 0.01 });
    expect(reportRJ.regime).toBe("rayleigh-jeans");
    expect(reportRJ.rayleighJeansAdmitted).toBe(true);
    expect(reportRJ.wienAdmitted).toBe(false);
    expect(reportRJ.rayleighJeansRelativeError).toBeLessThan(0.01);

    // Intermediate regime: x = 1.0
    const nuMid = (1.0 * kB * T) / h;
    const reportMid = regimeRelativeErrors(nuMid, T, set, { epsilonW: 0.01, epsilonRJ: 0.01 });
    expect(reportMid.regime).toBe("intermediate");
    expect(reportMid.wienAdmitted).toBe(false);
    expect(reportMid.rayleighJeansAdmitted).toBe(false);

    logger.log({
      testId: "spectra-regime-error-classification",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Band energy density: quadrature agrees with independent analytical series to 10^-9 relative error", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1200;
    const nu1 = 1.0e14;
    const nu2 = 3.0e14;

    const quadPlanck = planckBandEnergyDensity(nu1, nu2, T, set);
    const seriesPlanck = planckFrequencyBandSeries(nu1, nu2, T, set);

    expect(quadPlanck.status).toBe("value");
    if (quadPlanck.status === "value") {
      expect(withinTolerance(quadPlanck.value, seriesPlanck, { relative: 1e-9 }).ok).toBe(true);
    }

    const quadWien = wienBandEnergyDensity(nu1, nu2, T, set);
    const seriesWien = wienFrequencyBandSeries(nu1, nu2, T, set);

    expect(quadWien.status).toBe("value");
    if (quadWien.status === "value") {
      expect(withinTolerance(quadWien.value, seriesWien, { relative: 1e-9 }).ok).toBe(true);
    }

    // Wavelength band
    const lambda1 = 1.0e-6;
    const lambda2 = 2.5e-6;
    const quadWave = planckWavelengthBandEnergyDensity(lambda1, lambda2, T, set);
    const seriesWave = planckWavelengthBandSeries(lambda1, lambda2, T, set);

    expect(quadWave.status).toBe("value");
    if (quadWave.status === "value") {
      expect(withinTolerance(quadWave.value, seriesWave, { relative: 1e-9 }).ok).toBe(true);
    }

    // Golden band (LQ-03): 400-600 THz at 5000 K holding ~0.1286853 J/m^3
    const tGolden = 5000;
    const nuGolden1 = 400e12;
    const nuGolden2 = 600e12;
    const quadGolden = planckBandEnergyDensity(nuGolden1, nuGolden2, tGolden, set);
    const seriesGolden = planckFrequencyBandSeries(nuGolden1, nuGolden2, tGolden, set);
    expect(quadGolden.status).toBe("value");
    if (quadGolden.status === "value") {
      expect(withinTolerance(quadGolden.value, 0.1286853, { relative: 1e-5 }).ok).toBe(true);
      expect(withinTolerance(quadGolden.value, seriesGolden, { relative: 1e-9 }).ok).toBe(true);
    }

    // Multi-temperature matching frequency/wavelength band integrals agree to 10^-10 at 500 K, 3000 K, 10000 K
    const c = 299792458;
    for (const testT of [500, 3000, 10000]) {
      const f1 = 200e12;
      const f2 = 500e12;
      const l1 = c / f2;
      const l2 = c / f1;
      const fRes = planckBandEnergyDensity(f1, f2, testT, set);
      const lRes = planckWavelengthBandEnergyDensity(l1, l2, testT, set);
      expect(fRes.status).toBe("value");
      expect(lRes.status).toBe("value");
      if (fRes.status === "value" && lRes.status === "value") {
        expect(withinTolerance(fRes.value, lRes.value, { relative: 1e-10 }).ok).toBe(true);
      }
    }

    logger.log({
      testId: "spectra-band-quadrature-vs-series",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("adversarial fixture: a spectral-axis relabeling preserves density must FAIL", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 4000;
    const c = 299792458;
    const nu = 5.0e14;
    const lambda = c / nu;

    const uNu = planckFrequencyEnergyDensity(nu, T, set);
    const uLambda = planckWavelengthEnergyDensity(lambda, T, set);

    expect(uNu.status).toBe("value");
    expect(uLambda.status).toBe("value");

    if (uNu.status === "value" && uLambda.status === "value") {
      // Direct relabeling assertion (substituting coordinates without Jacobian |dnu/dlambda| = c/lambda^2)
      // must fail because spectral density is a differential distribution, not a scalar value.
      const directRelabelAssert = () => {
        if (!withinTolerance(uNu.value, uLambda.value, { relative: 1e-2 }).ok) {
          throw new Error(
            `Coordinate relabeling failed: u_nu (${uNu.value}) != u_lambda (${uLambda.value}) without Jacobian`,
          );
        }
      };
      expect(directRelabelAssert).toThrow("Coordinate relabeling failed: u_nu");

      // Coordinate transformation with Jacobian MUST hold
      const jacobian = c / (lambda * lambda);
      expect(withinTolerance(uLambda.value, uNu.value * jacobian, { relative: 1e-12 }).ok).toBe(
        true,
      );
    }

    logger.log({
      testId: "adversarial-spectral-axis-relabeling-fails",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Total energy density satisfies Stefan-Boltzmann law u = a * T^4", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1500;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;
    const c = 299792458;

    const aExact = (8 * Math.PI ** 5 * kB ** 4) / (15 * c ** 3 * h ** 3);
    const uTotalRes = planckTotalEnergyDensity(T, set);

    expect(uTotalRes.status).toBe("value");
    if (uTotalRes.status === "value") {
      const expectedTotal = aExact * T ** 4;
      expect(withinTolerance(uTotalRes.value, expectedTotal, { relative: 1e-12 }).ok).toBe(true);
    }

    logger.log({
      testId: "spectra-total-energy-stefan-boltzmann",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
