/**
 * Readings audit (am-cm-audit-scripts-d34): R0–R3 present, R0 sentence count,
 * R3 citation, R2 length heuristic with reviewed overrides, ownership map,
 * and scope-critical qualifications at R0/R1/R2.
 */

import { countSentences, countWords } from "./sentenceCount.ts";
import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export const R2_LENGTH_FACTOR = 1.2;
export const READING_LEVELS = ["r0", "r1", "r2", "r3"] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export type ReadingTargetKind =
  | "paragraph"
  | "heading"
  | "footnote"
  | "closing"
  | "equation"
  | "derivation-step"
  | "instrument-caption";

export type ReadingSet = Readonly<{
  r0: string;
  r1: string;
  r2: string;
  r3: string;
  r3Citations?: readonly string[];
  qualificationsCited?: readonly string[];
}>;

export type ReadingTarget = Readonly<{
  targetId: string;
  targetKind: ReadingTargetKind;
  paper: string;
  readings?: ReadingSet;
  scopeCritical?: readonly string[];
}>;

export type ReadingsOwnerEntry = Readonly<{
  ownerBeadId: string;
  fileName: string;
  paper: string;
  targetKinds: readonly ReadingTargetKind[];
  targetIds: readonly string[];
}>;

export type R2Override = Readonly<{
  targetId: string;
  rule: "r2-length";
  reason?: string;
  reviewer?: string;
  date?: string;
}>;

export type ReadingsAuditInput = Readonly<{
  targets: readonly ReadingTarget[];
  owners: readonly ReadingsOwnerEntry[];
  overrides?: readonly R2Override[];
}>;

function ownerFor(
  target: ReadingTarget,
  owners: readonly ReadingsOwnerEntry[],
): { ownerBeadId?: string; conflicts: string[] } {
  const matches = owners.filter(
    (owner) =>
      owner.targetIds.includes(target.targetId) && owner.targetKinds.includes(target.targetKind),
  );
  if (matches.length === 0) return { conflicts: [] };
  if (matches.length > 1) {
    return { conflicts: matches.map((owner) => owner.ownerBeadId) };
  }
  const firstOwner = matches[0]?.ownerBeadId;
  return {
    ...(firstOwner !== undefined ? { ownerBeadId: firstOwner } : {}),
    conflicts: [],
  };
}

export function auditReadings(input: ReadingsAuditInput): AuditReport {
  const findings: AuditFinding[] = [];

  for (const owner of input.owners) {
    const expected = `${owner.ownerBeadId}.yaml`;
    if (owner.fileName !== expected) {
      findings.push({
        check: "owner-filename-mismatch",
        family: "readings",
        severity: "error",
        ownerBeadId: owner.ownerBeadId,
        recordId: owner.fileName,
        message: `Readings-owner file "${owner.fileName}" must be named ${expected}.`,
      });
    }
  }

  for (const target of input.targets) {
    const { ownerBeadId, conflicts } = ownerFor(target, input.owners);
    if (conflicts.length > 0) {
      findings.push({
        check: "owner-conflict",
        family: "readings",
        severity: "error",
        paper: target.paper,
        recordId: target.targetId,
        targetKind: target.targetKind,
        message: `Target ${target.targetId} (${target.targetKind}) is claimed by ${conflicts.join(" and ")}.`,
      });
      continue;
    }
    if (!ownerBeadId) {
      findings.push({
        check: "owner-unassigned",
        family: "readings",
        severity: "error",
        paper: target.paper,
        recordId: target.targetId,
        targetKind: target.targetKind,
        message: `Target ${target.targetId} (${target.targetKind}) has no readings owner.`,
      });
      continue;
    }

    const readings = target.readings;
    if (!readings) {
      findings.push({
        check: "readings-missing",
        family: "readings",
        severity: "error",
        paper: target.paper,
        recordId: target.targetId,
        targetKind: target.targetKind,
        ownerBeadId,
        message: `Target ${target.targetId} has no reading texts.`,
      });
      continue;
    }

    for (const level of READING_LEVELS) {
      if (!readings[level]?.trim()) {
        findings.push({
          check: `missing-${level}`,
          family: "readings",
          severity: "error",
          paper: target.paper,
          recordId: target.targetId,
          targetKind: target.targetKind,
          ownerBeadId,
          requirement: level.toUpperCase(),
          message: `${level.toUpperCase()} is missing for ${target.targetId}.`,
        });
      }
    }

    if (readings.r0.trim()) {
      const sentences = countSentences(readings.r0);
      if (sentences < 1 || sentences > 2) {
        findings.push({
          check: "r0-sentence-count",
          family: "readings",
          severity: "error",
          paper: target.paper,
          recordId: target.targetId,
          targetKind: target.targetKind,
          ownerBeadId,
          expected: "1 or 2 sentences",
          actual: String(sentences),
          message: `R0 for ${target.targetId} has ${sentences} sentences; it must be one or two.`,
        });
      }
    }

    const citations = readings.r3Citations ?? [];
    if (readings.r3.trim() && citations.length === 0) {
      findings.push({
        check: "r3-citation-missing",
        family: "readings",
        severity: "error",
        paper: target.paper,
        recordId: target.targetId,
        targetKind: target.targetKind,
        ownerBeadId,
        message: `R3 for ${target.targetId} carries no citation.`,
      });
    }

    if (readings.r1.trim() && readings.r2.trim()) {
      const r1Words = countWords(readings.r1);
      const r2Words = countWords(readings.r2);
      const override = (input.overrides ?? []).find(
        (entry) => entry.targetId === target.targetId && entry.rule === "r2-length",
      );
      if (r2Words < r1Words * R2_LENGTH_FACTOR) {
        if (!override) {
          findings.push({
            check: "r2-length",
            family: "readings",
            severity: "error",
            paper: target.paper,
            recordId: target.targetId,
            targetKind: target.targetKind,
            ownerBeadId,
            expected: `longer than R1 by factor ${R2_LENGTH_FACTOR}`,
            actual: `R2 ${r2Words} words, R1 ${r1Words} words`,
            message: `R2 for ${target.targetId} is not longer than R1 by factor ${R2_LENGTH_FACTOR} and has no override.`,
          });
        } else if (!override.reason?.trim() || !override.reviewer?.trim()) {
          findings.push({
            check: "r2-override-incomplete",
            family: "readings",
            severity: "error",
            paper: target.paper,
            recordId: target.targetId,
            targetKind: target.targetKind,
            ownerBeadId,
            message: `R2-length override for ${target.targetId} requires a reason and a reviewer.`,
          });
        }
      }
    }

    for (const qualificationId of target.scopeCritical ?? []) {
      const cited = new Set(readings.qualificationsCited ?? []);
      const missingLevels = (["r0", "r1", "r2"] as const).filter((level) => {
        if (cited.has(qualificationId)) return false;
        return !readings[level].includes(qualificationId);
      });
      if (missingLevels.length > 0) {
        findings.push({
          check: "scope-critical-missing",
          family: "readings",
          severity: "error",
          paper: target.paper,
          recordId: target.targetId,
          targetKind: target.targetKind,
          ownerBeadId,
          requirement: qualificationId,
          expected: "stated at R0, R1, and R2",
          actual: `missing at ${missingLevels.join(", ")}`,
          message: `scopeCritical qualification ${qualificationId} on ${target.targetId} is missing from ${missingLevels.join(", ")}.`,
        });
      }
    }
  }

  return summarize("audit-readings", findings);
}
