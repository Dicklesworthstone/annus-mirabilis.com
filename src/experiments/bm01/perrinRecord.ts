import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetCitationText } from "../../content/datasets/loadPlotVerdict.ts";
import { datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import {
  evaluatePerrinRecord,
  PERRIN_1909_DATASET_ID,
  PERRIN_AXES,
  type PerrinRecord,
} from "./perrin.ts";

/** Build-time only: the browser receives the verdict, never a withdrawn record's observations. */
export function loadPerrinRecord(rootDir = process.cwd()): PerrinRecord {
  const dataset = loadHistoricalDataset(
    resolve(rootDir, "content/datasets", `${PERRIN_1909_DATASET_ID}.yaml`),
  );
  const verdict = datasetPlotVerdict(
    dataset,
    PERRIN_AXES.x,
    PERRIN_AXES.y,
    `${datasetCitationText(dataset, rootDir)} First-series table, p. 77; measurement definition, p. 76.`,
  );
  const shelf = getDatasetShelfStatus(dataset);
  return evaluatePerrinRecord(
    verdict,
    shelf.eligible ? undefined : shelf.badgeLabel,
    dataset.digitizer.sourcePageImage,
    dataset.uncertainty.description,
  );
}
