/**
 * Small, explicit countermodel owners; no outcomes are decided here.
 * The ether route uses Lorentz's relative coordinate and local time with l = 1,
 * not the Einstein event map. Composition in that case is attributed to
 * Poincare's June 1905 parallel work, not silently to Lorentz 1904 alone.
 */
import {
  alignedBoost, galileanMap, galileanRelativisticVelocityDifference,
  galileanVelocity, gamma, speedOfLightMetresPerSecond, transformEvent,
  type Event, type KinematicResult,
} from "./kinematics.ts";
import { ok, outsideDomain } from "./kinematics/types.ts";

export type CountermodelId = "galilean" | "lorentz" | "lorentz-ether";
export type EventMap = (event: Event, beta: number, c: number) => KinematicResult<Event>;

function domain(v: number, c: number): KinematicResult<never> | null {
  if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(v))
    return outsideDomain("nonfinite-input", "Use finite speeds and a positive finite light speed.");
  if (Math.abs(v) >= c)
    return outsideDomain("superluminal-observer", "The comparison uses observers with |v| < c.");
  return null;
}
function finiteNumber(value: number): KinematicResult<number> {
  return Number.isFinite(value) ? ok(value) : {
    status: "outside-domain", condition: "unrepresentable-result", domainKind: "numerical",
    reason: "This result is outside the finite numerical range.",
  };
}
function finiteEvent(result: KinematicResult<Event>): KinematicResult<Event> {
  if (result.status !== "value") return result;
  return Object.values(result.value).every(Number.isFinite) ? result : {
    status: "outside-domain", condition: "unrepresentable-result", domainKind: "numerical",
    reason: "The transformed event is outside the finite numerical range.",
  };
}

/** Galilean addition, within the comparison's common subluminal input domain. */
export function galileanCompose(u: number, v: number, c = speedOfLightMetresPerSecond()): KinematicResult<number> {
  const bad = domain(v, c) ?? domain(u, c);
  if (bad) return bad;
  const result = galileanVelocity(u, -v);
  return result.status === "value" ? finiteNumber(result.value) : result;
}

/** Galilean minus relativistic composition, without subtracting rounded speeds. */
export function lorentzCompositionResidual(u: number, v: number, c = speedOfLightMetresPerSecond()): KinematicResult<number> {
  const bad = domain(v, c) ?? domain(u, c);
  if (bad) return bad;
  // The existing owner's difference for a boost of -v is relativistic addition
  // minus Galilean addition. Changing the sign keeps its cancellation-free path.
  const result = galileanRelativisticVelocityDifference(u, -v, c);
  return result.status === "value" ? finiteNumber(-result.value.difference) : result;
}

export function lorentz1904EventMap(event: Event, v: number, c = speedOfLightMetresPerSecond()): KinematicResult<Event> {
  const bad = domain(v, c);
  if (bad) return bad;
  const g = gamma(v / c);
  if (g.status !== "value") return g;
  const relative = galileanMap(event, v);
  if (relative.status !== "value") return relative;
  const xr = relative.value.x;
  return finiteEvent(ok({
    x: g.value * xr,
    t: event.t / g.value - g.value * (v / c) * (xr / c),
    y: event.y,
    z: event.z,
  }));
}

/** Closed owner registry, deliberately without an arbitrary function-name evaluator. */
export function countermodelEventMap(candidate: CountermodelId, event: Event, beta: number,
  c = speedOfLightMetresPerSecond()): KinematicResult<Event> {
  if (!Number.isFinite(beta) || Math.abs(beta) >= 1)
    return outsideDomain("superluminal-observer", "Use a finite observer speed with |v/c| < 1.");
  const bad = domain(beta * c, c);
  if (bad) return bad;
  if (candidate === "galilean") return finiteEvent(galileanMap(event, beta * c));
  if (candidate === "lorentz-ether") return lorentz1904EventMap(event, beta * c, c);
  if (candidate !== "lorentz") return outsideDomain("unknown-model", "This candidate is not registered.");
  const boost = alignedBoost(beta, c);
  return boost.status === "value" ? finiteEvent(transformEvent(event, boost.value)) : boost;
}

/** A rate from two events on a worldline, not a second velocity-transform formula. */
export function mappedWorldlineSpeed(map: EventMap, u: number, beta: number, c: number): KinematicResult<number> {
  if (!Number.isFinite(u) || Math.abs(u) > c)
    return outsideDomain("invalid-speed", "The tested worldline must have |u| <= c.");
  const origin = map({ t: 0, x: 0, y: 0, z: 0 }, beta, c);
  const later = map({ t: 1, x: u, y: 0, z: 0 }, beta, c);
  if (origin.status !== "value") return origin;
  if (later.status !== "value") return later;
  const dt = later.value.t - origin.value.t;
  if (dt === 0) return outsideDomain("zero-time-interval", "These events have no time separation in this description.");
  return finiteNumber((later.value.x - origin.value.x) / dt);
}

/** Rest-frame clock seconds per laboratory second, from the clock's worldline. */
export function mappedClockRate(map: EventMap, beta: number, c: number): KinematicResult<number> {
  const origin = map({ t: 0, x: 0, y: 0, z: 0 }, beta, c);
  const later = map({ t: 1, x: beta * c, y: 0, z: 0 }, beta, c);
  if (origin.status !== "value") return origin;
  if (later.status !== "value") return later;
  return finiteNumber(later.value.t - origin.value.t);
}

/**
 * Solve laboratory simultaneity with the candidate's inverse map. The two
 * endpoints are fixed in the rod frame. Equal rod-frame times would measure
 * a different thing; every candidate supplies its own required time offset.
 */
export function mappedRodLength(map: EventMap, properLength: number, beta: number, c: number): KinematicResult<number> {
  if (!Number.isFinite(properLength) || properLength <= 0)
    return outsideDomain("invalid-length", "Use a positive finite proper length.");
  const timeBasis = map({ t: 1, x: 0, y: 0, z: 0 }, -beta, c);
  const endAtZero = map({ t: 0, x: properLength, y: 0, z: 0 }, -beta, c);
  if (timeBasis.status !== "value") return timeBasis;
  if (endAtZero.status !== "value") return endAtZero;
  if (timeBasis.value.t === 0)
    return outsideDomain("singular-time-map", "This map cannot select simultaneous laboratory endpoints.");
  const end = map({ t: -endAtZero.value.t / timeBasis.value.t, x: properLength, y: 0, z: 0 }, -beta, c);
  const start = map({ t: 0, x: 0, y: 0, z: 0 }, -beta, c);
  if (end.status !== "value") return end;
  if (start.status !== "value") return start;
  return finiteNumber(end.value.x - start.value.x);
}
