/**
 * Refusal throw site test suite for shelfDate.ts (am-muyh).
 *
 * Covers all 8 previously untested refusal sites in src/content/checks/epistemic/shelfDate.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes, reasons,
 * and repairs with exact line citations.
 *
 * Zero mocks are used.
 */
import { describe, expect, test } from "bun:test";
import {
  evaluateShelfDate,
  type ShelfJourney,
  type ShelfPremise,
  type ShelfStage,
} from "./shelfDate.ts";

const stageChain: ShelfStage = { id: "stage-1", kind: "chain" };
const stageMove: ShelfStage = { id: "stage-2", kind: "move" };

describe("shelfDate.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 78 - shelf-date-violation (later-card)
  // --------------------------------------------------------------------------
  test("rejects later status card as discovery premise (shelfDate.ts:78)", () => {
    // Reject: later status card cannot serve as premise in a chain stage
    const laterPremise: ShelfPremise = {
      id: "perrin-1909-emulsion",
      status: "later",
      latestYear: 1909,
    };
    const rejectDecision = evaluateShelfDate(stageChain, laterPremise);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("later-card");
      expect(rejectDecision.repair).toContain(
        'Cite "perrin-1909-emulsion" as labeled world-check evidence',
      );
    }

    // Accept: available by 1904 premise
    const acceptPremise: ShelfPremise = {
      id: "van-t-hoff-1887-osmotic",
      status: "available",
      latestYear: 1887,
    };
    const acceptDecision = evaluateShelfDate(stageChain, acceptPremise);
    expect(acceptDecision.ok).toBe(true);
    if (acceptDecision.ok) {
      expect(acceptDecision.reason).toBe("available-by-1904");
    }
  });

  // --------------------------------------------------------------------------
  // Site 2: line 88 - shelf-date-violation (admitted-import-wrong-year)
  // --------------------------------------------------------------------------
  test("rejects admitted import with wrong year or non-available status (shelfDate.ts:88)", () => {
    // Reject: admittedImport set on premise with latestYear !== 1905
    const wrongYearPremise: ShelfPremise = {
      id: "wrong-year-import",
      status: "available",
      latestYear: 1903,
      admittedImport: true,
    };
    const rejectDecision = evaluateShelfDate(stageChain, wrongYearPremise);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("admitted-import-wrong-year");
      expect(rejectDecision.repair).toContain("must be status available with latestYear 1905");
    }

    // Accept: admitted import with status available and latestYear 1905 declared in journey
    const validJourney: ShelfJourney = {
      id: "journey-1",
      admittedImports: ["valid-import"],
    };
    const validPremise: ShelfPremise = {
      id: "valid-import",
      status: "available",
      latestYear: 1905,
      admittedImport: true,
    };
    const acceptDecision = evaluateShelfDate(stageChain, validPremise, validJourney);
    expect(acceptDecision.ok).toBe(true);
    if (acceptDecision.ok) {
      expect(acceptDecision.reason).toBe("admitted-import");
    }
  });

  // --------------------------------------------------------------------------
  // Site 3: line 98 - shelf-date-violation (admitted-import-undeclared in journey)
  // --------------------------------------------------------------------------
  test("rejects admitted import not declared in journey admittedImports (shelfDate.ts:98)", () => {
    const undeclaredPremise: ShelfPremise = {
      id: "sr-s8-result",
      status: "available",
      latestYear: 1905,
      admittedImport: { resultId: "sr-s8-result" },
    };
    const journeyWithoutImport: ShelfJourney = {
      id: "journey-empty",
      admittedImports: ["other-result"],
    };
    const rejectDecision = evaluateShelfDate(stageChain, undeclaredPremise, journeyWithoutImport);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("admitted-import-undeclared");
      expect(rejectDecision.repair).toContain(
        'Declare "sr-s8-result" in journey "journey-empty" admittedImports',
      );
    }

    // Accept: journey explicitly declares the import
    const journeyWithImport: ShelfJourney = {
      id: "journey-with-sr8",
      admittedImports: ["sr-s8-result"],
    };
    const acceptDecision = evaluateShelfDate(stageChain, undeclaredPremise, journeyWithImport);
    expect(acceptDecision.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 4: line 107 - shelf-date-violation (admitted-import-not-exported)
  // --------------------------------------------------------------------------
  test("rejects admitted import not listed in source paper exportedResults (shelfDate.ts:107)", () => {
    const importPremise: ShelfPremise = {
      id: "unexported-result",
      status: "available",
      latestYear: 1905,
      admittedImport: { resultId: "unexported-result" },
    };
    const journeyWithExports: ShelfJourney = {
      id: "journey-exports",
      admittedImports: ["unexported-result"],
      sourcePaperExportedResults: ["exported-alpha", "exported-beta"],
    };
    const rejectDecision = evaluateShelfDate(stageChain, importPremise, journeyWithExports);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("admitted-import-not-exported");
      expect(rejectDecision.repair).toContain(
        'List "unexported-result" in the source paper exportedResults',
      );
    }

    // Accept: sourcePaperExportedResults includes the resultId
    const journeyWithMatchingExport: ShelfJourney = {
      ...journeyWithExports,
      sourcePaperExportedResults: ["unexported-result", "exported-alpha"],
    };
    const acceptDecision = evaluateShelfDate(stageChain, importPremise, journeyWithMatchingExport);
    expect(acceptDecision.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 5: line 119 - shelf-date-violation (admitted-import declaringJourney mismatch)
  // --------------------------------------------------------------------------
  test("rejects admitted import when declaringJourney mismatches current journey (shelfDate.ts:119)", () => {
    const scopedPremise: ShelfPremise = {
      id: "sr-energy",
      status: "available",
      latestYear: 1905,
      admittedImport: {
        resultId: "sr-energy",
        declaringJourney: "journey-mass-energy",
      },
    };
    const otherJourney: ShelfJourney = {
      id: "journey-light-quanta",
      admittedImports: ["sr-energy"],
    };
    const rejectDecision = evaluateShelfDate(stageChain, scopedPremise, otherJourney);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("admitted-import-undeclared");
      expect(rejectDecision.repair).toContain(
        'Cite admitted import "sr-energy" only from journey "journey-mass-energy"',
      );
    }

    // Accept: journey matches declaringJourney
    const matchingJourney: ShelfJourney = {
      id: "journey-mass-energy",
      admittedImports: ["sr-energy"],
    };
    const acceptDecision = evaluateShelfDate(stageChain, scopedPremise, matchingJourney);
    expect(acceptDecision.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 6: line 137 - shelf-date-violation (parallel-work-unacknowledged)
  // --------------------------------------------------------------------------
  test("rejects parallel-work premise without stage acknowledgement (shelfDate.ts:137)", () => {
    const parallelPremise: ShelfPremise = {
      id: "sutherland-1905-diffusion",
      status: "parallel-work",
      latestYear: 1905,
    };
    const unacknowledgedStage: ShelfStage = {
      id: "stage-brownian-chain",
      kind: "chain",
      parallelWorkAcknowledged: false,
    };
    const rejectDecision = evaluateShelfDate(unacknowledgedStage, parallelPremise);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("parallel-work-unacknowledged");
      expect(rejectDecision.repair).toContain(
        'must set parallelWorkAcknowledged to cite "sutherland-1905-diffusion"',
      );
    }

    // Accept: stage sets parallelWorkAcknowledged: true
    const acknowledgedStage: ShelfStage = {
      ...unacknowledgedStage,
      parallelWorkAcknowledged: true,
    };
    const acceptDecision = evaluateShelfDate(acknowledgedStage, parallelPremise);
    expect(acceptDecision.ok).toBe(true);
    if (acceptDecision.ok) {
      expect(acceptDecision.reason).toBe("parallel-work");
    }
  });

  // --------------------------------------------------------------------------
  // Site 7: line 146 - shelf-date-violation (available-after-cutoff)
  // --------------------------------------------------------------------------
  test("rejects available card dated after 1904 cutoff without admittedImport (shelfDate.ts:146)", () => {
    const post1904Premise: ShelfPremise = {
      id: "jeans-1905-correction",
      status: "available",
      latestYear: 1905,
    };
    const rejectDecision = evaluateShelfDate(stageChain, post1904Premise);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("available-after-cutoff");
      expect(rejectDecision.repair).toContain(
        "A 1905 result needs parallel-work with the stage flag",
      );
    }

    // Accept: available card dated 1904 or earlier
    const pre1905Premise: ShelfPremise = {
      id: "lorentz-1904-electrodynamics",
      status: "available",
      latestYear: 1904,
    };
    const acceptDecision = evaluateShelfDate(stageChain, pre1905Premise);
    expect(acceptDecision.ok).toBe(true);
    if (acceptDecision.ok) {
      expect(acceptDecision.reason).toBe("available-by-1904");
    }
  });

  // --------------------------------------------------------------------------
  // Site 8: line 154 - shelf-date-violation (status-alone-insufficient)
  // --------------------------------------------------------------------------
  test("rejects unrecognized status or unhandled combination (shelfDate.ts:154)", () => {
    // Reject: premise status is not recognized (e.g. cast from invalid input)
    const invalidStatusPremise = {
      id: "unknown-status-card",
      status: "hypothetical" as unknown as ShelfPremise["status"],
      latestYear: 1900,
    };
    const rejectDecision = evaluateShelfDate(stageMove, invalidStatusPremise);
    expect(rejectDecision.ok).toBe(false);
    if (!rejectDecision.ok) {
      expect(rejectDecision.code).toBe("shelf-date-violation");
      expect(rejectDecision.reason).toBe("status-alone-insufficient");
      expect(rejectDecision.repair).toContain(
        'Premise "unknown-status-card" is not admitted to move stage "stage-2"',
      );
    }

    // Accept: valid recognized available status <= 1904
    const validPremise: ShelfPremise = {
      id: "boltzmann-1877-entropy",
      status: "available",
      latestYear: 1877,
    };
    const acceptDecision = evaluateShelfDate(stageMove, validPremise);
    expect(acceptDecision.ok).toBe(true);
  });
});
