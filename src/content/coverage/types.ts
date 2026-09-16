/**
 * Coverage Ledger Data Model and Types.
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
 */

import type { RuntimeProvenance } from "./coverageManifest.ts";

export type ArgumentTreatmentKind = "instrument" | "static" | "omitted";

export interface InstrumentTreatment {
  readonly kind: "instrument";
  readonly experimentIds: readonly string[];
  readonly correspondenceNote?: string | undefined;
}

export interface StaticTreatment {
  readonly kind: "static";
  readonly description?: string | undefined;
}

export interface OmittedTreatment {
  readonly kind: "omitted";
  readonly reason: string;
}

export type ArgumentTreatment = InstrumentTreatment | StaticTreatment | OmittedTreatment;

export interface ArgumentNodeCoverage {
  readonly id: string;
  readonly paper: string;
  readonly section: string;
  readonly logicalRole?:
    | "derivation"
    | "heuristic-inference"
    | "premise"
    | "conclusion"
    | "foundation"
    | string
    | undefined;
  readonly readingsPresent: readonly ("R0" | "R1" | "R2" | "R3")[];
  readonly treatment: ArgumentTreatment;
  readonly numericalBinding?:
    | {
        readonly ownerId: string;
        readonly outputIds: readonly string[];
      }
    | undefined;
  readonly accessibilityEquivalent?:
    | {
        readonly kind: "action-contract" | "textual-equivalent";
        readonly details?: string | undefined;
      }
    | undefined;
  readonly acceptanceScenarioIds?: readonly string[] | undefined;
}

export type ExecutionProvenanceState =
  | "static-worked-example"
  | "host-calculation-available"
  | "frankensim-owner-packaged"
  | "artifact-loaded"
  | "accepted-frankensim-result-demonstrated"
  | "typed-refusal-boundary-present";

export type NumericalValidationStatus = "passing" | "failing" | "not-run";
export type EditorialReviewStatus = "accepted" | "needs-rereview" | "not-reviewed";

export interface CoverageReportInput {
  readonly path: string;
  readonly sha256: string;
  readonly kind: "source-manifest" | "scenario-evidence" | "review-records" | "argument-nodes";
}

export interface DimensionStatusSummary {
  readonly byStatus: Readonly<Record<string, number>>;
  readonly totalUnits?: number | undefined;
  readonly totalNodes?: number | undefined;
  readonly totalScenarios?: number | undefined;
  readonly totalReviews?: number | undefined;
  readonly totalInstruments?: number | undefined;
  readonly details?: readonly unknown[] | undefined;
}

export interface CoverageReport {
  readonly logRunId: string;
  readonly generatedAt: string;
  readonly inputs: readonly CoverageReportInput[];
  readonly sourceStatus: {
    readonly byStatus: Readonly<Record<string, number>>;
    readonly totalUnits: number;
    readonly papers: Readonly<
      Record<
        string,
        { readonly totalUnits: number; readonly byStatus: Readonly<Record<string, number>> }
      >
    >;
  };
  readonly translationReview: {
    readonly byStatus: Readonly<Record<string, number>>;
    readonly totalUnits: number;
    readonly papers: Readonly<
      Record<
        string,
        { readonly totalUnits: number; readonly byStatus: Readonly<Record<string, number>> }
      >
    >;
  };
  readonly argumentTreatment: {
    readonly byKind: Readonly<Record<string, number>>;
    readonly totalNodes: number;
    readonly papers: Readonly<
      Record<
        string,
        { readonly totalNodes: number; readonly byKind: Readonly<Record<string, number>> }
      >
    >;
  };
  readonly instrumentAvailability: {
    readonly byProvenance: Readonly<Record<string, number>>;
    readonly totalInstruments: number;
    readonly instruments: Readonly<
      Record<
        string,
        { readonly provenance: ExecutionProvenanceState; readonly donorState: RuntimeProvenance }
      >
    >;
  };
  readonly accessibilityEquivalence: {
    readonly byKind: Readonly<Record<string, number>>;
    readonly totalNodes: number;
    readonly nodes: Readonly<
      Record<string, { readonly kind: string; readonly details?: string | undefined }>
    >;
  };
  readonly numericalValidation: {
    readonly byStatus: Readonly<Record<string, number>>;
    readonly totalScenarios: number;
    readonly scenarios: Readonly<
      Record<
        string,
        { readonly status: NumericalValidationStatus; readonly reason?: string | undefined }
      >
    >;
  };
  readonly editorialReview: {
    readonly byStatus: Readonly<Record<string, number>>;
    readonly totalReviews: number;
    readonly reviews: Readonly<
      Record<
        string,
        {
          readonly physicsReview: EditorialReviewStatus;
          readonly r2Readability: EditorialReviewStatus;
          readonly germanSourceReview: EditorialReviewStatus;
        }
      >
    >;
  };
}

export interface CoverageDiagnostic {
  readonly severity: "error" | "flag";
  readonly rule: string;
  readonly paper?: string | undefined;
  readonly section?: string | undefined;
  readonly argumentId?: string | undefined;
  readonly message: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly repair?: string | undefined;
}
