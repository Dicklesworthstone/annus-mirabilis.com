import { getLogger } from "./logger.ts";
import type { Outcome, ToleranceSpec } from "./schema.ts";
// am-ver-tolerance-module-ho90 delivers this module. Its documented interface
// (validateToleranceSpec, withinTolerance, compareBitwise) is consumed here
// verbatim; this file carries no tolerance or bitwise comparison logic of its
// own. See am-test-logging-standard-l3cp's comment on that bead and the
// MaroonTiger -> BoldHarbor mail thread for the agreed signatures.
import { validateToleranceSpec, withinTolerance, compareBitwise } from "../../units/tolerance.ts";

export interface AssertionMeta {
  suite: string;
  logRunId?: string;
  testId: string;
  beadId?: string;
  paper?: string;
  anchor?: string;
  instrumentId?: string;
  instanceId?: string;
  runId?: string;
}

function loggerFor(meta: AssertionMeta) {
  return getLogger(meta.suite, meta.logRunId);
}

function identityFields(meta: AssertionMeta): Record<string, unknown> {
  const fields: Record<string, unknown> = { testId: meta.testId };
  if (meta.beadId !== undefined) fields.beadId = meta.beadId;
  if (meta.paper !== undefined) fields.paper = meta.paper;
  if (meta.anchor !== undefined) fields.anchor = meta.anchor;
  if (meta.instrumentId !== undefined) fields.instrumentId = meta.instrumentId;
  if (meta.instanceId !== undefined) fields.instanceId = meta.instanceId;
  if (meta.runId !== undefined) fields.runId = meta.runId;
  return fields;
}

/** Converts a value into something the JSONL schema can serialize as-is. */
function toLoggable(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value as unknown as Iterable<number | bigint>, (v) => (typeof v === "bigint" ? v.toString() : v));
  }
  return value;
}

/** Records outcome, duration, and failure message for one test. */
export async function withTestLog(meta: AssertionMeta, fn: () => unknown | Promise<unknown>): Promise<void> {
  const logger = loggerFor(meta);
  const start = performance.now();
  try {
    await fn();
    logger.log({ ...identityFields(meta), outcome: "passed", durationMs: Math.round(performance.now() - start) });
  } catch (error) {
    logger.log({
      ...identityFields(meta),
      outcome: "failed",
      durationMs: Math.round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await logger.flush();
  }
}

/**
 * Requires an explicit `ToleranceSpec`, delegates the verdict to
 * `src/units/tolerance.ts`, and logs `expected`, `actual`, `tolerance`,
 * `comparisonKind: "tolerance"`, `diff`, `allowed`, and `verdict`. Fails on
 * any spec issue or a non-`within` verdict.
 */
export function expectClose(actual: number, expected: number, spec: ToleranceSpec, meta: AssertionMeta) {
  if (spec === undefined || spec === null) {
    // No tolerance object exists to log; a schema-valid "tolerance" comparison
    // event requires one, so this precondition failure is a thrown error only.
    throw new Error("expectClose requires an explicit ToleranceSpec (absolute and/or relative).");
  }
  const logger = loggerFor(meta);
  const issues = validateToleranceSpec(spec, expected);
  if (issues.length > 0) {
    const message = issues.map((issue: { message: string }) => issue.message).join("; ");
    logger.log({
      ...identityFields(meta),
      expected: toLoggable(expected),
      actual: toLoggable(actual),
      tolerance: spec,
      comparisonKind: "tolerance",
      outcome: "failed" satisfies Outcome,
      message,
    });
    logger.flushSync();
    throw new Error(`expectClose: invalid tolerance spec — ${message}`);
  }

  const verdict = withinTolerance(actual, expected, spec);
  logger.log({
    ...identityFields(meta),
    expected: toLoggable(expected),
    actual: toLoggable(actual),
    tolerance: spec,
    comparisonKind: "tolerance",
    diff: verdict.diff,
    allowed: verdict.allowed,
    verdict: verdict.kind,
    outcome: (verdict.ok ? "passed" : "failed") satisfies Outcome,
    ...(verdict.ok ? {} : { message: `expectClose failed: ${verdict.kind} diff=${verdict.diff} allowed=${verdict.allowed}` }),
  });
  // expectClose is usually the sole assertion in a test; flush immediately so
  // a caller can read the event straight back rather than waiting on a
  // separate test-boundary flush.
  logger.flushSync();
  if (!verdict.ok) throw new Error(`expectClose failed: ${verdict.kind} diff=${verdict.diff} allowed=${verdict.allowed}`);
  return verdict;
}

/**
 * Delegates to `compareBitwise` (integers, digests, Philox counter outputs,
 * float bit patterns) and logs `comparisonKind: "bitwise"` with the first
 * differing index for arrays.
 */
export function expectBitwise(actual: unknown, expected: unknown, meta: AssertionMeta) {
  const logger = loggerFor(meta);
  const verdict = compareBitwise(actual, expected);
  logger.log({
    ...identityFields(meta),
    expected: toLoggable(expected),
    actual: toLoggable(actual),
    comparisonKind: "bitwise",
    verdict: verdict.kind,
    outcome: (verdict.ok ? "passed" : "failed") satisfies Outcome,
    ...(verdict.detail !== undefined ? { extra: { detail: toLoggable(verdict.detail) } } : {}),
    ...(verdict.ok ? {} : { message: `expectBitwise failed: ${verdict.kind}${verdict.detail !== undefined ? ` (${JSON.stringify(verdict.detail)})` : ""}` }),
  });
  logger.flushSync();
  if (!verdict.ok) throw new Error(`expectBitwise failed: ${verdict.kind}`);
  return verdict;
}

/** Writes any schema-valid event through this test's logger. */
export function recordEvent(meta: AssertionMeta, rawEvent: Record<string, unknown>) {
  return loggerFor(meta).log({ ...identityFields(meta), ...rawEvent });
}
