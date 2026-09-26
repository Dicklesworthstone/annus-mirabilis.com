import {
  BM05_MODEL,
  BM05_OUTPUTS,
  type Bm05Parameters,
  bm05Layout,
} from "../../experiments/bm05/definition.ts";
import { validateBm05Parameters } from "../../experiments/bm05/parameters.ts";
import {
  decodeOutcome,
  decodeRefusal,
  decodeResultBatch,
} from "../../experiments/results/codec.ts";
import { ownerAdmitted, type RequestToken } from "../../experiments/store/instanceStore.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import type { Bm05Evaluation } from "../operations/bm05.ts";

/** Deliberately scoped version: not an assertion that the full WASM protocol is implemented. */
export const BM05_PROTOCOL = "bm05-host-v1";
export type LabRequest = Readonly<{
  messageKind: "request";
  protocolVersion: typeof BM05_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
}>;
export type LabCancel = Readonly<{
  messageKind: "cancel";
  protocolVersion: typeof BM05_PROTOCOL;
  instanceId: string;
  actionIndex: number;
}>;
export type LabResponse = Readonly<{
  messageKind: "result";
  protocolVersion: typeof BM05_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
  result: Computation<Bm05Evaluation>;
}>;
export type LabHello = Readonly<{
  messageKind: "hello";
  protocolVersion: typeof BM05_PROTOCOL;
  sourceDigest: string;
  ownerKind: "host-reference";
  modelId: string;
}>;

import { LabProtocolError } from "./bm06.ts";

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
  if (input !== BM05_PROTOCOL)
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
  if (o.experimentId !== "bm-05") fail("Unknown instrument.");
  text(o.instanceId);
  text(o.runId);
  if (o.parentRunId !== null && typeof o.parentRunId !== "string") fail("Invalid parent run.");
  if (typeof o.parentRunId === "string") text(o.parentRunId);
  count(o.actionIndex, 1);
  const revisions = record(o.revisions, ["input", "observer", "measurement", "estimator"]);
  for (const v of Object.values(revisions)) count(v);
  if (validateBm05Parameters(o.parameters).kind !== "accepted")
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
  if (o.messageKind !== "hello" || o.ownerKind !== "host-reference" || o.modelId !== BM05_MODEL.id)
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
      const requiredSteps = Number(token.parameters.runSteps);
      if (
        data.stepIndex !== requiredSteps ||
        data.simulationTime !== Number(token.parameters.runSteps) * Number(token.parameters.tau)
      )
        fail("Response evaluates a different time or step count.");
      const outputs = decodeResultBatch(
        { revisions: token.revisions, outputs: data.outputs },
        {
          expectedRevisions: token.revisions,
          allowPartial: true,
          statuses: Object.fromEntries(
            Object.entries(BM05_OUTPUTS).map(([id, c]) => [id, c.statuses]),
          ),
        },
      ).outputs;
      for (const output of outputs) {
        const c = BM05_OUTPUTS[output.quantityId];
        if (!c) {
          fail(`Undeclared output quantity: ${output.quantityId}`);
          continue;
        }
        if (
          !ownerAdmitted(c, output.ownerId) ||
          output.semanticKind !== c.semanticKind ||
          output.unit !== c.unit
        )
          fail("Output identity or units do not match the registered owner.");
        if (output.status === "value") {
          const length = bm05Layout(output.quantityId, token.parameters as Bm05Parameters);
          if (
            length !== null
              ? !(output.value instanceof Float64Array) || output.value.length !== length
              : typeof output.value !== "number"
          )
            fail("Output buffer does not match its declared layout.");
        }
        const p = token.parameters as Bm05Parameters;
        if (
          [
            "sumKurtosis",
            "kolmogorovDistance",
            "shapeTerm",
            "agreementBound",
            "withinBound",
          ].includes(output.quantityId) &&
          output.status !== (p.n === 0 ? "not-applicable" : "value")
        )
          fail("The zero-step comparison status is inconsistent.");
        if (
          ["coinPositions", "coinProbabilities", "coinNumerators", "coinDenominator"].includes(
            output.quantityId,
          ) &&
          output.status !== (p.kernel === "coin" && p.n <= 16 ? "value" : "not-applicable")
        )
          fail("Exact coin support status is inconsistent.");
        if (
          output.quantityId === "biasedDiffusion" &&
          output.status !== (p.bias === 0.5 ? "value" : "outside-domain")
        )
          fail("Biased diffusion status is inconsistent.");
      }
      // The outputs read from the draws name one producer between them, and FrankenSim draws
      // normals, so it can have drawn only a Gaussian walk.
      const drawn = outputs.filter(
        (o) => (BM05_OUTPUTS[o.quantityId]?.admittedOwnerIds?.length ?? 0) > 0,
      );
      const moduleOwner = BM05_OUTPUTS.walkPositions?.admittedOwnerIds?.[0];
      const byModule = drawn.filter((o) => o.ownerId === moduleOwner).length;
      if (byModule > 0 && byModule !== drawn.length)
        fail("Outputs read from one set of draws name different producers.");
      if (byModule > 0 && (token.parameters as Bm05Parameters).kernel !== "gaussian")
        fail("FrankenSim draws normals, so it cannot have drawn a coin or uniform walk.");
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
    protocolVersion: BM05_PROTOCOL,
    sourceDigest,
    ownerKind: "host-reference",
    modelId: BM05_MODEL.id,
  };
}
