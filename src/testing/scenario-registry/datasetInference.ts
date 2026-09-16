import { readFileSync } from "node:fs";
import { validateHistoricalDataset } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

export const DATASET_INFERENCE_NOT_ADMITTED = "dataset-inference-not-admitted";

export type DatasetInferenceCheck =
  | { ok: true; allowed: readonly string[] }
  | {
      ok: false;
      code: string;
      message: string;
      allowed: readonly string[] | null;
    };

export function checkDatasetInference(
  datasetPath: string,
  datasetId: string,
  inferenceModelId: string | undefined,
): DatasetInferenceCheck {
  const raw = strictParse(readFileSync(datasetPath, "utf8"), "yaml");
  let dataset: ReturnType<typeof validateHistoricalDataset>;
  try {
    dataset = validateHistoricalDataset(raw);
  } catch (err) {
    return {
      ok: false,
      code: "dataset-record-invalid",
      message: `Dataset ${datasetId} failed record validation: ${err instanceof Error ? err.message : String(err)}`,
      allowed: null,
    };
  }
  if (dataset.id !== datasetId) {
    return {
      ok: false,
      code: "dataset-record-invalid",
      message: `Dataset file id ${dataset.id} does not match scenario datasetId ${datasetId}.`,
      allowed: null,
    };
  }
  if (inferenceModelId === undefined) {
    return { ok: true, allowed: dataset.allowedInferenceModelIds };
  }
  if (!Object.hasOwn(dataset, "allowedInferenceModelIds")) {
    return {
      ok: false,
      code: "dataset-record-invalid",
      message: `Dataset ${datasetId} has no allowedInferenceModelIds list; an absent list is not permission.`,
      allowed: null,
    };
  }
  const allowed = dataset.allowedInferenceModelIds;
  if (allowed.length === 0) {
    return {
      ok: false,
      code: DATASET_INFERENCE_NOT_ADMITTED,
      message: `${DATASET_INFERENCE_NOT_ADMITTED}: dataset ${datasetId} admits no inference models (display and citation only); refused ${inferenceModelId}.`,
      allowed,
    };
  }
  if (!allowed.includes(inferenceModelId)) {
    return {
      ok: false,
      code: DATASET_INFERENCE_NOT_ADMITTED,
      message: `${DATASET_INFERENCE_NOT_ADMITTED}: dataset ${datasetId} does not admit inference model ${inferenceModelId}; admitted: ${allowed.join(", ")}.`,
      allowed,
    };
  }
  return { ok: true, allowed };
}
