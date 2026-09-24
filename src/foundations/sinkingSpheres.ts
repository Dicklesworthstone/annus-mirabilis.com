/**
 * The Stokes-drag lesson's sinking-sphere table, as printed numbers.
 *
 * Grains 1.2 times as dense as water sink through water at the speed where Stokes's drag, 6πηa
 * times the speed, balances their weight less the water's buoyancy. The law is owned by
 * src/physics/reference (stokesMobility), which a client component may not import, so this module
 * holds only the printed rows; foundTransport.sinkingSpheres.test.ts recomputes every one of them
 * through the owner, at the figures printed here.
 */

export const SINKING = {
  /** kg/m³: the grain of the temperature lesson, and the water it sinks through. */
  grainDensity: 1200,
  waterDensity: 1000,
  /** Pa·s, water at room temperature. */
  viscosity: 1e-3,
  /** m/s². */
  gravity: 9.81,
} as const;

export type SinkingRow = Readonly<{
  /** Radius, micrometres. */
  radius: number;
  /** Drag at 1 μm/s, newtons, printed to three figures. */
  drag: number;
  /** Sinking speed, micrometres per second, printed to three figures. */
  speed: number;
  /** Time to sink 1 mm, printed to two figures in the unit named. */
  time: Readonly<{ value: number; unit: "hours" | "minutes" }>;
  /** Inertia ÷ viscosity at the sinking speed, printed to one figure. */
  inertiaRatio: number;
}>;

export const SINKING_ROWS: readonly SinkingRow[] = [
  {
    radius: 0.25,
    drag: 4.71e-15,
    speed: 0.0273,
    time: { value: 10, unit: "hours" },
    inertiaRatio: 7e-9,
  },
  {
    radius: 0.5,
    drag: 9.42e-15,
    speed: 0.109,
    time: { value: 2.5, unit: "hours" },
    inertiaRatio: 5e-8,
  },
  {
    radius: 1,
    drag: 1.88e-14,
    speed: 0.436,
    time: { value: 38, unit: "minutes" },
    inertiaRatio: 4e-7,
  },
  {
    radius: 2.5,
    drag: 4.71e-14,
    speed: 2.72,
    time: { value: 6.1, unit: "minutes" },
    inertiaRatio: 7e-6,
  },
  {
    radius: 5,
    drag: 9.42e-14,
    speed: 10.9,
    time: { value: 1.5, unit: "minutes" },
    inertiaRatio: 5e-5,
  },
];
