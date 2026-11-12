import { ExperimentRuntimeError } from "../refusal.ts";
import { parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import {
  checkpointJson,
  decodeInstanceCheckpoint,
  type InstanceCheckpointRestore,
} from "../store/instanceCheckpoint.ts";
import {
  createInstanceStore,
  type ExperimentView,
  type OutputContract,
  type ParameterClass,
} from "../store/instanceStore.ts";
import { parseShelfParameters } from "./definition.ts";
import { evaluateShelfOptics } from "./evaluation.ts";
import {
  applyShelfParameters,
  primaryShelfMetrics,
  type ShelfApply,
  type ShelfEvaluator,
  type ShelfReport,
  type ShelfSnapshot,
  shelfSnapshot,
} from "./state.ts";

export type ShelfView = ExperimentView & Readonly<{ comparison: ShelfSnapshot }>;
type ComparisonOutput = Extract<ScientificResult, { status: "value" }>;

/**
 * One canonical primary observable, ordered by the report's model rows. The optical owner
 * reuses some secondary quantity ids for different observables and units, so those remain
 * in the same immutable report instead of inventing scientific ids from their display labels.
 */
function comparisonOutput(report: ShelfReport): ComparisonOutput | null {
  const metrics = primaryShelfMetrics(report);
  const first = metrics[0];
  if (
    !first ||
    metrics.some(
      (metric) =>
        metric.quantityId !== first.quantityId ||
        metric.unit !== first.unit ||
        metric.ownerId !== first.ownerId,
    )
  )
    return null;
  return {
    quantityId: first.quantityId,
    unit: first.unit,
    semanticKind: "model-comparison",
    ownerId: first.ownerId,
    status: "value",
    value: Float64Array.from(metrics, (metric) => metric.value),
  };
}

/**
 * The shelf's accepted state has one owner in both standalone and reader placements.
 * Applying settings calls the existing evaluator once. It publishes the comparison and the
 * standard instance identity together; React only owns unsubmitted form text and predictions.
 */
export function createShelfOpticsSession(
  instanceId: string,
  example: ShelfReport,
  evaluate: ShelfEvaluator = evaluateShelfOptics,
) {
  let comparison = shelfSnapshot(example);
  const initialOutput = comparisonOutput(comparison.report);
  if (!initialOutput)
    throw new ExperimentRuntimeError(
      "primary-observable-mismatch",
      "The model rows must share one primary observable, unit and numerical owner.",
      "shelf-optics",
    );
  const contract: OutputContract = {
    statuses: ["value"],
    unit: initialOutput.unit,
    semanticKind: initialOutput.semanticKind,
    ownerId: initialOutput.ownerId,
  };
  const modelIds = comparison.report.rows.map((row) => row.modelId);
  const primaryMetric = comparison.report.primaryMetric;
  const primaryQuantityId = initialOutput.quantityId;
  const store = createInstanceStore({
    experimentId: comparison.report.parameters.instrumentId,
    instanceId,
    initialParameters: comparison.report.parameters,
    parameterClasses: Object.fromEntries(
      Object.keys(comparison.report.parameters).map((key) => [key, "input" as ParameterClass]),
    ),
    outputs: { [primaryQuantityId]: contract },
  });
  let cachedStoreView: ExperimentView | undefined;
  let cachedView: ShelfView | undefined;

  function getSnapshot(): ShelfView {
    const next = store.getSnapshot();
    if (!cachedView || cachedStoreView !== next || cachedView.comparison !== comparison) {
      cachedStoreView = next;
      cachedView = Object.freeze({ ...next, comparison });
    }
    return cachedView;
  }

  function publish(snapshot: ShelfSnapshot, output: ComparisonOutput): void {
    const previousComparison = comparison;
    const token = store.issue("setup-change", snapshot.report.parameters);
    // The store notifies synchronously on acceptance. Its subscribers must already be able
    // to read the report belonging to that accepted output, not the preceding calculation.
    comparison = snapshot;
    const decision = store.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [output],
    });
    if (!decision.accepted) {
      comparison = previousComparison;
      throw new ExperimentRuntimeError(
        "publication-refused",
        `The shelf comparison could not be published: ${decision.reason}`,
        "shelf-optics",
      );
    }
  }

  publish(comparison, initialOutput);
  const initialView = getSnapshot();
  let applying = false;

  function checkedOutput(report: ShelfReport): ComparisonOutput | null {
    const output = comparisonOutput(report);
    return output &&
      report.primaryMetric === primaryMetric &&
      output.quantityId === primaryQuantityId &&
      output.unit === contract.unit &&
      output.ownerId === contract.ownerId &&
      report.rows.length === modelIds.length &&
      report.rows.every((row, index) => row.modelId === modelIds[index])
      ? output
      : null;
  }

  function apply(raw: unknown): ShelfApply {
    // Store notifications are synchronous. A subscriber must not supersede an unfinished
    // publication and leave its accepted numeric vector paired with another report.
    if (applying)
      return {
        kind: "refused",
        message: "The current calculation is still being applied. Try again when it finishes.",
      };
    applying = true;
    try {
      const result = applyShelfParameters(comparison, raw, evaluate);
      if (result.kind === "refused") return result;
      const report = result.snapshot.report;
      const output = checkedOutput(report);
      if (!output) {
        return {
          kind: "refused",
          message:
            "The calculation did not preserve the comparison's observable and model rows. The previous calculation is unchanged.",
        };
      }
      publish(result.snapshot, output);
      return result;
    } finally {
      applying = false;
    }
  }

  /** Rebuild every report metric with the current owner before importing an archived identity. */
  function restoreCheckpoint(input: unknown): InstanceCheckpointRestore {
    if (applying)
      return { kind: "not-restored", notice: "A shelf calculation is already being applied." };
    applying = true;
    const previousComparison = comparison;
    try {
      const { checkpoint } = decodeInstanceCheckpoint(input);
      const parameters = checkpoint.accepted.parameters;
      const parsed = parseShelfParameters(example.parameters.instrumentId, parameters);
      if (
        parsed.kind !== "parameters" ||
        checkpointJson(parsed.parameters) !== checkpointJson(parameters)
      )
        return { kind: "not-restored", notice: "The recorded shelf settings are incompatible." };
      const result = applyShelfParameters(comparison, parsed.parameters, evaluate);
      if (result.kind !== "accepted") return { kind: "not-restored", notice: result.message };
      const output = checkedOutput(result.snapshot.report);
      const recorded =
        checkpoint.accepted.outputs.length === 1
          ? parseResult(checkpoint.accepted.outputs[0] as string)
          : null;
      if (
        !output ||
        recorded?.status !== "value" ||
        typeof output.value === "number" ||
        typeof recorded.value === "number" ||
        output.quantityId !== recorded.quantityId ||
        output.unit !== recorded.unit ||
        output.ownerId !== recorded.ownerId ||
        output.semanticKind !== recorded.semanticKind ||
        output.value.length !== recorded.value.length ||
        !output.value.every((value, index) =>
          Object.is(value, (recorded.value as Float64Array)[index]),
        )
      )
        return {
          kind: "not-restored",
          notice: "The current optical owner does not reproduce the recorded comparison.",
        };
      // Every shelf command is one setup-change, including the initial worked example. The
      // report revision follows that same sequence while the store restores its exact counters.
      comparison = shelfSnapshot(result.snapshot.report, checkpoint.accepted.actionIndex - 1);
      const restored = store.restoreCheckpoint(checkpoint);
      if (restored.kind !== "restored") comparison = previousComparison;
      return restored;
    } catch (error) {
      comparison = previousComparison;
      return {
        kind: "not-restored",
        notice: `The shelf checkpoint could not be restored: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      applying = false;
    }
  }

  return Object.freeze({
    getSnapshot,
    getServerSnapshot: () => initialView,
    subscribe: store.subscribe,
    exportCheckpoint: store.exportCheckpoint,
    restoreCheckpoint,
    acceptedParameters: () => comparison.report.parameters,
    apply,
    // Applying shelf controls always starts an explicitly identified setup-change run.
    startNewRun: apply,
  });
}

export type ShelfOpticsSession = ReturnType<typeof createShelfOpticsSession>;
