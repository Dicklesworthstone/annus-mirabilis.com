import { BM01_CLASSES, type Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import type { TracerRecording } from "../../physics/reference/diffusion/tracers.ts";
import { createBm01Recording, measureBm01 } from "../operations/bm01.ts";
import {
  BM01_PROTOCOL,
  decodeLabRequest,
  type LabHello,
  type LabRequest,
  type LabResponse,
  labHello,
} from "../protocol/bm01.ts";
/** One privately held realization per worker. Re-observation has zero PRNG calls. */
export function createBm01Host(
  send: (message: LabResponse | LabHello) => void,
  sourceDigest: string,
) {
  let active: LabRequest | null = null,
    stopped = false,
    cancelled = false,
    instanceId: string | null = null;
  let cache: { runId: string; parameters: Bm01Parameters; recording: TracerRecording } | null =
    null;
  async function receive(input: unknown): Promise<void> {
    const message = decodeLabRequest(input, sourceDigest);
    if (stopped) return;
    if (message.messageKind === "cancel") {
      if (
        active?.token.instanceId === message.instanceId &&
        active.token.actionIndex === message.actionIndex
      )
        cancelled = true;
      return;
    }
    if (active) throw new TypeError("Concurrent requests to one recording owner.");
    if (instanceId !== null && instanceId !== message.token.instanceId)
      throw new TypeError("A recording owner cannot serve another instance.");
    instanceId = message.token.instanceId;
    active = message;
    cancelled = false;
    const p = message.token.parameters as Bm01Parameters;
    let result: LabResponse["result"];
    try {
      const activeCache = cache;
      const reused =
        activeCache !== null &&
        activeCache.runId === message.token.runId &&
        (Object.keys(BM01_CLASSES) as (keyof Bm01Parameters)[]).every(
          (k) => BM01_CLASSES[k] !== "input" || Object.is(p[k], activeCache.parameters[k]),
        );
      const recording =
        reused && activeCache !== null
          ? { kind: "accepted" as const, data: activeCache.recording }
          : await createBm01Recording(p, { cancelled: () => cancelled || stopped });
      if (recording.kind !== "accepted") result = recording;
      else {
        result = measureBm01(recording.data, p, reused);
        if (result.kind === "accepted" && !cancelled && !stopped)
          cache = { runId: message.token.runId, parameters: p, recording: recording.data };
      }
      if (cancelled)
        result = {
          kind: "outcome" as const,
          outcome: { outcome: "cancelled" as const, ...executionOutcomeRegistry.cancelled },
        };
    } catch {
      result = {
        kind: "outcome" as const,
        outcome: {
          outcome: "invariant-violation" as const,
          ...executionOutcomeRegistry["invariant-violation"],
        },
      };
    }
    active = null;
    if (!stopped)
      send({
        messageKind: "result",
        protocolVersion: BM01_PROTOCOL,
        sourceDigest,
        token: message.token,
        result,
      });
  }
  return Object.freeze({
    hello: () => send(labHello(sourceDigest)),
    receive,
    dispose() {
      stopped = true;
      cancelled = true;
      cache = null;
    },
  });
}
