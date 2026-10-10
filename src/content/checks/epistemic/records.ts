/**
 * Record-shape helpers for epistemic checks. Reading-layer arguments whose
 * premises are strings are not proof-graph nodes.
 */

import type { CheckContext } from "../../compiler/checks/registry.ts";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function recordId(rec: Record<string, unknown>, fallback: string): string {
  return typeof rec.id === "string" && rec.id.trim() ? rec.id : fallback;
}

export function isArgumentNodeRecord(rec: Record<string, unknown>): boolean {
  if (rec.kind === "argument-node") return true;
  if (!Array.isArray(rec.premises) || rec.premises.length === 0) return false;
  const first = rec.premises[0];
  return Boolean(first && typeof first === "object" && "edgeType" in first && "ref" in first);
}

export function isProofRecord(rec: Record<string, unknown>): boolean {
  return rec.kind === "proof";
}

/**
 * A JOURNEY IS IDENTIFIED BY ITS KEY, NOT BY A `kind` FIELD ON THE RECORD (am-4k0m).
 *
 * This read `rec.kind === "journey" && Array.isArray(rec.stages)` and matched NOTHING. Both
 * clauses were wrong, in different ways, and the second is the more interesting:
 *
 *   - no journey record carries a `kind` key, and none should. `recordKey.ts` records the same
 *     mistake costing the editorial-note checks every one of their 8 records: the route's name
 *     lives in the KEY, as `journey:<paper>:<id>`, and inventing a second spelling on the record
 *     is how two sources of one truth drift apart.
 *   - the `stages` clause was redundant AND it asked the wrong question. The world check and the
 *     shelf check both guard `Array.isArray(rec.stages)` inside their own bodies before reading
 *     it, so a journey with no stages is handled correctly either way; requiring stages to BE a
 *     journey only decided which records were looked at. (In the event all four records declare
 *     `stages: []`, so even that clause would have passed -- the `kind` test alone was fatal.)
 *
 * Dropping a clause from a gate's predicate is usually the shape of a weakened gate. This one
 * widens it: the population goes from 0 records to 4, which is why the census beside it is
 * printed and why `runWorldChecks` fails rather than passes at zero.
 */
export function isJourneyKey(key: string): boolean {
  return key.startsWith("journey:");
}

export function isExperimentRecord(rec: Record<string, unknown>): boolean {
  return (
    rec.kind === "experiment" && (Array.isArray(rec.notModeled) || rec.notModeled === undefined)
  );
}

/**
 * Visits every record as `(id, record, key)`. The KEY is passed because it carries the route kind
 * and the paper (`recordKey.ts`), and a check that needs either of those has no other honest
 * source: reading a `kind` field invents a second spelling of the route's name. Callers that do
 * not need it simply take two parameters.
 */
export function eachRecord(
  context: CheckContext,
  visit: (id: string, rec: Record<string, unknown>, key: string) => void,
): void {
  for (const [key, value] of context.records.entries()) {
    const rec = asRecord(value);
    if (rec) visit(recordId(rec, key), rec, key);
  }
}
