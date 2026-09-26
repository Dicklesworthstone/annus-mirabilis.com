import { BM06_MODEL, BM06_OUTPUTS } from "../../experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../../experiments/bm06/parameters.ts";
import {
  decodeOutcome,
  decodeRefusal,
  decodeResultBatch,
} from "../../experiments/results/codec.ts";
import { ownerAdmitted, type RequestToken } from "../../experiments/store/instanceStore.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import type { Bm06Evaluation } from "../operations/bm06.ts";

/** Deliberately scoped version: not an assertion that the full WASM protocol is implemented. */
export const BM06_PROTOCOL = "bm06-host-v1";
export type LabRequest = Readonly<{
  messageKind: "request";
  protocolVersion: typeof BM06_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
}>;
export type LabCancel = Readonly<{
  messageKind: "cancel";
  protocolVersion: typeof BM06_PROTOCOL;
  instanceId: string;
  actionIndex: number;
}>;
export type LabResponse = Readonly<{
  messageKind: "result";
  protocolVersion: typeof BM06_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
  result: Computation<Bm06Evaluation>;
}>;
export type LabHello = Readonly<{
  messageKind: "hello";
  protocolVersion: typeof BM06_PROTOCOL;
  sourceDigest: string;
  ownerKind: "host-reference";
  modelId: string;
}>;
export class LabProtocolError extends TypeError {
  readonly code: "protocol-mismatch" | "artifact-mismatch" | "malformed-response";
  constructor(code: LabProtocolError["code"], reason: string) {
    super(reason);
    this.name = "LabProtocolError";
    this.code = code;
  }
}
function fail(reason: string): never {
  throw new LabProtocolError("malformed-response", reason);
}
function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    fail("Expected a plain protocol record.");
  const actual = Reflect.ownKeys(input);
  if (
    actual.length !== keys.length ||
    actual.some((k) => typeof k !== "string" || !keys.includes(k))
  )
    fail("Missing or unrecognized protocol fields.");
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d?.enumerable || !Object.hasOwn(d, "value"))
      fail("Protocol records must contain data only.");
  }
  return input as Record<string, unknown>;
}
function text(input: unknown): asserts input is string {
  if (typeof input !== "string" || input.length === 0 || input.length > 512)
    fail("Invalid protocol identity.");
}
function count(input: unknown, minimum = 0): asserts input is number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < minimum)
    fail("Invalid logical counter.");
}
function version(input: unknown): void {
  if (input !== BM06_PROTOCOL)
    throw new LabProtocolError("protocol-mismatch", "Unsupported laboratory protocol.");
}
export function validateSourceDigest(input: unknown): asserts input is string {
  if (typeof input !== "string" || !/^source:sha256:[a-f0-9]{64}$/.test(input))
    fail("Missing evaluator source digest.");
}
function digest(input: unknown, expected: string): void {
  validateSourceDigest(input);
  validateSourceDigest(expected);
  if (input !== expected)
    throw new LabProtocolError("artifact-mismatch", "Worker and page evaluator sources differ.");
}
export function decodeLabToken(input: unknown): RequestToken {
  const o = record(input, [
    "experimentId",
    "instanceId",
    "runId",
    "parentRunId",
    "actionIndex",
    "revisions",
    "parameters",
  ]);
  if (o.experimentId !== "bm-06") fail("Unknown instrument.");
  text(o.instanceId);
  text(o.runId);
  if (o.parentRunId !== null && typeof o.parentRunId !== "string") fail("Invalid parent run.");
  if (typeof o.parentRunId === "string") text(o.parentRunId);
  count(o.actionIndex, 1);
  const revisions = record(o.revisions, ["input", "observer", "measurement", "estimator"]);
  for (const v of Object.values(revisions)) count(v);
  if (validateBm06Parameters(o.parameters).kind !== "accepted")
    fail("Invalid complete parameter record.");
  return structuredClone(input) as RequestToken;
}
export function decodeLabRequest(input: unknown, expectedDigest: string): LabRequest | LabCancel {
  if (
    input &&
    typeof input === "object" &&
    Object.getOwnPropertyDescriptor(input, "messageKind")?.value === "cancel"
  ) {
    const o = record(input, ["messageKind", "protocolVersion", "instanceId", "actionIndex"]);
    version(o.protocolVersion);
    text(o.instanceId);
    count(o.actionIndex, 1);
    return structuredClone(input) as LabCancel;
  }
  const o = record(input, ["messageKind", "protocolVersion", "sourceDigest", "token"]);
  version(o.protocolVersion);
  digest(o.sourceDigest, expectedDigest);
  if (o.messageKind !== "request") fail("Expected a calculation request.");
  decodeLabToken(o.token);
  return structuredClone(input) as LabRequest;
}
export function decodeLabHello(input: unknown, expectedDigest: string): LabHello {
  const o = record(input, [
    "messageKind",
    "protocolVersion",
    "sourceDigest",
    "ownerKind",
    "modelId",
  ]);
  version(o.protocolVersion);
  digest(o.sourceDigest, expectedDigest);
  if (o.messageKind !== "hello" || o.ownerKind !== "host-reference" || o.modelId !== BM06_MODEL.id)
    fail("Unregistered calculation owner.");
  return structuredClone(input) as LabHello;
}
function sameToken(a: RequestToken, b: RequestToken): boolean {
  return (
    a.experimentId === b.experimentId &&
    a.instanceId === b.instanceId &&
    a.runId === b.runId &&
    a.actionIndex === b.actionIndex &&
    Object.keys(a.revisions).every(
      (k) =>
        a.revisions[k as keyof typeof a.revisions] === b.revisions[k as keyof typeof b.revisions],
    ) &&
    Object.keys(a.parameters).every((k) => Object.is(a.parameters[k], b.parameters[k]))
  );
}
/** Validate identity, provenance, every scientific output and every buffer shape before publication. */
export function decodeLabResponse(
  input: unknown,
  expected: RequestToken,
  expectedDigest: string,
): LabResponse {
  try {
    const o = record(input, ["messageKind", "protocolVersion", "sourceDigest", "token", "result"]);
    version(o.protocolVersion);
    digest(o.sourceDigest, expectedDigest);
    if (o.messageKind !== "result") fail("Expected a calculation result.");
    const token = decodeLabToken(o.token);
    if (!sameToken(token, expected)) fail("Response does not echo the issued request.");
    const r = o.result as Record<string, unknown>;
    if (r?.kind === "accepted") {
      record(r, ["kind", "data"]);
      const data = record(r.data, ["outputs", "stepIndex", "simulationTime"]);
      count(data.stepIndex);
      const requiredSteps =
        token.parameters.gridEnabled && token.parameters.t !== 0 ? token.parameters.steps : 0;
      if (data.stepIndex !== requiredSteps || data.simulationTime !== token.parameters.t)
        fail("Response evaluates a different time or step count.");
      const outputs = decodeResultBatch(
        { revisions: token.revisions, outputs: data.outputs },
        {
          expectedRevisions: token.revisions,
          allowPartial: true,
          statuses: Object.fromEntries(
            Object.entries(BM06_OUTPUTS).map(([id, c]) => [id, c.statuses]),
          ),
        },
      ).outputs;
      for (const output of outputs) {
        const c = BM06_OUTPUTS[output.quantityId];
        if (!c) fail(`Response declares an unregistered quantity id: ${output.quantityId}.`);
        if (
          !ownerAdmitted(c, output.ownerId) ||
          output.semanticKind !== c.semanticKind ||
          output.unit !== c.unit
        )
          fail("Output identity or units do not match the registered owner.");
        if (output.status === "value") {
          const length = ["positionCoordinate1d", "probabilityDensity"].includes(output.quantityId)
            ? 81
            : ["comparisonTimes", "comparisonRms"].includes(output.quantityId)
              ? 3
              : ["gridDensity", "cellMasses", "cellProbabilities"].includes(output.quantityId)
                ? token.parameters.n
                : null;
          if (
            length !== null
              ? !(output.value instanceof Float64Array) || output.value.length !== length
              : typeof output.value !== "number"
          )
            fail("Output buffer does not match its declared layout.");
        }
        if (
          output.quantityId === "probabilityDensity" &&
          (output.status === "analytic-limit") !== (token.parameters.t === 0)
        )
          fail("Density representation does not match elapsed time.");
        if (
          [
            "gridDensity",
            "cellMasses",
            "cellProbabilities",
            "maxCellMassDifference",
            "wallContact",
            "stabilityRatio",
            "gridTimeStep",
          ].includes(output.quantityId) &&
          (output.status === "value") !== token.parameters.gridEnabled
        )
          fail("Grid output does not match the requested mode.");
      }
      // The field and its diffusion number come from one stepping, so they name one stepper.
      const gridOwners = new Set(
        outputs
          .filter((o) => (BM06_OUTPUTS[o.quantityId]?.admittedOwnerIds?.length ?? 0) > 0)
          .map((o) => o.ownerId),
      );
      if (gridOwners.size > 1) fail("Grid outputs from one stepping name different steppers.");
    } else if (r?.kind === "refused") {
      record(r, ["kind", "refusal"]);
      decodeRefusal(r.refusal);
    } else if (r?.kind === "outcome") {
      record(r, ["kind", "outcome"]);
      decodeOutcome(r.outcome);
    } else fail("Unknown calculation result kind.");
    return structuredClone(input) as LabResponse;
  } catch (error) {
    if (error instanceof LabProtocolError) throw error;
    return fail("Malformed calculation payload.");
  }
}
export function labHello(sourceDigest: string): LabHello {
  validateSourceDigest(sourceDigest);
  return {
    messageKind: "hello",
    protocolVersion: BM06_PROTOCOL,
    sourceDigest,
    ownerKind: "host-reference",
    modelId: BM06_MODEL.id,
  };
}
