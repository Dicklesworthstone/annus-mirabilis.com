/** Shared reader-answer workflow. No browser storage, network, eval or alternate RNG. */
import { type ToleranceSpec, validateToleranceSpec } from "../../units/tolerance.ts";
import { dimensionMessage, readDimensions } from "./dimensions.ts";
import { contrastOverlaps, type DomainProbeOutcome, probeDomain } from "./domainProbe.ts";
import { checkEquivalence, type EquivalenceOutcome } from "./equivalence.ts";
import { ALLOWED_FUNCTIONS, echo, parse } from "./grammar.ts";
import { normalize } from "./normalize.ts";
import { type Domain, validateDomains } from "./samplePoints.ts";

export interface ExpressionExercisePart {
  readonly id: string;
  readonly prompt: string;
  readonly declaredNames: readonly string[];
  readonly domains: Readonly<Record<string, Domain>>;
  readonly referenceSource: string;
  readonly tolerance: ToleranceSpec;
  readonly workedExplanation: string;
  /**
   * Optional: each variable's dimension, six exponents in the content/quantities order (length,
   * mass, time, temperature, current, amount). With it, a dimensionally wrong answer is told so
   * before any numeric comparison.
   */
  readonly dimensions?: Readonly<Record<string, readonly string[]>>;
  /**
   * Optional: per variable, where the domain probe looks after an "equivalent" verdict. Absent,
   * the probe uses zero and the mirror of the declared range (domainProbe.ts). A contrast range
   * that overlaps its declared range is refused, because a point already tested is no contrast.
   */
  readonly contrastDomain?: Readonly<Record<string, Domain>>;
  /** Optional: one authored sentence naming the condition, the probe note's first sentence. */
  readonly conditionNote?: string;
}
/** A refused probe setting. The code names the rule, so a test can name the refusal. */
export class ExerciseDefinitionError extends TypeError {
  readonly code: "exercise-contrast-overlap" | "exercise-condition-note-shape";
  constructor(code: ExerciseDefinitionError["code"], message: string) {
    super(message);
    this.name = "ExerciseDefinitionError";
    this.code = code;
  }
}
/**
 * What a reader can do next when the checker gives no verdict. The two outcomes differ: the first
 * means the checker cannot read the answer, the second that it could not find enough places to
 * compare it, and neither says whether the answer is right.
 */
export const NEXT_ACTION = Object.freeze({
  "unsupported-expression":
    "This says nothing about whether your answer is right. Rewrite it with the functions above and check again.",
  "could-not-compare":
    "This says nothing about whether your answer is right. The worked explanation below compares the two by hand.",
});

export type AnswerVerdict =
  | Readonly<{ kind: "parse-error"; position: number; message: string }>
  | Readonly<{
      kind: "unsupported-expression";
      /** The function the checker does not read, for example "tan". */
      name: string;
      position: number;
      message: string;
      nextAction: string;
    }>
  | Readonly<{ kind: "dimension"; message: string; readAs: string }>
  | Readonly<{
      kind: "checked";
      outcome: EquivalenceOutcome;
      /** How the reader's expression was read, every grouping explicit (grammar.ts echo). */
      readAs?: string;
      /** Present only after an "equivalent" outcome: where the agreement stops, if it does. */
      probe?: DomainProbeOutcome;
    }>;

function field(value: unknown, name: string): unknown {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new TypeError("Exercise settings must be plain records.");
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
    throw new TypeError(`Missing exercise field or accessor: ${name}.`);
  return descriptor.value;
}
/** An optional field: undefined when absent, its value when it is a plain enumerable value. */
function optional(value: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor?.enumerable && Object.hasOwn(descriptor, "value")
    ? descriptor.value
    : undefined;
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new TypeError(`Invalid ${label}.`);
  return value;
}

/** Snapshot the computational definition BEFORE any asynchronous digest; caller edits
 * cannot change the meaning of an in-flight answer. Extra editorial fields are not inputs. */
export function snapshotExercise(part: ExpressionExercisePart): ExpressionExercisePart {
  const id = text(field(part, "id"), "exercise identity", 160);
  const prompt = text(field(part, "prompt"), "exercise prompt", 4000);
  const workedExplanation = text(field(part, "workedExplanation"), "worked explanation", 8000);
  const referenceSource = text(field(part, "referenceSource"), "reference expression", 200);
  const rawNames = field(part, "declaredNames");
  if (
    !Array.isArray(rawNames) ||
    rawNames.length > 9 ||
    rawNames.some(
      (n) =>
        typeof n !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(n) ||
        ["constructor", "prototype", ...ALLOWED_FUNCTIONS].includes(n),
    ) ||
    new Set(rawNames).size !== rawNames.length
  )
    throw new TypeError("Declare distinct variable names and optional pi, not function names.");
  const declaredNames = Object.freeze([...rawNames] as string[]);
  const rawDomains = field(part, "domains") as Readonly<Record<string, Domain>>;
  const variables = [...validateDomains(rawDomains)].sort();
  if (
    variables.some((n) => !declaredNames.includes(n)) ||
    declaredNames.some((n) => n !== "pi" && !variables.includes(n))
  )
    throw new TypeError("Every variable must have exactly one declared domain; pi is a constant.");
  const domains = Object.freeze(
    Object.fromEntries(
      variables.map((name) => {
        const domain = rawDomains[name];
        if (!domain) {
          throw new TypeError(`Missing domain for variable: ${name}`);
        }
        return [
          name,
          Object.freeze({ min: domain.min, max: domain.max, scale: domain.scale ?? "linear" }),
        ];
      }),
    ),
  );
  const rawTolerance = field(part, "tolerance");
  if (!rawTolerance || ![Object.prototype, null].includes(Object.getPrototypeOf(rawTolerance)))
    throw new TypeError("Invalid exercise tolerance.");
  const fields = Object.getOwnPropertyDescriptors(rawTolerance);
  if (
    Reflect.ownKeys(rawTolerance).some((k) => {
      if (typeof k !== "string" || !["absolute", "relative", "relativeTo"].includes(k)) {
        return true;
      }
      const desc = fields[k];
      return !desc?.enumerable || !Object.hasOwn(desc, "value");
    })
  )
    throw new TypeError("Invalid exercise tolerance field.");
  if (
    (fields.absolute && typeof fields.absolute.value !== "number") ||
    (fields.relative && typeof fields.relative.value !== "number") ||
    (fields.relativeTo && typeof fields.relativeTo.value !== "string")
  )
    throw new TypeError("Tolerance values must not be coerced from null or other types.");
  const tolerance: ToleranceSpec = Object.freeze({
    absolute: fields.absolute?.value ?? 0,
    relative: fields.relative?.value ?? 0,
    relativeTo: fields.relativeTo?.value ?? "reference",
  });
  if (
    !tolerance.relativeTo ||
    !["reference", "larger"].includes(tolerance.relativeTo) ||
    validateToleranceSpec(tolerance, 1).length
  )
    throw new TypeError("The exercise tolerance is invalid.");
  const reference = parse(referenceSource, new Set(declaredNames));
  if (!reference.ok)
    throw new TypeError(`The reference expression is invalid: ${reference.message}`);
  // Optional, and never thrown on: a malformed map only turns the dimension pre-check off.
  const descriptor = Object.getOwnPropertyDescriptor(part, "dimensions");
  const rawDimensions: unknown =
    descriptor?.enumerable && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  const dimensionMap = rawDimensions ? readDimensions(rawDimensions, variables) : null;
  // readDimensions accepted it, so it is a record with a six-entry list for every variable.
  const accepted = rawDimensions as Readonly<Record<string, readonly string[]>>;
  const dimensions = dimensionMap
    ? Object.freeze(
        Object.fromEntries(
          variables.map((name) => [name, Object.freeze([...(accepted[name] ?? [])])]),
        ),
      )
    : undefined;
  const rawContrast = optional(part, "contrastDomain") as
    | Readonly<Record<string, Domain>>
    | undefined;
  let contrastDomain: Readonly<Record<string, Domain>> | undefined;
  if (rawContrast !== undefined) {
    const named = validateDomains(rawContrast);
    const problems = contrastOverlaps(domains, rawContrast);
    if (problems.length)
      throw new ExerciseDefinitionError(
        "exercise-contrast-overlap",
        `Exercise ${id}: ${problems.join(" ")}`,
      );
    contrastDomain = Object.freeze(
      Object.fromEntries(
        named.map((name) => {
          const d = rawContrast[name] as Domain;
          return [name, Object.freeze({ min: d.min, max: d.max, scale: d.scale ?? "linear" })];
        }),
      ),
    );
  }
  const rawNote = optional(part, "conditionNote");
  const conditionNote =
    rawNote === undefined ? undefined : text(rawNote, "condition note", 240).trim();
  if (conditionNote !== undefined && /[\n\r]/.test(conditionNote))
    throw new ExerciseDefinitionError(
      "exercise-condition-note-shape",
      `Exercise ${id}: a condition note is one sentence on one line.`,
    );
  return Object.freeze({
    id,
    prompt,
    workedExplanation,
    referenceSource,
    declaredNames,
    domains,
    tolerance,
    ...(dimensions ? { dimensions } : {}),
    ...(contrastDomain ? { contrastDomain } : {}),
    ...(conditionNote ? { conditionNote } : {}),
  });
}

export function exerciseDefinitionKey(part: ExpressionExercisePart): string {
  const p = snapshotExercise(part);
  return JSON.stringify([
    "annus-exercise-sampling-v1",
    p.id,
    p.referenceSource,
    [...p.declaredNames].sort(),
    p.domains,
    p.tolerance,
  ]);
}

/**
 * What a page keys a form on: the sampling definition plus the probe's settings, so a changed
 * contrast range or condition note remounts the form instead of relabelling an old verdict. The
 * probe settings stay out of exerciseDefinitionKey, which seeds the Philox points.
 */
export function exerciseRenderKey(part: ExpressionExercisePart): string {
  const p = snapshotExercise(part);
  return JSON.stringify([
    exerciseDefinitionKey(p),
    p.contrastDomain ?? null,
    p.conditionNote ?? null,
  ]);
}

/** First eight SHA-256 bytes, big endian, retained as an exact u64 decimal seed.
 * Public reproducibility, not secrecy or cheating resistance. No weak-hash fallback. */
export async function deriveExerciseSeed(identity: string): Promise<string> {
  if (typeof identity !== "string" || !identity || identity.length > 8192)
    throw new TypeError("Invalid exercise sampling identity.");
  if (!globalThis.crypto?.subtle)
    throw new Error("Secure browser hashing is unavailable; no answer verdict was produced.");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return new DataView(digest).getBigUint64(0, false).toString();
}

export async function checkExerciseAnswer(
  part: ExpressionExercisePart,
  rawInput: string,
): Promise<AnswerVerdict> {
  try {
    const p = snapshotExercise(part);
    if (typeof rawInput !== "string" || rawInput.length > 200)
      return {
        kind: "parse-error",
        position: 200,
        message: "Use an expression of at most 200 characters.",
      };
    const normalized = normalize(rawInput);
    if (!normalized.ok)
      return { kind: "parse-error", position: normalized.position, message: normalized.message };
    const reader = parse(normalized.text, new Set(p.declaredNames));
    if (!reader.ok && reader.unsupported)
      return {
        kind: "unsupported-expression",
        name: reader.unsupported,
        position: reader.position,
        message: reader.message,
        nextAction: NEXT_ACTION["unsupported-expression"],
      };
    if (!reader.ok)
      return { kind: "parse-error", position: reader.position, message: reader.message };
    const reference = parse(p.referenceSource, new Set(p.declaredNames));
    if (!reference.ok) throw new TypeError("The reference expression is invalid.");
    const dimensionMap = p.dimensions ? readDimensions(p.dimensions, Object.keys(p.domains)) : null;
    if (dimensionMap) {
      const message = dimensionMessage(reader.expr, reference.expr, dimensionMap);
      if (message) return { kind: "dimension", message, readAs: echo(reader.expr) };
    }
    const seed = await deriveExerciseSeed(exerciseDefinitionKey(p));
    const outcome = checkEquivalence(reader.expr, reference.expr, p.domains, p.tolerance, { seed });
    if (outcome.status !== "equivalent")
      return { kind: "checked", outcome, readAs: echo(reader.expr) };
    const probe = probeDomain(reader.expr, reference.expr, {
      domains: p.domains,
      tolerance: p.tolerance,
      ...(p.contrastDomain ? { contrastDomain: p.contrastDomain } : {}),
      ...(p.conditionNote ? { conditionNote: p.conditionNote } : {}),
    });
    return { kind: "checked", outcome, readAs: echo(reader.expr), probe };
  } catch (error) {
    return {
      kind: "checked",
      outcome: {
        status: "could-not-compare",
        reason: error instanceof Error ? error.message : "The exercise could not be checked.",
      },
    };
  }
}
