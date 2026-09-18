/**
 * The rights vocabulary: enums and constraint checks built from docs/rights-vocabulary.yaml,
 * the single source `am-src-rights-policy-1dp` owns. This module imports what that file
 * defines and redefines nothing -- a later status, required field, or constraint arrives
 * through the file and this module's own failing test, never through a second hand-copied list.
 * Specification: am-cm-schemas-source-1en.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { strictParse } from "./strictParse.ts";

export type VocabularyEntry = Readonly<{
  value: string;
  definition: string;
  requiredFields: readonly string[];
  implies: string;
  requiresReason?: boolean;
}>;

export type VocabularyConstraint = Readonly<{
  id: string;
  if: string;
  /** The file's own "then" field, renamed here: an object with a literal `then` property is a
   * thenable to `await` and dynamic `import()`, which is not what this record is. */
  thenClause: string;
  message: string;
}>;

export type RightsVocabulary = Readonly<{
  version: number;
  rightsStatus: readonly VocabularyEntry[];
  publicationDecision: readonly VocabularyEntry[];
  cloudProcessing: readonly VocabularyEntry[];
  reuseTerms: readonly VocabularyEntry[];
  constraints: readonly VocabularyConstraint[];
}>;

export class RightsVocabularyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RightsVocabularyError";
    this.code = code;
  }
}

const DEFAULT_VOCABULARY_PATH = path.join(process.cwd(), "docs", "rights-vocabulary.yaml");
const KEBAB_CASE = /^[a-z]+(?:-[a-z]+)*$/;

const CATEGORIES = [
  "rightsStatus",
  "publicationDecision",
  "cloudProcessing",
  "reuseTerms",
] as const;

function parseEntries(raw: unknown, category: string): VocabularyEntry[] {
  if (!Array.isArray(raw)) {
    throw new RightsVocabularyError(
      "invalid-category",
      `rights-vocabulary.yaml: "${category}" must be a list.`,
    );
  }
  const entries: VocabularyEntry[] = [];
  const seen = new Set<string>();
  for (const [i, item] of raw.entries()) {
    const o = item as Record<string, unknown>;
    const where = `${category}[${i}]`;
    if (!o || typeof o !== "object" || typeof o.value !== "string" || !KEBAB_CASE.test(o.value)) {
      throw new RightsVocabularyError(
        "invalid-value",
        `rights-vocabulary.yaml: ${where}.value must be a kebab-case string.`,
      );
    }
    if (seen.has(o.value)) {
      throw new RightsVocabularyError(
        "duplicate-value",
        `rights-vocabulary.yaml: ${category} has a duplicate value "${o.value}".`,
      );
    }
    seen.add(o.value);
    if (typeof o.definition !== "string" || !o.definition.trim()) {
      throw new RightsVocabularyError(
        "missing-definition",
        `rights-vocabulary.yaml: ${where} ("${o.value}") is missing a definition.`,
      );
    }
    if (!Array.isArray(o.requiredFields) || o.requiredFields.some((f) => typeof f !== "string")) {
      throw new RightsVocabularyError(
        "missing-required-fields",
        `rights-vocabulary.yaml: ${where} ("${o.value}") is missing a requiredFields list.`,
      );
    }
    entries.push(
      Object.freeze({
        value: o.value,
        definition: o.definition,
        requiredFields: Object.freeze([...(o.requiredFields as string[])]),
        implies: typeof o.implies === "string" ? o.implies : "",
        ...(typeof o.requiresReason === "boolean" ? { requiresReason: o.requiresReason } : {}),
      }),
    );
  }
  return entries;
}

function parseConstraints(raw: unknown): VocabularyConstraint[] {
  if (!Array.isArray(raw)) {
    throw new RightsVocabularyError(
      "invalid-constraints",
      'rights-vocabulary.yaml: "constraints" must be a list.',
    );
  }
  const constraints: VocabularyConstraint[] = [];
  const seenIds = new Set<string>();
  for (const [i, item] of raw.entries()) {
    const o = item as Record<string, unknown>;
    const where = `constraints[${i}]`;
    if (typeof o.id !== "string" || !o.id.trim()) {
      throw new RightsVocabularyError(
        "missing-constraint-id",
        `rights-vocabulary.yaml: ${where}.id is required.`,
      );
    }
    if (seenIds.has(o.id)) {
      throw new RightsVocabularyError(
        "duplicate-constraint-id",
        `rights-vocabulary.yaml: duplicate constraint id "${o.id}".`,
      );
    }
    seenIds.add(o.id);
    if (typeof o.if !== "string" || typeof o.then !== "string" || typeof o.message !== "string") {
      throw new RightsVocabularyError(
        "malformed-constraint",
        `rights-vocabulary.yaml: constraint "${o.id}" must carry string "if", "then", and "message" fields.`,
      );
    }
    constraints.push(Object.freeze({ id: o.id, if: o.if, thenClause: o.then, message: o.message }));
  }
  return constraints;
}

let cached: RightsVocabulary | undefined;

/** Loads and validates docs/rights-vocabulary.yaml. Cached per process for the default path; pass
 * `filePath` to bypass the cache (tests exercising a fixture vocabulary). */
export function loadRightsVocabulary(filePath: string = DEFAULT_VOCABULARY_PATH): RightsVocabulary {
  if (filePath === DEFAULT_VOCABULARY_PATH && cached) return cached;
  const text = readFileSync(filePath, "utf8");
  const raw = strictParse(text, "yaml") as Record<string, unknown>;
  if (!raw || typeof raw !== "object") {
    throw new RightsVocabularyError(
      "invalid-file",
      "rights-vocabulary.yaml must parse to an object.",
    );
  }
  if (typeof raw.version !== "number") {
    throw new RightsVocabularyError(
      "missing-version",
      'rights-vocabulary.yaml: "version" must be a number.',
    );
  }
  const vocabulary: RightsVocabulary = Object.freeze({
    version: raw.version,
    rightsStatus: Object.freeze(parseEntries(raw.rightsStatus, "rightsStatus")),
    publicationDecision: Object.freeze(
      parseEntries(raw.publicationDecision, "publicationDecision"),
    ),
    cloudProcessing: Object.freeze(parseEntries(raw.cloudProcessing, "cloudProcessing")),
    reuseTerms: Object.freeze(parseEntries(raw.reuseTerms, "reuseTerms")),
    constraints: Object.freeze(parseConstraints(raw.constraints)),
  });
  if (filePath === DEFAULT_VOCABULARY_PATH) cached = vocabulary;
  return vocabulary;
}

export function valuesOf(
  vocabulary: RightsVocabulary,
  category: (typeof CATEGORIES)[number],
): readonly string[] {
  return vocabulary[category].map((e) => e.value);
}

export function entryFor(
  vocabulary: RightsVocabulary,
  category: (typeof CATEGORIES)[number],
  value: string,
): VocabularyEntry | undefined {
  return vocabulary[category].find((e) => e.value === value);
}

export function requiredFieldsFor(
  vocabulary: RightsVocabulary,
  category: (typeof CATEGORIES)[number],
  value: string,
): readonly string[] {
  return entryFor(vocabulary, category, value)?.requiredFields ?? [];
}

// ---------------------------------------------------------------------------
// A small, generic interpreter for the constraint mini-language observed in
// docs/rights-vocabulary.yaml's "if"/"then" strings: dotted field paths,
// `==`, `!=` (against a quoted string or `null`), `in [...]` against a quoted
// list, a bare path as a truthy check, and `&&` conjunction. This is not a
// general expression language; it accepts exactly the forms the file uses
// and throws on anything else, so an unrecognized future form fails loudly
// here rather than being silently treated as always-true.
// ---------------------------------------------------------------------------

type Clause =
  | Readonly<{ kind: "eq"; path: string; value: string }>
  | Readonly<{ kind: "neq"; path: string; value: string | null }>
  | Readonly<{ kind: "in"; path: string; values: readonly string[] }>
  | Readonly<{ kind: "truthy"; path: string }>;

const IN_PATTERN = /^(\S+)\s+in\s+\[(.*)\]$/;
const EQ_PATTERN = /^(\S+)\s*==\s*'([^']*)'$/;
const NEQ_NULL_PATTERN = /^(\S+)\s*!=\s*null$/;
const NEQ_STRING_PATTERN = /^(\S+)\s*!=\s*'([^']*)'$/;

export function requireGroup(match: RegExpExecArray, index: number, raw: string): string {
  const group = match[index];
  if (group === undefined) {
    throw new RightsVocabularyError(
      "unsupported-expression",
      `rights-vocabulary.yaml: could not extract a required capture group from "${raw}".`,
    );
  }
  return group;
}

function parseList(inner: string): readonly string[] {
  return inner
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const m = /^'([^']*)'$/.exec(s);
      if (!m) {
        throw new RightsVocabularyError(
          "unsupported-expression",
          `rights-vocabulary.yaml: unrecognized list element "${s}" in an "in [...]" clause.`,
        );
      }
      return requireGroup(m, 1, s);
    });
}

function parseClause(raw: string): Clause {
  const clause = raw.trim();
  const inMatch = IN_PATTERN.exec(clause);
  if (inMatch) {
    return {
      kind: "in",
      path: requireGroup(inMatch, 1, raw),
      values: parseList(requireGroup(inMatch, 2, raw)),
    };
  }
  const eqMatch = EQ_PATTERN.exec(clause);
  if (eqMatch) {
    return {
      kind: "eq",
      path: requireGroup(eqMatch, 1, raw),
      value: requireGroup(eqMatch, 2, raw),
    };
  }
  const neqNullMatch = NEQ_NULL_PATTERN.exec(clause);
  if (neqNullMatch) return { kind: "neq", path: requireGroup(neqNullMatch, 1, raw), value: null };
  const neqStringMatch = NEQ_STRING_PATTERN.exec(clause);
  if (neqStringMatch) {
    return {
      kind: "neq",
      path: requireGroup(neqStringMatch, 1, raw),
      value: requireGroup(neqStringMatch, 2, raw),
    };
  }
  if (/^\S+$/.test(clause)) return { kind: "truthy", path: clause };
  throw new RightsVocabularyError(
    "unsupported-expression",
    `rights-vocabulary.yaml: unrecognized constraint clause "${raw}".`,
  );
}

function getPath(context: Readonly<Record<string, unknown>>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, context);
}

function evaluateClause(clause: Clause, context: Readonly<Record<string, unknown>>): boolean {
  const resolved = getPath(context, clause.path);
  switch (clause.kind) {
    case "eq":
      return resolved === clause.value;
    case "neq":
      return clause.value === null
        ? resolved !== null && resolved !== undefined
        : resolved !== clause.value;
    case "in":
      return typeof resolved === "string" && clause.values.includes(resolved);
    case "truthy":
      return Boolean(resolved);
  }
}

/** Parses and evaluates one "if" or "then" string against a context object, ANDing every
 * `&&`-joined clause. Exported so a targeted test can assert the parser's own behavior directly,
 * independent of a full constraint check. */
export function evaluateExpression(
  expression: string,
  context: Readonly<Record<string, unknown>>,
): boolean {
  const clauses = expression.split("&&").map(parseClause);
  return clauses.every((clause) => evaluateClause(clause, context));
}

export type ConstraintViolation = Readonly<{ id: string; message: string }>;

/** Every constraint whose "if" holds against `context` but whose "then" does not -- the vocabulary
 * file's constraints made executable, exactly as written, never re-derived by hand here. */
export function checkConstraints(
  vocabulary: RightsVocabulary,
  context: Readonly<Record<string, unknown>>,
): readonly ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  for (const constraint of vocabulary.constraints) {
    if (!evaluateExpression(constraint.if, context)) continue;
    if (!evaluateExpression(constraint.thenClause, context)) {
      violations.push({ id: constraint.id, message: constraint.message });
    }
  }
  return violations;
}
