/**
 * The osmotic-pressure lesson's selective-partition table, as printed numbers.
 *
 * Particles held behind a wall that lets the liquid through push on it with p = νk_BT, whatever
 * their size, while they are dilute. The law is owned by src/physics/reference (osmoticPressure),
 * which a client component may not import, so this module holds only the printed rows;
 * foundTransport.osmoticRows.test.ts recomputes each through the owner at 293 K, and each share of
 * the volume as ν times (4/3)πa³.
 */

export type OsmoticRow = Readonly<{
  what: string;
  /** Particles per cubic metre. */
  perCubicMetre: number;
  /** Grain radius in micrometres, when the particles are grains; null for dissolved sugar. */
  radius: number | null;
  /** Share of the volume the grains fill, printed to one figure; null for dissolved sugar. */
  share: number | null;
  /** Osmotic pressure in pascals, printed to two figures; null where the dilute law does not apply. */
  pressure: number | null;
}>;

export const OSMOTIC_ROWS: readonly OsmoticRow[] = [
  {
    what: "Sugar, 0.1 gram-molecule per litre",
    perCubicMetre: 6.02e25,
    radius: null,
    share: null,
    pressure: 2.4e5,
  },
  {
    what: "Grains of 0.5 μm radius, a million per mm³",
    perCubicMetre: 1e15,
    radius: 0.5,
    share: 5e-4,
    pressure: 4.0e-6,
  },
  {
    what: "Grains of 0.05 μm radius, a million per mm³",
    perCubicMetre: 1e15,
    radius: 0.05,
    share: 5e-7,
    pressure: 4.0e-6,
  },
  {
    what: "Grains of 0.5 μm radius, a billion per mm³",
    perCubicMetre: 1e18,
    radius: 0.5,
    share: 0.5,
    pressure: null,
  },
];

/** The temperature the pressures are given at, kelvin. */
export const OSMOTIC_TEMPERATURE = 293;
