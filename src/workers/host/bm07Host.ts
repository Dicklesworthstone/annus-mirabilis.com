import { BM07_CLASSES, type Bm07Parameters } from "../../experiments/bm07/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import type { InferenceRecording } from "../../physics/reference/inference/synthetic.ts";
import { createBm07Recording, measureBm07 } from "../operations/bm07.ts";
import {
  BM07_PROTOCOL,
  decodeLabRequest,
  type LabHello,
  type LabRequest,
  type LabResponse,
  labHello,
} from "../protocol/bm07.ts";
export function createBm07Host(
  send: (message: LabResponse | LabHello) => void,
  sourceDigest: string,
) {
  let active: LabRequest | null = null,
    stopped = false,
    cancelled = false,
    instanceId: string | null = null;
  let cache: { runId: string; parameters: Bm07Parameters; recording: InferenceRecording } | null =
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
    if (active) throw new TypeError("Concurrent requests to a single inference owner.");
    if (instanceId !== null && instanceId !== message.token.instanceId)
      throw new TypeError("A recording owner cannot serve another instance.");
    instanceId = message.token.instanceId;
    active = message;
    cancelled = false;
    const p = message.token.parameters as Bm07Parameters;
    let result: LabResponse["result"];
    try {
      const activeCache = cache;
      const reused =
        activeCache !== null &&
        activeCache.runId === message.token.runId &&
        (Object.keys(BM07_CLASSES) as (keyof Bm07Parameters)[]).every(
          (k) => BM07_CLASSES[k] !== "input" || Object.is(p[k], activeCache.parameters[k]),
        );
      const options = { cancelled: () => cancelled || stopped };
      const recording =
        reused && activeCache !== null
          ? { kind: "accepted" as const, data: activeCache.recording }
          : await createBm07Recording(p, options);
      if (recording.kind !== "accepted") result = recording;
      else {
        result = await measureBm07(recording.data, p, reused, options);
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
        protocolVersion: BM07_PROTOCOL,
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
