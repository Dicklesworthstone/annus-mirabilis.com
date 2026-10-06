/**
 * THE DIMENSION OF A LABORATORY OUTPUT'S DECLARED UNIT (am-ff2s).
 *
 * AGENTS.md lists "dimension mismatches in supported expressions" among what the content compiler
 * rejects. No check compared an OUTPUT's declared unit with the dimension of the quantity its manifest
 * binds it to, which is why bm-07 declares `radiusNumberProduct: c("m/mol", ...)` in code and
 * `quantityId: avogadroNumberEstimate` in its manifest - a mismatch of a whole length dimension,
 * sitting in a manifest where anything reading the output's quantityId for a name, a unit or a colour
 * inherits it.
 *
 * WHY A NEW PARSER RATHER THAN `parseUnitToDimension`. That one exists in qty.ts and is a flat table of
 * exact spellings, and this was tried against it once before and discarded. src/content/teachingTapes.ts
 * records the attempt verbatim: "parseUnitToDimension returns dimensionless for every compound unit it
 * does not know ('m/mol', '1/mol', 'm2/s' and 'J/K' all come back [0,0,0,0,0,0]) ... A guard that cannot
 * fail is not a guard". Returning dimensionless for an unrecognised unit is the defect: it makes every
 * comparison agree, and agreement is what the comparison is for.
 *
 * SO THE ONE RULE HERE IS THAT AN UNRECOGNISED UNIT IS NEVER A DIMENSION. `unitDimension` returns a
 * tagged result, and `kind: "unparsed"` names the token it could not read. A caller that treats unparsed
 * as agreement has reintroduced the bug, which is why there is no fallback value to reach for.
 *
 * BUILT AGAINST THE MEASURED CORPUS, not against a guess at what units look like. Enumerating every
 * `*_OUTPUTS` contract across the 40 experiment modules on 2026-10-06 gives 560 contracts, 478 distinct
 * output ids and FIFTY-THREE distinct unit strings. All 53 are specimens in
 * outputUnitDimension.test.ts, so a unit this parser cannot read is a failing test rather than a quiet
 * dimensionless.
 *
 * The grammar is small because the corpus is: an optional numerator and denominator separated by `/`,
 * each a product of factors separated by a space, `·` or `*`, each factor a unit token with an exponent
 * written `^n`, as a trailing digit (`m2`, `m4`), or as a trailing negative (`m-2`, `kg-1`). A
 * parenthesised denominator groups its factors (`J/(m^3 Hz K)`).
 */

import {
  DIMENSION_COUNT,
  type RationalDimension,
  type RationalScale,
} from "../content/schemas/dimensionBasis.ts";

/** [length, mass, time, temperature, current, amount] — DIMENSION_BASIS order, not qty.ts's. */
export type Exponents = readonly [number, number, number, number, number, number];

const Z: Exponents = [0, 0, 0, 0, 0, 0];
const add = (a: Exponents, b: Exponents, times: number): Exponents =>
  [
    a[0] + b[0] * times,
    a[1] + b[1] * times,
    a[2] + b[2] * times,
    a[3] + b[3] * times,
    a[4] + b[4] * times,
    a[5] + b[5] * times,
  ] as const;

const L: Exponents = [1, 0, 0, 0, 0, 0];
const M: Exponents = [0, 1, 0, 0, 0, 0];
const T: Exponents = [0, 0, 1, 0, 0, 0];
const K: Exponents = [0, 0, 0, 1, 0, 0];
const I: Exponents = [0, 0, 0, 0, 1, 0];
const N: Exponents = [0, 0, 0, 0, 0, 1];

/**
 * Unit token to dimension. Keyed by the token as written in the contracts, case-sensitively, because
 * `T` is tesla and `s` is a second while `S` is nothing here: a case-insensitive table would make
 * `MS`, `Ms` and `ms` one unit. The entries are the measured corpus plus the SI base and the derived
 * units an output could plausibly gain.
 */
const TOKENS: Readonly<Record<string, Exponents>> = Object.freeze({
  // Dimensionless, each written somewhere in the corpus or in a reader-facing ratio.
  "1": Z,
  "": Z,
  "%": Z,
  rad: Z,
  deg: Z,
  sr: Z,
  count: Z,
  // SI base.
  m: L,
  kg: M,
  g: M,
  s: T,
  K: K,
  A: I,
  mol: N,
  // Length-flavoured units the corpus writes directly.
  nm: L,
  um: L,
  µm: L,
  mm: L,
  cm: L,
  km: L,
  /**
   * The light-second, a LENGTH. SR instruments measure distances in light-seconds so that c is 1 in
   * their own numbers; the quantity it binds to is still a length, which is the whole reason this has
   * to be a token rather than an unparsed string.
   */
  ls: L,
  /** A wavelength, used as a unit of length by the wave laboratories. */
  lambda: L,
  // Time.
  ns: T,
  us: T,
  µs: T,
  ms: T,
  // Derived, in DIMENSION_BASIS order.
  N: add(add(M, L, 1), T, -2),
  J: add(add(M, L, 2), T, -2),
  W: add(add(M, L, 2), T, -3),
  Pa: add(add(M, L, -1), T, -2),
  Hz: add(Z, T, -1),
  THz: add(Z, T, -1),
  GHz: add(Z, T, -1),
  MHz: add(Z, T, -1),
  kHz: add(Z, T, -1),
  C: add(I, T, 1),
  V: add(add(add(M, L, 2), T, -3), I, -1),
  T: add(add(M, T, -2), I, -1),
  /**
   * The speed of light AS A UNIT, which is how SR outputs report a velocity ("0.6 c"). Its dimension
   * is a velocity, so an output in `c` bound to a dimensionless quantity is a real mismatch and one in
   * `c` bound to a velocity agrees.
   */
  c: add(L, T, -1),
  eV: add(add(M, L, 2), T, -2),
});

export type UnitDimension =
  | Readonly<{ kind: "dimension"; exponents: Exponents }>
  | Readonly<{ kind: "unparsed"; unit: string; token: string; reason: string }>;

/**
 * `m2` -> {name: "m", power: 2}; `m-2` -> power -2; `m^3` -> power 3; `m` -> power 1.
 *
 * THE NAME CLASS IS LETTERS, not "anything but a digit", and the difference is two real units. With
 * `[^\d^]+` the name matched greedily THROUGH the minus sign, so `m-2` split as name `m-` and power 2
 * and `kg-1 s` as name `kg-`: both came back unparsed, naming a token that does not exist. Measured
 * against the corpus, those were the only two of 53 unit strings this parser could not read.
 */
function splitFactor(factor: string): { name: string; power: number } | null {
  const NAME = String.raw`[A-Za-z\u00b0\u00b5%]+`;
  const caret = new RegExp(`^(${NAME})\\^(-?\\d+)$`).exec(factor);
  if (caret?.[1] !== undefined && caret[2] !== undefined)
    return { name: caret[1], power: Number(caret[2]) };
  const trailing = new RegExp(`^(${NAME})(-?\\d+)$`).exec(factor);
  if (trailing?.[1] !== undefined && trailing[2] !== undefined)
    return { name: trailing[1], power: Number(trailing[2]) };
  if (/[\d^]/.test(factor)) return factor === "1" ? { name: "1", power: 1 } : null;
  return { name: factor, power: 1 };
}

function productOf(text: string, unit: string, sign: number): UnitDimension {
  let out: Exponents = Z;
  const factors = text
    .replace(/[()]/g, " ")
    .split(/[\s·*]+/)
    .filter((f) => f.length > 0);
  for (const factor of factors) {
    const split = splitFactor(factor);
    if (split === null)
      return {
        kind: "unparsed",
        unit,
        token: factor,
        reason: "a factor whose exponent could not be read",
      };
    const dim = TOKENS[split.name];
    if (dim === undefined)
      return { kind: "unparsed", unit, token: split.name, reason: "an unknown unit token" };
    out = add(out, dim, split.power * sign);
  }
  return { kind: "dimension", exponents: out };
}

/**
 * The dimension of a declared unit string, or an explicit refusal naming the token.
 *
 * Never returns a dimension for a unit it does not understand. See the docblock.
 */
export function unitDimension(unit: string): UnitDimension {
  const text = unit.trim();
  if (text === "") return { kind: "dimension", exponents: Z };
  const slash = text.indexOf("/");
  if (slash === -1) return productOf(text, unit, 1);
  const numerator = productOf(text.slice(0, slash), unit, 1);
  if (numerator.kind === "unparsed") return numerator;
  const denominator = productOf(text.slice(slash + 1), unit, -1);
  if (denominator.kind === "unparsed") return denominator;
  return { kind: "dimension", exponents: add(numerator.exponents, denominator.exponents, 1) };
}

/** A registry dimension as plain integer exponents, or null when any slot is not an integer. */
export function registryExponents(dimension: RationalDimension): Exponents | null {
  if (dimension.length !== DIMENSION_COUNT) return null;
  const out: number[] = [];
  for (const slot of dimension) {
    if (slot.den === 0) return null;
    const value = slot.num / slot.den;
    if (!Number.isInteger(value)) return null;
    out.push(value);
  }
  return out as unknown as Exponents;
}

/** True only when a registry dimension carries a non-integer exponent, which this comparison declines. */
export function hasFractionalExponent(dimension: RationalDimension): boolean {
  return dimension.some(
    (slot: RationalScale) => slot.den !== 0 && !Number.isInteger(slot.num / slot.den),
  );
}

export function exponentsEqual(a: Exponents, b: Exponents): boolean {
  return a.every((value, i) => value === b[i]);
}

const SYMBOLS = ["m", "kg", "s", "K", "A", "mol"] as const;

/** `m^2 s^-1`, for a message a reader can compare with a unit string. */
export function formatExponents(e: Exponents): string {
  const parts: string[] = [];
  e.forEach((power, i) => {
    const symbol = SYMBOLS[i];
    if (power === 0 || symbol === undefined) return;
    parts.push(power === 1 ? symbol : `${symbol}^${power}`);
  });
  return parts.length === 0 ? "1" : parts.join(" ");
}
