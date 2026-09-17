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

export function isJourneyRecord(rec: Record<string, unknown>): boolean {
  return rec.kind === "journey" && Array.isArray(rec.stages);
}

export function isExperimentRecord(rec: Record<string, unknown>): boolean {
  return (
    rec.kind === "experiment" && (Array.isArray(rec.notModeled) || rec.notModeled === undefined)
  );
}

export function eachRecord(
  context: CheckContext,
  visit: (id: string, rec: Record<string, unknown>) => void,
): void {
  for (const [key, value] of context.records.entries()) {
    const rec = asRecord(value);
    if (rec) visit(recordId(rec, key), rec);
  }
}
