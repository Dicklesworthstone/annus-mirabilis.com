#!/usr/bin/env bun
/**
 * Backfill script for converting pre-existing session reports into review records.
 * Specification: am-edit-review-records-hofz (§10.4, §17.2, §17.7)
 */

import { loadOwnersRegistry, type OwnersRegistry } from "../src/content/owners/parseOwners.ts";
import type { ReviewRecord } from "../src/content/schemas/review.ts";
import {
  type ParsedParticipantCode,
  parseParticipantCode,
} from "../src/testing/docs/participantCodes.ts";

export type RawSessionReport = Readonly<{
  filePath: string;
  paper: string;
  reviewType: "accessibility-codesign" | "comprehension-round";
  facilitatorId: string;
  date: string;
  participantCodes: readonly { code: string; line: number }[];
  scope: readonly {
    recordId: string;
    contentRevision?: number | string;
    translationRevision?: number | string;
  }[];
  notes?: string | undefined;
  result?: "accepted" | "accepted-with-changes" | "rejected" | "needs-rereview" | undefined;
}>;

export class BackfillError extends Error {
  readonly code: string;
  readonly file: string;
  readonly line?: number | undefined;

  constructor(code: string, message: string, file: string, line?: number) {
    super(
      line !== undefined
        ? `${file}:${line}: ${message} (${code})`
        : `${file}: ${message} (${code})`,
    );
    this.name = "BackfillError";
    this.code = code;
    this.file = file;
    this.line = line;
  }
}

/**
 * Converts a raw session report into a verified ReviewRecord.
 */
export function convertSessionReportToReviewRecord(
  report: RawSessionReport,
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
): ReviewRecord {
  // 1. Validate facilitator in owners table with required role
  const owner = ownersRegistry.getOwner(report.facilitatorId);
  if (!owner) {
    throw new BackfillError(
      "unknown-facilitator",
      `Facilitator id "${report.facilitatorId}" is not found in docs/OWNERS.md.`,
      report.filePath,
      1,
    );
  }

  const expectedRole =
    report.reviewType === "accessibility-codesign"
      ? "accessibility-codesign-facilitator"
      : "comprehension-facilitator";

  if (!ownersRegistry.hasRole(report.facilitatorId, expectedRole)) {
    throw new BackfillError(
      "invalid-facilitator-role",
      `Facilitator "${report.facilitatorId}" lacks required role "${expectedRole}".`,
      report.filePath,
      1,
    );
  }

  // 2. Validate all participant codes
  const parsedCodes: ParsedParticipantCode[] = [];
  for (const item of report.participantCodes) {
    const parsed = parseParticipantCode(item.code);
    if (!parsed.ok) {
      throw new BackfillError(
        "invalid-participant-code",
        `Invalid participant code "${item.code}": ${parsed.error}`,
        report.filePath,
        item.line,
      );
    }
    parsedCodes.push(parsed);
  }

  const id = `review-${report.reviewType}-${report.paper}-${report.date.replace(/-/g, "")}`;

  return {
    id,
    reviewType: report.reviewType,
    reviewer: report.facilitatorId,
    scope: report.scope.map((s) => ({
      recordId: s.recordId,
      contentRevision: s.contentRevision,
      translationRevision: s.translationRevision,
    })),
    date: report.date,
    result: report.result ?? "accepted",
    sessionRef: report.filePath,
    notes:
      report.notes ?? `Backfilled from ${report.filePath} (${parsedCodes.length} participants)`,
  };
}
