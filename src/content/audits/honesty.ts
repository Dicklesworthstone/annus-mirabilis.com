/**
 * Four honesty checks (am-cm-audit-scripts-d34) that must be able to fail
 * on a planted bad record:
 * - a reading without a real review must emit editorial-review-pending
 * - every citation id must resolve
 * - every quantity id in use must be registered
 * - German/English equation blocks must be byte-identical (the machine
 *   half of "checked against the German"; paraphrase quality is not claimed)
 */

import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export type ReviewHonestyRecord = Readonly<{
  id: string;
  kind: "argument" | "foundation" | "equation" | "paragraph";
  review: "draft" | "accepted";
  hasAcceptedReviewRecord: boolean;
  emittedEditorialReviewPending: boolean;
}>;

export function auditReviewHonesty(records: readonly ReviewHonestyRecord[]): AuditReport {
  const findings: AuditFinding[] = [];
  for (const record of records) {
    if (record.review === "accepted") {
      if (!record.hasAcceptedReviewRecord) {
        findings.push({
          check: "review-claim-unbacked",
          family: "audit",
          severity: "error",
          recordId: record.id,
          message: `${record.id} is marked accepted without a review record.`,
        });
      }
      continue;
    }
    if (!record.emittedEditorialReviewPending) {
      findings.push({
        check: "editorial-review-pending-missing",
        family: "audit",
        severity: "error",
        recordId: record.id,
        message: `${record.id} has no accepted review and did not emit editorial-review-pending.`,
      });
    }
  }
  return summarize("audit-review-honesty", findings);
}

export type CitationUse = Readonly<{ from: string; citationId: string }>;

export function auditCitationsResolve(
  defined: ReadonlySet<string>,
  uses: readonly CitationUse[],
): AuditReport {
  const findings: AuditFinding[] = [];
  for (const use of uses) {
    if (!defined.has(use.citationId)) {
      findings.push({
        check: "citation-unresolved",
        family: "audit",
        severity: "error",
        recordId: use.from,
        message: `${use.from} cites ${use.citationId}, which is not in the bibliography.`,
      });
    }
  }
  return summarize("audit-citations", findings);
}

export type QuantityUse = Readonly<{ from: string; quantityId: string }>;

export function auditQuantityIdsRegistered(
  registered: ReadonlySet<string>,
  uses: readonly QuantityUse[],
): AuditReport {
  const findings: AuditFinding[] = [];
  for (const use of uses) {
    if (!registered.has(use.quantityId)) {
      findings.push({
        check: "quantity-unregistered",
        family: "audit",
        severity: "error",
        recordId: use.from,
        message: `${use.from} binds quantity id ${use.quantityId}, which is not registered.`,
      });
    }
  }
  return summarize("audit-quantity-ids", findings);
}

export type EquationPair = Readonly<{
  id: string;
  german: string;
  english: string;
}>;

export function auditEquationBlocksIdentical(pairs: readonly EquationPair[]): AuditReport {
  const findings: AuditFinding[] = [];
  for (const pair of pairs) {
    if (pair.german !== pair.english) {
      findings.push({
        check: "equation-not-identical",
        family: "audit",
        severity: "error",
        recordId: pair.id,
        message: `English equation block ${pair.id} is not byte-identical to its German block.`,
      });
    }
  }
  return summarize("audit-equation-identity", findings);
}
