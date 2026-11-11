import type { DatasetPlotVerdict, PlotAxis } from "../../content/datasets/plotVerdict.ts";
import { moments } from "../../physics/reference/diffusion.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";

export const PERRIN_1909_DATASET_ID = "perrin-1909-displacements";

export const PERRIN_AXES: Readonly<{ x: PlotAxis; y: PlotAxis }> = Object.freeze({
  x: Object.freeze({ quantityId: "elapsedTime", unit: "s" }),
  y: Object.freeze({ quantityId: "meanSquareDisplacement1d", unit: "m2" }),
});

/** Perrin, p. 77, first series. The constant set is today's; the physical inputs are the source's. */
export const PERRIN_TRACER_INPUTS = Object.freeze({
  constantSetId: "modern-si-2019",
  T: 290.15,
  eta: 0.0011,
  a: 0.212e-6,
});

export type PerrinPoint = Readonly<{
  elapsedTimeSeconds: number;
  observedMeanSquareM2: number;
}>;

export type PerrinRecord =
  | Readonly<{
      kind: "plottable";
      citation: string;
      evidenceLabel: string;
      sourcePageImage: string;
      uncertainty: string;
      points: readonly PerrinPoint[];
    }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

/** A withdrawn dataset cannot serialize observations into a client component. */
export function evaluatePerrinRecord(
  verdict: DatasetPlotVerdict,
  evidenceLabel: string | undefined,
  sourcePageImage: string,
  uncertainty: string,
): PerrinRecord {
  const withheld = (reason: string): PerrinRecord =>
    Object.freeze({ kind: "withheld", citation: verdict.citation, reason });
  if (verdict.kind === "withheld") return withheld(verdict.reason);
  if (evidenceLabel !== "later evidence, published 1909") {
    return withheld("This comparison needs the cited record's 1909 publication date.");
  }
  if (verdict.datasetId !== PERRIN_1909_DATASET_ID) {
    return withheld("This is not the first-series displacement record cited by this comparison.");
  }
  const intervals = [30, 60, 90, 120];
  if (
    verdict.points.length !== intervals.length ||
    verdict.points.some(
      (point, i) => point.x !== intervals[i] || !Number.isFinite(point.y) || point.y <= 0,
    )
  ) {
    return withheld("The cited table needs all four intervals and their measured mean squares.");
  }
  return Object.freeze({
    kind: "plottable",
    citation: verdict.citation,
    evidenceLabel,
    sourcePageImage,
    uncertainty,
    points: Object.freeze(
      verdict.points.map((point) =>
        Object.freeze({
          elapsedTimeSeconds: point.x,
          observedMeanSquareM2: point.y,
        }),
      ),
    ),
  });
}

export type PerrinComparison =
  | Readonly<{
      kind: "available";
      sourceConditionsMatch: boolean;
      points: readonly Readonly<
        PerrinPoint & { predictedMeanSquareM2: number; measuredMinusModelM2: number }
      >[];
    }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

/**
 * Teaching composition of the audited mean-square owner. D comes from the accepted instrument,
 * never from a fit to Perrin's observations, the draft controls, or a second Stokes-Einstein formula.
 */
export function comparePerrin(record: PerrinRecord, snapshot: AcceptedSnapshot): PerrinComparison {
  if (record.kind === "withheld") return { kind: "unavailable", reason: record.reason };
  const diffusivity = snapshot.outputs.find((output) => output.quantityId === "diffusionCoefficient");
  if (
    !diffusivity ||
    diffusivity.status !== "value" ||
    typeof diffusivity.value !== "number" ||
    diffusivity.unit !== "m2/s" ||
    !Number.isFinite(diffusivity.value) ||
    diffusivity.value <= 0
  ) {
    return {
      kind: "unavailable",
      reason: "The accepted ensemble has no positive diffusivity for this comparison.",
    };
  }
  const points: {
    elapsedTimeSeconds: number;
    observedMeanSquareM2: number;
    predictedMeanSquareM2: number;
    measuredMinusModelM2: number;
  }[] = [];
  for (const point of record.points) {
    const prediction = moments(1, diffusivity.value, point.elapsedTimeSeconds).marginal.result;
    if (prediction.status !== "value" || typeof prediction.value !== "number") {
      return {
        kind: "unavailable",
        reason: "The mean-square model cannot evaluate these accepted settings.",
      };
    }
    points.push({
      ...point,
      predictedMeanSquareM2: prediction.value,
      measuredMinusModelM2: point.observedMeanSquareM2 - prediction.value,
    });
  }
  const sourceConditionsMatch = Object.entries(PERRIN_TRACER_INPUTS).every(
    ([key, value]) => snapshot.parameters[key] === value,
  );
  return Object.freeze({
    kind: "available",
    sourceConditionsMatch,
    points: Object.freeze(points.map((point) => Object.freeze(point))),
  });
}
