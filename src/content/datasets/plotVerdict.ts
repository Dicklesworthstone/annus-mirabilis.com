import { datasetValuesMayBeShown, type HistoricalDataset } from "../schemas/experiment.ts";

/** Why a dataset's values are not shown, in words a reader can be given. */
export function datasetWithheldReason(
  dataset: Pick<HistoricalDataset, "evidenceStatus" | "withdrawal">,
): string {
  return (
    dataset.withdrawal?.reason ??
    `Its evidence status, "${dataset.evidenceStatus}", is not a measurement this site shows.`
  );
}

export type PlotAxis = Readonly<{ quantityId: string; unit: string }>;

export type DatasetPoint = Readonly<{ rowIndex: number; x: number; y: number }>;

export type DatasetPlotVerdict =
  | Readonly<{
      kind: "plottable";
      datasetId: string;
      citation: string;
      points: readonly DatasetPoint[];
    }>
  | Readonly<{ kind: "withheld"; datasetId: string; citation: string; reason: string }>;

/**
 * The points a plot may draw from a record, or why it may draw none. A withheld verdict carries no
 * values at all, so a server page that hands one to a client component never serializes a withdrawn
 * record's rows into the page.
 */
export function datasetPlotVerdict(
  dataset: HistoricalDataset,
  x: PlotAxis,
  y: PlotAxis,
  citation: string,
): DatasetPlotVerdict {
  const base = { datasetId: dataset.id, citation };
  if (!datasetValuesMayBeShown(dataset)) {
    return Object.freeze({ ...base, kind: "withheld", reason: datasetWithheldReason(dataset) });
  }
  const column = (axis: PlotAxis) =>
    dataset.columns.findIndex((c) => c.quantityId === axis.quantityId && c.unit === axis.unit);
  const xi = column(x);
  const yi = column(y);
  const absent = xi < 0 ? x : yi < 0 ? y : undefined;
  if (absent) {
    return Object.freeze({
      ...base,
      kind: "withheld",
      reason: `The record has no ${absent.quantityId} column in ${absent.unit}.`,
    });
  }
  const points: DatasetPoint[] = [];
  dataset.rows.forEach((row, rowIndex) => {
    const cx = row.cells[xi];
    const cy = row.cells[yi];
    if (cx?.kind === "number" && cy?.kind === "number") {
      points.push(Object.freeze({ rowIndex, x: cx.value, y: cy.value }));
    }
  });
  return Object.freeze({ ...base, kind: "plottable", points: Object.freeze(points) });
}
