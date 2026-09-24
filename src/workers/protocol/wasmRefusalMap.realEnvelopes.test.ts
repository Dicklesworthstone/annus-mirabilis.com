/**
 * The mapper against envelopes the compiled module actually emits (am-frankensim-repin-and-bind-jvhg).
 *
 * Each envelope below is verbatim output of the pinned artifact at FrankenSim 01824653
 * (public/wasm/fs-annus-diffusion/80a1f8fda6f69003), captured 2026-09-24 by calling the export
 * with the inputs named in the case. Upstream at that revision emits the registered code itself,
 * not the condition names in docs/FRANKENSIM_BINDING.md 5.4, and writes philox's budget miss
 * under "execution". Measured against the mapper before this change: 6 of these 7 became
 * malformed-response. Only philox's stream-index-overflow, whose condition name happens to equal
 * its code, mapped. frankensimCalls.test.ts repeats the same cases against the live module.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapFrankenSimRefusalEnvelope } from "./wasmRefusalMap.ts";

const identity = {
  instanceId: "i",
  runId: "r",
  actionIndex: 1,
  revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
};

const REAL: [string, string, "refusal" | "outcome", string, string][] = [
  [
    "brownian_frames unsupported-kernel",
    "brownian_frames",
    "refusal",
    "unsupported-kernel",
    '{"refusal":{"code":"unsupported-kernel","message":"step_kernel 4 is not in {0,1,2,3}","ranked_repairs":["use step_kernel 0 (coin), 1 (uniform), 2 (unit Gaussian teaching), or 3 (Gaussian with exact D)"],"details":{"stepKernel":4}}}',
  ],
  [
    "brownian_frames invalid-parameter (n_particles 0)",
    "brownian_frames",
    "refusal",
    "invalid-parameter",
    '{"refusal":{"code":"invalid-parameter","message":"n_particles must be at least 1","ranked_repairs":["use n_particles >= 1 and steps >= 1"],"details":{"name":"n_particles","value":0}}}',
  ],
  [
    "brownian_frames budget-exhausted",
    "brownian_frames",
    "outcome",
    "budget-exhausted",
    '{"refusal":{"code":"budget-exhausted","message":"output length 2097154 exceeds 2097152","ranked_repairs":["use brownian_frames_window with a smaller steps","reduce n_particles"],"details":{"requested":2097154,"allowed":2097152,"unit":"f64-values"}}}',
  ],
  [
    "philox_normals execution budget-exhausted",
    "philox_normals",
    "outcome",
    "budget-exhausted",
    '{"execution":{"code":"budget-exhausted","message":"Requested 1048577 normals exceeds the declared budget of 1048576.","ranked_repairs":["request fewer normals","issue several calls with advancing start_index"],"details":{"requested":1048577,"allowed":1048576,"unit":"normals"}}}',
  ],
  [
    "philox_normals stream-index-overflow",
    "philox_normals",
    "refusal",
    "stream-index-overflow",
    '{"refusal":{"code":"stream-index-overflow","message":"This request would exceed the random stream\'s 64-bit draw counter.","ranked_repairs":["reduce count","lower start_index","start_index=18446744073709551613 count=1 is the last accepted pair"],"details":{"startIndex":"18446744073709551614","draws":"2","maxIndex":"18446744073709551615"}}}',
  ],
  [
    "diffusion1d_frames unsupported-kernel (profile 3)",
    "diffusion1d_frames",
    "refusal",
    "unsupported-kernel",
    '{"refusal":{"code":"unsupported-kernel","message":"profile 3 is not in {0,1,2}","ranked_repairs":["use profile 0 (spike), 1 (step), or 2 (two spikes)"],"details":{"profile":3}}}',
  ],
  [
    "diffusion1d_frames nonfinite-input",
    "diffusion1d_frames",
    "refusal",
    "nonfinite-input",
    '{"refusal":{"code":"nonfinite-input","message":"diffusion must be finite","ranked_repairs":["pass finite diffusion (>= 0) and strictly positive dx and dt"],"details":{"parameterIds":["diffusion","dx","dt"],"name":"diffusion"}}}',
  ],
];

describe("real 01824653 envelopes map to the registered refusal or outcome", () => {
  for (const [name, exportName, kind, code, text] of REAL)
    it(name, () => {
      const upstream = JSON.parse(text);
      const mapped = mapFrankenSimRefusalEnvelope(upstream, identity, exportName);
      if (kind === "refusal") {
        assert.equal(mapped.messageKind, "refusal", JSON.stringify(mapped));
        if (mapped.messageKind !== "refusal") return;
        assert.equal(mapped.refusal.code, code);
        const body = upstream.refusal as { ranked_repairs: string[] };
        // Matched by code, so the upstream's own repairs name the condition that failed.
        assert.deepEqual(
          mapped.refusal.rankedRepairs.map((r) => r.label),
          body.ranked_repairs,
        );
      } else {
        assert.equal(mapped.messageKind, "outcome", JSON.stringify(mapped));
        if (mapped.messageKind === "outcome") assert.equal(mapped.outcome.outcome, code);
      }
    });
});

describe("the mapper still refuses what is not a registered envelope", () => {
  const body = { code: "unsupported-kernel", message: "m", ranked_repairs: [], details: {} };
  it("an execution envelope naming a refusal code", () => {
    const m = mapFrankenSimRefusalEnvelope({ execution: body }, identity, "brownian_frames");
    assert.equal(m.messageKind, "outcome");
    if (m.messageKind === "outcome") assert.equal(m.outcome.outcome, "malformed-response");
  });
  it("two envelope keys", () => {
    const m = mapFrankenSimRefusalEnvelope(
      { refusal: body, execution: body },
      identity,
      "brownian_frames",
    );
    assert.equal(m.messageKind, "outcome");
    if (m.messageKind === "outcome") assert.equal(m.outcome.outcome, "malformed-response");
  });
  it("a registered code another export never emits", () => {
    const m = mapFrankenSimRefusalEnvelope(
      { refusal: { ...body, code: "ftcs-unstable" } },
      identity,
      "philox_normals",
    );
    assert.equal(m.messageKind, "outcome");
    if (m.messageKind === "outcome") assert.equal(m.outcome.outcome, "malformed-response");
  });
});
