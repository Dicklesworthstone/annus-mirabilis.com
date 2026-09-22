import { ExperimentRuntimeError } from "../refusal.ts";
import { parseShelfParameters, type ShelfId, type ShelfParameters } from "./definition.ts";

export type ShelfMetric = Readonly<{
  label: string;
  unit: string;
  value: number;
  quantityId: string;
  ownerId: string;
}>;
export type ShelfRow = Readonly<{
  modelId: string;
  label: string;
  metrics: readonly ShelfMetric[];
}>;
export type ShelfReport = Readonly<{
  parameters: ShelfParameters;
  rows: readonly ShelfRow[];
  primaryMetric: string;
  interpretation: string;
  later: readonly ShelfMetric[];
}>;
export type ShelfSnapshot = Readonly<{ revision: number; report: ShelfReport }>;
export type ShelfEvaluator = (parameters: ShelfParameters) => ShelfReport;
export type ShelfApply =
  | Readonly<{ kind: "accepted"; snapshot: ShelfSnapshot }>
  | Readonly<{ kind: "refused"; message: string }>;

/** Freeze a fresh copy: server props, evaluator buffers and other lab instances cannot alias it. */
export function shelfSnapshot(report: ShelfReport, revision = 0): ShelfSnapshot {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new ExperimentRuntimeError(
      "invalid-revision",
      "Invalid calculation revision.",
      "shelf-optics",
    );
  const parsed = parseShelfParameters(report.parameters.instrumentId, report.parameters);
  if (parsed.kind !== "parameters")
    throw new ExperimentRuntimeError("parameters-rejected", parsed.message, "shelf-optics");
  if (
    report.rows.length < 2 ||
    new Set(report.rows.map((row) => row.modelId)).size !== report.rows.length
  ) {
    throw new ExperimentRuntimeError(
      "model-rows-not-distinct",
      "A comparison requires distinct model rows.",
      "shelf-optics",
    );
  }
  const copyMetric = (metric: ShelfMetric): ShelfMetric => {
    if (
      !metric.label ||
      !metric.unit ||
      !metric.quantityId ||
      !metric.ownerId ||
      !Number.isFinite(metric.value)
    ) {
      throw new ExperimentRuntimeError(
        "owner-result-nonfinite",
        "The owner did not provide a finite, labeled result.",
        "shelf-optics",
      );
    }
    return Object.freeze({ ...metric });
  };
  const rows = report.rows.map((row) => {
    if (
      !row.modelId ||
      !row.label ||
      row.metrics.filter((metric) => metric.label === report.primaryMetric).length !== 1
    ) {
      throw new ExperimentRuntimeError(
        "primary-observable-missing",
        "Every model needs one named primary observable.",
        "shelf-optics",
      );
    }
    return Object.freeze({ ...row, metrics: Object.freeze(row.metrics.map(copyMetric)) });
  });
  return Object.freeze({
    revision,
    report: Object.freeze({
      ...report,
      parameters: parsed.parameters,
      rows: Object.freeze(rows),
      later: Object.freeze(report.later.map(copyMetric)),
    }),
  });
}

/** One synchronous owner evaluation per accepted request. Refusal never alters the last result. */
export function applyShelfParameters(
  current: ShelfSnapshot,
  raw: unknown,
  evaluate: ShelfEvaluator,
): ShelfApply {
  const id: ShelfId = current.report.parameters.instrumentId;
  const parsed = parseShelfParameters(id, raw);
  if (parsed.kind === "refused") return parsed;
  try {
    const report = evaluate(parsed.parameters);
    if (JSON.stringify(report.parameters) !== JSON.stringify(parsed.parameters)) {
      return {
        kind: "refused",
        message:
          "The calculation returned settings different from the request. The previous calculation is unchanged.",
      };
    }
    return { kind: "accepted", snapshot: shelfSnapshot(report, current.revision + 1) };
  } catch {
    return {
      kind: "refused",
      message:
        "The reference calculation could not produce a complete finite comparison. The previous calculation is unchanged.",
    };
  }
}

/** The plot and its text/table alternatives share this exact selected observable. */
export function primaryShelfMetrics(report: ShelfReport) {
  return report.rows.map((row) => {
    const metric = row.metrics.find((entry) => entry.label === report.primaryMetric);
    if (!metric)
      throw new ExperimentRuntimeError(
        "primary-observable-missing",
        "Missing primary observable.",
        "shelf-optics",
      );
    return { ...metric, modelId: row.modelId, modelLabel: row.label };
  });
}
