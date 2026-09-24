/**
 * BM-01 recorded by FrankenSim's brownian_frames against the host reference
 * (am-frankensim-repin-and-bind-jvhg). Runs under bun test and node --experimental-strip-types --test.
 *
 * Stated tolerance, and why it is not bitwise. The two recorders draw the same Philox integers.
 * Those are bitwise identical, and the 315-vector test in frankensimCalls.test.ts proves it.
 * Their normal transforms differ, though: FrankenSim uses fs-math's deterministic ln and cos,
 * and the host uses Math. philox.vectors.json already records the normals themselves as
 * "tolerance, not bitwise". So each position is compared with
 *   |x_frankensim - x_host| <= steps * 64 * eps * amplitude,   amplitude = sqrt(2 D h),
 * i.e. at most 64 ulps of one step's scale per step accumulated. Measured at the BM-01 defaults
 * (400 tracers, 500 steps): 27% of positions are bitwise equal, and the largest difference is
 * 3.6e-14 amplitude, about 200 times inside the bound.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { before, describe, it } from "node:test";
import {
  BM01_DEFAULTS,
  BM01_FRANKENSIM_RECORDER_OWNER,
  BM01_HOST_RECORDER_OWNER,
  BM01_OUTPUTS,
  type Bm01Parameters,
} from "../../experiments/bm01/definition.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { type Bm01Recorder, createBm01Recording, measureBm01 } from "../operations/bm01.ts";
import { BM01_PROTOCOL, decodeLabResponse } from "../protocol/bm01.ts";
import { FRANKENSIM_NORMAL_VERSION, frankensimTracerRecorder } from "./frankensimTracerRecorder.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";
import { loadPinnedBundle } from "./pinnedBundle.ts";

const wasmPath = resolve(
  "public/wasm",
  PINNED_ARTIFACT.bundleId,
  PINNED_ARTIFACT.hashPrefix,
  PINNED_ARTIFACT.wasmFile,
);
const quiet = { yieldControl: async () => {} };
let fs: Bm01Recorder;

before(async () => {
  const loaded = await loadPinnedBundle({ wasmUrl: wasmPath, readBytes: (p) => readFile(p) });
  if (loaded.kind !== "loaded") throw new Error(loaded.message);
  fs = frankensimTracerRecorder(loaded.exports);
});

describe("FrankenSim records BM-01's ensemble in the host's layout", () => {
  it("agrees with the host reference position by position within the stated tolerance, at 3 settings", async () => {
    const settings: Bm01Parameters[] = [
      BM01_DEFAULTS,
      { ...BM01_DEFAULTS, seed: "18446744073709551615" },
      { ...BM01_DEFAULTS, M: 50, H: 40, h: 0.05, T: 310, eta: 0.002 },
    ];
    for (const p of settings) {
      const host = await createBm01Recording(p, quiet);
      const frank = await createBm01Recording(p, quiet, fs);
      assert.equal(host.kind, "accepted");
      assert.equal(frank.kind, "accepted");
      if (host.kind !== "accepted" || frank.kind !== "accepted") return;
      assert.deepEqual(frank.data.setup, host.data.setup);
      assert.equal(frank.data.draws, host.data.draws);
      assert.equal(frank.data.allocationId, host.data.allocationId);
      assert.equal(frank.data.normalVersion, FRANKENSIM_NORMAL_VERSION);
      const a = host.data.values;
      const b = frank.data.values;
      assert.equal(b.length, a.length);
      const amplitude = Math.sqrt(2 * host.data.setup.D * host.data.setup.h);
      const absolute = host.data.setup.steps * 64 * Number.EPSILON * amplitude;
      let equal = 0;
      let worst = 0;
      for (let i = 0; i < a.length; i++) {
        const v = withinTolerance(b[i] ?? Number.NaN, a[i] ?? Number.NaN, {
          absolute,
          relative: 1e-12,
          relativeTo: "larger",
        });
        assert.equal(v.ok, true, `setting seed ${p.seed}, value ${i}: ${JSON.stringify(v)}`);
        if (a[i] === b[i]) equal++;
        worst = Math.max(worst, Math.abs((b[i] ?? 0) - (a[i] ?? 0)));
      }
      // Not bitwise overall (the normal transforms differ), and not wildly different either.
      assert.ok(equal > 0 && equal < a.length, `bitwise-equal ${equal} of ${a.length}`);
      assert.ok(worst < absolute / 10, `worst ${worst} against bound ${absolute}`);
    }
  });

  it("admits exactly what the host admits: same kind and same code, for 10 setups", async () => {
    const setups: Bm01Parameters[] = [
      BM01_DEFAULTS,
      { ...BM01_DEFAULTS, M: 1 },
      { ...BM01_DEFAULTS, M: 10000, H: 1, h: 0.1 },
      { ...BM01_DEFAULTS, M: 10000, H: 10, h: 0.02 },
      { ...BM01_DEFAULTS, M: 2000, H: 10, h: 0.02 },
      // 1000 tracers x 501 samples x 3 axes = 1,503,000 values: over the site's 8 MiB budget
      // (1,048,576 values) but under FrankenSim's own (2,097,152). Only the site's admission can
      // refuse this one, so it is the case that tells the two budgets apart.
      { ...BM01_DEFAULTS, M: 1000, H: 10, h: 0.02 },
      { ...BM01_DEFAULTS, M: 0 },
      { ...BM01_DEFAULTS, seed: "not-a-seed" },
      { ...BM01_DEFAULTS, h: 0 },
      { ...BM01_DEFAULTS, T: -1 },
    ];
    const code = (r: Awaited<ReturnType<typeof createBm01Recording>>) =>
      r.kind === "accepted"
        ? "accepted"
        : r.kind === "refused"
          ? `refused:${r.refusal.code}`
          : `outcome:${r.outcome.outcome}`;
    const kinds = new Set<string>();
    for (const p of setups) {
      const host = await createBm01Recording(p, quiet);
      const frank = await createBm01Recording(p, quiet, fs);
      assert.equal(code(frank), code(host), JSON.stringify(p));
      kinds.add(code(host));
    }
    // The grid exercises accepted, refused and budget outcomes, not only one of them.
    assert.ok(kinds.has("accepted"));
    assert.ok([...kinds].some((k) => k.startsWith("refused:")));
    assert.ok(kinds.has("outcome:budget-exhausted"));
  });

  it("the measured snapshot names FrankenSim for the recording's three outputs only, and the BM-01 decoder admits it", async () => {
    const p = { ...BM01_DEFAULTS, M: 40, H: 2, interval: 1 };
    const rec = await createBm01Recording(p, quiet, fs);
    assert.equal(rec.kind, "accepted");
    if (rec.kind !== "accepted") return;
    const m = measureBm01(rec.data, p, false, fs.ownerId);
    assert.equal(m.kind, "accepted");
    if (m.kind !== "accepted") return;
    const owners = new Map(m.data.outputs.map((o) => [o.quantityId, o.ownerId]));
    for (const id of ["tracerPositions", "traceCoordinates", "recordingDraws"])
      assert.equal(owners.get(id), BM01_FRANKENSIM_RECORDER_OWNER, id);
    // Every other output keeps its registered host owner: FrankenSim computed the positions, and
    // the statistics are host reductions of them.
    for (const [id, owner] of owners)
      if (!["tracerPositions", "traceCoordinates", "recordingDraws"].includes(id))
        assert.equal(owner, BM01_OUTPUTS[id]?.ownerId, id);
    assert.equal(owners.get("sampleMean"), "diffusion.ensembleMoments");
    const token = {
      experimentId: "bm-01",
      instanceId: "fs-test",
      runId: "run-fs",
      parentRunId: null,
      actionIndex: 1,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: p,
    };
    const digest = `source:sha256:${"b".repeat(64)}`;
    const message = {
      messageKind: "result",
      protocolVersion: BM01_PROTOCOL,
      sourceDigest: digest,
      token,
      result: m,
    };
    assert.doesNotThrow(() => decodeLabResponse(structuredClone(message), token, digest));
    // The same snapshot with one recording output claiming the host is refused.
    const mixed = structuredClone(message);
    const draws = mixed.result.data.outputs.find(
      (o: { quantityId: string }) => o.quantityId === "recordingDraws",
    ) as { ownerId: string };
    draws.ownerId = BM01_HOST_RECORDER_OWNER;
    assert.throws(() => decodeLabResponse(mixed, token, digest), /different producers/);
  });
});
