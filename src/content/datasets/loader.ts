import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { legacySpellingMessage, resolveQuantityId } from "../quantities/resolveQuantityId.ts";
import { type HistoricalDataset, validateHistoricalDataset } from "../schemas/experiment.ts";
import { strictParse } from "../schemas/strictParse.ts";

export class DatasetValidationError extends Error {
  readonly code: string;
  readonly datasetId: string;
  readonly fieldPath: string;

  constructor(code: string, message: string, datasetId = "unknown", fieldPath = "root") {
    super(`[Dataset ${datasetId}] ${fieldPath}: ${message} (${code})`);
    this.name = "DatasetValidationError";
    this.code = code;
    this.datasetId = datasetId;
    this.fieldPath = fieldPath;
  }
}

export type DatasetLoaderOptions = Readonly<{
  sourcePath?: string | undefined;
  checkQuantityRegistry?: boolean | undefined;
  expectedCsvDigest?: string | undefined;
  csvContent?: string | undefined;
}>;

/**
 * Loads and strictly validates a HistoricalDataset from YAML string or file.
 */
export function loadHistoricalDatasetFromYaml(
  yamlText: string,
  options: DatasetLoaderOptions = {},
): HistoricalDataset {
  const { sourcePath, checkQuantityRegistry = true, expectedCsvDigest, csvContent } = options;

  // Pipeline-only dataset check
  if (sourcePath) {
    const isPipelineDirectory =
      sourcePath.includes("/pipeline/") ||
      sourcePath.includes("/scratch/") ||
      sourcePath.includes("/temp_");
    const isCanonicalDirectory =
      sourcePath.includes("content/datasets/") ||
      sourcePath.includes("src/testing/") ||
      sourcePath.includes("src/content/schemas/__fixtures__/");

    if (isPipelineDirectory && !isCanonicalDirectory) {
      throw new DatasetValidationError(
        "pipeline-only-dataset-rejected",
        `Dataset at "${sourcePath}" is in a pipeline directory. Only canonical records under content/datasets/ may be loaded into the edition.`,
        "pipeline-record",
        sourcePath,
      );
    }
  }

  const raw = strictParse(yamlText, "yaml");
  const dataset = validateHistoricalDataset(raw);

  // Validate quantityIds against registry and legacy-spellings
  if (checkQuantityRegistry) {
    for (let cIdx = 0; cIdx < dataset.columns.length; cIdx++) {
      const col = dataset.columns[cIdx];
      if (!col) continue;

      const resolution = resolveQuantityId(col.quantityId);
      if (!resolution.ok) {
        if (resolution.kind === "legacy-spelling") {
          throw new DatasetValidationError(
            "legacy-spelling-quantity-id",
            `Column "${col.name}" uses legacy spelling "${col.quantityId}": ${legacySpellingMessage(col.quantityId)}.`,
            dataset.id,
            `columns[${cIdx}].quantityId`,
          );
        }
        throw new DatasetValidationError(
          "unregistered-quantity-id",
          `Column "${col.name}" references unregistered quantityId "${col.quantityId}".`,
          dataset.id,
          `columns[${cIdx}].quantityId`,
        );
      }
    }

    if (dataset.fits) {
      for (let fIdx = 0; fIdx < dataset.fits.length; fIdx++) {
        const fit = dataset.fits[fIdx];
        if (!fit) continue;

        for (let pIdx = 0; pIdx < fit.parameters.length; pIdx++) {
          const param = fit.parameters[pIdx];
          if (!param) continue;

          const resolution = resolveQuantityId(param.quantityId);
          if (!resolution.ok) {
            if (resolution.kind === "legacy-spelling") {
              throw new DatasetValidationError(
                "legacy-spelling-quantity-id",
                `Fit "${fit.id}" parameter "${param.name}" uses legacy spelling "${param.quantityId}": ${legacySpellingMessage(param.quantityId)}.`,
                dataset.id,
                `fits[${fIdx}].parameters[${pIdx}].quantityId`,
              );
            }
            throw new DatasetValidationError(
              "unregistered-quantity-id",
              `Fit "${fit.id}" parameter "${param.name}" references unregistered quantityId "${param.quantityId}".`,
              dataset.id,
              `fits[${fIdx}].parameters[${pIdx}].quantityId`,
            );
          }
        }
      }
    }
  }

  // CSV digest validation if provided
  if (expectedCsvDigest && csvContent !== undefined) {
    const computedDigest = createHash("sha256").update(csvContent, "utf8").digest("hex");
    if (computedDigest !== expectedCsvDigest) {
      throw new DatasetValidationError(
        "csv-digest-mismatch",
        `Calculated CSV digest (${computedDigest}) does not match expected digest (${expectedCsvDigest}).`,
        dataset.id,
        "csvDigest",
      );
    }
  }

  return dataset;
}

/**
 * Loads a HistoricalDataset from a file path.
 */
export function loadHistoricalDataset(
  filePath: string,
  options: DatasetLoaderOptions = {},
): HistoricalDataset {
  const content = readFileSync(filePath, "utf8");
  return loadHistoricalDatasetFromYaml(content, {
    sourcePath: filePath,
    ...options,
  });
}
