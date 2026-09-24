/**
 * Protocol Valid and Malformed Message Corpus.
 * Specification: am-rt-worker-protocol-gaq test plan.
 */

import type { U64String } from "../../experiments/identity/u64.ts";
import type { DecodeRejectionCode } from "../../workers/protocol/decode.ts";
import type {
  AcceptedResponse,
  HelloMessage,
  OutcomeResponse,
  RefusalResponse,
  RequestMessage,
} from "../../workers/protocol/schema.ts";

export const TEST_EVALUATOR_HASH =
  "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b";

export const VALID_HELLO: HelloMessage = {
  messageKind: "hello",
  protocolVersion: 1,
  supportedLayouts: ["brownian-frames@1", "diffusion1d-frames@1", "philox-normals@1"],
  ownerKind: "host-reference",
  provenanceSet: [TEST_EVALUATOR_HASH],
};

export const VALID_REQUEST: RequestMessage = {
  messageKind: "request",
  protocolVersion: 1,
  experimentId: "bm01",
  instanceId: "inst-42",
  runId: "run-alpha",
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  parameters: { particleRadius: 1e-6, temperature: 293.15 },
  modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
  constantSetId: "modern-si-2019",
  seedPolicy: {
    seed: "123456789012345678" as U64String,
    streamVersion: 1,
    allocationId: "stream-alloc-1",
  },
  operation: "evaluate",
  workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
};

export const VALID_ACCEPTED: AcceptedResponse = {
  messageKind: "accepted",
  instanceId: "inst-42",
  runId: "run-alpha",
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  acceptedParameters: { particleRadius: 1e-6, temperature: 293.15 },
  stepIndex: 1,
  simulatedTime: 1.0,
  outputs: [
    {
      quantityId: "particleRadius",
      unit: "metre",
      semanticKind: "parameter",
      ownerId: "bm01Host",
      status: "value",
      value: 1e-6,
    },
  ],
  modelDomain: { regime: "viscous" },
  final: true,
  provenance: {
    ownerKind: "host-reference",
    evaluatorId: "bm01Host",
    modelVersion: "1.0.0",
    artifactDigest: TEST_EVALUATOR_HASH,
    streamVersion: 1,
    determinismClass: "bitwise-identical",
  },
};

export const VALID_ACCEPTED_WITH_BUFFER: AcceptedResponse = {
  ...VALID_ACCEPTED,
  buffers: [
    {
      layoutId: "brownian-frames",
      layoutVersion: 1,
      dtype: "float64",
      shape: [2, 3],
      byteLength: 2 * 3 * 8,
      littleEndian: true,
      ownership: "transfer",
    },
  ],
};

export const VALID_REFUSAL: RefusalResponse = {
  messageKind: "refusal",
  instanceId: "inst-42",
  runId: "run-alpha",
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  refusal: {
    code: "ftcs-unstable",
    domainKind: "numerical",
    affected: { parameterIds: ["dt"] },
    message: "This time step is too large for the explicit diffusion scheme.",
    rankedRepairs: [{ label: "Reduce the time step to the stated limit." }],
  },
};

export const VALID_OUTCOME: OutcomeResponse = {
  messageKind: "outcome",
  instanceId: "inst-42",
  runId: "run-alpha",
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  outcome: {
    outcome: "budget-exhausted",
    message: "This calculation exceeds the declared work or memory budget.",
    retry: "new-run",
    requested: { workUnits: 500, allocationBytes: 0 },
    allowed: { workUnits: 100, allocationBytes: 0 },
  },
};

export interface MalformedTestCase {
  readonly id: string;
  readonly message: unknown;
  readonly expectedCode: DecodeRejectionCode;
  readonly description: string;
}

export const MALFORMED_CORPUS: readonly MalformedTestCase[] = [
  {
    id: "nan-value",
    message: {
      ...VALID_REQUEST,
      parameters: { particleRadius: Number.NaN },
    },
    expectedCode: "nonfinite-value",
    description: "Parameters containing NaN",
  },
  {
    id: "infinity-value",
    message: {
      ...VALID_ACCEPTED,
      outputs: [
        {
          quantityId: "particleRadius",
          unit: "metre",
          semanticKind: "parameter",
          ownerId: "bm01Host",
          status: "value",
          value: Number.POSITIVE_INFINITY,
        },
      ],
    },
    expectedCode: "nonfinite-value",
    description: "Outputs containing Infinity",
  },
  {
    id: "neg-infinity-value",
    message: {
      ...VALID_ACCEPTED,
      simulatedTime: Number.NEGATIVE_INFINITY,
    },
    expectedCode: "nonfinite-value",
    description: "Simulated time containing -Infinity",
  },
  {
    id: "buffer-short",
    message: {
      ...VALID_ACCEPTED,
      buffers: [
        {
          layoutId: "brownian-frames",
          layoutVersion: 1,
          dtype: "float64",
          shape: [2, 3],
          byteLength: 2 * 3 * 8 - 8, // 8 bytes short
          littleEndian: true,
          ownership: "transfer",
        },
      ],
    },
    expectedCode: "buffer-length-mismatch",
    description: "Buffer with byteLength 8 bytes short of shape product * 8",
  },
  {
    id: "buffer-shape-mismatch",
    message: {
      ...VALID_ACCEPTED,
      buffers: [
        {
          layoutId: "brownian-frames",
          layoutVersion: 1,
          dtype: "float64",
          shape: [6], // expected 2D [nParticles, steps + 1]
          byteLength: 6 * 8,
          littleEndian: true,
          ownership: "transfer",
        },
      ],
    },
    expectedCode: "buffer-shape-mismatch",
    description: "Buffer shape dimensions mismatch registered layout expectation",
  },
  {
    id: "unit-mismatch",
    message: {
      ...VALID_ACCEPTED,
      outputs: [
        {
          quantityId: "displacement",
          unit: "m", // context expects "μm"
          semanticKind: "measurement",
          ownerId: "bm01Host",
          status: "value",
          value: 1.0,
        },
      ],
    },
    expectedCode: "unit-mismatch",
    description: 'Output unit declared as "m" where "μm" was expected',
  },
  {
    id: "stale-run-id",
    message: {
      ...VALID_ACCEPTED,
      runId: "superseded-run-99",
    },
    expectedCode: "stale-run-id",
    description: "Response carrying a superseded runId",
  },
  {
    id: "stale-action-index",
    message: {
      ...VALID_ACCEPTED,
      actionIndex: 0, // context has acceptedActionIndex: 1
    },
    expectedCode: "stale-action-index",
    description: "Response with older actionIndex than acceptedActionIndex",
  },
  {
    id: "stale-step-index",
    message: {
      ...VALID_ACCEPTED,
      actionIndex: 1,
      stepIndex: 1, // context has acceptedActionIndex: 1, acceptedStepIndex: 1
    },
    expectedCode: "stale-step-index",
    description: "Response with non-increasing stepIndex for equal actionIndex",
  },
  {
    id: "unissued-action-index",
    message: {
      ...VALID_ACCEPTED,
      actionIndex: 999, // not in issuedActionIndices
    },
    expectedCode: "unissued-action-index",
    description: "Response carrying an actionIndex that was never issued",
  },
  {
    id: "protocol-version-999",
    message: {
      ...VALID_HELLO,
      protocolVersion: 999,
    },
    expectedCode: "protocol-mismatch",
    description: "Hello message with unsupported protocol version 999",
  },
  {
    id: "unknown-layout-version",
    message: {
      ...VALID_ACCEPTED,
      buffers: [
        {
          layoutId: "brownian-frames",
          layoutVersion: 99,
          dtype: "float64",
          shape: [2, 3],
          byteLength: 48,
          littleEndian: true,
          ownership: "transfer",
        },
      ],
    },
    expectedCode: "unknown-layout",
    description: "Buffer header with unknown layout version 99",
  },
  {
    id: "unknown-capability",
    message: {
      ...VALID_ACCEPTED,
      provenance: {
        ownerKind: "frankensim",
        capabilityId: "unadmitted-super-solver",
        modelVersion: "1.0.0",
        artifactDigest: "sha256:80a1f8fda6f69003c9aa40f991726933c265b6c13ce6062faf5faef479a917bd",
        streamVersion: 1,
        determinismClass: "bitwise-identical",
      },
    },
    expectedCode: "unadmitted-capability",
    description: "Provenance declaring capabilityId absent from manifest",
  },
  {
    id: "unknown-digest",
    message: {
      ...VALID_ACCEPTED,
      provenance: {
        ownerKind: "frankensim",
        modelVersion: "1.0.0",
        artifactDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        streamVersion: 1,
        determinismClass: "bitwise-identical",
      },
    },
    expectedCode: "unadmitted-digest",
    description: "Provenance declaring artifactDigest absent from manifest",
  },
  {
    id: "json-number-seed",
    message: {
      ...VALID_REQUEST,
      seedPolicy: {
        seed: 12345678, // JSON number instead of U64String
        streamVersion: 1,
        allocationId: "stream-alloc-1",
      },
    },
    expectedCode: "invalid-u64-seed",
    description: "Seed passed as a JSON number rather than a canonical string",
  },
  {
    id: "unregistered-refusal-code",
    message: {
      ...VALID_REFUSAL,
      refusal: {
        ...VALID_REFUSAL.refusal,
        code: "completely-invented-code",
      },
    },
    expectedCode: "unregistered-refusal-code",
    description: "Refusal response with code absent from refusalCodeRegistry",
  },
  {
    id: "unknown-top-level-field",
    message: {
      ...VALID_REQUEST,
      unrecognizedField: "surprise-payload",
    },
    expectedCode: "unknown-field",
    description: "Message containing an unknown top-level field",
  },
  {
    id: "missing-instance-id",
    message: {
      ...VALID_ACCEPTED,
      instanceId: "",
    },
    expectedCode: "missing-identity",
    description: "Accepted response with missing instanceId",
  },
];
