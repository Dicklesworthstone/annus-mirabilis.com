/**
 * The entropy-multiplicity lesson's configuration counter, as pure logic.
 *
 * A box is cut into `cells` equal parts and the squeezed volume v keeps `kept` of them, so
 * v/v₀ = kept/cells. Each of n independent particles lands in any cell with equal chance, so there
 * are cellsⁿ equally likely arrangements, keptⁿ of them have every particle inside v, and the
 * probability of the squeezed state is W = (v/v₀)ⁿ. Its logarithm is n·ln(v/v₀), and Boltzmann's
 * principle, which the light paper uses in §5, turns that into the entropy change k_B·ln W.
 *
 * Counts beyond 10¹⁵ are carried as a power of ten. Neither W nor a count is ever rounded to 0 or
 * printed as Infinity: for a gram-molecule squeezed to half, W is 10 to the power −1.81 × 10²³,
 * which no floating-point number can hold, but its logarithm can.
 */

import { formatScientificSuperscript, toSuperscriptDigits } from "../i18n/numberLocale.ts";

/** The exact 2019 SI Boltzmann constant, J/K. A test pins it to the constants owner. */
export const BOLTZMANN_CONSTANT = 1.380649e-23;
/** The exact 2019 SI Avogadro constant: the number of particles in a gram-molecule. */
export const GRAM_MOLECULE = 6.02214076e23;

export type Squeeze = Readonly<{ cells: number; kept: number; name: string; part: string }>;

export const SQUEEZES: readonly Squeeze[] = [
  { cells: 2, kept: 1, name: "half", part: "the left half" },
  { cells: 4, kept: 1, name: "a quarter", part: "the first quarter" },
  { cells: 10, kept: 9, name: "nine tenths", part: "the first nine tenths" },
];

export const PARTICLE_CHOICES: readonly number[] = [1, 2, 4, 10, 100, GRAM_MOLECULE];

/** At most this many arrangements are listed one by one. */
export const LISTING_LIMIT = 16;

/** A count or a probability: exact when it fits, otherwise a power of ten. */
export type Magnitude =
  | Readonly<{ kind: "exact"; value: number }>
  | Readonly<{ kind: "power"; log10: number }>;

/** One arrangement: the cell (1-based) each particle is in, and whether all are inside v. */
export type Arrangement = Readonly<{ cells: readonly number[]; inside: boolean }>;

/** How many arrangements put exactly `inside` of the particles inside v, from all of them to none. */
export type Split = Readonly<{ inside: number; arrangements: number }>;

export type Configurations = Readonly<{
  n: number;
  squeeze: Squeeze;
  total: Magnitude;
  favourable: Magnitude;
  probability: Magnitude;
  /** ln W = n·ln(v/v₀), in units of nothing: a pure number. */
  lnW: number;
  /** S − S₀ = k_B·ln W, in joules per kelvin. */
  entropyChange: number;
  /** Every arrangement, when there are at most LISTING_LIMIT of them; otherwise null. */
  listing: readonly Arrangement[] | null;
  /** The listing counted by how many particles are inside v; null when there is no listing. */
  splits: readonly Split[] | null;
}>;

const EXACT_LIMIT = 1e15;

function power(base: number, n: number): Magnitude {
  const log10 = n * Math.log10(base);
  if (log10 <= Math.log10(EXACT_LIMIT) && Number.isInteger(n)) {
    const value = base ** n;
    if (Number.isSafeInteger(value)) return { kind: "exact", value };
  }
  return { kind: "power", log10 };
}

function probability(fraction: number, n: number): Magnitude {
  const log10 = n * Math.log10(fraction);
  // A probability smaller than 10⁻³⁰⁰ underflows a double; keep it as a power of ten.
  return log10 > -300 ? { kind: "exact", value: fraction ** n } : { kind: "power", log10 };
}

function listing(cells: number, kept: number, n: number): readonly Arrangement[] | null {
  if (!Number.isInteger(n) || cells ** n > LISTING_LIMIT) return null;
  const out: Arrangement[] = [];
  for (let index = 0; index < cells ** n; index++) {
    const placed: number[] = [];
    let rest = index;
    for (let particle = 0; particle < n; particle++) {
      placed.unshift((rest % cells) + 1);
      rest = Math.floor(rest / cells);
    }
    out.push({ cells: placed, inside: placed.every((cell) => cell <= kept) });
  }
  return out;
}

function splits(list: readonly Arrangement[] | null, kept: number, n: number): Split[] | null {
  if (list === null) return null;
  return Array.from({ length: n + 1 }, (_, i) => n - i).map((inside) => ({
    inside,
    arrangements: list.filter((a) => a.cells.filter((cell) => cell <= kept).length === inside)
      .length,
  }));
}

/** The counter's whole state for n particles and one squeeze. */
export function configurations(n: number, squeeze: Squeeze): Configurations {
  const fraction = squeeze.kept / squeeze.cells;
  const lnW = n * Math.log(fraction);
  const list = listing(squeeze.cells, squeeze.kept, n);
  return {
    n,
    squeeze,
    total: power(squeeze.cells, n),
    favourable: power(squeeze.kept, n),
    probability: probability(fraction, n),
    lnW,
    entropyChange: BOLTZMANN_CONSTANT * lnW,
    listing: list,
    splits: splits(list, squeeze.kept, n),
  };
}

/** A number in the lessons' style, with "−" for minus and a superscript power of ten. */
export function sci(value: number, figures = 3): string {
  if (value === 0) return "0";
  const [mantissa, exponent] = value.toExponential(figures - 1).split("e") as [string, string];
  const exp = Number(exponent);
  const plain =
    exp >= -3 && exp < 6
      ? Number(value.toPrecision(figures)).toString()
      : formatScientificSuperscript(mantissa, exp);
  return plain.replace(/^-/, "−");
}

/** Thousands grouped with thin spaces, as the lessons print "299 792 458". */
export function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** A count or probability in words a reader can say aloud. */
export function describeMagnitude(m: Magnitude, figures = 3): string {
  if (m.kind === "exact") {
    if (Number.isInteger(m.value)) return grouped(m.value);
    // 1/16 is exactly 0.0625 and says so; (1/2)¹⁰⁰ is rounded and says "about".
    const shown = sci(m.value, figures);
    return Number(m.value.toPrecision(figures)) === m.value ? shown : `about ${shown}`;
  }
  // An exact power of ten, such as the 10¹⁰⁰ arrangements of 100 particles in tenths, says so.
  if (Number.isInteger(m.log10) && Math.abs(m.log10) < 300)
    return `10${toSuperscriptDigits(m.log10)}`;
  // 10^x with x = whole + fractional part: the mantissa is 10^fraction.
  let whole = Math.floor(m.log10);
  let mantissa = (10 ** (m.log10 - whole)).toFixed(figures - 1);
  // 9.996 would print as "10.0"; carry it into the power instead.
  if (Number(mantissa) >= 10) {
    whole += 1;
    mantissa = (Number(mantissa) / 10).toFixed(figures - 1);
  }
  if (Math.abs(m.log10) < 300) return `about ${formatScientificSuperscript(mantissa, whole)}`;
  return `10 to the power ${sci(m.log10, figures)}`;
}
