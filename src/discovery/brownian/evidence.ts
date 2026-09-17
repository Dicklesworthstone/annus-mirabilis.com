/** Presentation-only evidence records. No physical law or random draw is evaluated here. */
export type EvidenceSnapshot = Readonly<{
  experimentId: string;
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  final: boolean;
  parameters: Readonly<Record<string, number | string | boolean>>;
  outputs: readonly Readonly<{
    quantityId: string;
    status: string;
    unit: string;
    value?: unknown;
  }>[];
}>;

export const TRACER_EVIDENCE_QUANTITIES = [
  "diffusionCoefficient",
  "observationInterval",
  "sampleMean",
  "sampleMeanSquare",
  "sampleRms",
  "rmsDisplacement1d",
  "sampledApparentSpeed",
  "modelApparentSpeed",
] as const;
export type EvidenceQuantity = (typeof TRACER_EVIDENCE_QUANTITIES)[number];
export type EvidenceValue = Readonly<{ status: string; unit: string; value: number | null }>;
export type TracerEvidence = Readonly<{
  schemaVersion: 1;
  kind: "synthetic-tracer-evidence";
  sourceDigest: string;
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  parameters: EvidenceSnapshot["parameters"];
  outputs: Readonly<Record<EvidenceQuantity, EvidenceValue>>;
}>;

/** Capture only a completed accepted snapshot, never a draft, model recomputation or DOM value. */
export function captureTracerEvidence(
  snapshot: EvidenceSnapshot,
  sourceDigest: string,
): TracerEvidence {
  if (snapshot.experimentId !== "bm-01" || !snapshot.final)
    throw new TypeError("Capture a completed BM-01 result.");
  if (
    !sourceDigest.trim() ||
    !snapshot.instanceId.trim() ||
    !snapshot.runId.trim() ||
    !Number.isSafeInteger(snapshot.snapshotVersion) ||
    snapshot.snapshotVersion < 1
  )
    throw new TypeError("Accepted result provenance is required.");
  for (const value of Object.values(snapshot.parameters)) {
    if (
      !["number", "string", "boolean"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value))
    )
      throw new TypeError("Accepted parameters must be finite scalar values.");
  }
  const entries = TRACER_EVIDENCE_QUANTITIES.map((id) => {
    const matches = snapshot.outputs.filter((output) => output.quantityId === id);
    if (matches.length !== 1) throw new TypeError(`Expected exactly one accepted ${id}.`);
    const output = matches[0]!;
    if (
      output.status === "value" &&
      (typeof output.value !== "number" || !Number.isFinite(output.value))
    )
      throw new TypeError(`Expected a finite scalar for ${id}.`);
    return [
      id,
      Object.freeze({
        status: output.status,
        unit: output.unit,
        value: output.status === "value" ? (output.value as number) : null,
      }),
    ] as const;
  });
  return Object.freeze({
    schemaVersion: 1,
    kind: "synthetic-tracer-evidence",
    sourceDigest,
    instanceId: snapshot.instanceId,
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    parameters: Object.freeze({ ...snapshot.parameters }),
    outputs: Object.freeze(Object.fromEntries(entries)) as TracerEvidence["outputs"],
  });
}

/** A one-time handoff of the model coefficient, NOT a fitted coefficient from the finite sample. */
export function diffusivitySource(evidence: TracerEvidence) {
  const output = evidence.outputs.diffusionCoefficient;
  if (
    output.status !== "value" ||
    output.unit !== "m2/s" ||
    output.value === null ||
    !(output.value > 0) ||
    !Number.isFinite(output.value)
  )
    throw new TypeError("A positive accepted diffusivity in m2/s is required.");
  return Object.freeze({
    instanceId: evidence.instanceId,
    runId: evidence.runId,
    snapshotVersion: evidence.snapshotVersion,
    value: output.value,
  });
}

export function compareTracerEvidence(baseline: TracerEvidence, current: TracerEvidence) {
  const sameRecording =
    baseline.instanceId === current.instanceId &&
    baseline.runId === current.runId &&
    baseline.sourceDigest === current.sourceDigest;
  const sameProjection =
    baseline.parameters.d === current.parameters.d &&
    baseline.parameters.axis === current.parameters.axis;
  function ratio(id: EvidenceQuantity): number | null {
    const a = baseline.outputs[id],
      b = current.outputs[id];
    if (
      a.status !== "value" ||
      b.status !== "value" ||
      a.unit !== b.unit ||
      a.value === null ||
      b.value === null ||
      a.value === 0
    )
      return null;
    const value = b.value / a.value;
    return Number.isFinite(value) ? value : null;
  }
  const comparable = sameRecording && sameProjection;
  return Object.freeze({
    sameRecording,
    sameProjection,
    intervalRatio: comparable ? ratio("observationInterval") : null,
    sampleRmsRatio: comparable ? ratio("sampleRms") : null,
    modelRmsRatio: comparable ? ratio("rmsDisplacement1d") : null,
    modelApparentSpeedRatio: comparable ? ratio("modelApparentSpeed") : null,
  });
}

/** Long-form CSV: preserve canonical units, status and provenance for every exported readout. */
export function tracerEvidenceCsv(records: readonly TracerEvidence[]): string {
  function cell(value: string | number | null): string {
    let text = value === null ? "" : String(value);
    // String provenance may be opened in a spreadsheet. Numeric negatives stay numeric.
    if (typeof value === "string" && /^[\s]*[=+@-]/u.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  const rows: (string | number | null)[][] = [
    [
      "record",
      "instance_id",
      "run_id",
      "snapshot_version",
      "source_digest",
      "quantity",
      "value",
      "unit",
      "status",
      "parameters_json",
    ],
  ];
  records.forEach((record, index) => {
    for (const id of TRACER_EVIDENCE_QUANTITIES) {
      const output = record.outputs[id];
      rows.push([
        index + 1,
        record.instanceId,
        record.runId,
        record.snapshotVersion,
        record.sourceDigest,
        id,
        output.value,
        output.unit,
        output.status,
        JSON.stringify(record.parameters),
      ]);
    }
  });
  return `${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
