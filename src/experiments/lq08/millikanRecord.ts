/**
 * Server side: the Millikan 1916 panel as LQ-08's page and embed build it
 * (am-data-millikan-1916-zh2q, dispatch 249). The record is read and judged here, at build time;
 * the client receives only the result, so a withheld record's rows never reach a page.
 */
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetCitationText } from "../../content/datasets/loadPlotVerdict.ts";
import { datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import {
  evaluateMillikanOverlay,
  MILLIKAN_1916_DATASET_ID,
  MILLIKAN_1916_FIT_ID,
  MILLIKAN_FIG6_AXES,
  type MillikanOverlayResult,
  type MillikanSlopeFit,
} from "./millikan.ts";

export function loadMillikanOverlay(rootDir = process.cwd()): MillikanOverlayResult {
  const dataset = loadHistoricalDataset(
    resolve(rootDir, "content/datasets", `${MILLIKAN_1916_DATASET_ID}.yaml`),
  );
  const verdict = datasetPlotVerdict(
    dataset,
    MILLIKAN_FIG6_AXES.x,
    MILLIKAN_FIG6_AXES.y,
    datasetCitationText(dataset, rootDir),
  );
  const recordFit = dataset.fits?.find((f) => f.id === MILLIKAN_1916_FIT_ID);
  const fit: MillikanSlopeFit | undefined = recordFit && {
    rowsUsed: recordFit.rowsUsed,
    printedSlopes: recordFit.parameters
      .filter((p) => p.source === "imported" && p.quantityId === "planckChargeQuotientEstimate")
      .map((p) => ({ label: p.name, slopeVs: p.value, citation: p.sourceCitation ?? "" })),
  };
  // Only later evidence stands beside the model; a record the 1904 shelf could hold gets no label.
  const shelf = getDatasetShelfStatus(dataset);
  return evaluateMillikanOverlay(verdict, fit, shelf.eligible ? undefined : shelf.badgeLabel);
}
