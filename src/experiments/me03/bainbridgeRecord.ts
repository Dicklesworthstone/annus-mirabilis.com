import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetCitationText } from "../../content/datasets/loadPlotVerdict.ts";
import {
  BAINBRIDGE_1933_DATASET_ID,
  type BainbridgeRecord,
  evaluateBainbridgeRecord,
} from "./bainbridge.ts";

/** Build-time only: withheld observations never cross the client-component boundary. */
export function loadBainbridgeRecord(rootDir = process.cwd()): BainbridgeRecord {
  const dataset = loadHistoricalDataset(
    resolve(rootDir, "content/datasets", `${BAINBRIDGE_1933_DATASET_ID}.yaml`),
  );
  return evaluateBainbridgeRecord(dataset, datasetCitationText(dataset, rootDir));
}
