/**
 * The turnable-axes construction of foundation:vectors-components (am-found-linear-geometry-7w15):
 * one fixed arrow, the lesson's field of 5 units pointing 3 along x and 4 along y, described in
 * axes turned by an angle the reader chooses. The components change and the length does not.
 * Pure and throw-free.
 */
import { withinTolerance } from "../units/tolerance.ts";

/** The fixed arrow: 3 along x and 4 along y, so 5 long. */
export const ARROW = { x: 3, y: 4 } as const;

export const ANGLE_SLIDER = { min: -90, max: 90, step: 5 } as const;

/** Angles beyond a full turn either way are refused: the construction's axes stop there. */
export const ANGLE_LIMIT = 360;

export interface TurnedAxes {
  /** Degrees, counterclockwise from the original x axis. */
  readonly angle: number;
  readonly cos: number;
  readonly sin: number;
  /** The arrow's components along the turned axes. */
  readonly along: number;
  readonly across: number;
  readonly length: number;
  /** Whether the turned x axis lies along the arrow, to the three decimals the page prints. */
  readonly aligned: boolean;
}

export type AxesOutcome =
  | { readonly status: "turned"; readonly axes: TurnedAxes }
  | { readonly status: "refused"; readonly message: string };

export const AXES_REFUSALS = {
  empty: "Type an angle in degrees, for example 30 or −45.",
  unreadable: "The construction cannot read that as an angle. Write it like 30, 36,87 or −45.",
  "out-of-range": `Choose an angle between −${ANGLE_LIMIT} and ${ANGLE_LIMIT} degrees.`,
} as const;

/** Turns the axes counterclockwise by `angle` degrees and describes the arrow in them. */
export function turnAxes(angle: number): AxesOutcome {
  if (!Number.isFinite(angle)) return { status: "refused", message: AXES_REFUSALS.unreadable };
  if (Math.abs(angle) > ANGLE_LIMIT)
    return { status: "refused", message: AXES_REFUSALS["out-of-range"] };
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const along = ARROW.x * cos + ARROW.y * sin;
  const across = -ARROW.x * sin + ARROW.y * cos;
  return {
    status: "turned",
    axes: {
      angle,
      cos,
      sin,
      along,
      across,
      length: Math.hypot(along, across),
      aligned: along > 0 && withinTolerance(across, 0, { absolute: 5e-4 }).ok,
    },
  };
}

/** Reads a typed angle in degrees: 30, 36.87, 36,87, −45 or -45. */
export function turnAxesTyped(text: string): AxesOutcome {
  const trimmed = text.trim().replace(/−/g, "-").replace(",", ".").replace(/°$/, "");
  if (trimmed === "") return { status: "refused", message: AXES_REFUSALS.empty };
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed))
    return { status: "refused", message: AXES_REFUSALS.unreadable };
  return turnAxes(Number(trimmed));
}

/** The angle, about 53.13°, at which the turned x axis lies along the arrow. */
export const ALIGNED_ANGLE = (Math.atan2(ARROW.y, ARROW.x) * 180) / Math.PI;
