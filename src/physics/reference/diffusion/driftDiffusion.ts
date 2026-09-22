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

/** SG transport speeds without exp(Pe) overflow or an infinity-times-zero product. */
function transportSpeeds(D: number, u: number, dx: number) {
  if (D === 0) return { right: Math.max(u, 0), left: Math.max(-u, 0) };
  const diffusionSpeed = D / dx;
  const speed = Math.abs(u);
  const z = speed / diffusionSpeed;
  let againstDrift: number;
  if (speed === 0) againstDrift = diffusionSpeed;
  else if (z < 1e-3) {
    const z2 = z * z;
    againstDrift = diffusionSpeed * (1 - z / 2 + z2 / 12 - (z2 * z2) / 720);
  } else if (z > 50) {
    const tail = Math.exp(-z);
    againstDrift = (speed * tail) / (1 - tail);
  } else againstDrift = speed / Math.expm1(z);
  return u >= 0
    ? { right: speed + againstDrift, left: againstDrift }
    : { right: againstDrift, left: speed + againstDrift };
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
  if (!Number.isFinite(u) || !Number.isFinite(1 / dx) || dx <= 0) {
    return invalid(
      ["width", "cells", "mobility", "force"],
      "The drift speed and cell scale must be representable.",
    );
  }
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
  const speeds = transportSpeeds(D, u, dx);
  const rate = (speeds.right + speeds.left) / dx;
  const sigma = dt * rate;
  if (!Number.isFinite(rate) || !Number.isFinite(sigma)) {
    return invalid(
      ["dt", "width", "kickDiffusivity", "force"],
      "The explicit transport rate must be finite.",
    );
  }
  if (sigma > 1) {
    const dtMax = 1 / rate;
    const driftOnly = D === 0;
    return {
      kind: "refused",
      refusal: makeRefusal(
        driftOnly ? "drift-cfl-exceeded" : "drift-diffusion-unstable",
        {
          parameterIds: driftOnly ? ["dt", "force"] : ["dt"],
          capabilityId: "diffusion.driftDiffusionFrames1d",
        },
        {
          details: driftOnly
            ? { courant: sigma, limit: 1, dtMax }
            : { ratio: sigma, limit: 1, dtMax },
          rankedRepairs: [
            {
              label: "Reduce the time step to the explicit scheme's positivity limit.",
              action: { parameterId: "dt", value: dtMax },
            },
            {
              label: "Use a coarser spatial grid.",
              action: { parameterId: "cells", value: Math.max(3, Math.floor(cells / 2)) },
            },
            ...(driftOnly
              ? [
                  {
                    label: "Use a weaker force.",
                    action: { parameterId: "force", value: force / 2 },
                  },
                ]
              : []),
          ],
        },
      ),
    };
  }
  const field = initialProfile(cells, dx, width, D, u, force, temperature, profile, set);
  if (!field) {
    return invalid(
      ["profile"],
      "The initial profile must have a finite, positive, representable mass.",
    );
  }
  const values = new Float64Array(cells * frames);
  values.set(field);
  // Reuse numerical buffers. Face objects are needed only for the accepted final frame.
  const flux = new Float64Array(cells + 1);
  const next = new Float64Array(cells);
  for (let frame = 1; frame < frames; frame++) {
    for (let s = 0; s < stepsPerFrame; s++) {
      const step = advance(field, flux, next, dx, dt, speeds);
      if (step.kind === "refused") return step;
    }
    values.set(field, frame * cells);
  }
  const pe = D === 0 ? (u === 0 ? 0 : Math.sign(u) * Number.POSITIVE_INFINITY) : u / (D / dx);
  return {
    kind: "accepted",
    data: Object.freeze({
      values,
      shape: Object.freeze([frames, cells] as const),
      dx,
      peclet: pe,
      sigma,
      driftVelocity: u,
      // Diagnostics describe this frame, not the field before its last time step.
      faceFlux: Object.freeze(faceFlux(field, speeds, D, u)),
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
  else if (profile === "spike" || profile === 0) field[Math.floor(cells / 2)] = 1;
  else if (profile === "step" || profile === 1) field.fill(1, 0, Math.floor(cells / 2));
  else if (profile === 2) {
    field[Math.floor(cells / 4)] = 0.5;
    field[Math.floor((3 * cells) / 4)] = 0.5;
  } else if (profile === "equilibrium") {
    if (D > 0) {
      const pe = u / (D / dx);
      // Subtract the largest log weight before exponentiating. This also handles
      // a grid Peclet number beyond binary64 as a wall-supported limiting profile.
      for (let i = 0; i < cells; i++) {
        const offset = u >= 0 ? i - (cells - 1) : i;
        field[i] = offset === 0 ? 1 : Math.exp(pe * offset);
      }
    } else {
      for (let i = 0; i < cells; i++) {
        const x = (i + 0.5) * dx;
        const n = osmoticEquilibriumProfile(x, width, force, temperature, 1, set);
        if (n.result.status !== "value" || typeof n.result.value !== "number") return null;
        field[i] = n.result.value;
      }
    }
  } else return null;
  // Every selectable profile is a coordinate probability density. Comparing a
  // unit-height step with a unit-mass reference would change the particle count.
  let weight = 0;
  for (const density of field) {
    if (!Number.isFinite(density) || density < 0) return null;
    weight += density;
  }
  if (!(weight > 0) || !Number.isFinite(weight)) return null;
  for (let i = 0; i < cells; i++) {
    const density = (field[i] ?? 0) / weight / dx;
    if (!Number.isFinite(density)) return null;
    field[i] = density;
  }
  return field;
}

type TransportSpeeds = ReturnType<typeof transportSpeeds>;

function faceFlux(field: Float64Array, speeds: TransportSpeeds, D: number, u: number): FaceFlux[] {
  const faces: FaceFlux[] = Array.from({ length: field.length + 1 }, () => ({
    total: 0,
    drift: 0,
    diffusion: 0,
  }));
  for (let i = 0; i < field.length - 1; i++) {
    const ni = field[i] ?? 0;
    const nj = field[i + 1] ?? 0;
    const total = speeds.right * ni - speeds.left * nj;
    const drift = D === 0 ? total : u * (ni / 2 + nj / 2);
    faces[i + 1] = { total, drift, diffusion: total - drift };
  }
  return faces;
}

function advance(
  field: Float64Array,
  flux: Float64Array,
  next: Float64Array,
  dx: number,
  dt: number,
  speeds: TransportSpeeds,
): { kind: "accepted" } | { kind: "refused"; refusal: RequestRefusal } {
  for (let i = 0; i < field.length - 1; i++) {
    flux[i + 1] = speeds.right * (field[i] ?? 0) - speeds.left * (field[i + 1] ?? 0);
  }
  for (let i = 0; i < field.length; i++) {
    const updated = (field[i] ?? 0) - (dt / dx) * ((flux[i + 1] ?? 0) - (flux[i] ?? 0));
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
  return { kind: "accepted" };
}
