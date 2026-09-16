import { SR03_MODEL, SR03_OUTPUTS } from "../../experiments/sr03/definition.ts";
import {
  decodeOutcome,
  decodeRefusal,
  decodeResultBatch,
} from "../../experiments/results/codec.ts";
import type { RequestToken } from "../../experiments/store/instanceStore.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import type { Sr03Evaluation } from "../operations/sr03.ts";
import { LabProtocolError } from "./bm06.ts";

export { LabProtocolError } from "./bm06.ts";

export const SR03_PROTOCOL = "sr03-host-v1";

export type LabRequest = Readonly<{
  messageKind: "request";
  protocolVersion: typeof SR03_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
}>;

export type LabCancel = Readonly<{
  messageKind: "cancel";
  protocolVersion: typeof SR03_PROTOCOL;
  instanceId: string;
  actionIndex: number;
}>;

export type LabResponse = Readonly<{
  messageKind: "result";
  protocolVersion: typeof SR03_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
  result: Computation<Sr03Evaluation>;
}>;

export type LabHello = Readonly<{
  messageKind: "hello";
  protocolVersion: typeof SR03_PROTOCOL;
  sourceDigest: string;
  ownerKind: "host-reference";
  modelId: string;
}>;

function fail(reason: string): never {
  throw new LabProtocolError("malformed-response", reason);
}

function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    fail("Expected a plain protocol record.");
  }
  const actual = Reflect.ownKeys(input);
  if (
    actual.length !== keys.length ||
    actual.some((k) => typeof k !== "string" || !keys.includes(k))
  ) {
    fail("Missing or unrecognized protocol fields.");
  }
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d?.enumerable || !Object.hasOwn(d, "value")) {
      fail("Protocol records must contain data only.");
    }
  }
  return input as Record<string, unknown>;
}

function text(input: unknown): asserts input is string {
  if (typeof input !== "string" || input.length === 0 || input.length > 512) {
    fail("Invalid protocol identity.");
  }
}

function count(input: unknown, minimum = 0): asserts input is number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < minimum) {
    fail("Invalid logical counter.");
  }
}

function version(input: unknown): void {
  if (input !== SR03_PROTOCOL) {
    throw new LabProtocolError("protocol-mismatch", "Unsupported laboratory protocol.");
  }
}

export function validateSourceDigest(input: unknown): asserts input is string {
  if (typeof input !== "string" || !/^source:sha256:[a-f0-9]{64}$/.test(input)) {
    fail("Missing evaluator source digest.");
  }
}

function digest(input: unknown, expected: string): void {
  validateSourceDigest(input);
  validateSourceDigest(expected);
  if (input !== expected) {
    throw new LabProtocolError("artifact-mismatch", "Worker and page evaluator sources differ.");
  }
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
  if (o.experimentId !== "sr-03") fail("Unknown instrument.");
  text(o.instanceId);
  text(o.runId);
  if (o.parentRunId !== null && typeof o.parentRunId !== "string") fail("Invalid parentRunId.");
  count(o.actionIndex, 1);
  const revisions = record(o.revisions, ["input", "observer", "measurement", "estimator"]);
  for (const v of Object.values(revisions)) count(v);
  if (
    !o.parameters ||
    typeof o.parameters !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(o.parameters))
  ) {
    fail("Invalid complete parameter record.");
  }
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
  if (
    o.messageKind !== "hello" ||
    o.ownerKind !== "host-reference" ||
    o.modelId !== SR03_MODEL.id
  ) {
    fail("Unregistered calculation owner.");
  }
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
      const outputs = decodeResultBatch(
        { revisions: token.revisions, outputs: data.outputs },
        {
          expectedRevisions: token.revisions,
          allowPartial: true,
          statuses: Object.fromEntries(
            Object.entries(SR03_OUTPUTS).map(([id, c]) => [id, c.statuses]),
          ),
        },
      ).outputs;
      for (const output of outputs) {
        const c = SR03_OUTPUTS[output.quantityId];
        if (!c) fail(`Response declares an unregistered quantity id: ${output.quantityId}.`);
        if (
          output.ownerId !== c.ownerId ||
          output.semanticKind !== c.semanticKind ||
          output.unit !== c.unit
        ) {
          fail("Output identity or units do not match the registered owner.");
        }
        if (output.status === "value") {
          if (typeof output.value !== "number" || !Number.isFinite(output.value)) {
            fail("Output scalar does not match its declared type.");
          }
        }
      }
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
    protocolVersion: SR03_PROTOCOL,
    sourceDigest,
    ownerKind: "host-reference",
    modelId: SR03_MODEL.id,
  };
}
