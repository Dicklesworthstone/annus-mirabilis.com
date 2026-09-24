/**
 * The temperature lesson's speed-distribution picture, as printed facts and a curve shape.
 *
 * In equilibrium at a temperature T, the speed of any particle along one axis is spread in a bell
 * curve whose width is √(k_BT/m), and whose mean energy of motion along that axis is ½k_BT, the
 * same for a molecule and for a grain. Measured in its own width, the curve is the same for both.
 * The numbers here are the lesson's own, printed; foundTransport.speedSpread.test.ts recomputes
 * them through the constants and the erf owner, which a client component may not import.
 */

export type Particle = Readonly<{
  id: "nitrogen" | "grain";
  name: string;
  /** √(k_BT/m) at 293 K, in `unit`. */
  spread: number;
  unit: "m/s" | "mm/s";
}>;

export const PARTICLES: readonly Particle[] = [
  { id: "nitrogen", name: "a nitrogen molecule", spread: 295, unit: "m/s" },
  { id: "grain", name: "a 0.5 μm grain", spread: 2.5, unit: "mm/s" },
];

/** The grain's spread is this many times smaller, printed to two figures. */
export const SPREAD_RATIO = 120_000;
/** Mean energy of motion along one axis at 293 K, joules, printed as the lesson prints it. */
export const MEAN_ENERGY_PER_AXIS = 2.02e-21;
/** Per cent of particles, at any moment, below a quarter of the mean energy along an axis. */
export const SLOW_PERCENT = 38;
/** Per cent of particles, at any moment, above four times the mean energy along an axis. */
export const FAST_PERCENT = 5;

/** The bell curve's height at u widths from the centre, 1 at the centre. */
export const bell = (u: number) => Math.exp(-(u * u) / 2);

/** Axis marks, in widths. */
export const TICKS: readonly number[] = [-2, -1, 0, 1, 2];
