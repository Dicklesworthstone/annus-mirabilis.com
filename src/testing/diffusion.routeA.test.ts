import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  CLASSICAL_SUSPENDED_BODIES,
  configurationFactorRatio,
  configurationVolumeTerm,
  decayLengths,
  driftDiffusionFlux,
  driftVelocity,
  equilibriumBalance,
  equilibriumProfile,
  osmoticPressure,
  osmoticPressureClassicalExpectation,
  stokesMobility,
} from "../physics/reference/diffusion.ts";

const modern = getConstantSet("modern-si-2019");
const k = modern.entries.find((e) => e.quantityId === "boltzmannConstant")?.value ?? 0;

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

describe("route A", () => {
  test("osmotic pressure n=1e18 at 293.15 K is 4.04737e-3 Pa, matching the molar form", () => {
    const Pi = val(osmoticPressure({ n: 1e18, T: 293.15 }, modern));
    expect(Pi).toBeCloseTo(4.04737e-3, 8);
    const R = modern.entries.find((e) => e.quantityId === "molarGasConstant")?.value ?? 0;
    const N = modern.entries.find((e) => e.quantityId === "avogadroConstant")?.value ?? 0;
    expect(Math.abs(Pi / ((1e18 / N) * R * 293.15) - 1)).toBeLessThan(1e-12);
  });

  test("classical expectation is labeled zero, not a refutation", () => {
    const r = osmoticPressureClassicalExpectation();
    expect(val(r)).toBe(0);
    expect(r.modelIdentity).toBe(CLASSICAL_SUSPENDED_BODIES);
    expect(r.modelNote?.includes("Perrin")).toBe(true);
    expect(r.modelNote?.includes("labeled alternative")).toBe(true);
  });

  test("configuration Np=2, V/V0=2 gives factor 4 and Delta F = -2 kT ln 2", () => {
    const ratio = configurationFactorRatio(2, "2");
    expect("decimal" in ratio && ratio.decimal === "4").toBe(true);
    const term = configurationVolumeTerm({ Np: 2, V: 2, V0: 1, T: 293.15 }, modern);
    expect("deltaF" in term).toBe(true);
    if ("deltaF" in term) {
      expect(val(term.deltaF)).toBeCloseTo(-2 * k * 293.15 * Math.log(2), 8);
      expect(term.volumeIndependentFactor.status).toBe("symbolic");
      expect(term.freeEnergyOffset.status).toBe("symbolic");
    }
  });

  test("Np=1e6 configuration does not overflow", () => {
    const ratio = configurationFactorRatio(1_000_000, "2");
    expect("ln" in ratio).toBe(true);
    if ("ln" in ratio) expect(Number.isFinite(ratio.ln)).toBe(true);
  });

  test("mobility and flux parts", () => {
    const mu = val(stokesMobility(0.001, 0.5e-6));
    expect(mu).toBeGreaterThan(0);
    expect(val(driftVelocity(mu, 1e-15))).toBeCloseTo(mu * 1e-15, 12);
    const flux = driftDiffusionFlux(1e18, 0, 1e-15, mu, 4e-13);
    expect("drift" in flux).toBe(true);
    if ("drift" in flux) {
      expect(val(flux.diffusion)).toBeCloseTo(0, 15);
      expect(val(flux.drift)).toBeCloseTo(1e18 * mu * 1e-15, 6);
    }
  });

  test("unnormalized equilibrium profile and exponent refusal", () => {
    const kT = k * 293.15;
    const F = kT / 1e-6;
    const n = equilibriumProfile({ n0: 1, F, T: 293.15, x: 1e-6 }, modern);
    expect(val(n)).toBeCloseTo(Math.E, 10);
    const huge = equilibriumProfile({ n0: 1, F, T: 293.15, x: 1 }, modern);
    expect(huge.result.status).toBe("outside-domain");
  });

  test("decay lengths and balance at m=1 and off-unity", () => {
    const F = (k * 293.15) / 1e-6;
    const eta = 0.001;
    const a = 0.5e-6;
    const mu = val(stokesMobility(eta, a));
    const Dmob = mu * k * 293.15;
    const lengths = decayLengths(
      { force: F, temperature: 293.15, kickDiffusivity: Dmob, mobility: mu },
      modern,
    );
    expect(val(lengths.osmotic)).toBeCloseTo(1e-6, 12);
    expect(lengths.kickStrength).toBeCloseTo(1, 12);
    const bal = equilibriumBalance(
      { force: F, temperature: 293.15, eta, a, kickDiffusivity: Dmob },
      modern,
    );
    expect("agree" in bal).toBe(true);
    if ("agree" in bal) {
      expect(bal.agree).toBe(true);
      expect(val(bal.mobilityD)).toBeCloseTo(Dmob, 10);
      expect(val(bal.balanceD)).toBeCloseTo(Dmob, 10);
      expect(bal.relation.status).toBe("symbolic");
    }
    for (const m of [0.25, 0.5, 2, 4]) {
      const d = decayLengths(
        { force: F, temperature: 293.15, kickDiffusivity: m * Dmob, mobility: mu },
        modern,
      );
      expect(d.kickStrength).toBeCloseTo(m, 10);
      expect(val(d.kinetic) / val(d.osmotic)).toBeCloseTo(m, 8);
    }
    const zero = equilibriumBalance(
      { force: 0, temperature: 293.15, eta, a, kickDiffusivity: Dmob },
      modern,
    );
    expect("balanceD" in zero).toBe(true);
    if ("balanceD" in zero) {
      expect(zero.balanceD.result.status).toBe("not-applicable");
      expect(zero.mobilityD.result.status).toBe("value");
      expect(zero.relation.status).toBe("symbolic");
    }
  });
});
