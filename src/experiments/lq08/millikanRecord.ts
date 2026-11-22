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
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
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
  return millikanOverlayForRecord(dataset, datasetCitationText(dataset, rootDir));
}

/**
 * Source inspection follows the same admission as the numerical panel. A withdrawn record,
 * incompatible axes, missing slope record or insufficient points serialize no historical rows.
 *
 * The PDF locators follow the printed-page map in
 * docs/provenance/datasets/millikan-1916-sodium.md. They link to the source host. No publication
 * decision is inferred for the locally held crop, so the reveal continues to withhold that image.
 */
export function millikanOverlayForRecord(
  dataset: HistoricalDataset,
  citation: string,
): MillikanOverlayResult {
  const verdict = datasetPlotVerdict(
    dataset,
    MILLIKAN_FIG6_AXES.x,
    MILLIKAN_FIG6_AXES.y,
    citation,
  );
  if (verdict.kind === "withheld")
    return Object.freeze({ kind: "withheld", citation: verdict.citation, reason: verdict.reason });
  if (dataset.id !== MILLIKAN_1916_DATASET_ID)
    return Object.freeze({
      kind: "withheld",
      citation,
      reason: "This source inspector requires the Millikan 1916 sodium record.",
    });
  if (!dataset.allowedInferenceModelIds.includes("fitPhotoelectricSlope"))
    return Object.freeze({
      kind: "withheld",
      citation,
      reason: "This source record does not admit the photoelectric slope fit.",
    });
  const recordFit = dataset.fits?.find((f) => f.id === MILLIKAN_1916_FIT_ID);
  const fit: MillikanSlopeFit | undefined = recordFit && {
    rowsUsed: recordFit.rowsUsed,
    rowsExcluded: recordFit.rowsExcluded,
    printedSlopes: recordFit.parameters
      .filter((p) => p.source === "imported" && p.quantityId === "planckChargeQuotientEstimate")
      .map((p) => ({ label: p.name, slopeVs: p.value, citation: p.sourceCitation ?? "" })),
  };
  // Only later evidence stands beside the model; a record the 1904 shelf could hold gets no label.
  const shelf = getDatasetShelfStatus(dataset);
  const overlay = evaluateMillikanOverlay(
    verdict,
    fit,
    shelf.eligible ? undefined : shelf.badgeLabel,
  );
  if (overlay.kind === "withheld") return overlay;
  const scan =
    "https://archive.org/download/sim_physical-review_1916-03_7_3/sim_physical-review_1916-03_7_3.pdf";
  return Object.freeze({
    ...overlay,
    evidence: Object.freeze({
      dataset,
      sourceLinks: Object.freeze([
        Object.freeze({
          label: "Figure 6: printed page 373 (PDF page 93)",
          href: `${scan}#page=93`,
        }),
        Object.freeze({
          label: "The five lines used for the slope: page 374 (PDF page 94)",
          href: `${scan}#page=94`,
        }),
        Object.freeze({
          label: "The separately printed 2,535 line: page 382 (PDF page 102)",
          href: `${scan}#page=102`,
        }),
      ]),
    }),
  });
}
