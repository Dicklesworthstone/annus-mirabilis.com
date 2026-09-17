/**
 * Build-time projections for ResultCard's `support`, `limitation`, `printedChecks`, and
 * `reception` layers (am-read-results-face-uzh). Each function reads an existing registry and
 * never recomputes or re-authors what that registry already owns.
 */
import type { ArgumentNode } from "../../../content/schemas/argument.ts";
import type {
  DatasetAddressesResult,
  HistoricalDataset,
} from "../../../content/schemas/experiment.ts";
import type { PremiseEdgeType } from "../../../content/schemas/meanings.ts";
import {
  exportProofGraph,
  type ProofRouteGraph,
} from "../../../equations/derivations/exportProofGraph.ts";
import type { DerivationChain } from "../../../equations/derivations/types.ts";
import { verifyChain } from "../../../equations/derivations/verifyChain.ts";
import type {
  AlternativeRoute,
  EmpiricalInput,
  LimitationLayer,
  PrintedCheck,
  ReceptionEntry,
  SupportLayer,
  VerificationState,
} from "./types.ts";

export class ResultsProjectionError extends Error {
  readonly rule: string;
  constructor(rule: string, message: string) {
    super(message);
    this.name = "ResultsProjectionError";
    this.rule = rule;
  }
}

const EDGE_TYPE_WORDING: Readonly<Record<PremiseEdgeType, string>> = Object.freeze({
  "historical-derivation": "a premise the paper builds on",
  "modern-verification-oracle": "a modern check, not a premise",
  "cross-reference": "a cross-reference to another argument, not a premise of this one",
  "pedagogical-reconstruction": "part of a teaching reconstruction, not the paper's own route",
});

function edgeTypeWords(edgeType: PremiseEdgeType): string {
  return EDGE_TYPE_WORDING[edgeType];
}

function titleFromRouteKind(routeKind: string): string {
  return routeKind
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Projects the `support` layer from the real proof graph. `allRoutesForTarget` must include
 * every `DerivationChain` that shares `chain.target` with the selected one -- the bead's own
 * rule ("when several routes reach the target, the card names the source-order route as the
 * selected one and lists the others as alternatives") only holds when every route is present;
 * a caller that omits a route silently drops it from `alternativeRoutes`.
 *
 * `empiricalInputs` is supplied by the caller (`citedEmpiricalInputs`), not inferred here: the
 * bead text asks for premises whose `logicalRole` is `empirical-observation`, and no premise
 * record in this repository carries that field yet (it belongs to am-cm-schemas-argument-llm,
 * out of this bead's scope). An empty default is correct for every fixture checked so far
 * (Brownian's source-order route to lambda_x cites no measurement, matching the bead's own
 * "true for ... all of paper 4" example), and a caller that has resolved real empirical premises
 * or dataset citations passes them explicitly.
 */
export function projectSupport(
  chain: DerivationChain,
  allRoutesForTarget: readonly DerivationChain[],
  citedEmpiricalInputs: readonly EmpiricalInput[] = [],
): SupportLayer {
  if (!allRoutesForTarget.some((c) => c.proofRouteId === chain.proofRouteId)) {
    throw new ResultsProjectionError(
      "support-route-not-in-target-set",
      `Chain "${chain.id}" (route ${chain.proofRouteId}) is not present in allRoutesForTarget.`,
    );
  }
  const mismatched = allRoutesForTarget.filter((c) => c.target !== chain.target);
  if (mismatched.length > 0) {
    throw new ResultsProjectionError(
      "support-mismatched-target",
      `allRoutesForTarget contains a chain targeting "${mismatched[0]?.target}", not "${chain.target}".`,
    );
  }

  const selected =
    chain.routeKind === "source-order"
      ? chain
      : allRoutesForTarget.find((c) => c.routeKind === "source-order");
  if (!selected) {
    throw new ResultsProjectionError(
      "support-no-source-order-route",
      `No source-order route reaches target "${chain.target}"; the bead's contract requires one to be selected.`,
    );
  }

  const graphs = allRoutesForTarget.map((c) => exportProofGraph(c));
  const selectedGraph: ProofRouteGraph | undefined = graphs
    .flatMap((g) => g.routes)
    .find((r) => r.proofRouteId === selected.proofRouteId);
  if (!selectedGraph) {
    throw new ResultsProjectionError(
      "support-graph-export-mismatch",
      `exportProofGraph did not return the selected route "${selected.proofRouteId}".`,
    );
  }
  if (!selectedGraph.isAcyclic) {
    throw new ResultsProjectionError(
      "support-selected-route-cyclic",
      `The selected route "${selected.proofRouteId}" is cyclic: ${(selectedGraph.cyclePath ?? []).join(" -> ")}.`,
    );
  }

  const alternativeRoutes: AlternativeRoute[] = allRoutesForTarget
    .filter((c) => c.proofRouteId !== selected.proofRouteId)
    .map((c) => ({
      proofRouteId: c.proofRouteId,
      routeKind: c.routeKind,
      title: titleFromRouteKind(c.routeKind),
    }));

  // The real, step-by-step publication-gate verdict -- never re-derived from the chain's own
  // steps directly, so this can never drift from am-eq-derivation-chains-r4c's own rule.
  const gateReport = verifyChain(selected, { isPublicationGate: true });
  const firstUnverified = gateReport.stepReports.find(
    (s) => s.verificationStatus === "authored-unverified",
  );
  const verificationState: VerificationState = firstUnverified
    ? { status: "authored-unverified", reviewRecordId: firstUnverified.reviewRecordId }
    : { status: "verified" };

  return {
    proofRouteId: selected.proofRouteId,
    chainId: selected.id,
    routeKind: selected.routeKind,
    entryAssumptions: selected.entryAssumptions.map((p) => ({
      premiseId: p.ref,
      edgeType: edgeTypeWords(p.edgeType),
    })),
    alternativeRoutes,
    empiricalInputs: citedEmpiricalInputs,
    verificationState,
    isPublicationReady: gateReport.isPublicationReady,
  };
}

/**
 * Projects `limitation` by reference: `text` is always the argument node's own `limitations`
 * joined into one line, never a card-owned copy. Fails with `result-limitation-missing` when
 * the node has none, matching the bead's own required compilation rule.
 */
export function projectLimitation(
  argumentId: string,
  node: ArgumentNode,
  historiansMarginRecordId?: string,
): LimitationLayer {
  if (node.limitations.length === 0) {
    throw new ResultsProjectionError(
      "result-limitation-missing",
      `Argument node "${argumentId}" has no limitations; every result card requires one. A blank field means the limit has not been written down, not that none exists.`,
    );
  }
  return {
    argumentId,
    text: node.limitations.join(" "),
    ...(historiansMarginRecordId !== undefined ? { historiansMarginRecordId } : {}),
  };
}

/**
 * Projects one `PrintedCheck`. The reproduced value and its comparison are supplied by the
 * caller (`reproduce`), computed from the scenario's own stated inputs by the real owner
 * function the scenario names -- this projection formats and labels, it never evaluates
 * physics itself.
 */
export function projectPrintedCheck(params: {
  printedValue: string;
  statedInputs: Readonly<Record<string, string>>;
  constantSetId: string;
  scenarioId: string;
  reproducedValue: number;
  tolerance: number;
  comparisonKind: string;
  label: string;
  transcriptionPending: boolean;
}): PrintedCheck {
  if (!Number.isFinite(params.reproducedValue)) {
    throw new ResultsProjectionError(
      "printed-check-nonfinite-reproduction",
      `Scenario "${params.scenarioId}" reproduced a non-finite value; a printed check never shows NaN or Infinity.`,
    );
  }
  return { ...params };
}

/** Projects `reception` from `HistoricalDataset.addressesResults[]`. The bead's later-timeline-
 * entries half (am-disc-timeline-xzef) is not built; this covers the dataset half, which is. */
export function projectReception(
  resultId: string,
  datasets: readonly HistoricalDataset[],
  dateOf: (
    dataset: HistoricalDataset,
  ) => Readonly<{ date: string; precision: ReceptionEntry["precision"] }>,
): readonly ReceptionEntry[] {
  const entries: ReceptionEntry[] = [];
  for (const dataset of datasets) {
    const addresses =
      (dataset as { addressesResults?: readonly DatasetAddressesResult[] }).addressesResults ?? [];
    for (const entry of addresses) {
      if (entry.resultId !== resultId) continue;
      const { date, precision } = dateOf(dataset);
      entries.push({
        datasetId: dataset.id,
        relation: entry.relation,
        statement: entry.statement,
        date,
        precision,
      });
    }
  }
  return Object.freeze(entries);
}
