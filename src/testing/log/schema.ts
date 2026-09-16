/**
 * The one structured test-log event schema (AGENTS.md "Testing and Logging Standards").
 *
 * `logRunId` names one execution of a test suite. `runId` names an experiment
 * realization (the runtime contract's `data-run-id`). `toolRunId` names a
 * pipeline or tool run (OCR, downloads, coverage, audits). These three are
 * never interchangeable; validation below enforces that at the schema level
 * rather than trusting callers to keep them straight.
 */

export type ComparisonKind = "bitwise" | "tolerance" | "formatted";
export type Outcome = "passed" | "failed" | "skipped" | "not-available";

export interface ToleranceSpec {
  absolute?: number;
  relative?: number;
  relativeTo?: "reference" | "larger";
}

export interface EvidencePaths {
  screenshot?: string;
  trace?: string;
  dom?: string;
  console?: string;
  network?: string;
  files?: string[];
}

/** Bead-specific fields never appear at the top level; they live here unchanged. */
export type ExtraFields = Record<string, unknown>;

export interface LogEvent {
  timestamp: string;
  suite: string;
  logRunId: string;
  testId: string;
  beadId?: string;
  paper?: string;
  anchor?: string;
  instrumentId?: string;
  instanceId?: string;
  runId?: string;
  inputRevision?: string | number;
  acceptedInputRevision?: string | number;
  snapshotVersion?: string | number;
  seed?: string;
  streamVersion?: string | number;
  modelVersion?: string;
  artifactDigest?: string;
  executionLabel?: string;
  resultStatus?: string;
  expected?: unknown;
  actual?: unknown;
  tolerance?: ToleranceSpec;
  comparisonKind?: ComparisonKind;
  outcome?: Outcome;
  durationMs?: number;
  browser?: string;
  viewport?: string;
  reducedMotion?: boolean;
  jsEnabled?: boolean;
  message?: string;
  diff?: number;
  allowed?: number;
  verdict?: string;
  lane?: string;
  journey?: string;
  step?: string;
  toolRunId?: string;
  evidence?: EvidencePaths;
  extra?: ExtraFields;
}

/** Canonical field order: AGENTS.md order for the base fields, then the reviewed additions. */
export const FIELD_ORDER = [
  "timestamp", "suite", "logRunId", "testId", "beadId", "paper", "anchor", "instrumentId", "instanceId", "runId",
  "inputRevision", "acceptedInputRevision", "snapshotVersion", "seed", "streamVersion", "modelVersion", "artifactDigest",
  "executionLabel", "resultStatus", "expected", "actual", "tolerance", "comparisonKind", "outcome", "durationMs",
  "browser", "viewport", "reducedMotion", "jsEnabled", "message",
  "diff", "allowed", "verdict", "lane", "journey", "step", "toolRunId", "evidence", "extra",
] as const satisfies readonly (keyof LogEvent)[];

const KNOWN_FIELDS = new Set<string>(FIELD_ORDER);
const REQUIRED_FIELDS = ["timestamp", "suite", "logRunId", "testId"] as const;

export const RUN_IDENTITY_PATTERN = /^\d{8}T\d{6}Z-[0-9a-f]{8}$/;
export const AGENTS_MD_SUITE_LOG_PATH_PATTERN = "artifacts/test-logs/<suite>/<log-run-id>.jsonl";

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const OUTCOME_VALUES: readonly Outcome[] = ["passed", "failed", "skipped", "not-available"];
const COMPARISON_KIND_VALUES: readonly ComparisonKind[] = ["bitwise", "tolerance", "formatted"];
const FORBIDDEN_EXTRA_KEYS = new Set(["readerNote", "freeTextAnswer", "email", "participantName"]);
const MAX_EXTRA_STRING_LENGTH = 2000;

/** 2^64 - 1, the largest value a canonical unsigned 64-bit decimal seed may hold. */
export const SEED_MAX = 18446744073709551615n;

export class LogSchemaError extends Error {
  readonly field: string | undefined;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "LogSchemaError";
    this.field = field;
  }
}

function fail(message: string, field?: string): never {
  throw new LogSchemaError(message, field);
}

/**
 * Canonical unsigned 64-bit decimal seed check. This is an interim grammar;
 * am-rt-u64-identities-7ce replaces it with the single grammar in
 * src/experiments/identity/u64.ts, which this schema will then import.
 */
export function validateSeed(seed: unknown): string {
  if (typeof seed !== "string") fail('"seed" must be a canonical decimal string, never a JSON number.', "seed");
  const value = seed as string;
  if (value.length === 0 || value.length > 20) {
    fail(`"seed" must be a 1-20 digit unsigned decimal string (64-bit range); got length ${value.length}.`, "seed");
  }
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
    fail(`"seed" must be an unsigned decimal string with no sign, whitespace, or leading zeros (got ${JSON.stringify(value)}).`, "seed");
  }
  if (BigInt(value) > SEED_MAX) {
    fail(`"seed" ${value} exceeds the 64-bit range (max ${SEED_MAX.toString()}).`, "seed");
  }
  return value;
}

function validateRunIdentityField(value: unknown, field: "logRunId" | "toolRunId"): void {
  if (typeof value !== "string" || !RUN_IDENTITY_PATTERN.test(value)) {
    fail(`"${field}" must match YYYYMMDDTHHMMSSZ-<8 hex> (got ${JSON.stringify(value)}).`, field);
  }
}

function validateRunId(raw: Record<string, unknown>): void {
  if (raw.runId === undefined) return;
  if (typeof raw.runId !== "string") fail('"runId" must be a string.', "runId");
  if (RUN_IDENTITY_PATTERN.test(raw.runId)) {
    fail(
      '"runId" is the experiment realization; a suite execution belongs in `logRunId` and a pipeline or tool run in `toolRunId`',
      "runId",
    );
  }
  if (raw.instanceId === undefined && raw.instrumentId === undefined) {
    fail(
      'An event carrying "runId" must also carry "instanceId" or "instrumentId": an experiment run without an instance is meaningless.',
      "runId",
    );
  }
}

function validateComparison(raw: Record<string, unknown>): void {
  const hasExpected = raw.expected !== undefined;
  const hasComparisonKind = raw.comparisonKind !== undefined;
  if (hasComparisonKind && !COMPARISON_KIND_VALUES.includes(raw.comparisonKind as ComparisonKind)) {
    fail('"comparisonKind" must be "bitwise", "tolerance", or "formatted".', "comparisonKind");
  }
  if (hasExpected && !hasComparisonKind) {
    fail('"comparisonKind" is required whenever "expected" is present.', "comparisonKind");
  }
  const hasTolerance = raw.tolerance !== undefined;
  if (hasTolerance !== (raw.comparisonKind === "tolerance")) {
    fail('"tolerance" is present exactly when "comparisonKind" is "tolerance".', "tolerance");
  }
}

function validateBrowserEvidence(raw: Record<string, unknown>): void {
  if (raw.browser === undefined || raw.outcome !== "failed") return;
  const evidence = raw.evidence as EvidencePaths | undefined;
  if (!evidence || !evidence.screenshot || !evidence.dom) {
    fail(
      'A failing browser event must retain at least a screenshot and a DOM snapshot path in "evidence".',
      "evidence",
    );
  }
}

function checkStringLengths(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (value.length > MAX_EXTRA_STRING_LENGTH) {
      fail(`"${path}" exceeds ${MAX_EXTRA_STRING_LENGTH} characters; log a digest or summary instead.`, path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkStringLengths(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) checkStringLengths(item, `${path}.${key}`);
  }
}

function validateExtra(extra: unknown): void {
  if (extra === undefined) return;
  if (typeof extra !== "object" || extra === null || Array.isArray(extra)) {
    fail('"extra" must be a JSON-serializable object.', "extra");
  }
  try {
    JSON.stringify(extra);
  } catch {
    fail('"extra" must be JSON-serializable.', "extra");
  }
  for (const key of Object.keys(extra as Record<string, unknown>)) {
    if (FORBIDDEN_EXTRA_KEYS.has(key)) {
      fail(`"extra.${key}" is forbidden: logs never contain reader notes, free-text answers, or personal data.`, `extra.${key}`);
    }
  }
  checkStringLengths(extra, "extra");
}

/**
 * Validates a raw event against the closed schema and returns a field-ordered
 * clone. Throws `LogSchemaError` on the first violation. This is the single
 * gate every write path (logger, assertions, evidence, playwright, scripts)
 * passes through.
 */
export function validateEvent(raw: Record<string, unknown>): LogEvent {
  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key)) fail(`Unknown field "${key}"; move it to extra.${key}.`, key);
  }
  for (const field of REQUIRED_FIELDS) {
    if (raw[field] === undefined) fail(`"${field}" is required.`, field);
  }
  if (typeof raw.timestamp !== "string" || !ISO_TIMESTAMP_PATTERN.test(raw.timestamp)) {
    fail(`"timestamp" must be an ISO 8601 UTC string (got ${JSON.stringify(raw.timestamp)}).`, "timestamp");
  }
  if (typeof raw.suite !== "string" || raw.suite.length === 0) fail('"suite" is required and must be non-empty.', "suite");
  if (typeof raw.testId !== "string" || raw.testId.length === 0) fail('"testId" is required and must be non-empty.', "testId");
  validateRunIdentityField(raw.logRunId, "logRunId");
  if (raw.toolRunId !== undefined) validateRunIdentityField(raw.toolRunId, "toolRunId");
  validateRunId(raw);
  if (raw.seed !== undefined) validateSeed(raw.seed);
  validateComparison(raw);
  validateBrowserEvidence(raw);
  validateExtra(raw.extra);
  if (raw.outcome !== undefined && !OUTCOME_VALUES.includes(raw.outcome as Outcome)) {
    fail('"outcome" must be "passed", "failed", "skipped", or "not-available".', "outcome");
  }

  const ordered: Record<string, unknown> = {};
  for (const key of FIELD_ORDER) {
    if (raw[key] !== undefined) ordered[key] = raw[key];
  }
  return ordered as unknown as LogEvent;
}

export function parseLogLine(line: string): LogEvent {
  return JSON.parse(line) as LogEvent;
}
