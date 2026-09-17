/** Shared reader-answer workflow. No browser storage, network, eval or alternate RNG. */
import { type ToleranceSpec, validateToleranceSpec } from "../../units/tolerance.ts";
import { checkEquivalence, type EquivalenceOutcome } from "./equivalence.ts";
import { ALLOWED_FUNCTIONS, parse } from "./grammar.ts";
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
}
export type AnswerVerdict =
  | Readonly<{ kind: "parse-error"; position: number; message: string }>
  | Readonly<{ kind: "checked"; outcome: EquivalenceOutcome }>;

function field(value: unknown, name: string): unknown {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new TypeError("Exercise settings must be plain records.");
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
    throw new TypeError(`Missing exercise field or accessor: ${name}.`);
  return descriptor.value;
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
        const domain = rawDomains[name]!;
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
    Reflect.ownKeys(rawTolerance).some(
      (k) =>
        typeof k !== "string" ||
        !["absolute", "relative", "relativeTo"].includes(k) ||
        !fields[k]?.enumerable ||
        !Object.hasOwn(fields[k]!, "value"),
    )
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
    !["reference", "larger"].includes(tolerance.relativeTo!) ||
    validateToleranceSpec(tolerance, 1).length
  )
    throw new TypeError("The exercise tolerance is invalid.");
  const reference = parse(referenceSource, new Set(declaredNames));
  if (!reference.ok)
    throw new TypeError(`The reference expression is invalid: ${reference.message}`);
  return Object.freeze({
    id,
    prompt,
    workedExplanation,
    referenceSource,
    declaredNames,
    domains,
    tolerance,
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
    if (!reader.ok)
      return { kind: "parse-error", position: reader.position, message: reader.message };
    const reference = parse(p.referenceSource, new Set(p.declaredNames));
    if (!reference.ok) throw new TypeError("The reference expression is invalid.");
    const seed = await deriveExerciseSeed(exerciseDefinitionKey(p));
    return {
      kind: "checked",
      outcome: checkEquivalence(reader.expr, reference.expr, p.domains, p.tolerance, { seed }),
    };
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
