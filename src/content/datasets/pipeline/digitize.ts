import { createHash } from "node:crypto";
import type { SourceAssetRights } from "../../provenance/receiptToSourceAsset.ts";
import type {
  DataCell,
  DatasetColumn,
  DatasetPublication,
  DatasetRow,
  HistoricalDataset,
} from "../../schemas/experiment.ts";

export interface DigitizationSpotCheckPass {
  readonly passId: string;
  readonly checkerName: string;
  readonly verifiedCellCount: number;
  readonly discrepancies: readonly string[];
}

export interface DigitizationPipelineInput {
  readonly id: string;
  readonly title: string;
  readonly publications: readonly DatasetPublication[];
  readonly primaryPublicationId: string;
  readonly digitizer: {
    readonly name: string;
    readonly method: string;
    readonly date: string;
    readonly sourcePageImage: string;
    readonly digitizationRevision: number;
  };
  readonly columns: readonly DatasetColumn[];
  readonly rawRows: readonly (readonly DataCell[])[];
  readonly uncertainty: {
    readonly type: string;
    readonly description: string;
    readonly value?: number;
  };
  readonly notes: string;
  readonly rights: SourceAssetRights;
  readonly allowedInferenceModelIds: readonly string[];
  readonly calibrationIds?: readonly string[];
  readonly sharedInputIds?: readonly string[];
  readonly toolRunId?: string;
  readonly secondPass?: DigitizationSpotCheckPass;
}

export interface DigitizationPipelineResult {
  readonly dataset: HistoricalDataset;
  readonly csvDigest: string;
  readonly toolRunId: string;
  readonly passedSpotCheck: boolean;
  readonly loggedEvent: Record<string, unknown>;
}

/**
 * Digitization harness pipeline: processes extracted measurements, runs spot-check validation,
 * computes cryptographic hash digest, and produces canonical HistoricalDataset.
 */
export function executeDigitizationPipeline(
  input: DigitizationPipelineInput,
): DigitizationPipelineResult {
  const toolRunId = input.toolRunId ?? `tool-run-${Date.now()}`;

  // Run spot check verification if provided
  let passedSpotCheck = true;
  if (input.secondPass) {
    if (input.secondPass.discrepancies.length > 0) {
      passedSpotCheck = false;
      throw new Error(
        `Digitization spot check failed with discrepancies: ${input.secondPass.discrepancies.join("; ")}`,
      );
    }
  }

  // Build rows
  const rows: DatasetRow[] = input.rawRows.map((cells) => ({
    cells: [...cells],
  }));

  // Build CSV-like canonical string for digest
  const dataString = rows
    .map((r) =>
      r.cells
        .map((c) => (c.kind === "number" ? String(c.value) : c.kind === "bound" ? `${c.direction}:${c.value}` : `missing:${c.reason}`))
        .join(","),
    )
    .join("\n");

  const csvDigest = createHash("sha256").update(dataString, "utf8").digest("hex");

  const dataset: HistoricalDataset = {
    id: input.id,
    title: input.title,
    evidenceStatus: "historical-measurement",
    publications: input.publications,
    primaryPublicationId: input.primaryPublicationId,
    digitizer: {
      name: input.digitizer.name,
      method: input.digitizer.method,
      date: input.digitizer.date,
      sourcePageImage: input.digitizer.sourcePageImage,
      digitizationRevision: input.digitizer.digitizationRevision,
    },
    columns: input.columns,
    rows,
    uncertainty: input.uncertainty,
    notes: input.notes,
    rights: input.rights,
    allowedInferenceModelIds: input.allowedInferenceModelIds,
    calibrationIds: input.calibrationIds ?? [],
    sharedInputIds: input.sharedInputIds ?? [],
  };

  const loggedEvent = {
    timestamp: new Date().toISOString(),
    suite: "digitization-pipeline",
    logRunId: toolRunId,
    datasetId: dataset.id,
    csvDigest,
    toolRunId,
    digitizationRevision: dataset.digitizer.digitizationRevision,
    rowCount: rows.length,
    allowedInferenceModelCount: dataset.allowedInferenceModelIds.length,
    outcome: "passed",
  };

  return {
    dataset,
    csvDigest,
    toolRunId,
    passedSpotCheck,
    loggedEvent,
  };
}
