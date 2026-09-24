/**
 * The unit-cancellation table of foundation:quantities-units (am-found-quantities-magnitudes-igxe):
 * a formula's factors written in base SI units, their powers added, and the sum compared with the
 * units the quantity must have. Two of the formulas are deliberately wrong, so the check can be
 * seen to fail. Pure and throw-free.
 */

export const BASE_UNITS = ["kg", "m", "s", "K"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];
export type Dimensions = Readonly<Record<BaseUnit, number>>;

const dims = (kg: number, m: number, s: number, K: number): Dimensions => ({ kg, m, s, K });

/** Where a factor sits in the formula, which is the power its units are raised to. */
export type Placement = "top" | "bottom" | "root" | "number";
const PLACEMENT_POWER: Readonly<Record<Placement, number>> = {
  top: 1,
  bottom: -1,
  root: 0.5,
  number: 0,
};

export interface Factor {
  /** The letter, with an optional subscript: k with B for Boltzmann's constant. */
  readonly symbol: string;
  readonly subscript?: string;
  readonly name: string;
  /** The unit as usually written: J/K, Pa s. */
  readonly unit: string;
  readonly dimensions: Dimensions;
  readonly placement: Placement;
}

export interface CancellationFormula {
  readonly id: string;
  /** The menu label in words, short enough for a 320px phone; the component draws the formula. */
  readonly label: string;
  /** What the result must be, with its article: "a diffusion coefficient". */
  readonly quantity: string;
  readonly expected: Dimensions;
  readonly factors: readonly Factor[];
  /** For a wrong formula, what is wrong with it; absent for a right one. */
  readonly fault?: string;
}

const BOLTZMANN: Factor = {
  symbol: "k",
  subscript: "B",
  name: "Boltzmann's constant",
  unit: "J/K",
  dimensions: dims(1, 2, -2, -1),
  placement: "top",
};
const TEMPERATURE: Factor = {
  symbol: "T",
  name: "the temperature",
  unit: "K",
  dimensions: dims(0, 0, 0, 1),
  placement: "top",
};
const SIX_PI: Factor = {
  symbol: "6π",
  name: "six times pi",
  unit: "none",
  dimensions: dims(0, 0, 0, 0),
  placement: "number",
};
const VISCOSITY: Factor = {
  symbol: "η",
  name: "the viscosity",
  unit: "Pa s",
  dimensions: dims(1, -1, -1, 0),
  placement: "bottom",
};
const RADIUS: Factor = {
  symbol: "a",
  name: "the particle's radius",
  unit: "m",
  dimensions: dims(0, 1, 0, 0),
  placement: "bottom",
};
const DIFFUSIVITY: Dimensions = dims(0, 2, -1, 0);
const TWO: Factor = { ...SIX_PI, symbol: "2", name: "the number two" };
const D_ROOT: Factor = {
  symbol: "D",
  name: "the diffusion coefficient",
  unit: "m²/s",
  dimensions: DIFFUSIVITY,
  placement: "root",
};
const T_ROOT: Factor = {
  symbol: "t",
  name: "the time",
  unit: "s",
  dimensions: dims(0, 0, 1, 0),
  placement: "root",
};

export const CANCELLATION_FORMULAS: readonly CancellationFormula[] = [
  {
    id: "diffusivity",
    label: "D, the diffusion coefficient",
    quantity: "a diffusion coefficient",
    expected: DIFFUSIVITY,
    factors: [BOLTZMANN, TEMPERATURE, SIX_PI, VISCOSITY, RADIUS],
  },
  {
    id: "diffusivity-no-radius",
    label: "D with the radius left out",
    quantity: "a diffusion coefficient",
    expected: DIFFUSIVITY,
    factors: [BOLTZMANN, TEMPERATURE, SIX_PI, VISCOSITY],
    fault: "The radius a is missing from the bottom, so a metre too many survives.",
  },
  {
    id: "spread",
    label: "λ, the spread",
    quantity: "a length",
    expected: dims(0, 1, 0, 0),
    factors: [TWO, D_ROOT, T_ROOT],
  },
  {
    id: "spread-no-root",
    label: "λ with the root left off",
    quantity: "a length",
    expected: dims(0, 1, 0, 0),
    factors: [TWO, { ...D_ROOT, placement: "top" }, { ...T_ROOT, placement: "top" }],
    fault: "Without the square root the result is an area. The root halves every power.",
  },
  {
    id: "quantum",
    label: "hν, the energy of one quantum",
    quantity: "an energy",
    expected: dims(1, 2, -2, 0),
    factors: [
      {
        symbol: "h",
        name: "Planck's constant",
        unit: "J s",
        dimensions: dims(1, 2, -1, 0),
        placement: "top",
      },
      {
        symbol: "ν",
        name: "the frequency",
        unit: "Hz",
        dimensions: dims(0, 0, -1, 0),
        placement: "top",
      },
    ],
  },
  {
    id: "mass-energy",
    label: "L/V², the mass paper's mass",
    quantity: "a mass",
    expected: dims(1, 0, 0, 0),
    factors: [
      {
        symbol: "L",
        name: "the energy given off as light",
        unit: "J",
        dimensions: dims(1, 2, -2, 0),
        placement: "top",
      },
      {
        symbol: "V²",
        name: "the speed of light, squared",
        unit: "m²/s²",
        dimensions: dims(0, 2, -2, 0),
        placement: "bottom",
      },
    ],
  },
];

/** Adds every factor's powers, each raised to its placement's power. */
export function combine(factors: readonly Factor[]): Dimensions {
  const total: Record<BaseUnit, number> = { kg: 0, m: 0, s: 0, K: 0 };
  for (const factor of factors) {
    const power = PLACEMENT_POWER[factor.placement];
    for (const unit of BASE_UNITS) total[unit] += factor.dimensions[unit] * power;
  }
  return total;
}

export const sameDimensions = (a: Dimensions, b: Dimensions): boolean =>
  BASE_UNITS.every((unit) => a[unit] === b[unit]);

export interface CancellationResult {
  readonly result: Dimensions;
  readonly agrees: boolean;
}

export function checkFormula(formula: CancellationFormula): CancellationResult {
  const result = combine(formula.factors);
  return { result, agrees: sameDimensions(result, formula.expected) };
}

export const PLACEMENT_WORDS: Readonly<Record<Placement, string>> = {
  top: "on top",
  bottom: "underneath",
  root: "under the square root, so its powers are halved",
  number: "a pure number with no units",
};
