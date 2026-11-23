import { binomialPartialSumsGamma } from "./calculus.ts";

export type TaylorTermCount = 1 | 2 | 3 | 4;
export const TAYLOR_TERM_COUNTS: readonly TaylorTermCount[] = Object.freeze([1, 2, 3, 4] as const);
/** Keeps the fourth remainder above underflow, including its leading x^5 factor. */
export const MINIMUM_TAYLOR_SPEED = 1e-30;

export interface TaylorTerm {
  readonly count: TaylorTermCount;
  readonly term: number;
  readonly sum: number;
  readonly remainder: number;
  /** Undefined at rest, where the full expression and every partial sum are zero. */
  readonly relativeRemainder: number | null;
}

export interface TaylorSample {
  readonly speed: number;
  readonly exact: number;
  readonly approximation: number;
  readonly relativeRemainder: number | null;
}

export interface TaylorComparison {
  readonly speed: number;
  readonly x: number;
  readonly count: TaylorTermCount;
  readonly exact: number;
  readonly selected: TaylorTerm;
  readonly terms: readonly TaylorTerm[];
  readonly samples: readonly TaylorSample[];
}

export type TaylorRefusal = Readonly<{
  kind: "refused";
  field: "speed" | "terms";
  message: string;
}>;
export type TaylorOutcome =
  | Readonly<{ kind: "accepted"; comparison: TaylorComparison }>
  | TaylorRefusal;

// These polynomial coefficients are dyadic, so this bounded convolution and its subtractions
// are exact in binary64. For P_n = 1 + the first n terms, 1 - (1-x)P_n² begins at x^(n+1).
// Its remaining coefficients are positive. Rationalizing the remainder gives
//   R_n = [1 - (1-x)P_n²] / [sqrt(1-x) (1 + sqrt(1-x) P_n)].
// Factoring its numerator before evaluation preserves errors too small for full-minus-partial.
const COEFFICIENTS = [1, 1 / 2, 3 / 8, 5 / 16, 35 / 128] as const;
const REMAINDER_POLYNOMIALS = TAYLOR_TERM_COUNTS.map((count) => {
  const square = Array<number>(2 * count + 1).fill(0);
  for (let i = 0; i <= count; i += 1) {
    for (let j = 0; j <= count; j += 1) {
      square[i + j] = (square[i + j] ?? 0) + COEFFICIENTS[i]! * COEFFICIENTS[j]!;
    }
  }
  return Object.freeze(
    Array.from({ length: count + 1 }, (_, index) => {
      const power = count + 1 + index;
      return (square[power - 1] ?? 0) - (square[power] ?? 0);
    }),
  );
});

function remainder(x: number, count: TaylorTermCount, sum: number): number {
  if (x === 0) return 0;
  const coefficients = REMAINDER_POLYNOMIALS[count - 1]!;
  let polynomial = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1)
    polynomial = polynomial * x + coefficients[i]!;
  const root = Math.sqrt(1 - x);
  return (x ** (count + 1) * polynomial) / (root * (1 + root * (1 + sum)));
}

function atSpeed(speed: number) {
  const sums = binomialPartialSumsGamma(speed * speed);
  const terms = Object.freeze(
    TAYLOR_TERM_COUNTS.map((count): TaylorTerm => {
      const sum = sums.partialSums[count - 1]!;
      const tail = remainder(sums.x, count, sum);
      return Object.freeze({
        count,
        term: sums.terms[count - 1]!,
        sum,
        remainder: tail,
        relativeRemainder: sums.exact === 0 ? null : tail / sums.exact,
      });
    }),
  );
  return { exact: sums.exact, x: sums.x, terms };
}

const REFERENCE_SPEEDS = [0, 0.0001, 0.01, 0.1, 0.3, 0.6, 0.9, 0.99] as const;

function compare(speed: number, count: TaylorTermCount): TaylorComparison {
  const current = atSpeed(speed);
  const samples = Object.freeze(
    REFERENCE_SPEEDS.map((sampleSpeed): TaylorSample => {
      const sample = atSpeed(sampleSpeed);
      const selected = sample.terms[count - 1]!;
      return Object.freeze({
        speed: sampleSpeed,
        exact: sample.exact,
        approximation: selected.sum,
        relativeRemainder: selected.relativeRemainder,
      });
    }),
  );
  return Object.freeze({
    speed,
    x: current.x,
    count,
    exact: current.exact,
    selected: current.terms[count - 1]!,
    terms: current.terms,
    samples,
  });
}

export const INITIAL_TAYLOR_COMPARISON = compare(0.6, 1);

export function compareTaylorApproximation(speed: number, count: number): TaylorOutcome {
  if (
    !Number.isFinite(speed) ||
    speed < 0 ||
    speed >= 1 ||
    (speed !== 0 && speed < MINIMUM_TAYLOR_SPEED)
  )
    return {
      kind: "refused",
      field: "speed",
      message: "Use zero or a finite speed from 10⁻³⁰ up to, but not including, 1.",
    };
  if (!Number.isInteger(count) || count < 1 || count > 4)
    return {
      kind: "refused",
      field: "terms",
      message: "Choose one, two, three or four retained terms.",
    };
  return { kind: "accepted", comparison: compare(speed, count as TaylorTermCount) };
}

export function readTaylorApproximation(speedText: string, count: number): TaylorOutcome {
  const text = speedText.trim();
  if (
    text.length > 64 ||
    !/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text)
  )
    return {
      kind: "refused",
      field: "speed",
      message: "Enter a speed as a decimal or a power of ten, without units or expressions.",
    };
  const speed = Number(text);
  // A nonzero decimal may underflow in Number(); it must not become the rest example.
  if (speed === 0 && /[1-9]/u.test(text.split(/[eE]/u)[0] ?? ""))
    return {
      kind: "refused",
      field: "speed",
      message: "That nonzero speed is too small here. Use a speed of at least 10⁻³⁰, or zero.",
    };
  return compareTaylorApproximation(speed, count);
}
