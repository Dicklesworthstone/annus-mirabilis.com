import type { Bm06Parameters } from "../../experiments/bm06/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import {
  type Bm06Evaluation,
  type Bm06GridStepper,
  evaluateBm06,
  HOST_GRID_STEPPER,
} from "../operations/bm06.ts";
import { remeasureBm06 } from "../operations/bm06Measurement.ts";
import {
  BM06_PROTOCOL,
  decodeLabRequest,
  type LabHello,
  type LabRequest,
  type LabResponse,
  labHello,
} from "../protocol/bm06.ts";

/**
 * One host service per dedicated worker, with one bounded cached realization. `stepper` steps the
 * optional grid: the host reference by default, or FrankenSim's compiled diffusion1d_frames when
 * the worker has loaded the pinned module. One host keeps one stepper for its lifetime, so a run
 * never switches engines part-way.
 */
export function createBm06Host(
  send: (message: LabResponse | LabHello) => void,
  sourceDigest: string,
  stepper: Bm06GridStepper = HOST_GRID_STEPPER,
) {
  let active: LabRequest | null = null;
  let stopped = false,
    cancelled = false;
  let instanceId: string | null = null;
  let cache: { runId: string; parameters: Bm06Parameters; data: Bm06Evaluation } | null = null;
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
    if (active) throw new TypeError("The scheduler sent concurrent requests to a dedicated owner.");
    if (instanceId !== null && instanceId !== message.token.instanceId)
      throw new TypeError("A dedicated owner cannot serve a second instance.");
    instanceId = message.token.instanceId;
    active = message;
    cancelled = false;
    const parameters = message.token.parameters as Bm06Parameters;
    let result: LabResponse["result"];
    try {
      const reused =
        cache?.runId === message.token.runId
          ? remeasureBm06(cache.parameters, cache.data, parameters)
          : null;
      result =
        reused ??
        (await evaluateBm06(parameters, { cancelled: () => cancelled || stopped }, stepper));
      if (result.kind === "accepted" && !cancelled && !stopped)
        cache = { runId: message.token.runId, parameters, data: result.data };
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
        protocolVersion: BM06_PROTOCOL,
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
