import type { Bm04Parameters } from "../../experiments/bm04/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { type Bm04Evaluation, evaluateBm04 } from "../operations/bm04.ts";
import {
  BM04_PROTOCOL,
  decodeLabRequest,
  type LabHello,
  type LabRequest,
  type LabResponse,
  labHello,
} from "../protocol/bm04.ts";

/** One host service per dedicated worker, with one bounded cached realization. */
export function createBm04Host(
  send: (message: LabResponse | LabHello) => void,
  sourceDigest: string,
) {
  let active: LabRequest | null = null;
  let stopped = false;
  let cancelled = false;
  let instanceId: string | null = null;
  let cache: { runId: string; parameters: Bm04Parameters; data: Bm04Evaluation } | null = null;

  async function receive(input: unknown): Promise<void> {
    const message = decodeLabRequest(input, sourceDigest);
    if (stopped) return;
    if (message.messageKind === "cancel") {
      if (
        active?.token.instanceId === message.instanceId &&
        active.token.actionIndex === message.actionIndex
      ) {
        cancelled = true;
      }
      return;
    }
    if (active) throw new TypeError("The scheduler sent concurrent requests to a dedicated owner.");
    if (instanceId !== null && instanceId !== message.token.instanceId) {
      throw new TypeError("A dedicated owner cannot serve a second instance.");
    }
    instanceId = message.token.instanceId;
    active = message;
    cancelled = false;
    const parameters = message.token.parameters as unknown as Bm04Parameters;
    let result: Computation<Bm04Evaluation>;
    try {
      if (
        cache &&
        cache.runId === message.token.runId &&
        (Object.keys(parameters) as (keyof Bm04Parameters)[]).every((k) =>
          Object.is(cache?.parameters[k], parameters[k]),
        )
      ) {
        result = { kind: "accepted", data: cache.data };
      } else {
        result = await evaluateBm04(parameters, { cancelled: () => cancelled || stopped });
        if (result.kind === "accepted" && !cancelled && !stopped) {
          cache = { runId: message.token.runId, parameters, data: result.data };
        }
      }
      if (cancelled) {
        result = {
          kind: "outcome" as const,
          outcome: { outcome: "cancelled" as const, ...executionOutcomeRegistry.cancelled },
        };
      }
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
    if (!stopped) {
      send({
        messageKind: "result",
        protocolVersion: BM04_PROTOCOL,
        sourceDigest,
        token: message.token,
        result,
      });
    }
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
