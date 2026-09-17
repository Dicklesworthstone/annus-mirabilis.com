/** A bounded scalar projection of a completed instance-store snapshot, never a second evaluator. */
export type ComparisonParameters = Readonly<Record<string, number | string | boolean>>;
export type ComparisonIdentity = Readonly<{
  modelVersion: string;
  streamVersion: string;
  allocationId: string;
  constantSetId: string;
  sourceDigest: string;
  artifactDigest: string | null;
  executionLabel: string;
}>;
export type ComparisonSnapshot = Readonly<{
  experimentId: string;
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  actionIndex: number;
  final: boolean;
  revisions: Readonly<{ input: number; observer: number; measurement: number; estimator: number }>;
  parameters: ComparisonParameters;
  outputs: readonly Readonly<{
    quantityId: string;
    status: string;
    unit: string;
    semanticKind: string;
    value?: unknown;
    reason?: unknown;
  }>[];
}>;
export type ComparisonValue = Readonly<{
  status: string;
  unit: string;
  semanticKind: string;
  value: number | null;
  reason: string;
}>;
export type Baseline = Readonly<{
  experimentId: string;
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  actionIndex: number;
  acceptedInputRevision: number;
  revisions: ComparisonSnapshot["revisions"];
  parameters: ComparisonParameters;
  identity: ComparisonIdentity;
  outputs: Readonly<Record<string, ComparisonValue>>;
}>;
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 4096;
}
export function validateComparisonParameters(parameters: ComparisonParameters): void {
  if (
    !parameters ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(parameters)) ||
    Reflect.ownKeys(parameters).length > 256
  )
    throw new TypeError("Expected bounded parameter data.");
  for (const key of Reflect.ownKeys(parameters)) {
    const descriptor = Object.getOwnPropertyDescriptor(parameters, key);
    if (typeof key !== "string" || !nonempty(key) || !descriptor || !("value" in descriptor))
      throw new TypeError("Parameters must be named data fields.");
    const value: unknown = descriptor.value;
    if (
      !(
        typeof value === "boolean" ||
        (typeof value === "string" && value.length <= 4096) ||
        (typeof value === "number" && Number.isFinite(value))
      )
    )
      throw new TypeError("Parameters must be finite scalar values.");
  }
}

/** Call only with the accepted snapshot, not a request or values scraped from a form. */
export function pinBaseline(
  snapshot: ComparisonSnapshot,
  identity: ComparisonIdentity,
  outputIds: readonly string[],
): Baseline {
  if (
    !snapshot.final ||
    !Number.isSafeInteger(snapshot.snapshotVersion) ||
    snapshot.snapshotVersion < 1 ||
    !Number.isSafeInteger(snapshot.actionIndex) ||
    snapshot.actionIndex < 0 ||
    ![snapshot.experimentId, snapshot.instanceId, snapshot.runId].every(nonempty)
  )
    throw new TypeError("Pin a completed, identified accepted result.");
  for (const key of ["input", "observer", "measurement", "estimator"] as const) {
    if (!Number.isSafeInteger(snapshot.revisions[key]) || snapshot.revisions[key] < 0)
      throw new TypeError("Accepted revisions are required.");
  }
  for (const key of [
    "modelVersion",
    "streamVersion",
    "allocationId",
    "constantSetId",
    "sourceDigest",
    "executionLabel",
  ] as const) {
    if (!nonempty(identity[key])) throw new TypeError(`Missing comparison identity: ${key}.`);
  }
  if (identity.artifactDigest !== null && !nonempty(identity.artifactDigest))
    throw new TypeError("Declare the executable artifact or explicitly use a host source digest.");
  validateComparisonParameters(snapshot.parameters);
  if (Object.hasOwn(snapshot.parameters, "seed")) {
    const seed = snapshot.parameters.seed;
    if (
      typeof seed !== "string" ||
      !/^(?:0|[1-9][0-9]{0,19})$/u.test(seed) ||
      BigInt(seed) > 18446744073709551615n
    )
      throw new TypeError("A seed must be an exact canonical unsigned 64-bit decimal string.");
  }
  if (!outputIds.length || outputIds.length > 128 || new Set(outputIds).size !== outputIds.length)
    throw new TypeError("Declare a bounded, unique set of comparison outputs.");
  const outputs: [string, ComparisonValue][] = outputIds.map((id) => {
    const matches = snapshot.outputs.filter((output) => output.quantityId === id);
    const output = matches[0];
    if (
      matches.length !== 1 ||
      !output ||
      ![id, output.status, output.unit, output.semanticKind].every(nonempty)
    )
      throw new TypeError(`Missing or duplicate accepted output: ${id}.`);
    if (
      output.status === "value" &&
      (typeof output.value !== "number" || !Number.isFinite(output.value))
    )
      throw new TypeError(`Comparison output ${id} must be a finite scalar, not an array.`);
    return [
      id,
      Object.freeze({
        status: output.status,
        unit: output.unit,
        semanticKind: output.semanticKind,
        value: output.status === "value" ? (output.value as number) : null,
        reason:
          typeof output.reason === "string"
            ? output.reason
            : output.status === "value"
              ? ""
              : output.status,
      }),
    ];
  });
  return Object.freeze({
    experimentId: snapshot.experimentId,
    instanceId: snapshot.instanceId,
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    actionIndex: snapshot.actionIndex,
    acceptedInputRevision: snapshot.revisions.input,
    revisions: Object.freeze({ ...snapshot.revisions }),
    parameters: Object.freeze({ ...snapshot.parameters }),
    identity: Object.freeze({ ...identity }),
    outputs: Object.freeze(Object.fromEntries(outputs)),
  });
}
