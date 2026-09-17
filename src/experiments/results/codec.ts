import { type ExecutionOutcome, executionOutcomeRegistry } from "./outcomes.ts";
import { refusalCodeRegistry } from "./refusalCodes.ts";
import type { RequestRefusal } from "./refusals.ts";
import { type OutputStatus, outputStatusRegistry, type ScientificResult } from "./types.ts";

/** Boundary validation is deliberately dependency-free and usable in a worker. */
export class ResultDecodeError extends TypeError {
  readonly path: string;
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = "ResultDecodeError";
    this.path = path;
  }
}
type Check = (value: unknown, path: string) => void;
function fail(path: string, reason: string): never {
  throw new ResultDecodeError(path, reason);
}
const text: Check = (v, p) => {
  if (typeof v !== "string" || !v.trim()) fail(p, "expected nonempty text");
};
const finite: Check = (v, p) => {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(p, "expected a finite number");
};
const positive: Check = (v, p) => {
  finite(v, p);
  if ((v as number) <= 0) fail(p, "expected a positive number");
};
const nonnegative: Check = (v, p) => {
  finite(v, p);
  if ((v as number) < 0) fail(p, "expected a nonnegative number");
};
const count: Check = (v, p) => {
  nonnegative(v, p);
  if (!Number.isSafeInteger(v)) fail(p, "expected a safe integer");
};
const positiveCount: Check = (v, p) => {
  count(v, p);
  positive(v, p);
};
const probability: Check = (v, p) => {
  positive(v, p);
  if ((v as number) >= 1) fail(p, "expected a probability strictly below one");
};
const choices =
  (...values: readonly unknown[]): Check =>
  (v, p) => {
    if (!values.includes(v)) fail(p, "unrecognized discriminator");
  };
function object(v: unknown, p: string): Record<string, unknown> {
  if (
    v === null ||
    typeof v !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(v))
  )
    fail(p, "expected a plain record");
  for (const key of Reflect.ownKeys(v)) {
    if (
      typeof key !== "string" ||
      !Object.getOwnPropertyDescriptor(v, key)?.enumerable ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(v, key) ?? {}, "value")
    )
      fail(p, "accessors and hidden fields are not data");
  }
  return v as Record<string, unknown>;
}
function record(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return (v, p) => {
    const o = object(v, p);
    for (const key of Object.keys(o))
      if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key))
        fail(`${p}.${key}`, "unknown field");
    for (const [key, check] of Object.entries(required)) {
      if (!Object.hasOwn(o, key)) fail(`${p}.${key}`, "missing field");
      check(o[key], `${p}.${key}`);
    }
    for (const [key, check] of Object.entries(optional))
      if (Object.hasOwn(o, key)) check(o[key], `${p}.${key}`);
  };
}
const list =
  (check: Check): Check =>
  (v, p) => {
    if (!Array.isArray(v) || v.length === 0 || v.length > 1_000_000)
      fail(p, "expected a nonempty bounded array");
    for (let i = 0; i < v.length; i++) check(v[i], `${p}[${i}]`);
  };
const action = record({
  parameterId: text,
  value: (v, p) => {
    if (typeof v === "number") finite(v, p);
    else if (typeof v === "string") text(v, p);
    else if (typeof v !== "boolean") fail(p, "expected a parameter value");
  },
});
const domain = choices("physical", "model", "numerical", "input");
const band =
  (required: Record<string, Check>): Check =>
  (v, p) => {
    record(required)(v, p);
    const o = object(v, p);
    if ((o.lower as number) > (o.upper as number)) fail(p, "interval bounds are reversed");
  };
const uncertaintyChecks: Record<string, Check> = {
  "statistical-interval": band({
    kind: choices("statistical-interval"),
    lower: finite,
    upper: finite,
    coverage: probability,
    sampleSize: positiveCount,
    method: text,
  }),
  enclosure: band({ kind: choices("enclosure"), lower: finite, upper: finite, method: text }),
  "numerical-error-estimate": record({
    kind: choices("numerical-error-estimate"),
    magnitude: nonnegative,
    method: text,
    guarantee: choices("bound", "estimate"),
  }),
  "input-precision": record({
    kind: choices("input-precision"),
    significantFigures: positiveCount,
    source: text,
  }),
  "measurement-uncertainty": record({
    kind: choices("measurement-uncertainty"),
    magnitude: nonnegative,
    datasetId: text,
    uncertaintyType: text,
  }),
};
const uncertainty: Check = (v, p) => {
  const o = object(v, p);
  if (typeof o.kind !== "string" || !Object.hasOwn(uncertaintyChecks, o.kind))
    fail(`${p}.kind`, "unknown uncertainty kind");
  uncertaintyChecks[o.kind]?.(v, p);
};
const numericValue: Check = (v, p) => {
  if (v instanceof Float64Array) {
    if (!(v.buffer instanceof ArrayBuffer)) fail(p, "shared memory is not a snapshot");
    if (v.length === 0 || v.length > 1_000_000) fail(p, "empty or oversized numeric array");
    for (let i = 0; i < v.length; i++) finite(v[i], `${p}[${i}]`);
  } else finite(v, p);
};
const identity = { quantityId: text, unit: text, semanticKind: text, ownerId: text };
const status = (id: OutputStatus, fields: Record<string, Check>, optional = {}): Check =>
  record({ ...identity, status: choices(id), ...fields }, optional);
const checks: Record<OutputStatus, Check> = {
  value: status("value", { value: numericValue }, { uncertainty }),
  symbolic: status("symbolic", { expressionRef: text, unspecifiedSymbols: list(text) }),
  "analytic-limit": status("analytic-limit", {
    description: text,
    representation: (v, p) => {
      const o = object(v, p);
      if (o.kind === "point-mass")
        record({ kind: choices("point-mass"), location: finite, mass: positive })(v, p);
      else record({ kind: choices("coefficient"), value: finite })(v, p);
    },
  }),
  underdetermined: status("underdetermined", {
    compatibleFamily: text,
    neededInformation: list(text),
  }),
  "not-applicable": status("not-applicable", { reason: text }),
  "outside-domain": status("outside-domain", {
    condition: text,
    domainKind: domain,
    reason: text,
    boundary: (v, p) => {
      const o = object(v, p);
      (Object.hasOwn(o, "alternativeModel") ? record({ alternativeModel: text }) : action)(v, p);
    },
  }),
  divergent: status("divergent", {
    expressionRef: text,
    divergenceKind: choices("integral", "series", "limit"),
    variable: text,
    range: (v, p) => {
      const endpoint: Check = (v, p) => {
        if (v !== "unbounded") finite(v, p);
      };
      record({ lower: endpoint, upper: endpoint })(v, p);
      const o = object(v, p);
      if (typeof o.lower === "number" && typeof o.upper === "number" && o.lower >= o.upper)
        fail(p, "empty or reversed range");
    },
    rate: record({ statement: text }, { expressionRef: text }),
    modelId: text,
    finiteUnder: action,
  }),
};

/** Validate before cloning, so a caller cannot change a decoded scalar envelope. */
export function decodeResult(input: unknown): ScientificResult {
  const o = object(input, "result");
  if (typeof o.status !== "string" || !Object.hasOwn(outputStatusRegistry, o.status))
    fail("result.status", "unknown output status");
  checks[o.status as OutputStatus](input, "result");
  return structuredClone(input) as ScientificResult;
}

/** JSON transport for scalar results and small arrays; large worker buffers use their own protocol. */
export function encodeResult(input: ScientificResult): string {
  const result = decodeResult(input);
  return JSON.stringify(
    result.status === "value" && result.value instanceof Float64Array
      ? { ...result, value: { encoding: "float64-json-v1", values: Array.from(result.value) } }
      : result,
  );
}
export function parseResult(json: string): ScientificResult {
  if (json.length > 32_000_000) fail("result", "JSON exceeds the result budget");
  const o = object(JSON.parse(json), "result");
  if (o.status === "value" && typeof o.value === "object" && o.value !== null) {
    record({ encoding: choices("float64-json-v1"), values: list(finite) })(o.value, "result.value");
    o.value = Float64Array.from(object(o.value, "result.value").values as number[]);
  }
  return decodeResult(o);
}

function jsonDetails(v: unknown, p: string): void {
  let nodes = 0;
  const visit = (value: unknown, path: string, depth: number): void => {
    if (++nodes > 100_000 || depth > 32) fail(path, "details exceed the nesting or size budget");
    if (value === null || typeof value === "boolean" || typeof value === "string") return;
    if (typeof value === "number") {
      finite(value, path);
      return;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) visit(value[i], `${path}[${i}]`, depth + 1);
    } else
      for (const [key, child] of Object.entries(object(value, path)))
        visit(child, `${path}.${key}`, depth + 1);
  };
  object(v, p);
  visit(v, p, 0);
}
function rejectMisfiledOutputStatus(input: unknown, channel: "refusal" | "outcome"): void {
  if (input === null || typeof input !== "object") return;
  const status = (input as { status?: unknown }).status;
  if (typeof status === "string" && Object.hasOwn(outputStatusRegistry, status)) {
    fail(
      channel,
      `this is a ${status} output status, not ${channel === "outcome" ? "an execution outcome" : "a request refusal"}`,
    );
  }
}

export function decodeRefusal(input: unknown): RequestRefusal {
  rejectMisfiledOutputStatus(input, "refusal");
  record(
    {
      code: choices(...Object.keys(refusalCodeRegistry)),
      domainKind: domain,
      affected: (v, p) => {
        record({}, { parameterIds: list(text), capabilityId: text })(v, p);
        if (!Object.keys(object(v, p)).length) fail(p, "name an affected parameter or capability");
      },
      message: text,
      rankedRepairs: list(record({ label: text }, { action })),
    },
    { details: jsonDetails },
  )(input, "refusal");
  const refusal = input as RequestRefusal;
  const definition = refusalCodeRegistry[refusal.code];
  if (refusal.domainKind !== definition.domainKind || refusal.message !== definition.message)
    fail("refusal", "registry domain or reader text mismatch");
  if (refusal.code === "ftcs-unstable") {
    const details = object(refusal.details, "refusal.details");
    positive(details.ratio, "refusal.details.ratio");
    choices(0.5)(details.limit, "refusal.details.limit");
    positive(details.dtMax, "refusal.details.dtMax");
    if ((details.ratio as number) <= 0.5) fail("refusal.details.ratio", "this ratio is stable");
  }
  return structuredClone(refusal);
}
const workBudget = record({ workUnits: count, allocationBytes: count });
export function decodeOutcome(input: unknown): ExecutionOutcome {
  rejectMisfiledOutputStatus(input, "outcome");
  const o = object(input, "outcome");
  const required: Record<string, Check> = {
    outcome: choices(...Object.keys(executionOutcomeRegistry)),
    message: text,
    retry: choices("retry-same-request", "new-run", "reload", "none"),
  };
  if (o.outcome === "budget-exhausted") {
    required.requested = workBudget;
    required.allowed = workBudget;
  }
  record(required, { details: jsonDetails })(input, "outcome");
  const outcome = input as ExecutionOutcome;
  const definition = executionOutcomeRegistry[outcome.outcome];
  if (outcome.message !== definition.message || outcome.retry !== definition.retry)
    fail("outcome", "registry reader text or retry mismatch");
  if (
    outcome.outcome === "budget-exhausted" &&
    outcome.requested.workUnits <= outcome.allowed.workUnits &&
    outcome.requested.allocationBytes <= outcome.allowed.allocationBytes
  )
    fail("outcome", "requested work fits inside the budget");
  return structuredClone(outcome);
}

export type Revisions = Readonly<{
  input: number;
  observer: number;
  measurement: number;
  estimator: number;
}>;
export type ResultBatch = Readonly<{ revisions: Revisions; outputs: readonly ScientificResult[] }>;
export type ResultPolicy = Readonly<{
  allowPartial: boolean;
  statuses: Readonly<Record<string, readonly OutputStatus[]>>;
  expectedRevisions: Revisions;
}>;
const revisionsCheck = record({
  input: count,
  observer: count,
  measurement: count,
  estimator: count,
});
/** One revision tuple for the entire batch; outputs cannot smuggle their own revisions. */
export function decodeResultBatch(input: unknown, policy: ResultPolicy): ResultBatch {
  record({
    revisions: revisionsCheck,
    outputs: list((v) => {
      decodeResult(v);
    }),
  })(input, "batch");
  revisionsCheck(policy.expectedRevisions, "expectedRevisions");
  const batch = input as ResultBatch;
  for (const key of ["input", "observer", "measurement", "estimator"] as const)
    if (batch.revisions[key] !== policy.expectedRevisions[key])
      fail(`batch.revisions.${key}`, "mixed or unexpected revision");
  const seen = new Set<string>();
  for (const output of batch.outputs) {
    if (seen.has(output.quantityId)) fail("batch.outputs", "duplicate quantity id");
    seen.add(output.quantityId);
    if (
      !Object.hasOwn(policy.statuses, output.quantityId) ||
      !policy.statuses[output.quantityId]?.includes(output.status)
    )
      fail(`batch.outputs.${output.quantityId}`, "status not admitted by the manifest");
  }
  for (const id of Object.keys(policy.statuses))
    if (!seen.has(id)) fail(`batch.outputs.${id}`, "missing declared output");
  if (
    !policy.allowPartial &&
    batch.outputs.some((o) => o.status === "value") &&
    batch.outputs.some((o) => o.status !== "value")
  )
    fail("batch.outputs", "partial results not admitted by the manifest");
  return structuredClone(batch);
}
