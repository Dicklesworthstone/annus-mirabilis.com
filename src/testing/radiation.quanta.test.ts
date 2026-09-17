import { afterAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  bandLimitedMeanQuantumEnergyWien,
  effectiveIndependentCount,
  meanQuantumEnergyWien,
  meanQuantumEnergyWienBand,
  regimeRelativeErrors,
} from "../physics/reference/radiation.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

/**
 * Independently implemented composite Simpson's rule quadrature
 * written directly in this test file to avoid any shared code with reference evaluators.
 */
function independentQuadrature(
  f: (x: number) => number,
  a: number,
  b: number,
  intervals = 20000,
): number {
  const n = intervals % 2 === 0 ? intervals : intervals + 1;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (h / 3) * sum;
}

describe("radiation.quanta (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("effectiveIndependentCount returns E / (h * nu) and tracks quantum energy in eV", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 5.0e14; // Visible light frequency ~ 600 nm
    const h = 6.62607015e-34;
    const E = 1.0; // 1 Joule of monochromatic radiation

    const res = effectiveIndependentCount(E, nu, set);
    expect(res.status).toBe("value");
    expect(res.quantumEnergy).toBeCloseTo(h * nu, 25);
    expect(res.quantumEnergyEv).toBeCloseTo((h * nu) / 1.602176634e-19, 6);
    expect(res.count).toBeCloseTo(E / (h * nu), 0);

    logger.log({
      testId: "quanta-effective-count",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("meanQuantumEnergyWien evaluates to 3 * k_B * T and returns integrationRange and boundary shares", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1700;
    const kB = 1.380649e-23;

    const res = meanQuantumEnergyWien(T, set);
    expect(res.status).toBe("value");
    expect(res.meanQuantumEnergyWien).toBeCloseTo(3 * kB * T, 20);
    expect(res.meanResonatorEnergy).toBeCloseTo(kB * T, 20);
    expect(res.ratioToMoleculeKinetic).toBeCloseTo(2.0, 12);

    // Visible light at 600 THz ratio check
    const h = 6.62607015e-34;
    const nu600 = 6.0e14;
    const expectedRatio = (h * nu600) / (3 * kB * T);
    expect(res.ratioAt600THz).toBeCloseTo(expectedRatio, 10);

    // AC 9 verification: returns integrationRange, wienAdmittedBoundaryX, energyShareBelowBoundary = 0.675136, countShareBelowBoundary = 0.837910
    expect(res.integrationRange).toBe("all-positive-frequencies");
    expect(res.wienAdmittedBoundaryX).toBeCloseTo(Math.log(100), 10);
    expect(withinTolerance(res.energyShareBelowBoundary, 0.675136, { relative: 1e-5 }).ok).toBe(
      true,
    );
    expect(withinTolerance(res.countShareBelowBoundary, 0.83791, { relative: 1e-5 }).ok).toBe(true);
    expect(res.modelStatus).toBe("stipulated-model-extrapolated-beyond-admitted-regime");

    // Cross-check shares against independent adaptive quadrature in this test file
    const x0 = Math.log(100);
    const indepEnergyBelow = independentQuadrature((x) => x ** 3 * Math.exp(-x), 0, x0) / 6;
    const indepCountBelow = independentQuadrature((x) => x ** 2 * Math.exp(-x), 0, x0) / 2;
    expect(
      withinTolerance(res.energyShareBelowBoundary, indepEnergyBelow, { relative: 1e-9 }).ok,
    ).toBe(true);
    expect(
      withinTolerance(res.countShareBelowBoundary, indepCountBelow, { relative: 1e-9 }).ok,
    ).toBe(true);

    logger.log({
      testId: "quanta-mean-wien-energy-and-ratio",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("meanQuantumEnergyWienBand reproduces 3 * k_B * T over (0, infinity) bitwise against meanQuantumEnergyWien", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 2000;
    const kB = 1.380649e-23;

    const resFull = meanQuantumEnergyWien(T, set);
    const resBandInf = meanQuantumEnergyWienBand(T, 0, Infinity, set);

    expect(resBandInf.status).toBe("value");
    if (resBandInf.status === "value") {
      // Bitwise exact equality with meanQuantumEnergyWien
      expect(resBandInf.meanQuantumEnergyWien).toBe(resFull.meanQuantumEnergyWien);
      expect(resBandInf.historicalStatus).toBe("editorial-variant");
    }

    // Over (ln 100, infinity): returns 6.012671 * k_B * T
    const x0 = Math.log(100);
    const resAdmitted = meanQuantumEnergyWienBand(T, x0, Infinity, set);
    expect(resAdmitted.status).toBe("value");
    if (resAdmitted.status === "value") {
      const expectedAdmitted = 6.012671 * kB * T;
      expect(
        withinTolerance(resAdmitted.meanQuantumEnergyWien, expectedAdmitted, { relative: 1e-5 }).ok,
      ).toBe(true);

      // Compare against independent quadrature over tail [x0, 40]
      const indepTailEnergy = independentQuadrature((x) => x ** 3 * Math.exp(-x), x0, 40);
      const indepTailCount = independentQuadrature((x) => x ** 2 * Math.exp(-x), x0, 40);
      const indepRatio = indepTailEnergy / indepTailCount;
      const indepExpectedJoules = kB * T * indepRatio;
      expect(
        withinTolerance(resAdmitted.meanQuantumEnergyWien, indepExpectedJoules, { relative: 1e-9 })
          .ok,
      ).toBe(true);
    }

    // Boundary matches regimeRelativeErrors
    const regReport = regimeRelativeErrors((x0 * kB * T) / 6.62607015e-34, T, set, {
      epsilonW: 0.01,
    });
    expect(resFull.wienAdmittedBoundaryX).toBeCloseTo(regReport.wienBoundaryX, 10);

    // Changing epsilonW to 0.05 (x0 = ln 20 = 2.995732) changes both shares consistently with independent quadrature
    const resEps05 = meanQuantumEnergyWien(T, set, { epsilonW: 0.05 });
    const x0_05 = Math.log(20);
    expect(resEps05.wienAdmittedBoundaryX).toBeCloseTo(x0_05, 10);
    const indepEnergy05 = independentQuadrature((x) => x ** 3 * Math.exp(-x), 0, x0_05) / 6;
    const indepCount05 = independentQuadrature((x) => x ** 2 * Math.exp(-x), 0, x0_05) / 2;
    expect(
      withinTolerance(resEps05.energyShareBelowBoundary, indepEnergy05, { relative: 1e-9 }).ok,
    ).toBe(true);
    expect(
      withinTolerance(resEps05.countShareBelowBoundary, indepCount05, { relative: 1e-9 }).ok,
    ).toBe(true);

    logger.log({
      testId: "quanta-band-limited-incomplete-gamma",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("meanQuantumEnergyWienBand refuses inverted or nonfinite bounds", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 2000;

    // Inverted bounds: xMax <= xMin
    const resInverted = meanQuantumEnergyWienBand(T, 5, 2, set);
    expect(resInverted.status).toBe("outside-domain");
    if (resInverted.status === "outside-domain") {
      expect(resInverted.condition).toBe("invalid-dimensionless-bounds");
    }

    // Equal bounds: xMax === xMin
    const resEqual = meanQuantumEnergyWienBand(T, 4, 4, set);
    expect(resEqual.status).toBe("outside-domain");

    // Negative lower bound
    const resNeg = meanQuantumEnergyWienBand(T, -1, 5, set);
    expect(resNeg.status).toBe("outside-domain");

    // NaN bounds
    const resNaN = meanQuantumEnergyWienBand(T, NaN, 5, set);
    expect(resNaN.status).toBe("outside-domain");

    // -Infinity bound
    const resNegInf = meanQuantumEnergyWienBand(T, -Infinity, 5, set);
    expect(resNegInf.status).toBe("outside-domain");

    // Historical status check: labeling band-limited value as printed 1905 result must fail
    const bandRes = meanQuantumEnergyWienBand(T, 0, Infinity, set);
    expect(bandRes.status).toBe("value");
    if (bandRes.status === "value") {
      expect(bandRes.historicalStatus).toBe("editorial-variant");
      const assertHistoricalClaim = (status: string) => {
        if (status !== "printed-einstein-1905") {
          throw new Error("Band-limited variant is not the printed 1905 result.");
        }
      };
      expect(() => assertHistoricalClaim(bandRes.historicalStatus)).toThrow(
        "Band-limited variant is not the printed 1905 result.",
      );
    }

    // Static check: bare spelling "meanQuantumEnergy" must not appear as an exported identifier or property in quanta.ts
    const quantaSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/physics/reference/radiation/quanta.ts"),
      "utf8",
    );
    const bareSpellingMatches = quantaSource.match(
      /\bexport\s+(const|function|type)\s+meanQuantumEnergy\b/g,
    );
    expect(bareSpellingMatches).toBeNull();

    logger.log({
      testId: "quanta-band-refusals-and-status",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
