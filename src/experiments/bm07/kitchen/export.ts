import { exportKitchenCsv } from "./csv.ts";
import type { KitchenAccepted } from "./session.ts";

/** This is an analysis receipt, not an importable session or a claim of reviewed experimental provenance. */
export function kitchenAnalysisJson(accepted: KitchenAccepted, sourceDigest: string): string {
  if (
    !/^source:sha256:[a-f0-9]{64}$/.test(sourceDigest) ||
    accepted.snapshot.experimentId !== "bm-07-kitchen"
  )
    throw new TypeError("Expected an accepted local-observation analysis and evaluator identity.");
  const { snapshot, document, report, sourceId, documentDigest } = accepted;
  if (
    snapshot.parameters.sourceId !== sourceId ||
    snapshot.parameters.documentDigest !== documentDigest
  )
    throw new TypeError("The analysis and its observations have different identities.");
  const results = snapshot.outputs.map((output) =>
    output.status === "value" && typeof output.value !== "number"
      ? { ...output, value: Array.from(output.value.copy()) }
      : output,
  );
  return `${JSON.stringify(
    {
      format: "annus-local-observation-analysis-v1",
      provenance:
        document.metadata.data_origin === "synthetic"
          ? "Synthetic practice data. This is not empirical evidence."
          : "Reader-supplied observations. Acquisition, calibration and provenance have not been independently verified.",
      sourceDigest,
      sourceId,
      documentDigest,
      identity: {
        experimentId: snapshot.experimentId,
        instanceId: snapshot.instanceId,
        runId: snapshot.runId,
        snapshotVersion: snapshot.snapshotVersion,
        revisions: snapshot.revisions,
      },
      options: report.options,
      metadata: document.metadata,
      report,
      results,
      observationsCsv: exportKitchenCsv(document),
      limits:
        "Original intervals hold physical inputs fixed. Separate input-envelope outputs propagate declared ranges; combined coverage requires the recorded joint input coverage and camera allocation. Timing, exposure and model adequacy remain assumptions. An imported declaration is not proof that its assumptions hold.",
    },
    null,
    2,
  )}\n`;
}
