import { describe, expect, test } from "bun:test";
import { getConstantSet, thermalConstant } from "../physics/reference/constants.ts";
import { driftDiffusionFrames1d } from "../physics/reference/diffusion/driftDiffusion.ts";
import {
  decayLengths,
  equilibriumBalance,
  stokesMobility,
} from "../physics/reference/diffusion/routeA.ts";

describe("bm04.reference: BM-04 drift-diffusion balance reference physics", () => {
  const set = getConstantSet("modern-si-2019");
  const kB = thermalConstant(set).value;
  const T = 293.15;
  const kT = kB * T;
  const eta = 0.001; // Pa.s
  const a = 0.5e-6; // 0.5 um
  const mu = 1 / (6 * Math.PI * eta * a); // Stokes mobility ~ 1.06103e8 s/kg
  const D_thermal = mu * kT;

  test("default force and drift produce 1 um osmotic decay length", () => {
    const F = kT / 1e-6; // Force that gives 1 um decay length
    const mob = stokesMobility(eta, a);
    expect(mob.result.status).toBe("value");
    if (mob.result.status === "value") {
      expect(mob.result.value).toBeCloseTo(mu, 6);
    }
    const decays = decayLengths(
      { force: F, temperature: T, kickDiffusivity: D_thermal, mobility: mu },
      set,
    );
    expect(decays.osmotic.result.status).toBe("value");
    expect(decays.kinetic.result.status).toBe("value");
    if (decays.osmotic.result.status === "value" && decays.kinetic.result.status === "value") {
      expect(decays.osmotic.result.value).toBeCloseTo(1e-6, 12);
      expect(decays.kinetic.result.value).toBeCloseTo(1e-6, 12);
      expect(decays.kickStrength).toBeCloseTo(1.0, 9);
    }
  });

  test("force sweep at m=1 recovers D_balance = D_mobility within 10^-9", () => {
    const forces = [1e-15, 4.047373e-15, 1e-14, -1e-15, -4.047373e-15, -1e-14];
    for (const force of forces) {
      const balance = equilibriumBalance(
        { force, temperature: T, eta, a, kickDiffusivity: D_thermal },
        set,
      );
      expect(balance).toHaveProperty("agree");
      if ("agree" in balance) {
        expect(balance.agree).toBe(true);
        expect(balance.kickStrength).toBeCloseTo(1.0, 9);
        if (
          balance.balanceD.result.status === "value" &&
          balance.mobilityD.result.status === "value"
        ) {
          expect(balance.balanceD.result.value).toBeCloseTo(
            balance.mobilityD.result.value as number,
            9,
          );
        }
      }
    }
  });

  test("kick strength sweep scales kinetic decay length and balance D proportionally", () => {
    const F = 4.047373e-15;
    const multipliers = [0.25, 0.5, 2, 4];
    for (const m of multipliers) {
      const D_kick = m * D_thermal;
      const decays = decayLengths(
        { force: F, temperature: T, kickDiffusivity: D_kick, mobility: mu },
        set,
      );
      if (decays.osmotic.result.status === "value" && decays.kinetic.result.status === "value") {
        const lambdaOsm = decays.osmotic.result.value as number;
        const lambdaKin = decays.kinetic.result.value as number;
        expect(lambdaKin / lambdaOsm).toBeCloseTo(m, 9);
        expect(decays.kickStrength).toBeCloseTo(m, 9);
      }
      const balance = equilibriumBalance(
        { force: F, temperature: T, eta, a, kickDiffusivity: D_kick },
        set,
      );
      if ("balanceD" in balance && balance.balanceD.result.status === "value") {
        expect(balance.balanceD.result.value as number).toBeCloseTo(m * D_thermal, 9);
      }
    }
  });

  test("Scharfetter-Gummel exactness: node ratio matches exp(Pe) within 10^-12", () => {
    const PEs = [0.1, 0.2, 0.5, 1.0, 2.0];
    const width = 10e-6;
    const cells = 50;
    const dx = width / cells;

    for (const pe of PEs) {
      // Choose u and D such that u * dx / D = pe
      const D = 1e-12;
      const u = (pe * D) / dx;
      const force = u / mu;

      const res = driftDiffusionFrames1d({
        cells,
        width,
        frames: 2,
        stepsPerFrame: 1,
        dt: 1e-6,
        kickDiffusivity: D,
        mobility: mu,
        force,
        temperature: T,
        profile: "equilibrium",
        set,
      });

      expect(res.kind).toBe("accepted");
      if (res.kind === "accepted") {
        const values = res.data.values;
        // Check adjacent cell ratios of the equilibrium state (frame 0)
        for (let i = 0; i < cells - 1; i++) {
          const vNext = values[i + 1] ?? 0;
          const vCurr = values[i] ?? 1;
          const ratio = vNext / vCurr;
          const expectedRatio = Math.exp(pe);
          expect(Math.abs(ratio - expectedRatio) / expectedRatio).toBeLessThan(1e-10);
        }
      }
    }
  });

  test("equilibrium start produces negligible face fluxes", () => {
    const width = 10e-6;
    const cells = 30;
    const F = 4e-15;
    const u = mu * F;

    const res = driftDiffusionFrames1d({
      cells,
      width,
      frames: 2,
      stepsPerFrame: 1,
      dt: 1e-7,
      kickDiffusivity: D_thermal,
      mobility: mu,
      force: F,
      temperature: T,
      profile: "equilibrium",
      set,
    });

    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const maxN = Math.max(...res.data.values);
      const maxFlux = Math.max(...res.data.faceFlux.map((f) => Math.abs(f.total)));
      // Flux should be extremely small compared to scale u * maxN
      expect(maxFlux).toBeLessThan(1e-8 * u * maxN);
    }
  });

  test("mass is strictly conserved to 10^-12 relative over multiple steps", () => {
    const width = 10e-6;
    const cells = 40;
    const dx = width / cells;
    const F = 2e-15;

    const res = driftDiffusionFrames1d({
      cells,
      width,
      frames: 10,
      stepsPerFrame: 10,
      dt: 1e-7,
      kickDiffusivity: D_thermal,
      mobility: mu,
      force: F,
      temperature: T,
      profile: "step",
      set,
    });

    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const initialMass = res.data.values.slice(0, cells).reduce((acc, v) => acc + v * dx, 0);
      for (let f = 1; f < 10; f++) {
        const frameMass = res.data.values
          .slice(f * cells, (f + 1) * cells)
          .reduce((acc, v) => acc + v * dx, 0);
        expect(Math.abs(frameMass - initialMass) / initialMass).toBeLessThan(1e-12);
      }
    }
  });

  test("positivity limit refusal for drift-diffusion-unstable", () => {
    const width = 10e-6;
    const cells = 100; // Small dx makes positivity condition tighter
    const dtTooLarge = 1.0; // Large dt

    const res = driftDiffusionFrames1d({
      cells,
      width,
      frames: 2,
      stepsPerFrame: 1,
      dt: dtTooLarge,
      kickDiffusivity: D_thermal,
      mobility: mu,
      force: 4e-15,
      temperature: T,
      profile: "uniform",
      set,
    });

    expect(res.kind).toBe("refused");
    if (res.kind === "refused") {
      expect(res.refusal.code).toBe("drift-diffusion-unstable");
      expect(res.refusal.details).toHaveProperty("dtMax");
      expect(res.refusal.details?.dtMax).toBeLessThan(dtTooLarge);
    }
  });

  test("kicks-off (D=0) CFL refusal when Courant > 1", () => {
    const width = 10e-6;
    const cells = 100;
    const dx = width / cells;
    const F = 1e-13; // Strong force gives high drift velocity u
    const u = mu * F;
    const dtCfl = (2.0 * dx) / u; // Courant = 2 > 1

    const res = driftDiffusionFrames1d({
      cells,
      width,
      frames: 2,
      stepsPerFrame: 1,
      dt: dtCfl,
      kickDiffusivity: 0,
      mobility: mu,
      force: F,
      temperature: T,
      profile: "step",
      set,
    });

    expect(res.kind).toBe("refused");
    if (res.kind === "refused") {
      expect(res.refusal.code).toBe("drift-cfl-exceeded");
      expect(res.refusal.details).toHaveProperty("dtMax");
    }
  });

  test("kicks-off (m=0, D=0) advects toward boundary without diffusing", () => {
    const width = 10e-6;
    const cells = 50;
    const dx = width / cells;
    const F = 5e-15;
    const u = mu * F;
    const dt = (0.5 * dx) / u; // Courant = 0.5 < 1

    const res = driftDiffusionFrames1d({
      cells,
      width,
      frames: 5,
      stepsPerFrame: 20,
      dt,
      kickDiffusivity: 0,
      mobility: mu,
      force: F,
      temperature: T,
      profile: "step",
      set,
    });

    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const firstFrame = res.data.values.slice(0, cells);
      const lastFrame = res.data.values.slice(4 * cells, 5 * cells);
      // Under positive force, mass moves to the right wall (higher cell index)
      const initialRightMass = firstFrame.slice(cells / 2).reduce((a, b) => a + b, 0);
      const finalRightMass = lastFrame.slice(cells / 2).reduce((a, b) => a + b, 0);
      expect(finalRightMass).toBeGreaterThan(initialRightMass);
    }
  });

  test("zero-force handles decay lengths and balance quotient as not-applicable with symbolic relation", () => {
    const decays = decayLengths(
      { force: 0, temperature: T, kickDiffusivity: D_thermal, mobility: mu },
      set,
    );
    expect(decays.osmotic.result.status).toBe("not-applicable");
    expect(decays.kinetic.result.status).toBe("not-applicable");
    expect(decays.kickStrength).toBeNull();

    const balance = equilibriumBalance(
      { force: 0, temperature: T, eta, a, kickDiffusivity: D_thermal },
      set,
    );
    if ("balanceD" in balance) {
      expect(balance.balanceD.result.status).toBe("not-applicable");
      expect(balance.relation.status).toBe("symbolic");
      expect(balance.agree).toBeNull();
      expect(balance.kickStrength).toBeCloseTo(1.0, 9);
    }
  });
});
