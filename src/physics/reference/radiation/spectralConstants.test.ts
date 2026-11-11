import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../../units/tolerance.ts";
import { type ConstantSet, getConstantSet, withHistoricalGuard } from "../constants.ts";
import {
  planckBandEnergyDensity,
  planckTotalEnergyDensity,
  planckWavelengthBandEnergyDensity,
} from "./bandIntegration.ts";
import {
  planckFrequencyEnergyDensity,
  planckPeakFrequency,
  planckPeakWavelength,
  planckWavelengthEnergyDensity,
  rayleighJeansFrequencyEnergyDensity,
  regimeRelativeErrors,
  spectralDensityCoordinateTransform,
  wienFrequencyEnergyDensity,
} from "./spectra.ts";
import { spectralConstantsSI } from "./spectralConstants.ts";

const printed = getConstantSet("einstein-1905-light-quanta-printed");
const modern = getConstantSet("modern-si-2019");
function close(actual: number, expected: number, relative = 2e-12) {
  expect(withinTolerance(actual, expected, { relative }).ok).toBe(true);
}
function value(result: { status: string; value?: unknown }): number {
  expect(result.status).toBe("value");
  expect(typeof result.value).toBe("number");
  return result.value as number;
}
function replaceConstant(set: ConstantSet, quantityId: string, patch: object): ConstantSet {
  return {
    ...set,
    entries: set.entries.map((entry) =>
      entry.quantityId === quantityId ? { ...entry, ...patch } : entry,
    ),
  };
}

describe("radiation uses one declared coefficient set in SI", () => {
  test("the historical spectrum reads corrected alpha and beta without h, N or a modern thermal constant", () => {
    const spectralOnly = {
      ...printed,
      entries: printed.entries.filter((entry) =>
        ["wienConstantAlpha", "wienConstantBeta", "speedOfLight"].includes(entry.quantityId),
      ),
    };
    const constants = withHistoricalGuard(() => spectralConstantsSI(spectralOnly));
    expect(constants).toEqual({ A: 6.1e-58, B: 4.866e-11, c: 3e8 });
    const fromFull = withHistoricalGuard(() => planckFrequencyEnergyDensity(6e14, 5000, printed));
    expect(planckFrequencyEnergyDensity(6e14, 5000, spectralOnly)).toEqual(fromFull);
    // This value comes from the printed coefficient, not (R/N) beta and the rounded printed N.
    close(value(fromFull), 3.8469575732999924e-16);
    const alteredN = replaceConstant(printed, "avogadroConstant", { value: 1e23 });
    expect(planckFrequencyEnergyDensity(6e14, 5000, alteredN)).toEqual(fromFull);
  });

  test("all three historical laws use the printed coefficients and the classical limit alpha/beta", () => {
    close(value(wienFrequencyEnergyDensity(6e14, 5000, printed)), 3.8357584233939327e-16);
    close(value(rayleighJeansFrequencyEnergyDensity(6e14, 5000, printed)), 2.2564734895191123e-14);
    close(regimeRelativeErrors(6e14, 5000, printed).x, 5.8392);
    const misprintedAlpha = replaceConstant(printed, "wienConstantAlpha", { value: 6.1e-56 });
    close(
      value(planckFrequencyEnergyDensity(6e14, 5000, misprintedAlpha)),
      10 * value(planckFrequencyEnergyDensity(6e14, 5000, printed)),
    );
    expect(value(planckFrequencyEnergyDensity(6e14, 5000, printed))).not.toBe(
      value(planckFrequencyEnergyDensity(6e14, 5000, modern)),
    );
  });

  test("historical frequency/wavelength densities preserve the Jacobian, band energy, and independent peak roots", () => {
    // Independent 60-digit quadrature of A nu^3/expm1(B nu/T), with A = 6.10e-58,
    // B = 4.866e-11, T = 5000 K. Peak roots solve 3(1-exp(-x))=x and 5(1-exp(-x))=x.
    const expectedBand = 0.11891950109099571;
    withHistoricalGuard(() => {
      const frequency = value(planckBandEnergyDensity(4e14, 6e14, 5000, printed));
      const wavelength = value(
        planckWavelengthBandEnergyDensity(3e8 / 6e14, 3e8 / 4e14, 5000, printed),
      );
      close(frequency, expectedBand);
      close(wavelength, expectedBand);
      close(value(planckTotalEnergyDensity(5000, printed)), 0.4416006110851314);
      close(value(planckPeakFrequency(5000, printed)), 289913622289568.3);
      close(value(planckPeakWavelength(5000, printed)), 5.880227249020061e-7);
      for (const nu of [1e11, 1e13, 6e14, 1e15]) {
        const density = value(planckFrequencyEnergyDensity(nu, 5000, printed));
        close(
          value(planckWavelengthEnergyDensity(3e8 / nu, 5000, printed)),
          (density * nu * nu) / 3e8,
        );
      }
    });
  });

  test("modern spectra retain SI coefficients, and Planck's registered 1901 h and k are read directly", () => {
    const constants = spectralConstantsSI(modern);
    close(constants.A, (8 * Math.PI * 6.62607015e-34) / 299792458 ** 3);
    close(constants.B, 6.62607015e-34 / 1.380649e-23);
    expect(constants.c).toBe(299792458);
    const old = spectralConstantsSI(getConstantSet("planck-1900-1901-printed"));
    close(old.B, 6.55e-34 / 1.346e-23);
  });

  test("a coordinate conversion only requires the declared light speed, never a spectral calibration", () => {
    for (const set of [modern, printed]) {
      const lightSpeedOnly = {
        ...set,
        entries: set.entries.filter((entry) => entry.quantityId === "speedOfLight"),
      };
      const transformed = () => spectralDensityCoordinateTransform(2e-16, 6e14, lightSpeedOnly);
      const result = set === printed ? withHistoricalGuard(transformed) : transformed();
      const c = set === printed ? 3e8 : 299792458;
      close(result.wavelength, c / 6e14);
      close(result.jacobian, 6e14 ** 2 / c);
      close(result.uLambda, (2e-16 * 6e14 ** 2) / c);
    }
  });

  test("spectral-constant-invalid refuses missing, duplicate and unknown-unit entries (spectralConstants.ts:30)", () => {
    for (const quantity of ["wienConstantAlpha", "wienConstantBeta", "speedOfLight"]) {
      expect(() =>
        spectralConstantsSI({
          ...printed,
          entries: printed.entries.filter((entry) => entry.quantityId !== quantity),
        }),
      ).toThrow();
      const entry = printed.entries.find((entry) => entry.quantityId === quantity);
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(() =>
        spectralConstantsSI({ ...printed, entries: [...printed.entries, entry] }),
      ).toThrow();
      expect(() =>
        spectralConstantsSI(replaceConstant(printed, quantity, { unit: "unknown" })),
      ).toThrow();
    }
  });

  test("spectral-constant-invalid refuses nonpositive or nonfinite SI coefficients (spectralConstants.ts:37)", () => {
    for (const quantity of ["wienConstantAlpha", "wienConstantBeta", "speedOfLight"]) {
      for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          spectralConstantsSI(replaceConstant(printed, quantity, { value: invalid })),
        ).toThrow();
      }
    }
  });
});
