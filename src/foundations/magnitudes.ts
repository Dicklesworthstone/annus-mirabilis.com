/**
 * The log scale of foundation:orders-of-magnitude (am-found-quantities-magnitudes-igxe): the
 * lesson's numbers placed on a scale of powers of ten, one family at a time, and any two of them
 * compared as a ratio and a count of powers of ten. Pure and throw-free.
 *
 * Every value is the lesson's own, computed the same way: a length is a length and a speed is a
 * fraction of the speed of light, and the two families never share an axis. Kaufmann's fast
 * electrons, which the lesson mentions, are left off: the site holds no dataset for them yet, and
 * the bead requires the value to come from one.
 */

/** The exact 2019 SI speed of light, m/s (modern-si-2019). */
const SPEED_OF_LIGHT = 299_792_458;

/**
 * The Brownian paper's spread in one second, 0.7948 μm (einstein-1905-brownian-printed,
 * rmsDisplacement1d, to four figures), and so √60 times that in a minute, which the paper prints
 * as about 6 μm.
 */
const PAPER_SPREAD_M = 0.7948e-6;

export interface MagnitudeItem {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

export interface MagnitudeFamily {
  readonly id: "sizes" | "speeds";
  readonly label: string;
  /** What the axis measures, for the sentence under it. */
  readonly axis: string;
  /** The unit written after a value, empty for a pure ratio. */
  readonly unit: string;
  readonly items: readonly MagnitudeItem[];
}

export const MAGNITUDE_FAMILIES: readonly MagnitudeFamily[] = [
  {
    id: "sizes",
    label: "Sizes",
    axis: "length in metres",
    unit: "m",
    items: [
      { id: "water-molecule", label: "The width of a water molecule", value: 0.3e-9 },
      { id: "ultraviolet", label: "One wavelength of 250 nm ultraviolet", value: 250e-9 },
      { id: "red", label: "One wavelength of 650 nm red light", value: 650e-9 },
      { id: "spread-second", label: "The paper's spread in one second", value: PAPER_SPREAD_M },
      { id: "grain", label: "The width of a Brownian grain", value: 1e-6 },
      {
        id: "spread-minute",
        label: "The paper's spread in one minute",
        value: PAPER_SPREAD_M * Math.sqrt(60),
      },
    ],
  },
  {
    id: "speeds",
    label: "Speeds against light",
    axis: "speed as a fraction of the speed of light, v/c",
    unit: "",
    items: [
      {
        id: "earth-squared",
        label: "The Earth's (v/c)², the scale of relativity's corrections for it",
        value: (29_800 / SPEED_OF_LIGHT) ** 2,
      },
      { id: "jet", label: "A jet's speed (250 m/s)", value: 250 / SPEED_OF_LIGHT },
      { id: "bullet", label: "A rifle bullet's speed (1,000 m/s)", value: 1000 / SPEED_OF_LIGHT },
      {
        id: "earth",
        label: "The Earth's orbital speed (29.8 km/s)",
        value: 29_800 / SPEED_OF_LIGHT,
      },
    ],
  },
];

export interface DecadeRange {
  /** Powers of ten at the two ends of the axis. */
  readonly low: number;
  readonly high: number;
}

/** The whole powers of ten that enclose every value, at least one power apart. */
export function enclosingDecades(values: readonly number[]): DecadeRange {
  const logs = values.filter((v) => v > 0 && Number.isFinite(v)).map(Math.log10);
  if (logs.length === 0) return { low: 0, high: 1 };
  const low = Math.floor(Math.min(...logs));
  const high = Math.max(Math.ceil(Math.max(...logs)), low + 1);
  return { low, high };
}

/** Where a value sits along the axis, 0 at the left end and 1 at the right; null outside it. */
export function positionOnScale(value: number, range: DecadeRange): number | null {
  if (!(value > 0) || !Number.isFinite(value)) return null;
  const at = (Math.log10(value) - range.low) / (range.high - range.low);
  return at < 0 || at > 1 ? null : at;
}

export interface Comparison {
  /** How many times the larger is the smaller. */
  readonly ratio: number;
  /** log10 of the ratio: the number of powers of ten between them. */
  readonly powers: number;
  readonly larger: MagnitudeItem;
  readonly smaller: MagnitudeItem;
}

/** Compares two items of one family, larger over smaller. */
export function compare(a: MagnitudeItem, b: MagnitudeItem): Comparison {
  const [larger, smaller] = a.value >= b.value ? [a, b] : [b, a];
  const ratio = larger.value / smaller.value;
  return { ratio, powers: Math.log10(ratio), larger, smaller };
}
