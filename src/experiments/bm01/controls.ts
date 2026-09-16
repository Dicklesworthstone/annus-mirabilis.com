import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import type { Bm01Parameters } from "./definition.ts";
export type TracerDraft = Record<keyof Bm01Parameters, string>;
export const BM01_FIELDS = [
  ["T", "Temperature", "K", 0],
  ["eta", "Viscosity", "mPa·s", 3],
  ["a", "Particle radius", "μm", 6],
  ["M", "Number of tracers", "count", 0],
  ["h", "Recording time resolution", "s", 0],
  ["H", "Recording length", "s", 0],
  ["interval", "Observe after", "s", 0],
] as const;
export function toTracerDraft(p: Bm01Parameters): TracerDraft {
  return {
    T: String(p.T),
    eta: formatScaledDecimal(p.eta, 3),
    a: formatScaledDecimal(p.a, 6),
    M: String(p.M),
    h: String(p.h),
    H: String(p.H),
    interval: String(p.interval),
    d: String(p.d),
    axis: String(p.axis),
    seed: p.seed,
    statistic: p.statistic,
  };
}
export function fromTracerDraft(d: TracerDraft): Bm01Parameters {
  return {
    T: parseScaledDecimal(d.T, 0),
    eta: parseScaledDecimal(d.eta, 3),
    a: parseScaledDecimal(d.a, 6),
    M: parseScaledDecimal(d.M, 0),
    h: parseScaledDecimal(d.h, 0),
    H: parseScaledDecimal(d.H, 0),
    interval: parseScaledDecimal(d.interval, 0),
    d: parseScaledDecimal(d.d, 0),
    axis: parseScaledDecimal(d.axis, 0),
    seed: d.seed,
    statistic: d.statistic,
  };
}
