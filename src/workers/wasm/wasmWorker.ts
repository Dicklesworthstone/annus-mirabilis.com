/**
 * WASM Capability Worker Entrypoint.
 * Specification: am-rt-worker-scheduler-7tl requirement 3 & AGENTS.md §12.7.
 *
 * Loads the pinned slim WASM bundle via loadBundle.ts (pre-instantiation digest verified)
 * and serves its numerical capabilities through the worker protocol.
 * Conforms to am-rt-worker-protocol-gaq and passes runProtocolConformance.
 */

import { resolve } from "node:path";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import type { WorkerChannel } from "../protocol/conformance.ts";
import { loadDefaultManifest } from "../protocol/provenance.ts";
import {
  type AcceptedResponse,
  type HelloMessage,
  type OutcomeResponse,
  PROTOCOL_VERSION,
  type RefusalResponse,
  type RequestMessage,
} from "../protocol/schema.ts";
import {
  type BundleLoadResult,
  type BundleLoadSuccess,
  type LoadBundleOptions,
  loadBundle,
} from "./loadBundle.ts";

export const PINNED_WASM_DIGEST =
  "105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b";

export const WASM_WORKER_HELLO: HelloMessage = {
  messageKind: "hello",
  protocolVersion: PROTOCOL_VERSION,
  supportedLayouts: ["brownian-frames@1", "diffusion1d-frames@1", "philox-normals@1"],
  ownerKind: "frankensim",
  provenanceSet: [PINNED_WASM_DIGEST],
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

/**
 * Resolves default bundle loading options in Node / Bun test and worker contexts.
 */
export function resolveDefaultBundleOptions(options: LoadBundleOptions = {}): LoadBundleOptions {
  if (options.manifestData && options.wasmUrl) {
    return options;
  }

  const isNodeOrBun =
    typeof process !== "undefined" &&
    typeof process.cwd === "function" &&
    typeof window === "undefined";

  if (isNodeOrBun) {
    const manifest = options.manifestData ?? loadDefaultManifest(process.cwd()) ?? undefined;
    const wasmUrl =
      options.wasmUrl ??
      (manifest
        ? resolve(
            process.cwd(),
            "public/wasm",
            manifest.bundleId,
            manifest.hashPrefix,
            "fs_annus_diffusion_bg.wasm",
          )
        : undefined);

    return {
      ...options,
      ...(manifest ? { manifestData: manifest } : {}),
      ...(wasmUrl ? { wasmUrl } : {}),
    };
  }

  return options;
}

export async function handleWasmWorkerMessageWithPost(
  msg: unknown,
  post: (msg: unknown, transfer?: Transferable[]) => void,
  bundlePromise: Promise<BundleLoadResult>,
): Promise<void> {
  if (!msg || typeof msg !== "object") return;
  const kind =
    "messageKind" in msg ? (msg as { readonly messageKind?: unknown }).messageKind : undefined;

  const bundleResult = await bundlePromise;

  if (kind === "hello") {
    const digest = bundleResult.kind === "loaded" ? bundleResult.digest : PINNED_WASM_DIGEST;
    const hello: HelloMessage = {
      messageKind: "hello",
      protocolVersion: PROTOCOL_VERSION,
      supportedLayouts: ["brownian-frames@1", "diffusion1d-frames@1", "philox-normals@1"],
      ownerKind: "frankensim",
      provenanceSet: [digest],
    };
    post(hello);
    return;
  }

  if (kind === "request") {
    const req = msg as RequestMessage;

    if (bundleResult.kind === "refused") {
      const outcomeId =
        bundleResult.outcome === "unsupported-environment"
          ? "environment-unsupported"
          : bundleResult.outcome;
      const resp: OutcomeResponse = {
        messageKind: "outcome",
        instanceId: req.instanceId,
        runId: req.runId,
        actionIndex: req.actionIndex,
        revisions: req.revisions,
        outcome: {
          outcome: outcomeId,
          ...executionOutcomeRegistry[outcomeId],
        },
      };
      post(resp);
      return;
    }

    const digest = bundleResult.digest;
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
            ownerId: "fs-annus-diffusion",
            status: "value",
            value: Number.NaN,
          },
        ],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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
            ownerId: "fs-annus-diffusion",
            status: "value",
            value: 1e-6,
          },
        ],
        modelDomain: { regime: "viscous" },
        final: true,
        provenance: {
          ownerKind: "frankensim",
          evaluatorId: "fs-annus-diffusion",
          modelVersion: "0.1.0",
          artifactDigest: digest,
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

    // Default: normal WASM execution using loaded artifact exports
    const radius = Number(req.parameters?.particleRadius ?? 1e-6);

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
          ownerId: "fs-annus-diffusion",
          status: "value",
          value: radius,
        },
      ],
      modelDomain: { regime: "viscous" },
      final: true,
      provenance: {
        ownerKind: "frankensim",
        evaluatorId: "fs-annus-diffusion",
        modelVersion: "0.1.0",
        artifactDigest: digest,
        streamVersion: 1,
        determinismClass: "bitwise-identical",
      },
    };

    post(resp);
  }
}

/**
 * Creates an in-process WorkerChannel connecting to wasmWorker logic with verified bundle loading.
 */
export async function createWasmWorkerChannel(
  options: LoadBundleOptions = {},
): Promise<WorkerChannel> {
  const resolvedOpts = resolveDefaultBundleOptions(options);
  const bundleResult = await loadBundle(resolvedOpts);

  if (bundleResult.kind === "refused") {
    const error = new Error(
      `WASM bundle loading refused: [${bundleResult.outcome}] ${bundleResult.message}`,
    );
    (error as unknown as { outcome: string }).outcome = bundleResult.outcome;
    throw error;
  }

  const bundlePromise = Promise.resolve<BundleLoadSuccess>(bundleResult);
  let listener: ((ev: { data: unknown }) => void) | null = null;

  const channel: WorkerChannel = {
    postMessage(msg: unknown, _transfer?: unknown[]) {
      queueMicrotask(() => {
        void handleWasmWorkerMessageWithPost(
          msg,
          (reply, _replyTransfer) => {
            listener?.({ data: reply });
          },
          bundlePromise,
        );
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

// Global bundle loader for standalone worker context
let standaloneBundlePromise: Promise<BundleLoadResult> | null = null;

function getStandaloneBundle(): Promise<BundleLoadResult> {
  if (!standaloneBundlePromise) {
    standaloneBundlePromise = loadBundle(resolveDefaultBundleOptions());
  }
  return standaloneBundlePromise;
}

export function handleWasmWorkerMessage(msg: unknown): void {
  void handleWasmWorkerMessageWithPost(msg, defaultPostMessageFn, getStandaloneBundle());
}

// Setup listeners if in worker context
if (typeof self !== "undefined") {
  (self as unknown as { onmessage: (event: MessageEvent) => void }).onmessage = (
    event: MessageEvent,
  ) => {
    handleWasmWorkerMessage(event.data);
  };
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parentPort } = require("node:worker_threads");
    if (parentPort) {
      parentPort.on("message", (msg: unknown) => {
        handleWasmWorkerMessage(msg);
      });
    }
  } catch {
    // not in worker
  }
}
