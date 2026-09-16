/**
 * SR-05 (am-sr-05-moving-clocks-2zka): worldline proper time, reunion comparison, the light
 * clock, and reciprocal-rate arithmetic.
 *
 * SCOPE. This bead's Requirements name the future owner as "events.ts (properTime,
 * reunionComparison, reciprocalRates, lightClock, redescribe) and kinematics.ts
 * (dilationLossPerSecond, speedForDailyLoss, gamma). Label 'Ideal model, host calculation'
 * until upstream adoption." events.ts does not exist anywhere in this repository as of this
 * commit (am-ref-events-yvl, its owning bead, is still open with no landed code) -- checked by
 * grep, not assumed. kinematics.ts (am-ref-kinematics-tjq) is real and landed at
 * src/physics/reference/kinematics.ts with gamma, dilationLossPerSecond, and
 * speedForDailyLoss, each returning the typed outside-domain refusal for |beta| >= 1 (a typed
 * refusal, never a clamp).
 *
 * This module is the sanctioned "host calculation" stand-in: a piecewise-constant-speed
 * proper-time accumulator built from gamma() alone, never a second Lorentz-transform or
 * simultaneity implementation. That is deliberate and sufficient for this bead's own fixtures
 * (inertial, out-and-back, a constant-speed circle, and the light clock all have piecewise- or
 * globally-constant speed, so integrating the instantaneous dilation factor over duration is
 * exact -- see the "ideal-clock test" acceptance criterion: proper time depends only on the
 * speed profile, never on turning acceleration or path curvature). It is placed outside
 * src/physics/reference/ specifically so it never preempts events.ts's real, future home; when
 * am-ref-events-yvl lands, this module is replaced by real calls into it, not merged with it.
 *
 * reciprocalRates here is intentionally the SIMPLE symmetric statement (each frame reports the
 * same dilation factor for the other's clock) -- it does not attempt to construct an actual
 * desynchronized "clock reading at a distant simultaneous event," which needs events.ts's
 * synchronization ledger. The bead's own requirement is satisfied in words, not by building
 * that apparatus here: "comparing separated readings requires a simultaneity convention, while
 * a reunion comparison is invariant."
 */

import {
  type KinematicResult,
  ok,
  outsideDomain,
} from "../../physics/reference/kinematics/types.ts";
import {
  dilationLossPerSecond,
  gamma,
  speedForDailyLoss,
  speedOfLightMetresPerSecond,
} from "../../physics/reference/kinematics.ts";

export type WorldlineLeg = Readonly<{ beta: number; duration: number }>;

export type WorldlineSummary = Readonly<{ properTime: number; coordinateTime: number }>;

/** Sums proper time across legs of constant speed: tau = sum(duration_i * sqrt(1 - beta_i^2)).
 * Exact for any piecewise-constant-speed worldline, closed or not; direction and turning are
 * irrelevant to this sum, which is exactly the "ideal-clock" contract this bead requires. */
export function properTimeAlongLegs(
  legs: readonly WorldlineLeg[],
): KinematicResult<WorldlineSummary> {
  if (legs.length === 0)
    return outsideDomain("empty-worldline", "A worldline needs at least one leg.");
  let properTime = 0;
  let coordinateTime = 0;
  for (const leg of legs) {
    if (!Number.isFinite(leg.duration) || leg.duration <= 0)
      return outsideDomain("invalid-leg-duration", "Every leg needs a finite positive duration.");
    const g = gamma(leg.beta);
    if (g.status !== "value") return g;
    coordinateTime += leg.duration;
    properTime += leg.duration / g.value;
  }
  return ok({ properTime, coordinateTime });
}

export type ReunionSummary = Readonly<{
  travelingProperTime: number;
  stationaryProperTime: number;
  coordinateTime: number;
  exactLag: number;
  printedApproxLag: number;
}>;

/** Reunion comparison for a closed worldline: the traveling clock's proper time versus a
 * stationary clock's (= coordinate time), plus the exact lag beside the printed second-order
 * approximation sum(duration_i * (1/2) beta_i^2), labeled as an approximation and never
 * substituted for the exact value. */
export function reunionComparison(legs: readonly WorldlineLeg[]): KinematicResult<ReunionSummary> {
  const worldline = properTimeAlongLegs(legs);
  if (worldline.status !== "value") return worldline;
  let printedApproxLag = 0;
  for (const leg of legs) {
    const loss = dilationLossPerSecond(leg.beta);
    if (loss.status !== "value") return loss;
    printedApproxLag += leg.duration * loss.value.printedSecondOrder;
  }
  const { properTime, coordinateTime } = worldline.value;
  return ok({
    travelingProperTime: properTime,
    stationaryProperTime: coordinateTime,
    coordinateTime,
    exactLag: coordinateTime - properTime,
    printedApproxLag,
  });
}

export type LightClockSummary = Readonly<{ properTick: number; coordinateTick: number }>;

/** Transverse light-clock ticks. Arm length is in light-seconds, so c = 1 ls/s exactly and the
 * proper tick is simply 2 * armLengthLs; the coordinate tick is properTick * gamma(beta). This
 * is a supplemental illustration of dilation, offered after the measurement definitions, never
 * a substitute for the coordinate transformation (this bead's own Considerations). */
export function lightClockTicks(
  armLengthLs: number,
  beta: number,
): KinematicResult<LightClockSummary> {
  if (!Number.isFinite(armLengthLs) || armLengthLs <= 0)
    return outsideDomain(
      "invalid-arm-length",
      "The light-clock arm must be a finite positive number of light-seconds.",
    );
  const g = gamma(beta);
  if (g.status !== "value") return g;
  const properTick = 2 * armLengthLs;
  return ok({ properTick, coordinateTick: properTick * g.value });
}

export type ReciprocalRatesSummary = Readonly<{ dilationFactor: number }>;

/** Each inertial frame reports the same dilation factor for the other clock's rate -- the
 * symmetric statement this bead requires, without constructing a desynchronized separated-
 * reading comparison (that needs events.ts's simultaneity apparatus, out of this bead's Scope
 * to build). */
export function reciprocalRates(beta: number): KinematicResult<ReciprocalRatesSummary> {
  const g = gamma(beta);
  if (g.status !== "value") return g;
  return ok({ dilationFactor: g.value });
}

/** The equatorial rotation speed (465.1 m/s), a fixed illustrative input, never a control. */
export const EQUATOR_SPEED_M_PER_S = 465.1;

export type EquatorNoteSummary = Readonly<{
  illustrativeBeta: number;
  fractionalRate: number;
  approxNanosecondsPerDay: number;
}>;

/** A special-relativity-only illustration of the equatorial rotation speed's fractional time-
 * dilation rate. Never a prediction of a real clock on the rotating geoid -- see
 * realGeoidPrediction(), which is the typed refusal for that request. On the real geoid,
 * gravitational and kinematic effects approximately cancel (Hafele 1970); this function computes
 * neither of those, only the special-relativistic illustration named in this bead's Requirements. */
export function equatorNote(): EquatorNoteSummary {
  const c = speedOfLightMetresPerSecond();
  const beta = EQUATOR_SPEED_M_PER_S / c;
  const loss = dilationLossPerSecond(beta);
  const exact = loss.status === "value" ? loss.value.exact : Number.NaN;
  return Object.freeze({
    illustrativeBeta: beta,
    fractionalRate: exact,
    approxNanosecondsPerDay: exact * 86400 * 1e9,
  });
}

/** The typed refusal for a request this model cannot honor: predicting a real clock on the
 * rotating geoid needs gravitational physics this model does not have. */
export function realGeoidPrediction(): KinematicResult<never> {
  return outsideDomain(
    "geoid-prediction-outside-model",
    "Predicting a real clock on the rotating geoid needs gravitational physics beyond this model.",
  );
}

export { dilationLossPerSecond, gamma, speedForDailyLoss };
