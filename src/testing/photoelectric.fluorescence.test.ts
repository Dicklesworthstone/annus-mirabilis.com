import { describe, expect, test } from "bun:test";
import { fluorescenceBudget, fluorescenceRates } from "../physics/reference/photoelectric.ts";
import { getConstantSet } from "../physics/reference/constants.ts";

describe("LQ-07 Fluorescence Energy Budget & Rates (Paper 1, §7)", () => {
  const set = getConstantSet("modern-si-2019");

  test("golden fixture: nu1 = 850 THz gives h*nu1 = 3.515318 eV and nu2,max = 850 THz under paper assumptions", () => {
    const res = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "standard-stokes",
      set,
    });

    expect(res.status).toBe("value");
    expect(res.allowed).toBe(true);
    expect(res.e1Ev).toBeCloseTo(3.515318, 5);
    expect(res.nu2MaxHz).toBe(850e12);
    expect(res.energyDeficitEv).toBe(0);
    expect(res.eOtherEv).toBeCloseTo(0, 8);
  });

  test("golden fixture: nu2 = 900 THz is disallowed under standard assumptions with 0.206783 eV deficit", () => {
    const res = fluorescenceBudget({
      nu1: 850e12,
      nu2: 900e12,
      regime: "standard-stokes",
      set,
    });

    expect(res.status).toBe("value");
    expect(res.allowed).toBe(false);
    expect(res.e2Ev).toBeCloseTo(3.722101, 5);
    expect(res.energyDeficitEv).toBeCloseTo(0.206783, 5);
    expect(res.eOtherEv).toBe(0);
  });

  test("deviation case (1): k = 2 gives nu2,max = 1700 THz, permitting 900 THz emission", () => {
    const res = fluorescenceBudget({
      nu1: 850e12,
      nu2: 900e12,
      regime: "deviation-multi-quantum",
      multiQuantumK: 2,
      set,
    });

    expect(res.status).toBe("value");
    expect(res.allowed).toBe(true);
    expect(res.nu2MaxHz).toBe(1700e12);
    expect(res.energyDeficitEv).toBe(0);
    expect(res.eOtherEv).toBeCloseTo(2 * 3.515318 - 3.722101, 4);
  });

  test("deviation case (2): non-Wien source temperatures test Wien domain boundary", () => {
    // T_src = 20,000 K => x = 2.0397, e^-x = 0.1301 > 0.01 => outside-domain
    const res20k = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "deviation-non-wien",
      sourceTemperatureK: 20000,
      set,
    });
    expect(res20k.status).toBe("outside-domain");
    expect(res20k.refusalCode).toBe("outside-wien-domain");
    expect(res20k.wienParameterX).toBeCloseTo(2.0397, 3);
    expect(res20k.wienDeviationExpMinusX).toBeCloseTo(0.1301, 3);

    // T_src = 10,000 K => x = 4.0794, e^-x = 0.01692 > 0.01 => outside-domain
    const res10k = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "deviation-non-wien",
      sourceTemperatureK: 10000,
      set,
    });
    expect(res10k.status).toBe("outside-domain");
    expect(res10k.refusalCode).toBe("outside-wien-domain");
    expect(res10k.wienParameterX).toBeCloseTo(4.0794, 3);
    expect(res10k.wienDeviationExpMinusX).toBeCloseTo(0.01692, 3);

    // T_src = 5,800 K => x = 7.0334, e^-x = 8.82e-4 <= 0.01 => inside Wien domain
    const res5800 = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "deviation-non-wien",
      sourceTemperatureK: 5800,
      set,
    });
    expect(res5800.status).toBe("value");
    expect(res5800.allowed).toBe(true);
    expect(res5800.wienParameterX).toBeCloseTo(7.0334, 3);
    expect(res5800.wienDeviationExpMinusX).toBeCloseTo(8.82e-4, 5);
  });

  test("modern thermal allowance: n = 10, T_body = 300 K gives E_extra = 0.258520 eV and nu2,max = 912.51 THz", () => {
    const res = fluorescenceBudget({
      nu1: 850e12,
      nu2: 900e12,
      regime: "modern-thermal",
      bodyThermalDegreesN: 10,
      bodyTemperatureK: 300,
      set,
    });

    expect(res.status).toBe("value");
    expect(res.allowed).toBe(true);
    expect(res.thermalExtraEv).toBeCloseTo(0.25852, 4);
    expect(res.nu2MaxHz / 1e12).toBeCloseTo(912.51, 1);
  });

  test("light-only channel with nu2 < nu1 is disallowed (missing energy)", () => {
    const res = fluorescenceBudget({
      nu1: 850e12,
      nu2: 800e12,
      channels: "light-only",
      regime: "standard-stokes",
      set,
    });

    expect(res.allowed).toBe(false);
    expect(res.verdictReason).toContain("light-only");
  });

  test("weak-illumination rates: P_abs = 10^-6 W gives exact photon rates, linear with no threshold", () => {
    const rates = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 1e-6,
      quantumYield: 0.5,
      set,
    });

    expect(rates.status).toBe("value");
    expect(rates.absorbedRatePerSecond).toBeCloseTo(1.775518e12, -7);
    expect(rates.emittedRatePerSecond).toBeCloseTo(8.877589e11, -7);
    expect(rates.emittedRatePerSecond / rates.absorbedRatePerSecond).toBe(0.5);

    // Half power => half rates
    const halfRates = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 0.5e-6,
      quantumYield: 0.5,
      set,
    });
    expect(halfRates.absorbedRatePerSecond).toBeCloseTo(rates.absorbedRatePerSecond / 2, -6);
    expect(halfRates.emittedRatePerSecond).toBeCloseTo(rates.emittedRatePerSecond / 2, -6);

    // Extremely low power (10^-12 W) maintains same ratio 0.5 (no threshold)
    const lowRates = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 1e-12,
      quantumYield: 0.5,
      set,
    });
    expect(lowRates.absorbedRatePerSecond).toBeCloseTo(1.775518e6, -2);
    expect(lowRates.emittedRatePerSecond / lowRates.absorbedRatePerSecond).toBe(0.5);
  });

  test("rates are not-applicable in multi-quantum deviation regime", () => {
    const rates = fluorescenceRates({
      nu1: 850e12,
      nu2: 900e12,
      absorbedPowerWatts: 1e-6,
      quantumYield: 0.5,
      regime: "deviation-multi-quantum",
      set,
    });

    expect(rates.status).toBe("not-applicable");
  });
});
