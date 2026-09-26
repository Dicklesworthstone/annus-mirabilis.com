/**
 * BM-06's response decoder and the grid's stepper (am-frankensim-repin-and-bind-jvhg).
 *
 * A real host-evaluated snapshot with the grid on is re-owned in each way a response could name
 * who stepped the grid:
 * - the field and its diffusion number by FrankenSim: admitted;
 * - the field by FrankenSim and the diffusion number by the host: refused, one stepping has one
 *   stepper;
 * - an unregistered stepper, or a real FrankenSim export not registered for the grid: refused;
 * - FrankenSim claiming the host's comparison of the field: refused.
 * The host label reads the same admission: a snapshot whose grid names an admitted stepper is a
 * host calculation for the instrument, and one naming an unregistered owner is unavailable.
 * Runs under bun test and node --experimental-strip-types --test.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  BM06_DEFAULTS,
  BM06_FRANKENSIM_GRID_OWNER,
  BM06_OUTPUTS,
} from "../../experiments/bm06/definition.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import { evaluateBm06 } from "../operations/bm06.ts";
import { BM06_PROTOCOL, decodeLabResponse } from "./bm06.ts";

const p = { ...BM06_DEFAULTS, gridEnabled: true };
const token = {
  experimentId: "bm-06",
  instanceId: "owners",
  runId: "run-owners",
  parentRunId: null,
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  parameters: p,
};
const digest = `source:sha256:${"c".repeat(64)}`;
const STEPPING = ["gridDensity", "stabilityRatio"];
type Message = {
  result: { data: { outputs: { quantityId: string; ownerId: string }[] } };
};
let base: Message;

before(async () => {
  const r = await evaluateBm06(p, { yieldControl: async () => {} });
  if (r.kind !== "accepted") throw new Error("host evaluation refused");
  base = {
    messageKind: "result",
    protocolVersion: BM06_PROTOCOL,
    sourceDigest: digest,
    token,
    result: r,
  } as unknown as Message;
  // Non-vacuity: the grid is on, so both stepping outputs carry values to re-own.
  for (const id of STEPPING)
    assert.ok(
      r.data.outputs.some((o) => o.quantityId === id && o.status === "value"),
      `${id} has a value`,
    );
});

function owned(owners: Record<string, string>): Message {
  const message = structuredClone(base);
  for (const o of message.result.data.outputs)
    if (owners[o.quantityId]) o.ownerId = owners[o.quantityId] as string;
  return message;
}
function hostLabel(message: Message): string {
  const view = { accepted: { outputs: message.result.data.outputs } } as unknown as ExperimentView;
  return deriveHostExecution(view, BM06_OUTPUTS, digest, false).label;
}

describe("BM-06 decoder: who stepped the grid", () => {
  it("the host reference as registered: admitted, and the instrument is a host calculation", () => {
    assert.doesNotThrow(() => decodeLabResponse(owned({}), token, digest));
    assert.equal(hostLabel(owned({})), "host");
  });
  it("the field and its diffusion number by fs-wasm.diffusion1d_frames: admitted", () => {
    const both = Object.fromEntries(STEPPING.map((id) => [id, BM06_FRANKENSIM_GRID_OWNER]));
    assert.doesNotThrow(() => decodeLabResponse(owned(both), token, digest));
    // The instrument's own label describes the analytic density, which the host computed.
    assert.equal(hostLabel(owned(both)), "host");
  });
  it("one stepping, two steppers: refused", () => {
    assert.throws(
      () => decodeLabResponse(owned({ gridDensity: BM06_FRANKENSIM_GRID_OWNER }), token, digest),
      /Grid outputs from one stepping name different steppers\./,
    );
  });
  it("an unregistered stepper, or FrankenSim's other export: refused, and the label unavailable", () => {
    for (const other of ["fs-wasm.other_export", "fs-wasm.brownian_frames"]) {
      const both = Object.fromEntries(STEPPING.map((id) => [id, other]));
      assert.throws(() => decodeLabResponse(owned(both), token, digest), /registered owner/);
      assert.equal(hostLabel(owned(both)), "unavailable", other);
    }
  });
  it("FrankenSim claiming the host's comparison of the field: refused", () => {
    for (const id of ["cellMasses", "maxCellMassDifference", "probabilityDensity"])
      assert.throws(
        () => decodeLabResponse(owned({ [id]: BM06_FRANKENSIM_GRID_OWNER }), token, digest),
        /registered owner/,
        id,
      );
  });
});
