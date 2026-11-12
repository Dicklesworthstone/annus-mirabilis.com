import { type DatasetPlotVerdict, datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
import type { ShelfParameters } from "./definition.ts";
import type { ShelfSnapshot } from "./state.ts";

export const FIZEAU_DATASET_ID = "fizeau-1851-water";
export const FIZEAU_ASSUMED_INDEX = 1.333;
const REQUIRED_COLUMNS = Object.freeze([
  { quantityId: "flowSpeed", unit: "m/s" },
  { quantityId: "tubeLength", unit: "m" },
  { quantityId: "waterPathPerBeam", unit: "m" },
  { quantityId: "wavelength", unit: "m" },
] as const);

export type FizeauRecord =
  | Readonly<{
      kind: "plottable";
      citation: string;
      sourcePageImage: string;
      evidenceLabel: string;
      uncertainty: string;
      observations: readonly Readonly<{ rowNumber: number; fringeShift: number }>[];
      meanFringeShift: number;
      sourceInputs: Readonly<{
        waterSpeed: number;
        tubeLength: number;
        waterPathPerBeam: number;
        wavelength: number;
      }>;
    }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

/** Admission happens before a server serializes any observations into a client component. */
export function evaluateFizeauRecord(dataset: HistoricalDataset, citation: string): FizeauRecord {
  const withheld = (reason: string): FizeauRecord =>
    Object.freeze({ kind: "withheld", citation, reason });
  const verdict: DatasetPlotVerdict = datasetPlotVerdict(
    dataset,
    REQUIRED_COLUMNS[0],
    { quantityId: "fringeShift", unit: "1" },
    citation,
  );
  if (verdict.kind === "withheld") return withheld(verdict.reason);
  const shelf = getDatasetShelfStatus(dataset);
  const publication = dataset.publications.find((p) => p.id === dataset.primaryPublicationId);
  if (
    dataset.id !== FIZEAU_DATASET_ID ||
    !shelf.eligible ||
    shelf.publicationYear !== "1859" ||
    publication?.publicationDate.earliest !== "1859-12-01" ||
    publication.publicationDate.latest !== "1859-12-31"
  ) {
    return withheld("This comparison requires Fizeau's table published in December 1859.");
  }
  if (
    verdict.points.length !== 19 ||
    dataset.rows.length !== 19 ||
    verdict.points.some(
      (point, index) =>
        point.rowIndex !== index ||
        !Number.isFinite(point.x) ||
        point.x <= 0 ||
        !Number.isFinite(point.y) ||
        point.y <= 0,
    )
  ) {
    return withheld(
      "The comparison needs all nineteen printed displacement rows and their reduction speed.",
    );
  }
  const values: number[] = [];
  for (const axis of REQUIRED_COLUMNS) {
    const column = dataset.columns.findIndex(
      (entry) => entry.quantityId === axis.quantityId && entry.unit === axis.unit,
    );
    const first = dataset.rows[0]?.cells[column];
    if (
      column < 0 ||
      first?.kind !== "number" ||
      !Number.isFinite(first.value) ||
      first.value <= 0 ||
      dataset.rows.some((row) => {
        const cell = row.cells[column];
        return cell?.kind !== "number" || cell.value !== first.value;
      })
    ) {
      return withheld(
        `The source's common ${axis.quantityId} in ${axis.unit} is missing or inconsistent.`,
      );
    }
    values.push(first.value);
  }
  const [waterSpeed, tubeLength, waterPathPerBeam, wavelength] = values;
  if (
    waterSpeed === undefined ||
    tubeLength === undefined ||
    waterPathPerBeam === undefined ||
    wavelength === undefined ||
    Math.abs(waterPathPerBeam - 2 * tubeLength) > 1e-12
  ) {
    return withheld(
      "The recorded water path must contain two traversals of the cited tube length.",
    );
  }
  const observations = Object.freeze(
    verdict.points.map((point) =>
      Object.freeze({ rowNumber: point.rowIndex + 1, fringeShift: point.y }),
    ),
  );
  return Object.freeze({
    kind: "plottable",
    citation,
    sourcePageImage: dataset.digitizer.sourcePageImage,
    evidenceLabel: "1851 experiment · table published December 1859 · available before 1905",
    uncertainty: dataset.uncertainty.description,
    observations,
    meanFringeShift:
      observations.reduce((sum, row) => sum + row.fringeShift, 0) / observations.length,
    sourceInputs: Object.freeze({ waterSpeed, tubeLength, waterPathPerBeam, wavelength }),
  });
}

/** The apparatus settings travel from the admitted record; the index remains a model assumption. */
export function fizeauSourceParameters(
  record: FizeauRecord,
  showLater = false,
): Extract<ShelfParameters, { instrumentId: "shelf-fizeau" }> | null {
  if (record.kind === "withheld") return null;
  const { waterSpeed, waterPathPerBeam, wavelength } = record.sourceInputs;
  return Object.freeze({
    instrumentId: "shelf-fizeau",
    waterSpeed,
    waterPathPerBeam,
    wavelength,
    refractiveIndex: FIZEAU_ASSUMED_INDEX,
    reversal: false,
    showLater,
  });
}

export type FizeauComparison =
  | Readonly<{
      kind: "available";
      sourceConditionsMatch: boolean;
      predictions: readonly Readonly<{
        modelId: string;
        label: string;
        predictedFringeShift: number;
        observedMinusModel: number;
      }>[];
    }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

/** Select owner outputs; do not recalculate optics, fit an index, or adjust the measured flow. */
export function compareFizeau(record: FizeauRecord, snapshot: ShelfSnapshot): FizeauComparison {
  const unavailable = (reason: string): FizeauComparison =>
    Object.freeze({ kind: "unavailable", reason });
  if (record.kind === "withheld") return unavailable(record.reason);
  const { parameters: p, rows } = snapshot.report;
  if (p.instrumentId !== "shelf-fizeau")
    return unavailable("This is not a moving-water calculation.");
  if (p.reversal || p.waterSpeed < 0) {
    return unavailable(
      "The table records positive one-direction displacements. Your calculation uses flow reversal or the opposite orientation. Apply the source apparatus settings to compare the same protocol; the observations are not doubled or sign-changed.",
    );
  }
  const predictions = [];
  for (const modelId of ["fizeau-no-drag", "fizeau-full-drag", "fresnel-drag"]) {
    const row = rows.find((entry) => entry.modelId === modelId);
    const result = row?.metrics.find(
      (entry) => entry.label === "Signed fringe shift" && entry.quantityId === "fringeShift",
    );
    if (!row || !result || result.unit !== "fringes" || !Number.isFinite(result.value)) {
      return unavailable(
        "The accepted calculation does not supply all three finite fringe predictions.",
      );
    }
    predictions.push(
      Object.freeze({
        modelId,
        label: row.label,
        predictedFringeShift: result.value,
        observedMinusModel: record.meanFringeShift - result.value,
      }),
    );
  }
  return Object.freeze({
    kind: "available",
    sourceConditionsMatch:
      p.waterSpeed === record.sourceInputs.waterSpeed &&
      p.waterPathPerBeam === record.sourceInputs.waterPathPerBeam &&
      p.wavelength === record.sourceInputs.wavelength,
    predictions: Object.freeze(predictions),
  });
}
