/**
 * The single shelf-date rule (am-cm-checks-epistemic-o7n).
 * Knowledge-card validators and journey checks call this; they do not re-implement it.
 */

export const SHELF_CUTOFF_YEAR = 1904;

export type ShelfStageKind = "shelf" | "chain" | "fork" | "move";

export type ShelfPremiseStatus = "available" | "parallel-work" | "later";

export type AdmittedImportRef = Readonly<{
  resultId?: string | undefined;
  declaringJourney?: string | undefined;
}>;

export type ShelfStage = Readonly<{
  id: string;
  kind: ShelfStageKind;
  parallelWorkAcknowledged?: boolean | undefined;
}>;

export type ShelfPremise = Readonly<{
  id: string;
  status: ShelfPremiseStatus;
  latestYear: number;
  admittedImport?: boolean | AdmittedImportRef | undefined;
}>;

export type ShelfJourney = Readonly<{
  id: string;
  admittedImports?: readonly string[] | undefined;
  sourcePaperExportedResults?: readonly string[] | undefined;
}>;

export type ShelfDateOkReason = "available-by-1904" | "parallel-work" | "admitted-import";

export type ShelfDateFailReason =
  | "later-card"
  | "available-after-cutoff"
  | "parallel-work-unacknowledged"
  | "admitted-import-undeclared"
  | "admitted-import-not-exported"
  | "admitted-import-wrong-year"
  | "status-alone-insufficient";

export type ShelfDateDecision =
  | Readonly<{ ok: true; code: undefined; reason: ShelfDateOkReason }>
  | Readonly<{
      ok: false;
      code: "shelf-date-violation";
      reason: ShelfDateFailReason;
      repair: string;
    }>;

function admittedResultId(premise: ShelfPremise): string {
  const info = premise.admittedImport;
  if (info && typeof info === "object" && info.resultId) return info.resultId;
  return premise.id;
}

function hasAdmittedImport(premise: ShelfPremise): boolean {
  return Boolean(premise.admittedImport);
}

/**
 * Admit a premise into a discovery stage of kind shelf, chain, fork, or move.
 * A later card is never a premise. Status alone never admits a 1905 result.
 */
export function evaluateShelfDate(
  stage: ShelfStage,
  premise: ShelfPremise,
  journey?: ShelfJourney | undefined,
): ShelfDateDecision {
  if (premise.status === "later") {
    return {
      ok: false,
      code: "shelf-date-violation",
      reason: "later-card",
      repair: `Cite "${premise.id}" as labeled world-check evidence, not as a ${stage.kind} premise.`,
    };
  }

  if (hasAdmittedImport(premise)) {
    if (premise.status !== "available" || premise.latestYear !== 1905) {
      return {
        ok: false,
        code: "shelf-date-violation",
        reason: "admitted-import-wrong-year",
        repair: `Admitted import "${premise.id}" must be status available with latestYear 1905.`,
      };
    }
    const resultId = admittedResultId(premise);
    const declared = journey?.admittedImports ?? [];
    if (!declared.includes(resultId) && !declared.includes(premise.id)) {
      return {
        ok: false,
        code: "shelf-date-violation",
        reason: "admitted-import-undeclared",
        repair: `Declare "${resultId}" in journey "${journey?.id ?? "(unknown)"}" admittedImports.`,
      };
    }
    const exported = journey?.sourcePaperExportedResults;
    if (exported && !exported.includes(resultId)) {
      return {
        ok: false,
        code: "shelf-date-violation",
        reason: "admitted-import-not-exported",
        repair: `List "${resultId}" in the source paper exportedResults.`,
      };
    }
    const declaring =
      typeof premise.admittedImport === "object"
        ? premise.admittedImport.declaringJourney
        : undefined;
    if (declaring && journey?.id && declaring !== journey.id) {
      return {
        ok: false,
        code: "shelf-date-violation",
        reason: "admitted-import-undeclared",
        repair: `Cite admitted import "${premise.id}" only from journey "${declaring}".`,
      };
    }
    return { ok: true, code: undefined, reason: "admitted-import" };
  }

  if (premise.status === "available" && premise.latestYear <= SHELF_CUTOFF_YEAR) {
    return { ok: true, code: undefined, reason: "available-by-1904" };
  }

  if (premise.status === "parallel-work") {
    if (stage.parallelWorkAcknowledged === true) {
      return { ok: true, code: undefined, reason: "parallel-work" };
    }
    return {
      ok: false,
      code: "shelf-date-violation",
      reason: "parallel-work-unacknowledged",
      repair: `Stage "${stage.id}" must set parallelWorkAcknowledged to cite "${premise.id}".`,
    };
  }

  if (premise.status === "available" && premise.latestYear > SHELF_CUTOFF_YEAR) {
    return {
      ok: false,
      code: "shelf-date-violation",
      reason: "available-after-cutoff",
      repair: `A ${premise.latestYear} result needs parallel-work with the stage flag, or an admittedImport declared by the journey. Status available alone never admits it.`,
    };
  }

  return {
    ok: false,
    code: "shelf-date-violation",
    reason: "status-alone-insufficient",
    repair: `Premise "${premise.id}" is not admitted to ${stage.kind} stage "${stage.id}".`,
  };
}
