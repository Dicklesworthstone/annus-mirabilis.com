import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  DRIFT_ONLY_NO_KICKS,
  decayLengths,
  driftDiffusionFrames1d,
  equilibriumBalance,
  ftcs1d,
  osmoticEquilibriumProfile,
  stokesMobility,
} from "../physics/reference/diffusion.ts";

const modern = getConstantSet("modern-si-2019");
const k = modern.entries.find((e) => e.quantityId === "boltzmannConstant")?.value ?? 0;

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

function peCothHalf(pe: number): number {
  if (Math.abs(pe) < 1e-8) return 2 + (pe * pe) / 6;
  return (pe * (Math.exp(pe) + 1)) / Math.expm1(pe);
}

describe("drift-diffusion stepper (BM-04)", () => {
  const D = 0.4294396;
  const dx = 0.1;
  const pe = 0.1;

  test("at dx=0.1 um and Pe=0.1, dtMax is 0.0116334 s; sigma=1.0000001 is refused", () => {
    const dtMax = (dx * dx) / (D * peCothHalf(pe));
    const rLimit = 1 / peCothHalf(pe);
    expect(rLimit).toBeCloseTo(0.4995837, 6);
    expect(dtMax).toBeCloseTo(0.0116334, 6);
    const out = driftDiffusionFrames1d({
      cells: 20,
      width: 2,
      frames: 2,
      stepsPerFrame: 1,
      dt: dtMax * 1.0000001,
      kickDiffusivity: D,
      mobility: 1,
      force: (pe * D) / dx,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(out.kind).toBe("refused");
    if (out.kind !== "refused") return;
    expect(out.refusal.code).toBe("drift-diffusion-unstable");
    expect(out.refusal.details?.limit).toBe(1);
    expect(out.refusal.details?.ratio).toBeGreaterThan(1);
    expect(out.refusal.details?.dtMax).toBeCloseTo(dtMax, 10);
    expect(out.refusal.rankedRepairs[0]?.action?.parameterId).toBe("dt");
  });

  test("sigma=1 is accepted and nonnegative", () => {
    const dt = (dx * dx) / (D * peCothHalf(pe));
    const out = driftDiffusionFrames1d({
      cells: 20,
      width: 2,
      frames: 3,
      stepsPerFrame: 4,
      dt,
      kickDiffusivity: D,
      mobility: 1,
      force: (pe * D) / dx,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(out.kind).toBe("accepted");
    if (out.kind !== "accepted") return;
    expect(out.data.values.every((v) => v >= 0)).toBe(true);
    expect(out.data.sigma).toBeCloseTo(1, 10);
  });

  test("D=0 Courant 1 accepted and 1.0000001 is drift-cfl-exceeded", () => {
    const dtMax = 0.2328616;
    const ok = driftDiffusionFrames1d({
      cells: 20,
      width: 2,
      frames: 2,
      stepsPerFrame: 1,
      dt: dtMax,
      kickDiffusivity: 0,
      mobility: 1,
      force: dx / dtMax,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(ok.kind).toBe("accepted");
    if (ok.kind === "accepted") expect(ok.data.modelIdentity).toBe(DRIFT_ONLY_NO_KICKS);
    const bad = driftDiffusionFrames1d({
      cells: 20,
      width: 2,
      frames: 2,
      stepsPerFrame: 1,
      dt: dtMax * 1.0000001,
      kickDiffusivity: 0,
      mobility: 1,
      force: dx / dtMax,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(bad.kind).toBe("refused");
    if (bad.kind !== "refused") return;
    expect(bad.refusal.code).toBe("drift-cfl-exceeded");
    expect(bad.refusal.details?.limit).toBe(1);
    expect(bad.refusal.details?.courant).toBeGreaterThan(1);
    expect(bad.refusal.details?.dtMax).toBeCloseTo(dtMax, 6);
    expect(bad.refusal.rankedRepairs.at(-1)?.label.toLowerCase().includes("force")).toBe(true);
  });

  test("u=0 matches ftcs1d within 1e-14 relative", () => {
    const dt = 0.001;
    const n = 21;
    const w = n * 0.1;
    const sg = driftDiffusionFrames1d({
      cells: n,
      width: w,
      frames: 3,
      stepsPerFrame: 2,
      dt,
      kickDiffusivity: D,
      mobility: 1,
      force: 0,
      temperature: 293.15,
      profile: "spike",
      set: modern,
    });
    const ft = ftcs1d({ n, frames: 3, stepsPerFrame: 2, D, dx: 0.1, dt, profile: 0 });
    expect(sg.kind).toBe("accepted");
    expect(ft.kind).toBe("accepted");
    if (sg.kind !== "accepted" || ft.kind !== "accepted") return;
    let max = 0;
    for (let i = 0; i < sg.data.values.length; i++) {
      const a = Math.abs(sg.data.values[i] ?? 0);
      const b = Math.abs(ft.data.values[i] ?? 0);
      const rel =
        Math.abs((sg.data.values[i] ?? 0) - (ft.data.values[i] ?? 0)) / Math.max(a, b, 1e-30);
      if (rel > max) max = rel;
    }
    expect(max).toBeLessThan(1e-14);
  });

  test("D=0 piles mass downstream; without force a step is bitwise unchanged after 1e4 steps", () => {
    const n = 16;
    const dxLoc = 0.1;
    const piled = driftDiffusionFrames1d({
      cells: n,
      width: n * dxLoc,
      frames: 40,
      stepsPerFrame: 4,
      dt: 0.05,
      kickDiffusivity: 0,
      mobility: 1,
      force: 1,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(piled.kind).toBe("accepted");
    if (piled.kind === "accepted") {
      expect(piled.data.modelIdentity).toBe(DRIFT_ONLY_NO_KICKS);
      const last = piled.data.values.subarray((piled.data.shape[0] - 1) * n);
      const mass = last.reduce((s, v) => s + v, 0);
      const right = last[n - 1] ?? 0;
      expect(right / mass).toBeGreaterThan(0.5);
    }
    const still = driftDiffusionFrames1d({
      cells: n,
      width: n * dxLoc,
      frames: 2,
      stepsPerFrame: 10_000,
      dt: 0.01,
      kickDiffusivity: 0,
      mobility: 1,
      force: 0,
      temperature: 293.15,
      profile: "step",
      set: modern,
    });
    expect(still.kind).toBe("accepted");
    if (still.kind === "accepted") {
      const first = still.data.values.subarray(0, n);
      const last = still.data.values.subarray(n);
      expect(
        Buffer.from(last.buffer, last.byteOffset, last.byteLength).equals(
          Buffer.from(first.buffer, first.byteOffset, first.byteLength),
        ),
      ).toBe(true);
    }
  });

  test("discrete equilibrium ratio equals exp(Pe) within 1e-12 after 1000 steps", () => {
    for (const peLoc of [0.1, 0.2, 0.5, 1, 2]) {
      const n = 24;
      const dxLoc = 0.1;
      const Dloc = 0.4294396;
      const uLoc = (peLoc * Dloc) / dxLoc;
      const dt = 0.001;
      const out = driftDiffusionFrames1d({
        cells: n,
        width: n * dxLoc,
        frames: 2,
        stepsPerFrame: 1000,
        dt,
        kickDiffusivity: Dloc,
        mobility: 1,
        force: uLoc,
        temperature: 293.15,
        profile: "equilibrium",
        set: modern,
      });
      expect(out.kind).toBe("accepted");
      if (out.kind !== "accepted") return;
      const last = out.data.values.subarray(n);
      const first = out.data.values.subarray(0, n);
      const mass0 = first.reduce((s, v) => s + v, 0);
      const mass1 = last.reduce((s, v) => s + v, 0);
      expect(Math.abs(mass1 / mass0 - 1)).toBeLessThan(1e-12);
      expect(last.every((v) => v >= 0)).toBe(true);
      let maxDrift = 0;
      for (let i = 0; i < n; i++) {
        const drift = Math.abs((last[i] ?? 0) - (first[i] ?? 0)) / Math.max(first[i] ?? 0, 1e-30);
        if (drift > maxDrift) maxDrift = drift;
      }
      expect(maxDrift).toBeLessThan(1e-13);
      for (let i = 0; i < n - 1; i++) {
        const ratio = (last[i + 1] ?? 0) / (last[i] ?? 1);
        expect(Math.abs(ratio / Math.exp(peLoc) - 1)).toBeLessThan(1e-12);
      }
    }
  });

  test("osmoticEquilibriumProfile matches the closed form and integrates to N_tot", () => {
    const width = 1e-6;
    const force = (k * 293.15) / 1e-6;
    const total = 1;
    const lambda = (k * 293.15) / force;
    const cdf = (x: number) => total * (Math.expm1(x / lambda) / Math.expm1(width / lambda));
    expect(cdf(width) - cdf(0)).toBeCloseTo(total, 12);
    const nMid = val(osmoticEquilibriumProfile(0.5e-6, width, force, 293.15, total, modern));
    const closed = ((total / lambda) * Math.exp(0.5e-6 / lambda)) / Math.expm1(width / lambda);
    expect(Math.abs(nMid / closed - 1)).toBeLessThan(1e-12);
    const zero = val(osmoticEquilibriumProfile(0.4e-6, width, 0, 293.15, total, modern));
    expect(zero).toBeCloseTo(total / width, 12);
  });

  test("decay lengths and balance at m=1 across forces, including zero force", () => {
    const eta = 0.001;
    const a = 0.5e-6;
    const T = 293.15;
    const mu = val(stokesMobility(eta, a));
    const Dmob = mu * k * T;
    expect(Dmob * 1e12).toBeCloseTo(0.4294396, 6);
    const F1um = (k * T) / 1e-6;
    expect(F1um * 1e15).toBeCloseTo(4.047373, 5);
    const lengths = decayLengths(
      { force: F1um, temperature: T, kickDiffusivity: Dmob, mobility: mu },
      modern,
    );
    expect(val(lengths.osmotic)).toBeCloseTo(1e-6, 12);
    for (const fN of [1, 4.05, 10, -1, -4.05, -10]) {
      const force = fN * 1e-15;
      const bal = equilibriumBalance(
        { force, temperature: T, eta, a, kickDiffusivity: Dmob },
        modern,
      );
      expect("agree" in bal).toBe(true);
      if ("agree" in bal) {
        expect(bal.agree).toBe(true);
        expect(val(bal.mobilityD)).toBeCloseTo(Dmob, 10);
        expect(val(bal.balanceD)).toBeCloseTo(Dmob, 10);
        expect(bal.relation.status).toBe("symbolic");
      }
    }
    const zero = equilibriumBalance(
      { force: 0, temperature: T, eta, a, kickDiffusivity: Dmob },
      modern,
    );
    expect("balanceD" in zero).toBe(true);
    if ("balanceD" in zero) {
      expect(zero.balanceD.result.status).toBe("not-applicable");
      expect(zero.mobilityD.result.status).toBe("value");
      expect(zero.relation.status).toBe("symbolic");
    }
    const zeroLen = decayLengths(
      { force: 0, temperature: T, kickDiffusivity: Dmob, mobility: mu },
      modern,
    );
    expect(zeroLen.osmotic.result.status).toBe("not-applicable");
    expect(zeroLen.kinetic.result.status).toBe("not-applicable");
  });

  test("transient self-convergence at r=0.05, Pe<=0.2 has observed spatial order in [1.8, 2.2]", () => {
    const Dloc = 1;
    const width = 2;
    const u = 1;
    const Tfinal = 0.02;
    const fields: Float64Array[] = [];
    for (const cells of [20, 40, 80]) {
      const dxLoc = width / cells;
      const dt = (0.05 * dxLoc * dxLoc) / Dloc;
      const peLoc = (u * dxLoc) / Dloc;
      expect(peLoc).toBeLessThanOrEqual(0.2);
      const steps = Math.round(Tfinal / dt);
      const out = driftDiffusionFrames1d({
        cells,
        width,
        frames: 2,
        stepsPerFrame: steps,
        dt,
        kickDiffusivity: Dloc,
        mobility: 1,
        force: u,
        temperature: 293.15,
        profile: "uniform",
        set: modern,
      });
      expect(out.kind).toBe("accepted");
      if (out.kind !== "accepted") return;
      fields.push(out.data.values.subarray(cells));
    }
    const restrict = (fine: Float64Array): Float64Array => {
      const coarse = new Float64Array(fine.length / 2);
      for (let i = 0; i < coarse.length; i++)
        coarse[i] = 0.5 * ((fine[2 * i] ?? 0) + (fine[2 * i + 1] ?? 0));
      return coarse;
    };
    const l2 = (a: Float64Array, b: Float64Array): number => {
      let s = 0;
      for (let i = 0; i < a.length; i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        s += d * d;
      }
      return Math.sqrt(s / a.length);
    };
    const e1 = l2(fields[0] ?? new Float64Array(), restrict(fields[1] ?? new Float64Array()));
    const e2 = l2(fields[1] ?? new Float64Array(), restrict(fields[2] ?? new Float64Array()));
    const order = Math.log2(e1 / e2);
    expect(order).toBeGreaterThanOrEqual(1.8);
    expect(order).toBeLessThanOrEqual(2.2);
  });
});
