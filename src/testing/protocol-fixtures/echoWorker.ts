/**
 * Protocol Test Echo Worker.
 * Specification: am-rt-worker-protocol-gaq conformance and e2e testing.
 *
 * A protocol test worker that evaluates requests, supports buffer transfers,
 * and can emit scripted malformed, refusal, or out-of-order messages on command.
 */

import type { WorkerChannel } from "../../workers/protocol/conformance.ts";
import type {
  AcceptedResponse,
  HelloMessage,
  RefusalResponse,
  RequestMessage,
} from "../../workers/protocol/schema.ts";
import { TEST_EVALUATOR_HASH } from "./fixtures.ts";

export const ECHO_WORKER_HELLO: HelloMessage = {
  messageKind: "hello",
  protocolVersion: 1,
  supportedLayouts: ["brownian-frames@1", "diffusion1d-frames@1", "philox-normals@1"],
  ownerKind: "host-reference",
  provenanceSet: [TEST_EVALUATOR_HASH],
};

// Cross-environment postMessage abstraction
let defaultPostMessageFn: (msg: unknown, transfer?: any[]) => void;

if (
  typeof globalThis !== "undefined" &&
  "postMessage" in globalThis &&
  // Platform escape: DedicatedWorkerGlobalScope.postMessage is untyped on globalThis in DOM lib
  typeof (globalThis as any).postMessage === "function"
) {
  defaultPostMessageFn = (msg, transfer) => {
    if (transfer && transfer.length > 0) {
      // Platform escape: worker global postMessage accepts (message, transfer) without targetOrigin
      (globalThis as any).postMessage(msg, transfer);
    } else {
      // Platform escape: worker global postMessage accepts (message) without targetOrigin
      (globalThis as any).postMessage(msg);
    }
  };
} else {
  try {
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

export function handleWorkerMessage(msg: unknown): void {
  handleWorkerMessageWithPost(msg, defaultPostMessageFn);
}

export function handleWorkerMessageWithPost(
  msg: unknown,
  post: (msg: unknown, transfer?: any[]) => void,
): void {
  if (!msg || typeof msg !== "object") return;
  // Field reach eliminated: safely extract property across untrusted boundary without type assertion escape
  const kind =
    "messageKind" in msg ? (msg as { readonly messageKind?: unknown }).messageKind : undefined;

  if (kind === "hello") {
    post(ECHO_WORKER_HELLO);
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
            ownerId: "echoWorker",
            status: "value",
            value: Number.NaN,
          },
        ],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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
        actionIndex: 0, // older actionIndex
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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
        stepIndex: 0, // non-increasing stepIndex
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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
        actionIndex: 9999, // unissued actionIndex
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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
        actionIndex: 3, // older actionIndex (late observer response)
        revisions: req.revisions,
        acceptedParameters: req.parameters,
        stepIndex: 1,
        simulatedTime: 1.0,
        outputs: [],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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
            ownerId: "echoWorker",
            status: "value",
            value: 1e-6,
          },
        ],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "host-reference",
          evaluatorId: "echoWorker",
          modelVersion: "1.0.0",
          artifactDigest: TEST_EVALUATOR_HASH,
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

    // Default: normal accepted response
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
          ownerId: "echoWorker",
          status: "value",
          value: Number(req.parameters.particleRadius ?? 1e-6),
        },
      ],
      modelDomain: { regime: "viscous" },
      final: true,
      provenance: {
        ownerKind: "host-reference",
        evaluatorId: "echoWorker",
        modelVersion: "1.0.0",
        artifactDigest: TEST_EVALUATOR_HASH,
        streamVersion: 1,
        determinismClass: "bitwise-identical",
      },
    };

    post(resp);
  }
}

/**
 * Creates an in-process WorkerChannel connecting to echoWorker logic.
 */
export function createInProcessEchoWorker(): WorkerChannel {
  let listener: ((ev: any) => void) | null = null;
  const channel: WorkerChannel = {
    postMessage(msg: unknown, _transfer?: any[]) {
      queueMicrotask(() => {
        handleWorkerMessageWithPost(msg, (reply, _replyTransfer) => {
          listener?.({ data: reply });
        });
      });
    },
    set onmessage(fn: ((ev: any) => void) | null) {
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
  // Platform escape: DOM lib types self as Window; dedicated worker scope assigns worker onmessage listener
  (self as any).onmessage = (event: MessageEvent) => {
    handleWorkerMessage(event.data);
  };
} else {
  try {
    const { parentPort } = require("node:worker_threads");
    if (parentPort) {
      parentPort.on("message", (msg: unknown) => {
        handleWorkerMessage(msg);
      });
    }
  } catch {
    // not in worker
  }
}
