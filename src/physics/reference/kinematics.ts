/**
 * Flat-spacetime kinematics owner (am-ref-kinematics-tjq).
 * Standard configuration: primed frame moves at +v along unprimed x;
 * origins coincide at t = t' = 0; axes aligned.
 *
 * Rapidity is the identifier `rapidity`. Its modern-only glyph is
 * RAPIDITY_GLYPH from the concordance fixture, never a printed paper-3 letter.
 * The ansatz transverse coefficient is `transverseScale` with glyph
 * TRANSVERSE_SCALE_GLYPH. Neither Einstein's moving-system letter nor
 * his unknown-function letter is reused here.
 *
 * Rapidity, spacetime diagrams, and the light clock are later aids
 * (Minkowski 1908 for diagrams). Interval classification is a modern
 * verification oracle, not a 1904 premise.
 */

import { classifyWithTolerance } from "../../units/tolerance.ts";
import { constantValue, getConstantSet } from "./constants.ts";
import { RAPIDITY_GLYPH, TRANSVERSE_SCALE_GLYPH } from "./kinematics/concordance.ts";
import { isMode1904, refuseModernSurface } from "./kinematics/mode1904.ts";
import {
  type BetaVector,
  type Boost,
  type CompositionReport,
  type Event,
  type IntervalReport,
  type KinematicResult,
  ok,
  outsideDomain,
  type Velocity,
} from "./kinematics/types.ts";

export {
  isMode1904,
  Mode1904GuardError,
  refuseModernSurface,
  withMode1904Guard,
} from "./kinematics/mode1904.ts";
export type {
  BetaVector,
  Boost,
  CompositionReport,
  Event,
  IntervalReport,
  KinematicResult,
  Velocity,
};
export { RAPIDITY_GLYPH, TRANSVERSE_SCALE_GLYPH };

export const OWNER_ID = "kinematics";
export const LATER_AID = Object.freeze({
  rapidity: "Minkowski 1908 geometric aid; paper 3 does not print a rapidity glyph",
  spacetimeDiagram: "Minkowski 1908",
  lightClock: "later pedagogical construction",
});

export function speedOfLightMetresPerSecond(): number {
  if (isMode1904()) refuseModernSurface("numeric speed of light");
  return constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
}

function finite(n: number): boolean {
  return Number.isFinite(n);
}

function betaFromVector(b: BetaVector): number {
  return Math.hypot(b.bx, b.by, b.bz);
}

function refuseBeta(beta: number): KinematicResult<never> | null {
  if (!finite(beta)) return outsideDomain("nonfinite-beta", "Beta must be a finite number.");
  if (Math.abs(beta) >= 1) {
    return outsideDomain(
      "superluminal-observer",
      "No inertial observer at |v| >= c. Evaluator domain is |beta| < 1.",
    );
  }
  return null;
}

/** Lorentz factor gamma = (1 - beta^2)^{-1/2}. */
export function gamma(beta: number): KinematicResult<number> {
  if (isMode1904()) refuseModernSurface("gamma");
  const bad = refuseBeta(beta);
  if (bad) return bad;
  return ok(1 / Math.sqrt(1 - beta * beta));
}

/**
 * Cancellation-free gamma - 1 = gamma^2 beta^2 / (gamma + 1).
 * Naive gamma(beta) - 1 loses digits at walking speeds.
 */
export function gammaMinusOne(beta: number): KinematicResult<number> {
  const g = gamma(beta);
  if (g.status !== "value") return g;
  const gVal = g.value;
  return ok((gVal * gVal * beta * beta) / (gVal + 1));
}

/**
 * Clock loss per coordinate second: 1 - 1/gamma = beta^2 / (1 + sqrt(1 - beta^2)).
 * printedSecondOrder is (1/2) beta^2.
 */
export function dilationLossPerSecond(
  beta: number,
): KinematicResult<Readonly<{ exact: number; printedSecondOrder: number }>> {
  const bad = refuseBeta(beta);
  if (bad) return bad;
  if (isMode1904()) refuseModernSurface("gamma");
  const root = Math.sqrt(1 - beta * beta);
  return ok({
    exact: (beta * beta) / (1 + root),
    printedSecondOrder: 0.5 * beta * beta,
  });
}

/**
 * artanh(beta). Identifier rapidity; glyph RAPIDITY_GLYPH from the concordance.
 * artanh(0.6) = ln 2. Later aid: gamma = cosh(rapidity), gamma*beta = sinh(rapidity).
 */
export function rapidity(beta: number): KinematicResult<number> {
  if (isMode1904()) refuseModernSurface("rapidity");
  const bad = refuseBeta(beta);
  if (bad) return bad;
  return ok(0.5 * Math.log((1 + beta) / (1 - beta)));
}

/** Beta at which a clock loses `lossPerDay` seconds per 86400 s, via the stable loss form. */
export function speedForDailyLoss(lossPerDay: number): KinematicResult<number> {
  if (!finite(lossPerDay) || lossPerDay <= 0 || lossPerDay >= 86400) {
    return outsideDomain("invalid-loss", "Daily loss must be a finite interval inside one day.");
  }
  const L = lossPerDay / 86400;
  const beta2 = 2 * L - L * L;
  if (beta2 <= 0 || beta2 >= 1)
    return outsideDomain("invalid-loss", "That loss is not a subluminal dilation.");
  return ok(Math.sqrt(beta2));
}

function matrix2(gammaVal: number, v: number, c: number): number[][] {
  return [
    [gammaVal, -gammaVal * v],
    [(-gammaVal * v) / (c * c), gammaVal],
  ];
}

/** 2x2 boost on (x, t). Det 1. Eigenvalues sqrt((1∓beta)/(1±beta)). */
export function boostMatrixXT(
  beta: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<number[][]> {
  if (isMode1904()) refuseModernSurface("matrix");
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (!finite(c) || c <= 0) return outsideDomain("invalid-c", "c must be a positive finite speed.");
  return ok(matrix2(g.value, beta * c, c));
}

function identity4(): number[][] {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function setEntry(L: number[][], row: number, col: number, value: number): void {
  const line = L[row];
  if (!line) return;
  line[col] = value;
}

function generalMatrix(b: BetaVector, g: number): number[][] {
  const beta2 = b.bx * b.bx + b.by * b.by + b.bz * b.bz;
  if (beta2 === 0) return identity4();
  const factor = (g * g) / (g + 1);
  const n = [b.bx, b.by, b.bz];
  const L = identity4();
  setEntry(L, 0, 0, g);
  for (let i = 0; i < 3; i++) {
    const ni = n[i] ?? 0;
    setEntry(L, 0, i + 1, -g * ni);
    setEntry(L, i + 1, 0, -g * ni);
    for (let j = 0; j < 3; j++) {
      const nj = n[j] ?? 0;
      setEntry(L, i + 1, j + 1, (i === j ? 1 : 0) + factor * ni * nj);
    }
  }
  return L;
}

export function alignedBoost(
  beta: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<Boost> {
  if (isMode1904()) refuseModernSurface("matrix");
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (!finite(c) || c <= 0) return outsideDomain("invalid-c", "c must be a positive finite speed.");
  const b: BetaVector = { bx: beta, by: 0, bz: 0 };
  return ok({
    beta: b,
    c,
    gamma: g.value,
    matrix: generalMatrix(b, g.value),
  });
}

export function generalBoost(
  b: BetaVector,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<Boost> {
  if (isMode1904()) refuseModernSurface("matrix");
  const beta = betaFromVector(b);
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (!finite(c) || c <= 0) return outsideDomain("invalid-c", "c must be a positive finite speed.");
  if (![b.bx, b.by, b.bz].every(finite)) {
    return outsideDomain("nonfinite-beta", "Each beta component must be finite.");
  }
  return ok({
    beta: b,
    c,
    gamma: g.value,
    matrix: generalMatrix(b, g.value),
  });
}

export function inverseBoost(boost: Boost): KinematicResult<Boost> {
  return generalBoost({ bx: -boost.beta.bx, by: -boost.beta.by, bz: -boost.beta.bz }, boost.c);
}

function applyMatrix(L: ReadonlyArray<ReadonlyArray<number>>, X: readonly number[]): number[] {
  return [0, 1, 2, 3].map((mu) =>
    [0, 1, 2, 3].reduce((s, nu) => s + (L[mu]?.[nu] ?? 0) * (X[nu] ?? 0), 0),
  );
}

export function transformEvent(event: Event, boost: Boost): KinematicResult<Event> {
  if (![event.t, event.x, event.y, event.z].every(finite)) {
    return outsideDomain("nonfinite-event", "Event coordinates must be finite.");
  }
  const X = [boost.c * event.t, event.x, event.y, event.z];
  const Xp = applyMatrix(boost.matrix, X);
  return ok({
    t: (Xp[0] ?? 0) / boost.c,
    x: Xp[1] ?? 0,
    y: Xp[2] ?? 0,
    z: Xp[3] ?? 0,
  });
}

export function intervalSquared(
  event: Event,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<IntervalReport> {
  if (isMode1904()) refuseModernSurface("interval");
  if (![event.t, event.x, event.y, event.z, c].every(finite) || c <= 0) {
    return outsideDomain("nonfinite-event", "Interval needs finite event and positive c.");
  }
  const ct = c * event.t;
  const scale = ct * ct + event.x * event.x + event.y * event.y + event.z * event.z;
  const s2 = ct * ct - event.x * event.x - event.y * event.y - event.z * event.z;
  const classified = classifyWithTolerance(s2, { relative: 1e-12, scale });
  const kind =
    classified.sign === "indeterminate"
      ? "indeterminate"
      : classified.sign === "zero"
        ? "null"
        : classified.sign === "positive"
          ? "timelike"
          : "spacelike";
  return ok({ s2, kind, classification: classified.sign });
}

export function composeCollinear(beta1: number, beta2: number): KinematicResult<number> {
  const a = refuseBeta(beta1);
  if (a) return a;
  const b = refuseBeta(beta2);
  if (b) return b;
  const den = 1 + beta1 * beta2;
  if (den === 0)
    return outsideDomain("superluminal-observer", "Collinear composition denominator vanished.");
  const u = (beta1 + beta2) / den;
  if (Math.abs(u) >= 1) {
    return outsideDomain(
      "superluminal-observer",
      "Collinear composition left the open unit interval.",
    );
  }
  return ok(u);
}

/**
 * 1 - U/c for collinear composition, never `1 - composeCollinear`.
 * At 0.99 ⊕ 0.99 this is 1/19801.
 */
export function composedSpeedShortfall(beta1: number, beta2: number): KinematicResult<number> {
  const a = refuseBeta(beta1);
  if (a) return a;
  const b = refuseBeta(beta2);
  if (b) return b;
  return ok(((1 - beta1) * (1 - beta2)) / (1 + beta1 * beta2));
}

/** Paper 3 §5 printed forms. V is c. alpha in radians. */
export function composePrinted(
  v: number,
  w: number,
  alpha: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<number> {
  if (![v, w, alpha, c].every(finite) || c <= 0) {
    return outsideDomain(
      "nonfinite-input",
      "Printed composition needs finite speeds and a positive c.",
    );
  }
  if (Math.abs(v) >= c || Math.abs(w) >= c) {
    return outsideDomain("superluminal-observer", "Printed composition inputs must be subluminal.");
  }
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);
  const den = 1 + (v * w * cosA) / (c * c);
  const inner = v * v + w * w + 2 * v * w * cosA - ((v * w * sinA) / c) ** 2;
  if (inner < 0 || den === 0) {
    return outsideDomain(
      "invalid-parameter",
      "Printed composition radicand or denominator is invalid.",
    );
  }
  return ok(Math.sqrt(inner) / den);
}

/** Cancellation-free (u ⊕ w) - u. */
export function compositionIncrement(
  u: number,
  w: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<number> {
  if (![u, w, c].every(finite) || c <= 0) {
    return outsideDomain("nonfinite-input", "Increment needs finite speeds and a positive c.");
  }
  if (Math.abs(u) >= c || Math.abs(w) >= c) {
    return outsideDomain("superluminal-observer", "Increment inputs must be subluminal.");
  }
  return ok((w * (1 - (u * u) / (c * c))) / (1 + (u * w) / (c * c)));
}

function mul4(
  A: ReadonlyArray<ReadonlyArray<number>>,
  B: ReadonlyArray<ReadonlyArray<number>>,
): number[][] {
  const C = identity4();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let nu = 0; nu < 4; nu++) s += (A[i]?.[nu] ?? 0) * (B[nu]?.[j] ?? 0);
      setEntry(C, i, j, s);
    }
  }
  return C;
}

function spatialRotationFromProduct(Binv: number[][], L: number[][]): number[][] {
  return mul4(Binv, L);
}

function wignerAngleFromRotation(R: number[][]): number {
  const rxx = R[1]?.[1] ?? 1;
  const rxy = R[1]?.[2] ?? 0;
  return Math.atan2(rxy, rxx);
}

/**
 * Product L2 L1 (L1 first), decomposed as pure boost times spatial rotation.
 * Non-collinear composition is never forced into a parallel-axis boost.
 * Sign: boost along x first, then along y; angle in the x-y plane.
 */
export function composeBoosts(first: Boost, second: Boost): KinematicResult<CompositionReport> {
  if (first.c !== second.c) return outsideDomain("invalid-c", "Boosts must share one c.");
  const product = mul4(second.matrix, first.matrix);
  const g = product[0]?.[0] ?? 1;
  if (g < 1 || !finite(g))
    return outsideDomain("invalid-parameter", "Product is not a Lorentz boost block.");
  const bx = -((product[1]?.[0] ?? 0) / g);
  const by = -((product[2]?.[0] ?? 0) / g);
  const bz = -((product[3]?.[0] ?? 0) / g);
  const extracted = generalBoost({ bx, by, bz }, first.c);
  if (extracted.status !== "value") return extracted;
  const inv = inverseBoost(extracted.value);
  if (inv.status !== "value") return inv;
  const rotation = spatialRotationFromProduct(inv.value.matrix as number[][], product);
  const speed = betaFromVector(extracted.value.beta) * first.c;
  return ok({
    boost: extracted.value,
    rotation,
    product,
    wignerAngle: wignerAngleFromRotation(rotation),
    resultantSpeed: speed,
  });
}

export function transformVelocity(
  u: Velocity,
  beta: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<Velocity> {
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (![u.ux, u.uy, u.uz, c].every(finite) || c <= 0) {
    return outsideDomain(
      "nonfinite-input",
      "Velocity transform needs finite components and positive c.",
    );
  }
  const speed = Math.hypot(u.ux, u.uy, u.uz);
  if (speed > c)
    return outsideDomain("superluminal-particle", "Particle speed |u| > c is outside the model.");
  const v = beta * c;
  const den = 1 - (u.ux * v) / (c * c);
  if (den === 0)
    return outsideDomain("invalid-parameter", "Velocity transform denominator vanished.");
  return ok({
    ux: (u.ux - v) / den,
    uy: u.uy / (g.value * den),
    uz: u.uz / (g.value * den),
  });
}

/**
 * Relativistic minus Galilean transformed velocity, cancellation-free:
 * (u - v) * (u v / c^2) / (1 - u v / c^2).
 */
export function galileanRelativisticVelocityDifference(
  u: number,
  v: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<Readonly<{ difference: number; relativeSize: number }>> {
  if (![u, v, c].every(finite) || c <= 0) {
    return outsideDomain("nonfinite-input", "Difference needs finite speeds and positive c.");
  }
  if (Math.abs(u) > c || Math.abs(v) >= c) {
    return outsideDomain(
      "superluminal-observer",
      "Difference needs subluminal frame speed and |u| <= c.",
    );
  }
  const relativeSize = (u * v) / (c * c) / (1 - (u * v) / (c * c));
  return ok({
    difference: (u - v) * relativeSize,
    relativeSize,
  });
}

export function contractedLength(L0: number, beta: number): KinematicResult<number> {
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (!finite(L0) || L0 < 0)
    return outsideDomain("invalid-length", "Proper length must be finite and nonnegative.");
  return ok(L0 / g.value);
}

export function ellipsoidAxes(
  R: number,
  beta: number,
): KinematicResult<Readonly<{ longitudinal: number; transverseY: number; transverseZ: number }>> {
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (!finite(R) || R < 0)
    return outsideDomain("invalid-length", "Radius must be finite and nonnegative.");
  return ok({
    longitudinal: R * Math.sqrt(1 - beta * beta),
    transverseY: R,
    transverseZ: R,
  });
}

export function dilatedInterval(dtau: number, beta: number): KinematicResult<number> {
  const g = gamma(beta);
  if (g.status !== "value") return g;
  if (!finite(dtau)) return outsideDomain("nonfinite-input", "Proper interval must be finite.");
  return ok(g.value * dtau);
}

/** Trailing clock is ahead by v L / c^2 in the frame where the pair moves. */
export function desynchronization(
  Lproper: number,
  beta: number,
  c = speedOfLightMetresPerSecond(),
): KinematicResult<number> {
  const bad = refuseBeta(beta);
  if (bad) return bad;
  if (!finite(Lproper) || Lproper < 0 || !finite(c) || c <= 0) {
    return outsideDomain(
      "invalid-length",
      "Proper separation and c must be finite and nonnegative.",
    );
  }
  return ok((beta * Lproper) / c);
}

/** Galilean map x' = x - v t, t' = t. Does not preserve the light-speed postulate with absolute time. */
export function galileanMap(event: Event, v: number): KinematicResult<Event> {
  if (![event.t, event.x, event.y, event.z, v].every(finite)) {
    return outsideDomain("nonfinite-input", "Galilean map needs finite coordinates and v.");
  }
  return ok({
    t: event.t,
    x: event.x - v * event.t,
    y: event.y,
    z: event.z,
  });
}

export function galileanVelocity(u: number, v: number): KinematicResult<number> {
  if (![u, v].every(finite))
    return outsideDomain("nonfinite-input", "Galilean velocity needs finite u and v.");
  return ok(u - v);
}

export type { CandidateMap, ConstraintId, ConstraintSolve } from "./kinematics/constraints.ts";
export { checkCandidateMap, solveCandidateFamily } from "./kinematics/constraints.ts";
