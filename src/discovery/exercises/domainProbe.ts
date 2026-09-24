/**
 * The domain probe (am-disc-exercise-checker-i4h2). Agreement over a declared range answers a
 * narrower question than a reader hears: sqrt(x^2) and x agree at every point of [0.1, 10] and are
 * still different expressions. After an "equivalent" verdict the probe tries a few points OUTSIDE
 * the declared ranges and reports the first place the two part company, as a note beneath the
 * verdict. The verdict itself never changes.
 *
 * Where the probe looks, per variable:
 * - the part's authored contrastDomain, when it declares one;
 * - otherwise, for a range on one side of zero, zero itself (when the range excludes it) and the
 *   mirror image of the range through zero;
 * - for a range that straddles zero, whose mirror overlaps itself, one range width beyond each end.
 * A point with one variable at zero and the others at their declared midpoints comes first, then
 * Halton points with every variable in its contrast region at once, which is what ln(a*b) against
 * ln(a)+ln(b) needs: the two part company only where a and b are both negative.
 *
 * Probe values are rounded to the fewest significant figures, up to three, that keep them in the
 * region, so a note says "x = −5" rather than "x = −5.05" and a reader can check it by hand.
 *
 * A point counts only when at least one side has a value; where both are undefined there is nothing
 * to compare. With fewer than three counted points and no note the result is probe-not-available,
 * so an absent note is never read as agreement everywhere.
 */
import { exponentialParts } from "../../units/scientific.ts";
import { type ToleranceSpec, withinTolerance } from "../../units/tolerance.ts";
import { evaluate } from "./evaluate.ts";
import type { Expr } from "./grammar.ts";
import {
  type Domain,
  HALTON_BASES,
  haltonValue,
  mapUnitToDomain,
  type SamplePoint,
} from "./samplePoints.ts";

/** A sentence as text and numbers, so a page can draw each number and a test can read the text. */
export type NoteSegment = string | Readonly<{ number: number }>;

export type DomainProbeOutcome =
  | Readonly<{ kind: "agrees"; acceptedPointCount: number }>
  | Readonly<{
      kind: "scope-note";
      point: SamplePoint;
      readerValue: number;
      referenceValue: number;
      segments: readonly NoteSegment[];
      text: string;
    }>
  | Readonly<{
      kind: "domain-note";
      point: SamplePoint;
      definedSide: "reader" | "reference";
      definedValue: number;
      reason: string;
      segments: readonly NoteSegment[];
      text: string;
    }>
  | Readonly<{ kind: "probe-not-available"; reason: string }>;

export interface ProbeSettings {
  readonly domains: Readonly<Record<string, Domain>>;
  readonly tolerance: ToleranceSpec;
  readonly contrastDomain?: Readonly<Record<string, Domain>>;
  /** One authored sentence naming the condition, used verbatim as the note's first sentence. */
  readonly conditionNote?: string;
}

const TARGET_ACCEPTED = 8;
const MIN_ACCEPTED = 3;
const HALTON_CANDIDATES = 64;

const DIVIDES_BY_ZERO = "it divides by zero";
const LOGARITHM = "a logarithm needs a positive argument";
const SQUARE_ROOT = "a square root needs an argument that is not negative";
const FRACTIONAL_POWER = "a negative number has no real fractional power";
const TOO_LARGE = "a value in it grows too large to represent";

/** Why an expression has no value at a point: the innermost operation that fails, in words. */
export function undefinedReason(expr: Expr, env: Readonly<Record<string, number>>): string {
  switch (expr.kind) {
    case "number":
    case "identifier":
      return TOO_LARGE;
    case "unary":
      return undefinedReason(expr.operand, env);
    case "call": {
      const arg = evaluate(expr.arg, env);
      if (arg.status !== "value") return undefinedReason(expr.arg, env);
      if (expr.name === "ln" && arg.value <= 0) return LOGARITHM;
      if (expr.name === "sqrt" && arg.value < 0) return SQUARE_ROOT;
      return TOO_LARGE;
    }
    case "binary": {
      const left = evaluate(expr.left, env);
      if (left.status !== "value") return undefinedReason(expr.left, env);
      const right = evaluate(expr.right, env);
      if (right.status !== "value") return undefinedReason(expr.right, env);
      if (expr.op === "/" && right.value === 0) return DIVIDES_BY_ZERO;
      if (expr.op === "^" && left.value === 0 && right.value < 0) return DIVIDES_BY_ZERO;
      if (expr.op === "^" && left.value < 0 && !Number.isInteger(right.value))
        return FRACTIONAL_POWER;
      return TOO_LARGE;
    }
  }
}

interface Contrast {
  readonly specials: readonly number[];
  at(u: number): number;
  admits(value: number): boolean;
}

function contrastFor(declared: Domain, authored: Domain | undefined): Contrast {
  const inDeclared = (v: number) => v >= declared.min && v <= declared.max;
  if (authored)
    return {
      specials: [],
      at: (u) => mapUnitToDomain(u, authored),
      admits: (v) => Number.isFinite(v) && v >= authored.min && v <= authored.max && !inDeclared(v),
    };
  if (!(declared.min < 0 && declared.max > 0))
    return {
      specials: inDeclared(0) ? [] : [0],
      at: (u) => -mapUnitToDomain(u, declared),
      admits: (v) => Number.isFinite(v) && !inDeclared(v),
    };
  const width = declared.max - declared.min;
  return {
    specials: [],
    at: (u) => (u < 0.5 ? declared.min - width * (1 - 2 * u) : declared.max + width * (2 * u - 1)),
    admits: (v) => Number.isFinite(v) && !inDeclared(v),
  };
}

/**
 * The value with the fewest significant figures, up to three, that the region still admits and
 * that this variable has not already used, so a narrow region still yields distinct points.
 */
function readable(
  value: number,
  admits: (v: number) => boolean,
  used: ReadonlySet<number> = new Set(),
): number {
  for (const figures of [1, 2, 3]) {
    const rounded = Number(value.toPrecision(figures)) + 0;
    if (admits(rounded) && !used.has(rounded)) return rounded;
  }
  return value + 0;
}

/**
 * Checks that an authored contrast region lies wholly outside the declared range. Returns one
 * sentence per overlapping variable, naming both intervals; an empty list means none overlaps.
 */
export function contrastOverlaps(
  domains: Readonly<Record<string, Domain>>,
  contrastDomain: Readonly<Record<string, Domain>>,
): readonly string[] {
  const problems: string[] = [];
  for (const name of Object.keys(contrastDomain).sort()) {
    const contrast = contrastDomain[name];
    const declared = domains[name];
    if (!contrast || !declared) {
      problems.push(`The contrast range names ${name}, which is not a declared variable.`);
      continue;
    }
    if (contrast.min <= declared.max && declared.min <= contrast.max)
      problems.push(
        `The contrast range for ${name}, [${contrast.min}, ${contrast.max}], overlaps its declared range [${declared.min}, ${declared.max}]; a probe point inside the tested range is not a contrast.`,
      );
  }
  return problems;
}

function candidates(settings: ProbeSettings): readonly SamplePoint[] {
  const names = Object.keys(settings.domains).sort();
  const contrasts = new Map(
    names.map((name) => {
      const declared = settings.domains[name] as Domain;
      return [name, contrastFor(declared, settings.contrastDomain?.[name])] as const;
    }),
  );
  const middle = Object.fromEntries(
    names.map((name) => {
      const declared = settings.domains[name] as Domain;
      const inside = (v: number) => v >= declared.min && v <= declared.max;
      return [name, readable(mapUnitToDomain(0.5, declared), inside)];
    }),
  );
  const used = new Map(names.map((name) => [name, new Set<number>()]));
  const out: SamplePoint[] = [];
  for (const name of names)
    for (const special of contrasts.get(name)?.specials ?? [])
      out.push(Object.freeze({ ...middle, [name]: special }));
  for (let i = 1; i <= HALTON_CANDIDATES; i++)
    out.push(
      Object.freeze(
        Object.fromEntries(
          names.map((name, j) => {
            const contrast = contrasts.get(name) as Contrast;
            const seen = used.get(name) as Set<number>;
            const value = readable(
              contrast.at(haltonValue(i, HALTON_BASES[j] ?? 2)),
              contrast.admits,
              seen,
            );
            seen.add(value);
            return [name, value];
          }),
        ),
      ),
    );
  return out;
}

/** Rounds a computed value to six significant figures for a sentence a reader can check. */
const shown = (value: number) => Number(value.toPrecision(6)) + 0;

function plain(value: number): string {
  const parts = exponentialParts(value);
  return parts.kind === "plain" ? parts.text : `${parts.mantissa} × 10^${parts.exponent}`;
}

function pointSegments(point: SamplePoint): NoteSegment[] {
  const names = Object.keys(point).sort();
  return names.flatMap((name, i) => [
    `${i > 0 ? ", " : ""}${name} = `,
    { number: point[name] as number },
  ]);
}

const joined = (segments: readonly NoteSegment[]) =>
  segments.map((s) => (typeof s === "string" ? s : plain(s.number))).join("");

/**
 * Runs the probe for a pair already judged equivalent. Deterministic: the same pair and settings
 * give the same points and the same sentence. Nothing throws; a failure to probe is an outcome.
 */
export function probeDomain(
  reader: Expr,
  reference: Expr,
  settings: ProbeSettings,
): DomainProbeOutcome {
  try {
    if (Object.keys(settings.domains).length === 0)
      return {
        kind: "probe-not-available",
        reason: "This exercise has no variables, so there is no range to look beyond.",
      };
    const seen = new Set<string>();
    let accepted = 0;
    const lead =
      settings.conditionNote ?? "These agree in the ranges this exercise uses, but not everywhere.";
    for (const point of candidates(settings)) {
      if (accepted >= TARGET_ACCEPTED) break;
      const key = JSON.stringify(
        Object.keys(point)
          .sort()
          .map((n) => point[n]),
      );
      if (seen.has(key)) continue;
      seen.add(key);
      const readerSide = evaluate(reader, point);
      const referenceSide = evaluate(reference, point);
      if (readerSide.status !== "value" && referenceSide.status !== "value") continue;
      if (readerSide.status === "value" && referenceSide.status === "value") {
        const compared = withinTolerance(readerSide.value, referenceSide.value, settings.tolerance);
        if (compared.kind === "invalid-spec") continue;
        accepted++;
        if (compared.ok) continue;
        const segments: NoteSegment[] = [
          `${lead} At `,
          ...pointSegments(point),
          " your expression gives ",
          { number: shown(readerSide.value) },
          " and the reference gives ",
          { number: shown(referenceSide.value) },
          ", so they are different expressions.",
        ];
        return {
          kind: "scope-note",
          point,
          readerValue: readerSide.value,
          referenceValue: referenceSide.value,
          segments,
          text: joined(segments),
        };
      }
      accepted++;
      const definedSide = readerSide.status === "value" ? "reader" : "reference";
      const defined = readerSide.status === "value" ? readerSide : referenceSide;
      const definedValue = defined.status === "value" ? defined.value : Number.NaN;
      const reason = undefinedReason(definedSide === "reader" ? reference : reader, point);
      const segments: NoteSegment[] = [
        `${lead} At `,
        ...pointSegments(point),
        definedSide === "reader" ? " your expression gives " : " the reference gives ",
        { number: shown(definedValue) },
        definedSide === "reader"
          ? ` and the reference cannot be evaluated, because ${reason}.`
          : ` and your expression cannot be evaluated, because ${reason}.`,
      ];
      return {
        kind: "domain-note",
        point,
        definedSide,
        definedValue,
        reason,
        segments,
        text: joined(segments),
      };
    }
    if (accepted < MIN_ACCEPTED)
      return {
        kind: "probe-not-available",
        reason:
          accepted === 0
            ? "Outside the stated ranges neither expression could be evaluated at the sample points tried, so this check cannot say whether they part company there."
            : `Outside the stated ranges only ${accepted} ${accepted === 1 ? "sample point" : "sample points"} could be evaluated, too few to say whether these expressions part company there.`,
      };
    return { kind: "agrees", acceptedPointCount: accepted };
  } catch (error) {
    return {
      kind: "probe-not-available",
      reason:
        error instanceof Error
          ? `The probe could not run: ${error.message}`
          : "The probe could not run.",
    };
  }
}
