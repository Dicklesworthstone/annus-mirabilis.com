/**
 * The event-table transformer of foundation:matrices-linear-maps (am-found-linear-geometry-7w15):
 * the change from one frame to another written as a table of multipliers acting on (x, t), with
 * the Galilean map beside it for comparison. Pure and throw-free.
 *
 * Units: x in light-seconds and t in seconds, so c = 1 and the speed is the ratio v/c. The ratio
 * is never called beta here: Einstein's β is the modern γ in the relativity and mass-energy papers.
 */
import { withinTolerance } from "../units/tolerance.ts";

export type MapKind = "relativistic" | "galilean";

export interface EventPoint {
  readonly id: string;
  readonly label: string;
  /** Light-seconds. */
  readonly x: number;
  /** Seconds. */
  readonly t: number;
}

/** The four events the table transforms: two simultaneous, one at the origin later, one on a light line. */
export const EVENTS: readonly EventPoint[] = [
  { id: "origin", label: "The origin", x: 0, t: 0 },
  { id: "far", label: "Same moment, 10 light-seconds away", x: 10, t: 0 },
  { id: "later", label: "Same place, 10 seconds later", x: 0, t: 10 },
  { id: "flash", label: "Where a flash from the origin is after 10 s", x: 10, t: 10 },
];

export const SPEED_SLIDER = { min: -0.9, max: 0.9, step: 0.1 } as const;

export interface BoostTable {
  readonly kind: MapKind;
  readonly speedRatio: number;
  /** γ; 1 for the Galilean map. */
  readonly factor: number;
  /** Rows (p, q) and (r, s): x' = p x + q t and t' = r x + s t. */
  readonly p: number;
  readonly q: number;
  readonly r: number;
  readonly s: number;
  readonly determinant: number;
  /** Whether the forward light line x = t is carried to x' = t'. */
  readonly keepsForwardLight: boolean;
  /** How the map stretches the forward and backward light lines, when it keeps them. */
  readonly stretch: { readonly forward: number; readonly backward: number } | null;
  readonly transformed: readonly (EventPoint & {
    readonly xPrime: number;
    readonly tPrime: number;
  })[];
}

export type BoostOutcome =
  | { readonly status: "mapped"; readonly table: BoostTable }
  | { readonly status: "refused"; readonly message: string };

export const BOOST_REFUSALS = {
  empty: "Type a speed as a fraction of c, for example 0.6 or −0,6.",
  unreadable: "The construction cannot read that as a number. Write it like 0.6 or 0,6.",
  "at-light":
    "No frame moves at the speed of light or faster: at v/c = 1 the factor γ has no finite value. Choose a speed between −0.99 and 0.99.",
} as const;

const refused = (reason: keyof typeof BOOST_REFUSALS): BoostOutcome => ({
  status: "refused",
  message: BOOST_REFUSALS[reason],
});

/** Largest speed ratio the construction accepts; γ at 0.99 is about 7.09. */
export const SPEED_LIMIT = 0.99;

/**
 * Whether the transformed flash still has x' = t'. An equality test would fail on rounding alone,
 * so the verdict goes through the site's one tolerance module, far tighter than the table prints.
 */
const agrees = (a: number, b: number): boolean =>
  withinTolerance(a, b, { absolute: 1e-9, relative: 1e-9 }).ok;

export function boost(speedRatio: number, kind: MapKind): BoostOutcome {
  if (!Number.isFinite(speedRatio)) return refused("unreadable");
  if (Math.abs(speedRatio) > SPEED_LIMIT) return refused("at-light");
  const factor = kind === "relativistic" ? 1 / Math.sqrt(1 - speedRatio * speedRatio) : 1;
  const p = factor;
  const q = -factor * speedRatio;
  const r = kind === "relativistic" ? -factor * speedRatio : 0;
  const s = factor;
  const apply = (x: number, t: number) => ({ xPrime: p * x + q * t, tPrime: r * x + s * t });
  const flash = apply(1, 1);
  const keepsForwardLight = agrees(flash.xPrime, flash.tPrime);
  return {
    status: "mapped",
    table: {
      kind,
      speedRatio,
      factor,
      p,
      q,
      r,
      s,
      determinant: p * s - q * r,
      keepsForwardLight,
      stretch: keepsForwardLight
        ? { forward: factor * (1 - speedRatio), backward: factor * (1 + speedRatio) }
        : null,
      transformed: EVENTS.map((e) => ({ ...e, ...apply(e.x, e.t) })),
    },
  };
}

/** Reads a typed speed ratio: 0.6, 0,6, −0.6 or -0.6. */
export function boostTyped(text: string, kind: MapKind): BoostOutcome {
  const trimmed = text.trim().replace(/−/g, "-").replace(",", ".");
  if (trimmed === "") return refused("empty");
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) return refused("unreadable");
  return boost(Number(trimmed), kind);
}
