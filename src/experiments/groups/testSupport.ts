/** Transport controls for these tests only. All successful outputs come from the production owners. */
import tracerExample from "../../generated/bm01-example.json";
import densityExample from "../../generated/bm06-example.json";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createBm06Host } from "../../workers/host/bm06Host.ts";
import { createBm01Recording, measureBm01 } from "../../workers/operations/bm01.ts";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { BM01_DEFAULTS } from "../bm01/definition.ts";
import type { PreparedBm01Example } from "../bm01/session.ts";
import { BM06_DEFAULTS } from "../bm06/definition.ts";
import type { PreparedBm06Example } from "../bm06/session.ts";
import { encodeResult } from "../results/codec.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { RequestToken } from "../store/instanceStore.ts";

export async function smallBrownianExamples(): Promise<{
  tracer: PreparedBm01Example;
  density: PreparedBm06Example;
}> {
  const parameters = { ...BM01_DEFAULTS, M: 12, H: 0.2, interval: 0.2 };
  const recording = await createBm01Recording(parameters, { yieldControl: async () => {} });
  if (recording.kind !== "accepted") throw new Error("The real tracer fixture must record.");
  const measured = measureBm01(recording.data, parameters, false);
  if (measured.kind !== "accepted") throw new Error("The real tracer fixture must be measured.");
  const densityParameters = { ...BM06_DEFAULTS, t: 0.2 };
  const density = await evaluateBm06(densityParameters, { yieldControl: async () => {} });
  if (density.kind !== "accepted") throw new Error("The real density fixture must be evaluated.");
  return {
    tracer: {
      ...tracerExample,
      parameters,
      results: measured.data.outputs.map(encodeResult),
      stepIndex: measured.data.stepIndex,
      simulationTime: measured.data.simulationTime,
    },
    density: {
      ...densityExample,
      parameters: densityParameters,
      results: density.data.outputs.map(encodeResult),
      stepIndex: density.data.stepIndex,
      simulationTime: density.data.simulationTime,
    },
  };
}

type ResultMessage = Readonly<{
  messageKind: "result";
  token: RequestToken;
  result: unknown;
  [key: string]: unknown;
}>;

export function controlledOwner(kind: "bm-01" | "bm-06", sourceDigest: string) {
  let listener: ((message: unknown) => void) | undefined;
  let errorListener: (() => void) | undefined;
  let creations = 0;
  let disposals = 0;
  let holding = false;
  let refuseNext = false;
  let outcomeNext = false;
  const held: ResultMessage[] = [];
  const requests: RequestToken[] = [];
  const results: ResultMessage[] = [];
  const errors: unknown[] = [];
  const factory = (): WorkerChannel => {
    creations += 1;
    const deliver = (message: unknown) => {
      queueMicrotask(() => listener?.(structuredClone(message)));
    };
    const send = (message: unknown) => {
      if (
        message !== null &&
        typeof message === "object" &&
        "messageKind" in message &&
        message.messageKind === "result"
      ) {
        let result = message as ResultMessage;
        if (refuseNext) {
          refuseNext = false;
          // Negative fixture: replace a result with a typed refusal, never fabricated success.
          result = {
            ...result,
            result: {
              kind: "refused",
              refusal: makeRefusal(
                "invalid-parameter",
                { parameterIds: ["a"] },
                { details: { requirements: "This member refused the requested radius." } },
              ),
            },
          };
        }
        if (outcomeNext) {
          outcomeNext = false;
          result = {
            ...result,
            result: {
              kind: "outcome",
              outcome: {
                outcome: "invariant-violation",
                ...executionOutcomeRegistry["invariant-violation"],
              },
            },
          };
        }
        results.push(result);
        if (holding) held.push(result);
        else deliver(result);
      } else {
        deliver(message);
      }
    };
    const host =
      kind === "bm-01" ? createBm01Host(send, sourceDigest) : createBm06Host(send, sourceDigest);
    return {
      send(message) {
        if (
          message !== null &&
          typeof message === "object" &&
          "messageKind" in message &&
          message.messageKind === "request" &&
          "token" in message
        )
          requests.push(message.token as RequestToken);
        void host.receive(structuredClone(message)).catch((error) => {
          errors.push(error);
          errorListener?.();
        });
      },
      listen(onMessage, onError) {
        listener = onMessage;
        errorListener = onError;
        queueMicrotask(() => host.hello());
        return () => {
          listener = undefined;
          errorListener = undefined;
        };
      },
      dispose() {
        disposals += 1;
        host.dispose();
      },
    };
  };
  return {
    factory,
    requests,
    results,
    errors,
    held,
    get creations() {
      return creations;
    },
    get disposals() {
      return disposals;
    },
    hold() {
      holding = true;
    },
    refuseNext() {
      refuseNext = true;
    },
    outcomeNext() {
      outcomeNext = true;
    },
    release() {
      holding = false;
      for (const result of held.splice(0))
        queueMicrotask(() => listener?.(structuredClone(result)));
    },
  };
}

export async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  if (!condition())
    throw new Error("The owner did not reach the expected state within five seconds.");
}
