import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetCitationText } from "../../content/datasets/loadPlotVerdict.ts";
import { PERRIN_1909_DATASET_ID } from "../bm01/perrin.ts";
import { evaluatePerrinSummaryRecord, type PerrinSummaryRecord } from "./perrinSummary.ts";

/** Build-time only: withdrawn observations and unadmitted calculations never reach page props. */
export function loadPerrinSummaryRecord(rootDir = process.cwd()): PerrinSummaryRecord {
  const dataset = loadHistoricalDataset(
    resolve(rootDir, "content/datasets", `${PERRIN_1909_DATASET_ID}.yaml`),
  );
  return evaluatePerrinSummaryRecord(
    dataset,
    `${datasetCitationText(dataset, rootDir)} First-series table, p. 77; measurement definition, p. 76.`,
  );
}
