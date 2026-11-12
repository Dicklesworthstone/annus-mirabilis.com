/** Perrin's aggregate mean squares admit point estimates, never invented raw tracks. */
import { datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
import {
  estimateSummaryStatistics,
  summaryChiSquareInterval,
} from "../../physics/reference/inference.ts";
import { evaluatePerrinRecord, PERRIN_AXES, type PerrinPoint } from "../bm01/perrin.ts";

export const PERRIN_SUMMARY_MODEL_ID = "estimateSummaryStatistics";

export type PerrinSummaryPoint = Readonly<
  PerrinPoint & {
    diffusivityM2PerSecond: number;
    independentCoordinateCount: null;
  }
>;

export type PerrinSummaryRecord =
  | Readonly<{
      kind: "available";
      citation: string;
      evidenceLabel: string;
      sourcePageImage: string;
      uncertainty: string;
      modelId: typeof PERRIN_SUMMARY_MODEL_ID;
      points: readonly PerrinSummaryPoint[];
      intervalStatus: "not-applicable";
      intervalReason: string;
    }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

/**
 * The allow-list admits just the one-coordinate summary owner. The source names fifty grains,
 * not fifty independent coordinate increments at every lag. Neither a count, a drift correction,
 * an interval nor an independent radius/gas-constant calibration can be recovered from this table.
 */
export function evaluatePerrinSummaryRecord(
  dataset: HistoricalDataset,
  citation: string,
): PerrinSummaryRecord {
  const withheld = (reason: string): PerrinSummaryRecord =>
    Object.freeze({ kind: "withheld", citation, reason });
  const shelf = getDatasetShelfStatus(dataset);
  const record = evaluatePerrinRecord(
    datasetPlotVerdict(dataset, PERRIN_AXES.x, PERRIN_AXES.y, citation),
    shelf.eligible ? undefined : shelf.badgeLabel,
    dataset.digitizer.sourcePageImage,
    dataset.uncertainty.description,
  );
  if (record.kind === "withheld") return record;
  if (!dataset.allowedInferenceModelIds.includes(PERRIN_SUMMARY_MODEL_ID))
    return withheld("This source record has not admitted the one-axis summary point estimate.");
  if (
    dataset.rows.some((row) => row.seriesId !== "chaudesaigues-first") ||
    dataset.columns.find((column) => column.quantityId === PERRIN_AXES.y.quantityId)?.role !==
      "observed"
  )
    return withheld(
      "This calculation needs the observed mean squares from the cited first series.",
    );

  const points: PerrinSummaryPoint[] = [];
  let intervalReason = "";
  for (const point of record.points) {
    const summary = estimateSummaryStatistics({
      meanSquareDisplacement: point.observedMeanSquareM2,
      observationInterval: point.elapsedTimeSeconds,
      independentCoordinateCount: null,
    });
    if (summary.kind !== "accepted")
      return withheld("The reference owner cannot evaluate the cited mean square and interval.");
    const interval = summaryChiSquareInterval(summary.data, 0.05);
    if (interval.kind !== "no-value" || interval.status !== "not-applicable")
      return withheld("The unknown independent displacement count cannot support an interval.");
    intervalReason = interval.reason;
    points.push(
      Object.freeze({
        ...point,
        diffusivityM2PerSecond: summary.data.dHat,
        independentCoordinateCount: null,
      }),
    );
  }
  return Object.freeze({
    kind: "available",
    citation: record.citation,
    evidenceLabel: record.evidenceLabel,
    sourcePageImage: record.sourcePageImage,
    uncertainty: record.uncertainty,
    modelId: PERRIN_SUMMARY_MODEL_ID,
    points: Object.freeze(points),
    intervalStatus: "not-applicable",
    intervalReason,
  });
}
