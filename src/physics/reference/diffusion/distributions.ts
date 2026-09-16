import type { DomainKind, ScientificResult } from "../../../experiments/results/types.ts";
import { type ConstantSet, thermalConstant } from "../constants.ts";
import { erf, erfc } from "../special/erf.ts";

export const diffusionModel = Object.freeze({
  id: "free-isotropic-diffusion",
  boundary: "unbounded",
  regime: "assumed",
  assumptions: Object.freeze([
    "Independent, dilute, approximately spherical tracers in a homogeneous Newtonian liquid.",
    "Low Reynolds number and observation times long compared with momentum relaxation are assumed, not certified.",
    "No drift, walls, slip correction, anomalous diffusion, or active motion.",
  ]),
});
export type Evaluation = Readonly<{
  result: ScientificResult;
  model: typeof diffusionModel;
  constantSetId?: string;
}>;
const identities = {
  diffusionCoefficient: ["m2/s", "latent-diffusivity"],
  probabilityDensity: ["1/m", "coordinate-density"],
  intervalProbability: ["1", "probability"],
  rmsDisplacement1d: ["m", "latent-coordinate-rms"],
  meanSquareDisplacement1d: ["m2", "latent-coordinate-second-moment"],
  meanSquareDisplacement: ["m2", "latent-vector-second-moment"],
  meanRadialDistance: ["m", "latent-mean-radius"],
  rmsRadialDistance: ["m", "latent-vector-rms"],
  apparentSpeed: ["m/s", "interval-dependent-apparent-speed"],
  osmoticPressure: ["Pa", "ideal-osmotic-pressure"],
} as const;
type Quantity = keyof typeof identities;
function identity(quantityId: Quantity, owner: string, semanticKind?: string) {
  return {
    quantityId,
    unit: identities[quantityId][0],
    semanticKind: semanticKind ?? identities[quantityId][1],
    ownerId: `diffusion.${owner}`,
  };
}
function wrap(result: ScientificResult, set?: ConstantSet): Evaluation {
  return Object.freeze({
    result: Object.freeze(result),
    model: diffusionModel,
    ...(set ? { constantSetId: set.id } : {}),
  });
}
function outside(
  q: Quantity,
  owner: string,
  condition: string,
  reason: string,
  kind: DomainKind = "input",
  set?: ConstantSet,
): Evaluation {
  return wrap(
    {
      ...identity(q, owner),
      status: "outside-domain",
      condition,
      domainKind: kind,
      reason,
      boundary: {
        alternativeModel:
          kind === "numerical"
            ? "Use a rescaled or logarithmic calculation within binary64 range."
            : "Use finite inputs satisfying the stated model conditions.",
      },
    },
    set,
  );
}
function number(
  q: Quantity,
  owner: string,
  value: number,
  set?: ConstantSet,
  semantic?: string,
  positiveExpected = false,
): Evaluation {
  if (!Number.isFinite(value) || (positiveExpected && value === 0))
    return outside(
      q,
      owner,
      "binary64-range",
      "This result is outside the representable numerical range; it is not a physical zero or divergence.",
      "numerical",
      set,
    );
  return wrap({ ...identity(q, owner, semantic), status: "value", value }, set);
}
function validDt(D: number, t: number): boolean {
  return Number.isFinite(D) && Number.isFinite(t) && D >= 0 && t >= 0;
}
function pointMass(q: Quantity, owner: string): Evaluation {
  return wrap({
    ...identity(q, owner),
    status: "analytic-limit",
    description:
      "All probability is at the starting point; no finite density curve represents this state.",
    representation: { kind: "point-mass", location: 0, mass: 1 },
  });
}
function scale(D: number, t: number): number {
  return Math.SQRT2 * Math.sqrt(D) * Math.sqrt(t);
}
/** SI: temperature K, viscosity Pa s, radius m, output m2/s. No ambient constants. */
export function stokesEinsteinD(
  {
    T,
    eta,
    a,
    medium = "liquid",
  }: { T: number; eta: number; a: number; medium?: "liquid" | "gas" },
  set: ConstantSet,
): Evaluation {
  if (![T, eta, a].every((v) => Number.isFinite(v) && v > 0))
    return outside(
      "diffusionCoefficient",
      "stokesEinsteinD",
      "T > 0, eta > 0, a > 0",
      "Enter positive finite temperature, viscosity, and particle radius.",
      "input",
      set,
    );
  if (medium !== "liquid")
    return outside(
      "diffusionCoefficient",
      "stokesEinsteinD",
      "stokes-gas-medium",
      "The liquid Stokes-drag model does not include the slip correction needed in a gas.",
      "model",
      set,
    );
  const k = thermalConstant(set);
  return number(
    "diffusionCoefficient",
    "stokesEinsteinD",
    (k.value * T) / (6 * Math.PI * eta * a),
    set,
    undefined,
    true,
  );
}
export function osmoticPressure({ n, T }: { n: number; T: number }, set: ConstantSet): Evaluation {
  if (!Number.isFinite(n) || n < 0 || !Number.isFinite(T) || T <= 0)
    return outside(
      "osmoticPressure",
      "osmoticPressure",
      "n >= 0 and T > 0",
      "Use a nonnegative number density and a positive temperature.",
      "input",
      set,
    );
  return number(
    "osmoticPressure",
    "osmoticPressure",
    n * thermalConstant(set).value * T,
    set,
    undefined,
    n > 0,
  );
}
export function rmsDisplacement(D: number, t: number): Evaluation {
  if (!validDt(D, t))
    return outside(
      "rmsDisplacement1d",
      "rmsDisplacement",
      "D >= 0 and t >= 0",
      "Diffusivity and elapsed time must be finite and nonnegative.",
    );
  return number(
    "rmsDisplacement1d",
    "rmsDisplacement",
    scale(D, t),
    undefined,
    undefined,
    D > 0 && t > 0,
  );
}
export function apparentSpeed(D: number, tau: number): Evaluation {
  if (!validDt(D, tau) || tau === 0)
    return outside(
      "apparentSpeed",
      "apparentSpeed",
      "D >= 0 and tau > 0",
      "An apparent speed needs a positive observation interval.",
    );
  return number(
    "apparentSpeed",
    "apparentSpeed",
    (Math.SQRT2 * Math.sqrt(D)) / Math.sqrt(tau),
    undefined,
    undefined,
    D > 0,
  );
}
export function gaussianPropagator(x: number, t: number, D: number): Evaluation {
  if (!Number.isFinite(x) || !validDt(D, t))
    return outside(
      "probabilityDensity",
      "gaussianPropagator",
      "finite x, D >= 0, t >= 0",
      "Use finite position and nonnegative diffusivity and time.",
    );
  if (D === 0 || t === 0) return pointMass("probabilityDensity", "gaussianPropagator");
  const sigma = scale(D, t);
  const z = x / sigma;
  if (!(sigma > 0) || !Number.isFinite(sigma))
    return outside(
      "probabilityDensity",
      "gaussianPropagator",
      "representable spread",
      "The spread is outside the numerical range.",
      "numerical",
    );
  return number(
    "probabilityDensity",
    "gaussianPropagator",
    Math.exp(-Math.log(sigma) - 0.5 * Math.log(2 * Math.PI) - 0.5 * z * z),
    undefined,
    undefined,
    true,
  );
}
function tail(z: number): number {
  return z > 27 ? 0 : z < -27 ? 2 : erfc(z);
}
function central(z: number): number {
  return z > 27 ? 1 : z < -27 ? -1 : erf(z);
}
/** Closed intervals include the atom at t=0, including the interval [0,0]. */
export function intervalProbability(x1: number, x2: number, t: number, D: number): Evaluation {
  const owner = "intervalProbability";
  if (![x1, x2].every(Number.isFinite) || x1 > x2 || !validDt(D, t))
    return outside(
      "intervalProbability",
      owner,
      "x1 <= x2, D >= 0, t >= 0",
      "Use ordered finite interval endpoints and nonnegative diffusivity and time.",
    );
  if (D === 0 || t === 0) return number("intervalProbability", owner, x1 <= 0 && x2 >= 0 ? 1 : 0);
  if (x1 === x2) return number("intervalProbability", owner, 0);
  const s = 2 * Math.sqrt(D) * Math.sqrt(t);
  if (!(s > 0) || !Number.isFinite(s))
    return outside(
      "intervalProbability",
      owner,
      "representable spread",
      "The spread is outside the numerical range.",
      "numerical",
    );
  const lo = x1 / s;
  const hi = x2 / s;
  const width = (x2 - x1) / s;
  const mid = lo + width / 2;
  let p: number;
  // Very narrow intervals need direct integration, even when both tails are small.
  if (width > 0 && width * (1 + Math.abs(mid)) < 0.01) {
    const nodes = [0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363];
    const weights = [0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      const offset = (width / 2) * nodes[i]!;
      sum += weights[i]! * (Math.exp(-((mid - offset) ** 2)) + Math.exp(-((mid + offset) ** 2)));
    }
    p = (width / (2 * Math.sqrt(Math.PI))) * sum;
  } else
    p =
      lo >= 0
        ? 0.5 * (tail(lo) - tail(hi))
        : hi <= 0
          ? 0.5 * (tail(-hi) - tail(-lo))
          : 0.5 * (central(hi) - central(lo));
  if (p < 0 || p > 1)
    return outside(
      "intervalProbability",
      owner,
      "probability range",
      "Numerical evaluation did not produce an admissible probability.",
      "numerical",
    );
  return number("intervalProbability", owner, p, undefined, undefined, true);
}
function radial(r: number, t: number, D: number, d: 2 | 3): Evaluation {
  const owner = d === 2 ? "radialPropagator2d" : "radialPropagator3d";
  if (!Number.isFinite(r) || r < 0 || !validDt(D, t))
    return outside(
      "probabilityDensity",
      owner,
      "r >= 0, D >= 0, t >= 0",
      "Radius, diffusivity, and time must be finite and nonnegative.",
    );
  if (D === 0 || t === 0) return pointMass("probabilityDensity", owner);
  if (r === 0) return number("probabilityDensity", owner, 0, undefined, "radial-density");
  const sigma = scale(D, t);
  if (!(sigma > 0) || !Number.isFinite(sigma))
    return outside(
      "probabilityDensity",
      owner,
      "representable spread",
      "The spread is outside the numerical range.",
      "numerical",
    );
  const z = r / sigma;
  const logP =
    (d === 3 ? 0.5 * Math.log(2 / Math.PI) : 0) +
    (d - 1) * Math.log(z) -
    Math.log(sigma) -
    0.5 * z * z;
  return number("probabilityDensity", owner, Math.exp(logP), undefined, "radial-density", true);
}
export function radialPropagator2d(r: number, t: number, D: number): Evaluation {
  return radial(r, t, D, 2);
}
export function radialPropagator3d(r: number, t: number, D: number): Evaluation {
  return radial(r, t, D, 3);
}
export function moments(
  d: number,
  D: number,
  t: number,
): Readonly<Record<"marginal" | "total" | "meanRadius" | "rmsRadius", Evaluation>> {
  const qs = {
    marginal: "meanSquareDisplacement1d",
    total: "meanSquareDisplacement",
    meanRadius: "meanRadialDistance",
    rmsRadius: "rmsRadialDistance",
  } as const;
  if (![1, 2, 3].includes(d) || !validDt(D, t)) {
    const invalid = (q: Quantity) =>
      outside(
        q,
        "moments",
        "d in {1,2,3}, D >= 0, t >= 0",
        "Choose one, two, or three coordinates and nonnegative diffusivity and time.",
      );
    return Object.freeze({
      marginal: invalid(qs.marginal),
      total: invalid(qs.total),
      meanRadius: invalid(qs.meanRadius),
      rmsRadius: invalid(qs.rmsRadius),
    });
  }
  const s = scale(D, t);
  const mean =
    d === 1
      ? s * Math.sqrt(2 / Math.PI)
      : d === 2
        ? s * Math.sqrt(Math.PI / 2)
        : s * 2 * Math.sqrt(2 / Math.PI);
  const make = (q: Quantity, v: number) =>
    number(q, "moments", v, undefined, undefined, D > 0 && t > 0);
  return Object.freeze({
    marginal: make(qs.marginal, s * s),
    total: make(qs.total, d * s * s),
    meanRadius: make(qs.meanRadius, mean),
    rmsRadius: make(qs.rmsRadius, Math.sqrt(d) * s),
  });
}
