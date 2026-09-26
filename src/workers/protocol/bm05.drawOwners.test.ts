/**
 * BM-05's response decoder and who drew the walk (am-frankensim-repin-and-bind-jvhg, dispatch 269).
 *
 * A real host-measured snapshot is re-owned in each way a response could name the producer of its
 * draws:
 * - the four outputs read from the draws, all by FrankenSim, on a Gaussian walk: admitted;
 * - only some of them by FrankenSim: refused, one set of draws has one producer;
 * - FrankenSim on a coin walk: refused, since philox_normals draws normals and a coin walk draws
 *   none;
 * - an unregistered owner: refused;
 * - FrankenSim claiming a host reduction (sampleMean): refused.
 * The host label reads the same admission: a snapshot whose draws name an admitted producer is not
 * "unavailable".
 */
import { beforeAll, describe, expect, test } from "bun:test";
import {
  BM05_DEFAULTS,
  BM05_FRANKENSIM_DRAW_OWNER,
  BM05_OUTPUTS,
  type Bm05Parameters,
} from "../../experiments/bm05/definition.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import { createBm05Recording, measureBm05 } from "../operations/bm05.ts";
import { BM05_PROTOCOL, decodeLabResponse } from "./bm05.ts";

const DRAWN = ["walkPositions", "traceDisplacements", "recordingDraws", "replayedDraws"];
const digest = `source:sha256:${"c".repeat(64)}`;
type Message = { result: { data: { outputs: { quantityId: string; ownerId: string }[] } } };
const messages = new Map<string, { message: Message; token: Record<string, unknown> }>();

async function measured(p: Bm05Parameters) {
  const quiet = { yieldControl: async () => {} };
  const rec = await createBm05Recording(p, quiet);
  if (rec.kind !== "accepted") throw new Error("host recording refused");
  const m = await measureBm05(rec.data, p, false, quiet);
  if (m.kind !== "accepted") throw new Error("host measurement refused");
  const token = {
    experimentId: "bm-05",
    instanceId: "owners",
    runId: "run-owners",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: p,
  };
  const message = {
    messageKind: "result",
    protocolVersion: BM05_PROTOCOL,
    sourceDigest: digest,
    token,
    result: m,
  } as unknown as Message;
  return { message, token };
}

beforeAll(async () => {
  const small = { ...BM05_DEFAULTS, walkers: 40, runSteps: 30 };
  messages.set("gaussian", await measured({ ...small, kernel: "gaussian" }));
  messages.set("coin", await measured({ ...small, kernel: "coin" }));
});

function owned(kernel: string, owners: Record<string, string>) {
  const base = messages.get(kernel);
  if (!base) throw new Error(kernel);
  const message = structuredClone(base.message);
  for (const o of message.result.data.outputs)
    if (owners[o.quantityId]) o.ownerId = owners[o.quantityId] as string;
  return { message, token: base.token };
}
const decode = (x: ReturnType<typeof owned>) =>
  decodeLabResponse(x.message, x.token as never, digest);
const allDrawn = (owner: string) => Object.fromEntries(DRAWN.map((id) => [id, owner]));
function hostLabel(x: ReturnType<typeof owned>): string {
  const view = {
    accepted: { outputs: x.message.result.data.outputs },
  } as unknown as ExperimentView;
  return deriveHostExecution(view, BM05_OUTPUTS, digest, false).label;
}

describe("BM-05 decoder: who drew the walk", () => {
  test("the host reference as registered: admitted, a host calculation", () => {
    for (const kernel of ["gaussian", "coin"]) {
      expect(() => decode(owned(kernel, {}))).not.toThrow();
      expect(hostLabel(owned(kernel, {})), kernel).toBe("host");
    }
  });
  test("all four drawn outputs by fs-wasm.philox_normals, on a Gaussian walk: admitted", () => {
    const x = owned("gaussian", allDrawn(BM05_FRANKENSIM_DRAW_OWNER));
    expect(() => decode(x)).not.toThrow();
    expect(hostLabel(x)).toBe("host");
  });
  test("one set of draws, two producers: refused", () => {
    expect(() => decode(owned("gaussian", { walkPositions: BM05_FRANKENSIM_DRAW_OWNER }))).toThrow(
      /Outputs read from one set of draws name different producers\./,
    );
  });
  test("FrankenSim on a coin walk: refused", () => {
    expect(() => decode(owned("coin", allDrawn(BM05_FRANKENSIM_DRAW_OWNER)))).toThrow(
      /FrankenSim draws normals, so it cannot have drawn a coin or uniform walk\./,
    );
  });
  test("an unregistered producer, and FrankenSim claiming a host reduction: refused", () => {
    expect(() => decode(owned("gaussian", allDrawn("fs-wasm.brownian_frames")))).toThrow(
      /registered owner/,
    );
    expect(hostLabel(owned("gaussian", allDrawn("fs-wasm.brownian_frames")))).toBe("unavailable");
    expect(() => decode(owned("gaussian", { sampleMean: BM05_FRANKENSIM_DRAW_OWNER }))).toThrow(
      /registered owner/,
    );
  });
});
