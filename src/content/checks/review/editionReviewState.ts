/**
 * Record-backed edition review state checker for alignment tooling and edition contract.
 * Specification: am-edit-review-records-hofz and am-edn-alignment-tooling-do1
 */

import {
  type ReviewStateCheck,
  type ReviewStateCheckContext,
  type ReviewStateCheckResult,
  registerReviewStateCheck,
} from "../../editions/reviewState.ts";
import { loadOwnersRegistry, type OwnersRegistry } from "../../owners/parseOwners.ts";
import type { ReviewRecord } from "../../schemas/review.ts";

export class ReviewStore {
  private readonly records = new Map<string, ReviewRecord>();
  private readonly recordsByUnitId = new Map<string, ReviewRecord[]>();

  register(record: ReviewRecord): void {
    this.records.set(record.id, record);
    for (const scopeEntry of record.scope) {
      const list = this.recordsByUnitId.get(scopeEntry.recordId) ?? [];
      list.push(record);
      this.recordsByUnitId.set(scopeEntry.recordId, list);
    }
  }

  getRecordsForUnit(unitId: string): readonly ReviewRecord[] {
    return this.recordsByUnitId.get(unitId) ?? [];
  }

  clear(): void {
    this.records.clear();
    this.recordsByUnitId.clear();
  }
}

export const globalReviewStore = new ReviewStore();

export function createRecordBackedReviewStateCheck(
  store: ReviewStore = globalReviewStore,
  getRegistry: () => OwnersRegistry = () => loadOwnersRegistry(),
): ReviewStateCheck {
  return (context: ReviewStateCheckContext): ReviewStateCheckResult => {
    const records = store.getRecordsForUnit(context.unitId);
    const germanSourceRecords = records.filter((r) => r.reviewType === "german-source");

    if (germanSourceRecords.length === 0) {
      return {
        ok: false,
        code: "review-record-missing",
        message: `No german-source review record found covering unit "${context.unitId}".`,
      };
    }

    const registry = getRegistry();

    for (const record of germanSourceRecords) {
      const reviewer = record.reviewer;

      // 1. Reviewer unknown
      const owner = registry.getOwner(reviewer);
      if (!owner) {
        return {
          ok: false,
          code: "review-reviewer-unknown",
          message: `Reviewer "${reviewer}" is not found in docs/OWNERS.md for unit "${context.unitId}".`,
        };
      }

      // 2. Reviewer role
      if (!registry.hasRole(reviewer, "german-source-reviewer")) {
        return {
          ok: false,
          code: "review-reviewer-role",
          message: `Reviewer "${reviewer}" lacks "german-source-reviewer" role for unit "${context.unitId}".`,
        };
      }

      // 3. Self-review check
      if (
        (context.translatorId && reviewer === context.translatorId) ||
        (context.editorId && reviewer === context.editorId) ||
        (context.checkingEditorId && reviewer === context.checkingEditorId) ||
        (context.glossatorId && reviewer === context.glossatorId) ||
        context.editionEditors?.includes(reviewer)
      ) {
        return {
          ok: false,
          code: "review-self-review",
          message: `Reviewer "${reviewer}" cannot review unit "${context.unitId}" due to self-review conflict.`,
        };
      }

      // 4. Result check
      if (record.result !== "accepted" && record.result !== "accepted-with-changes") {
        return {
          ok: false,
          code: "review-record-stale",
          message: `Review record "${record.id}" for unit "${context.unitId}" has result "${record.result}".`,
        };
      }

      // 5. Staleness check: revision and unitHash
      const scopeEntry = record.scope.find((s) => s.recordId === context.unitId);
      if (!scopeEntry) {
        continue;
      }

      const effectiveRevision =
        record.result === "accepted-with-changes" &&
        record.acceptedRevisions &&
        record.acceptedRevisions[context.unitId] !== undefined
          ? record.acceptedRevisions[context.unitId]
          : (scopeEntry.translationRevision ?? scopeEntry.contentRevision);

      if (
        context.revision !== undefined &&
        effectiveRevision !== undefined &&
        String(effectiveRevision) !== String(context.revision)
      ) {
        return {
          ok: false,
          code: "review-record-stale",
          message: `Review record "${record.id}" covers revision ${effectiveRevision} but unit "${context.unitId}" is at revision ${context.revision}.`,
        };
      }

      if (
        context.unitHash !== undefined &&
        scopeEntry.unitHash !== undefined &&
        scopeEntry.unitHash !== context.unitHash
      ) {
        return {
          ok: false,
          code: "review-record-stale",
          message: `Review record "${record.id}" unitHash mismatch for unit "${context.unitId}".`,
        };
      }

      // Accepted and non-stale!
      return { ok: true };
    }

    return {
      ok: false,
      code: "review-record-missing",
      message: `No valid german-source review record accepts unit "${context.unitId}".`,
    };
  };
}

export const recordBackedReviewStateCheck: ReviewStateCheck = createRecordBackedReviewStateCheck();

/**
 * Registers the record-backed review state check into the edition reviewState seam.
 */
export function registerEditionReviewState(): void {
  registerReviewStateCheck(recordBackedReviewStateCheck);
}
