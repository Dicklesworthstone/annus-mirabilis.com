import { afterAll, describe, expect, it } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  entropyWithUnfixedConstant,
  radiationEntropyVolumeChange,
  wienSpectralEntropyDensity,
  wienTemperatureFromDensity,
} from "../physics/reference/radiation.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.entropy (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("Wien temperature from density inverts Wien spectral distribution", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 3000;
    const nu = 2.0e14;
    const c = 299792458;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;

    const x = (h * nu) / (kB * T);
    const rho = ((8 * Math.PI * h * nu ** 3) / c ** 3) * Math.exp(-x);

    const tRes = wienTemperatureFromDensity(rho, nu, set);
    expect(tRes.status).toBe("value");
    if (tRes.status === "value") {
      expect(tRes.value).toBeCloseTo(T, 8);
    }

    logger.log({
      testId: "wien-temperature-inversion",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Spectral entropy density derivative ds_nu/drho equals 1/T", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 3000;
    const nu = 3.0e14;
    const c = 299792458;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;

    const x = (h * nu) / (kB * T);
    const rho = ((8 * Math.PI * h * nu ** 3) / c ** 3) * Math.exp(-x);

    const hRho = 1e-8 * rho;
    const sPlus = wienSpectralEntropyDensity(rho + hRho, nu, set);
    const sMinus = wienSpectralEntropyDensity(rho - hRho, nu, set);

    expect(sPlus.status).toBe("value");
    expect(sMinus.status).toBe("value");

    if (sPlus.status === "value" && sMinus.status === "value") {
      const numDeriv = (sPlus.value - sMinus.value) / (2 * hRho);
      const expectedReciprocalT = 1 / T;
      const relDiff = Math.abs(numDeriv - expectedReciprocalT) / expectedReciprocalT;
      expect(relDiff).toBeLessThan(1e-6);
    }

    logger.log({
      testId: "wien-entropy-derivative-temperature",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Spectral entropy density at rho = 0 returns analytic-limit 0", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 3.0e14;
    const sZero = wienSpectralEntropyDensity(0, nu, set);
    expect(sZero.status).toBe("analytic-limit");
    if (sZero.status === "analytic-limit") {
      expect(sZero.value).toBe(0);
      expect(sZero.description).toContain("Entropy density vanishes");
    }

    logger.log({
      testId: "wien-entropy-zero-limit",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Outside-domain refusals for rho >= A*nu^3 and e^-x > epsilon_W", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 1.0e14;
    const c = 299792458;
    const h = 6.62607015e-34;
    const A = (8 * Math.PI * h) / c ** 3;
    const maxDensity = A * nu ** 3;

    // rho >= maxDensity
    const tOver = wienTemperatureFromDensity(maxDensity * 1.05, nu, set);
    expect(tOver.status).toBe("outside-domain");
    if (tOver.status === "outside-domain") {
      expect(tOver.condition).toBe("nonpositive-implied-temperature");
    }

    // Volume change with band not narrow (dNu / nu = 0.05 > 0.01)
    const bandWide = radiationEntropyVolumeChange({
      E: 1.0,
      nu: 1e14,
      dNu: 5e12,
      V: 2.0,
      V0: 1.0,
    });
    expect(bandWide.status).toBe("outside-domain");
    if (bandWide.status === "outside-domain") {
      expect(bandWide.condition).toBe("band-not-narrow");
    }

    logger.log({
      testId: "wien-entropy-outside-domain-refusals",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Radiation entropy volume change matches logarithmic volume scaling Delta S = (E/(B*nu)) * ln(V/V0)", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 5.0e14;
    const dNu = 1.0e12; // dNu / nu = 0.002 < 0.01
    const V0 = 1.0;
    const V = 2.0;
    const E = 1e-6; // Very dilute radiation

    const res = radiationEntropyVolumeChange({ E, nu, dNu, V, V0 }, set);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      const kB = 1.380649e-23;
      const h = 6.62607015e-34;
      const B = h / kB;
      const expectedEffectiveCount = E / (B * nu);
      const expectedDeltaS = expectedEffectiveCount * Math.log(V / V0);

      expect(res.effectiveIndependentCount).toBeCloseTo(expectedEffectiveCount, 12);
      expect(res.deltaS).toBeCloseTo(expectedDeltaS, 15);
      expect(res.volumeRatio).toBe(2.0);
    }

    logger.log({
      testId: "radiation-entropy-volume-law",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Unfixed constant variant adds linear volume deviation and carries adversarial status", () => {
    const params = {
      E: 1e-6,
      nu: 5.0e14,
      dNu: 1.0e12,
      V0: 1.0,
      V: 2.0,
      C: 1e-10,
    };

    const res = entropyWithUnfixedConstant(params);
    expect(res.status).toBe("value");
    expect(res.historicalStatus).toBe("adversarial-derivation-variant");
    expect(res.extraTerm).toBeCloseTo(params.dNu * params.C * (params.V - params.V0), 15);
    expect(res.deltaSWithC).toBeCloseTo(res.deltaS + res.extraTerm, 15);

    logger.log({
      testId: "unfixed-constant-adversarial-variant",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
