import { BM05_CLASSES, type Bm05Parameters } from "../../experiments/bm05/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import type { WalkNormalSource, WalkRecording } from "../../physics/reference/diffusion/walks.ts";
import { createBm05Recording, measureBm05 } from "../operations/bm05.ts";
import {
  BM05_PROTOCOL,
  decodeLabRequest,
  type LabHello,
  type LabRequest,
  type LabResponse,
  labHello,
} from "../protocol/bm05.ts";
/**
 * `normals` draws a Gaussian walk's steps: this reference's Philox stream by default, or
 * FrankenSim's compiled philox_normals when the worker has loaded the pinned module. One host
 * keeps one source for its lifetime, and a recording keeps the source it was drawn with, so a run
 * and its replays never change engines.
 */
export function createBm05Host(
  send: (message: LabResponse | LabHello) => void,
  sourceDigest: string,
  normals?: WalkNormalSource,
) {
  let active: LabRequest | null = null,
    stopped = false,
    cancelled = false,
    instanceId: string | null = null;
  let cache: { runId: string; parameters: Bm05Parameters; recording: WalkRecording } | null = null;
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
    if (active) throw new TypeError("Concurrent requests to a single walk owner.");
    if (instanceId !== null && instanceId !== message.token.instanceId)
      throw new TypeError("A recording owner cannot serve another instance.");
    instanceId = message.token.instanceId;
    active = message;
    cancelled = false;
    const p = message.token.parameters as Bm05Parameters;
    let result: LabResponse["result"];
    try {
      const activeCache = cache;
      const reused =
        activeCache !== null &&
        activeCache.runId === message.token.runId &&
        (Object.keys(BM05_CLASSES) as (keyof Bm05Parameters)[]).every(
          (k) => BM05_CLASSES[k] !== "input" || Object.is(p[k], activeCache.parameters[k]),
        );
      const options = { cancelled: () => cancelled || stopped, ...(normals ? { normals } : {}) };
      const recording =
        reused && activeCache !== null
          ? { kind: "accepted" as const, data: activeCache.recording }
          : await createBm05Recording(p, options);
      if (recording.kind !== "accepted") result = recording;
      else {
        result = await measureBm05(recording.data, p, reused, options);
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
        protocolVersion: BM05_PROTOCOL,
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
