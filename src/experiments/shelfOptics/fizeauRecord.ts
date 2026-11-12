import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetCitationText } from "../../content/datasets/loadPlotVerdict.ts";
import { evaluateFizeauRecord, FIZEAU_DATASET_ID, type FizeauRecord } from "./fizeau.ts";

/** Build-time only. Missing or withdrawn measurements are not serialized as live evidence. */
export function loadFizeauRecord(rootDir = process.cwd()): FizeauRecord {
  const path = resolve(rootDir, "content/datasets", `${FIZEAU_DATASET_ID}.yaml`);
  if (!existsSync(path)) {
    return Object.freeze({
      kind: "withheld",
      citation: "H. Fizeau, Annales de chimie et de physique (3) 57 (1859), p. 392.",
      reason: "The cited moving-water measurement record is missing from this edition.",
    });
  }
  const dataset = loadHistoricalDataset(path);
  return evaluateFizeauRecord(dataset, datasetCitationText(dataset, rootDir));
}
