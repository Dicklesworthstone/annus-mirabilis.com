/** Explicit conservative drift-diffusion stepper (BM-04). */
import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { makeRefusal, type RequestRefusal } from "../../../experiments/results/refusals.ts";
import type { ConstantSet } from "../constants.ts";
import { type Computation, REFERENCE_FTCS_BUDGET } from "./ftcs.ts";
import { DRIFT_ONLY_NO_KICKS, osmoticEquilibriumProfile } from "./routeA.ts";

export type DriftProfile = "uniform" | "step" | "equilibrium" | "spike" | 0 | 1 | 2;

export type DriftDiffusionParameters = Readonly<{
  cells: number;
  width: number;
  frames: number;
  stepsPerFrame: number;
  dt: number;
  kickDiffusivity: number;
  mobility: number;
  force: number;
  temperature: number;
  profile: DriftProfile;
  set: ConstantSet;
}>;

export type FaceFlux = Readonly<{ total: number; drift: number; diffusion: number }>;

export type DriftDiffusionFrames = Readonly<{
  values: Float64Array;
  shape: readonly [number, number];
  dx: number;
  peclet: number;
  sigma: number;
  driftVelocity: number;
  faceFlux: readonly FaceFlux[];
  boundary: "zero-flux";
  ownerId: "diffusion.driftDiffusionFrames1d";
  modelIdentity: string;
}>;

function integer(v: number, min = 0): boolean {
  return Number.isSafeInteger(v) && v >= min;
}

function bernoulli(z: number): number {
  if (z === 0) return 1;
  const az = Math.abs(z);
  if (az < 1e-3) {
    const z2 = z * z;
    return 1 - z / 2 + z2 / 12 - (z2 * z2) / 720;
  }
  return z / Math.expm1(z);
}

function peCothHalf(pe: number): number {
  if (Math.abs(pe) < 1e-8) return 2 + (pe * pe) / 6;
  return (pe * (Math.exp(pe) + 1)) / Math.expm1(pe);
}

function invalid(parameterIds: readonly string[], details: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { parameterIds },
      { details: { requirements: details } },
    ),
  };
}

export function driftDiffusionFrames1d(
  p: DriftDiffusionParameters,
  budget = REFERENCE_FTCS_BUDGET,
): Computation<DriftDiffusionFrames> {
  const {
    cells,
    width,
    frames,
    stepsPerFrame,
    dt,
    kickDiffusivity,
    mobility,
    force,
    temperature,
    profile,
    set,
  } = p;
  if (!integer(cells, 3) || !integer(frames, 1) || !integer(stepsPerFrame, 1)) {
    return invalid(
      ["cells", "frames", "stepsPerFrame"],
      "Use at least three cells and positive whole-number frame and step counts.",
    );
  }
  if (
    ![width, dt, kickDiffusivity, mobility, force, temperature].every(Number.isFinite) ||
    width <= 0 ||
    dt <= 0 ||
    kickDiffusivity < 0 ||
    mobility <= 0 ||
    temperature <= 0
  ) {
    return invalid(
      ["width", "dt", "kickDiffusivity", "mobility", "force", "temperature"],
      "Use positive width, dt, mobility, and temperature, nonnegative kick diffusivity, and a finite force.",
    );
  }
  const D = kickDiffusivity;
  const u = mobility * force;
  const dx = width / cells;
  const work = cells * (frames - 1) * stepsPerFrame;
  if (work > budget.workUnits || cells * frames * 8 > budget.allocationBytes) {
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        message: executionOutcomeRegistry["budget-exhausted"].message,
        retry: executionOutcomeRegistry["budget-exhausted"].retry,
        requested: { workUnits: work, allocationBytes: cells * frames * 8 },
        allowed: { ...budget },
      },
    };
  }
  if (D === 0) {
    const courant = (Math.abs(u) * dt) / dx;
    if (courant > 1) {
      const dtMax = dx / Math.abs(u);
      return {
        kind: "refused",
        refusal: makeRefusal(
          "drift-cfl-exceeded",
          { parameterIds: ["dt", "force"], capabilityId: "diffusion.driftDiffusionFrames1d" },
          {
            details: { courant, limit: 1, dtMax },
            rankedRepairs: [
              {
                label: "Reduce the time step to the Courant limit.",
                action: { parameterId: "dt", value: dtMax },
              },
              {
                label: "Use a coarser spatial grid.",
                action: { parameterId: "cells", value: Math.max(3, Math.floor(cells / 2)) },
              },
              { label: "Use a weaker force.", action: { parameterId: "force", value: force / 2 } },
            ],
          },
        ),
      };
    }
  } else {
    const pe = (u * dx) / D;
    const sigma = ((D * dt) / (dx * dx)) * peCothHalf(pe);
    if (sigma > 1) {
      const dtMax = (dx * dx) / (D * peCothHalf(pe));
      return {
        kind: "refused",
        refusal: makeRefusal(
          "drift-diffusion-unstable",
          { parameterIds: ["dt"], capabilityId: "diffusion.driftDiffusionFrames1d" },
          {
            details: { ratio: sigma, limit: 1, dtMax },
            rankedRepairs: [
              {
                label: "Reduce the time step to the explicit scheme's positivity limit.",
                action: { parameterId: "dt", value: dtMax },
              },
              {
                label: "Use a coarser spatial grid.",
                action: { parameterId: "cells", value: Math.max(3, Math.floor(cells / 2)) },
              },
            ],
          },
        ),
      };
    }
  }
  const field = initialProfile(cells, dx, width, D, u, force, temperature, profile, set);
  if (!field) return invalid(["profile"], "Unknown initial profile.");
  const values = new Float64Array(cells * frames);
  values.set(field);
  let faces: FaceFlux[] = Array.from({ length: cells + 1 }, () => ({
    total: 0,
    drift: 0,
    diffusion: 0,
  }));
  for (let frame = 1; frame < frames; frame++) {
    for (let s = 0; s < stepsPerFrame; s++) {
      const step = advance(field, dx, dt, D, u);
      if (step.kind === "refused") return step;
      faces = step.faces;
    }
    values.set(field, frame * cells);
  }
  const pe = D === 0 ? (u === 0 ? 0 : Number.POSITIVE_INFINITY) : (u * dx) / D;
  const sigma = D === 0 ? (Math.abs(u) * dt) / dx : ((D * dt) / (dx * dx)) * peCothHalf(pe);
  return {
    kind: "accepted",
    data: Object.freeze({
      values,
      shape: Object.freeze([frames, cells] as const),
      dx,
      peclet: pe,
      sigma,
      driftVelocity: u,
      faceFlux: Object.freeze(faces),
      boundary: "zero-flux",
      ownerId: "diffusion.driftDiffusionFrames1d",
      modelIdentity: D === 0 ? DRIFT_ONLY_NO_KICKS : "drift-diffusion",
    }),
  };
}

function initialProfile(
  cells: number,
  dx: number,
  width: number,
  D: number,
  u: number,
  force: number,
  temperature: number,
  profile: DriftProfile,
  set: ConstantSet,
): Float64Array | null {
  const field = new Float64Array(cells);
  if (profile === "uniform") field.fill(1);
  else if (profile === "spike" || profile === 0) field[Math.floor(cells / 2)] = 1 / dx;
  else if (profile === "step" || profile === 1) field.fill(1, 0, Math.floor(cells / 2));
  else if (profile === 2) {
    field[Math.floor(cells / 4)] = 0.5 / dx;
    field[Math.floor((3 * cells) / 4)] = 0.5 / dx;
  } else if (profile === "equilibrium") {
    if (D > 0) {
      const pe = (u * dx) / D;
      let mass = 0;
      for (let i = 0; i < cells; i++) {
        const density = Math.exp(pe * (i + 0.5));
        field[i] = density;
        mass += density;
      }
      if (mass > 0) {
        const scale = mass * dx;
        for (let i = 0; i < cells; i++) {
          const current = field[i];
          if (current !== undefined) field[i] = current / scale;
        }
      }
    } else {
      const total = 1;
      for (let i = 0; i < cells; i++) {
        const x = (i + 0.5) * dx;
        const n = osmoticEquilibriumProfile(x, width, force, temperature, total, set);
        if (n.result.status !== "value") return null;
        field[i] = n.result.value as number;
      }
    }
  } else return null;
  return field;
}

function advance(
  field: Float64Array,
  dx: number,
  dt: number,
  D: number,
  u: number,
): { kind: "accepted"; faces: FaceFlux[] } | { kind: "refused"; refusal: RequestRefusal } {
  const n = field.length;
  const faces: FaceFlux[] = Array.from({ length: n + 1 }, () => ({
    total: 0,
    drift: 0,
    diffusion: 0,
  }));
  faces[0] = { total: 0, drift: 0, diffusion: 0 };
  faces[n] = { total: 0, drift: 0, diffusion: 0 };
  const at = (arr: Float64Array, i: number): number => arr[i] ?? 0;
  if (D === 0) {
    for (let i = 0; i < n - 1; i++) {
      const total = u >= 0 ? u * at(field, i) : u * at(field, i + 1);
      faces[i + 1] = { total, drift: total, diffusion: 0 };
    }
  } else {
    const pe = (u * dx) / D;
    const bp = bernoulli(pe);
    const bm = bernoulli(-pe);
    const coeff = D / dx;
    for (let i = 0; i < n - 1; i++) {
      const ni = at(field, i);
      const nj = at(field, i + 1);
      const total = coeff * (bm * ni - bp * nj);
      const drift = (u * (ni + nj)) / 2;
      faces[i + 1] = { total, drift, diffusion: total - drift };
    }
  }
  const next = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const jR = faces[i + 1]?.total ?? 0;
    const jL = faces[i]?.total ?? 0;
    const updated = at(field, i) - (dt / dx) * (jR - jL);
    if (!Number.isFinite(updated) || updated < -1e-15) {
      return {
        kind: "refused",
        refusal: makeRefusal(
          "drift-diffusion-unstable",
          { parameterIds: ["dt"] },
          { details: { reason: "A cell became negative; no partial field is returned." } },
        ),
      };
    }
    next[i] = Math.max(0, updated);
  }
  field.set(next);
  return { kind: "accepted", faces };
}
