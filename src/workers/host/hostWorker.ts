/**
 * Host Reference Worker Entrypoint.
 * Specification: am-rt-worker-scheduler-7tl requirement 3 & AGENTS.md §12.7.
 *
 * Serves registered host reference evaluators through the worker protocol.
 * Conforms to am-rt-worker-protocol-gaq and passes runProtocolConformance.
 */

import { BM01_SOURCE_DIGEST } from "../../generated/bm01-provenance.ts";
import type { WorkerChannel } from "../protocol/conformance.ts";
import { registerAdmittedEvaluators } from "../protocol/provenance.ts";
import {
  type AcceptedResponse,
  type HelloMessage,
  PROTOCOL_VERSION,
  type RefusalResponse,
  type RequestMessage,
} from "../protocol/schema.ts";

export const HOST_WORKER_SOURCE_HASH =
  "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b";

// Register host evaluators in the admitted provenance registry
registerAdmittedEvaluators({
  hostWorker: HOST_WORKER_SOURCE_HASH,
  bm01Host: HOST_WORKER_SOURCE_HASH,
  echoWorker: HOST_WORKER_SOURCE_HASH,
  [BM01_SOURCE_DIGEST]: BM01_SOURCE_DIGEST,
});

export const HOST_WORKER_HELLO: HelloMessage = {
  messageKind: "hello",
  protocolVersion: PROTOCOL_VERSION,
  supportedLayouts: ["brownian-frames@1", "diffusion1d-frames@1", "philox-normals@1"],
  ownerKind: "host-reference",
  provenanceSet: [HOST_WORKER_SOURCE_HASH],
};

let defaultPostMessageFn: (msg: unknown, transfer?: Transferable[]) => void;

if (
  typeof globalThis !== "undefined" &&
  "postMessage" in globalThis &&
  typeof (globalThis as unknown as { postMessage: unknown }).postMessage === "function"
) {
  defaultPostMessageFn = (msg, transfer) => {
    const scope = globalThis as unknown as {
      postMessage: (m: unknown, t?: Transferable[]) => void;
    };
    if (transfer && transfer.length > 0) {
      scope.postMessage(msg, transfer);
    } else {
      scope.postMessage(msg);
    }
  };
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parentPort } = require("node:worker_threads");
    if (parentPort) {
      defaultPostMessageFn = (msg, transfer) => {
        parentPort.postMessage(msg, transfer);
      };
    } else {
      defaultPostMessageFn = () => {};
    }
  } catch {
    defaultPostMessageFn = () => {};
  }
}

export function handleHostWorkerMessage(msg: unknown): void {
  handleHostWorkerMessageWithPost(msg, defaultPostMessageFn);
}

export function handleHostWorkerMessageWithPost(
  msg: unknown,
  post: (msg: unknown, transfer?: Transferable[]) => void,
): void {
  if (!msg || typeof msg !== "object") return;
  const kind = "messageKind" in msg ? (msg as { readonly messageKind?: unknown }).messageKind : undefined;

  if (kind === "hello") {
    post(HOST_WORKER_HELLO);
    return;
  }

  if (kind === "request") {
    const req = msg as RequestMessage;
    const script = String(req.parameters?._script ?? "");

    // 1. Scripted malformed responses
    if (script === "emit-malformed-nan") {
      const resp = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [
          {
            quantityId: "particleRadius",
            unit: "metre",
            semanticKind: "parameter",
            ownerId: "hostWorker",
            status: "value",
            value: Number.NaN,
          },
        ],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
      };
      post(resp);
      return;
    }

    // 2. Scripted staleness responses
    if (script === "emit-stale-action") {
      const resp: AcceptedResponse = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: 0,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
      };
      post(resp);
      return;
    }

    if (script === "emit-stale-step") {
      const resp: AcceptedResponse = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 0,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
      };
      post(resp);
      return;
    }

    if (script === "emit-superseded-run") {
      const resp: AcceptedResponse = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: "old-superseded-run",
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
      };
      post(resp);
      return;
    }

    if (script === "emit-unissued-action") {
      const resp: AcceptedResponse = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: 9999,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
      };
      post(resp);
      return;
    }

    if (script === "emit-late-observer") {
      const resp: AcceptedResponse = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: 3,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
      };
      post(resp);
      return;
    }

    // 3. Scripted refusal responses
    if (script === "emit-refusal") {
      const resp: RefusalResponse = {
        messageKind: "refusal",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        refusal: {
          code: "ftcs-unstable",
          domainKind: "numerical",
          affected: { parameterIds: ["dt"] },
          message: "This time step is too large for the explicit diffusion scheme.",
          rankedRepairs: [{ label: "Reduce the time step to the stated limit." }],
        },
      };
      post(resp);
      return;
    }

    if (script === "emit-unregistered-refusal") {
      const resp = {
        messageKind: "refusal",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        refusal: {
          code: "unregistered-alien-code",
          domainKind: "model",
          message: "Alien refusal",
          rankedRepairs: [{ label: "None" }],
        },
      };
      post(resp);
      return;
    }

    // 4. Scripted FrankenSim envelopes
    if (script === "emit-envelope") {
      const env = {
        refusal: {
          code: "unsupported-step-kernel",
          message: "Kernel 9 is unsupported",
          ranked_repairs: ["Use kernel 0, 1, 2, or 3"],
          details: { stepKernel: 9 },
        },
      };
      post(env);
      return;
    }

    if (script === "emit-budget-envelope") {
      const env = {
        refusal: {
          code: "output-len-overflow-or-budget",
          message: "Output buffer too large",
          ranked_repairs: ["reduce steps"],
          details: { requested: 4000000, allowed: 2097152 },
        },
      };
      post(env);
      return;
    }

    // 5. Scripted buffer transfer response
    if (script === "emit-buffer") {
      const data = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
      const resp: AcceptedResponse & { dataBuffers: ArrayBuffer[] } = {
        messageKind: "accepted",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [
          {
            quantityId: "particleRadius",
            unit: "metre",
            semanticKind: "parameter",
            ownerId: "hostWorker",
            status: "value",
            value: 1e-6,
          },
        ],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "hostWorker",
          modelVersion: "1.0.0",
          artifactDigest: HOST_WORKER_SOURCE_HASH,
          streamVersion: 1,
          determinismClass: "bitwise-identical",
        },
        buffers: [
          {
            layoutId: "brownian-frames",
            layoutVersion: 1,
            dtype: "float64",
            shape: [2, 3],
            byteLength: data.byteLength,
            littleEndian: true,
            ownership: "transfer",
          },
        ],
        dataBuffers: [data.buffer],
      };

      post(resp, [data.buffer]);
      return;
    }

    // Default: normal host evaluation
    const radius = Number(req.parameters?.particleRadius ?? 1e-6);
    const temp = Number(req.parameters?.temperature ?? 293.15);
    const viscosity = Number(req.parameters?.viscosity ?? 0.001);
    const kB = 1.380649e-23;
    const diffusivity = (kB * temp) / (6 * Math.PI * viscosity * radius);

    const resp: AcceptedResponse = {
      messageKind: "accepted",
      instanceId: req.instanceId,
      runId: req.runId,
      actionIndex: req.actionIndex,
      revisions: req.revisions,
      acceptedParameters: req.parameters,
      stepIndex: req.actionIndex * 10,
      simulatedTime: req.actionIndex * 0.1,
      outputs: [
        {
          quantityId: "particleRadius",
          unit: "metre",
          semanticKind: "parameter",
          ownerId: "hostWorker",
          status: "value",
          value: radius,
        },
        {
          quantityId: "diffusivity",
          unit: "m^2/s",
          semanticKind: "derived",
          ownerId: "hostWorker",
          status: "value",
          value: diffusivity,
        },
      ],
      modelDomain: { regime: "viscous" },
      final: true,
      provenance: {
        ownerKind: "host-reference",
        evaluatorId: "hostWorker",
        modelVersion: "1.0.0",
        artifactDigest: HOST_WORKER_SOURCE_HASH,
        streamVersion: 1,
        determinismClass: "bitwise-identical",
      },
    };

    post(resp);
  }
}

/**
 * Creates an in-process WorkerChannel connecting to hostWorker logic.
 */
export function createHostWorkerChannel(): WorkerChannel {
  let listener: ((ev: { data: unknown }) => void) | null = null;
  const channel: WorkerChannel = {
    postMessage(msg: unknown, _transfer?: unknown[]) {
      queueMicrotask(() => {
        handleHostWorkerMessageWithPost(msg, (reply, _replyTransfer) => {
          listener?.({ data: reply });
        });
      });
    },
    set onmessage(fn: ((ev: { data: unknown }) => void) | null) {
      listener = fn;
    },
    get onmessage() {
      return listener;
    },
    terminate() {
      listener = null;
    },
  };
  return channel;
}

// Setup listeners if in worker context
if (typeof self !== "undefined") {
  (self as unknown as { onmessage: (event: MessageEvent) => void }).onmessage = (event: MessageEvent) => {
    handleHostWorkerMessage(event.data);
  };
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parentPort } = require("node:worker_threads");
    if (parentPort) {
      parentPort.on("message", (msg: unknown) => {
        handleHostWorkerMessage(msg);
      });
    }
  } catch {
    // not in worker
  }
}
