/**
 * The real pinned module, called through frankensimCalls.ts (am-frankensim-repin-and-bind-jvhg).
 * Every envelope below is one the compiled module produced; none is typed by hand except in the
 * malformed-output block, which feeds the decoder things the module never emits.
 * Runs under bun test and node --experimental-strip-types --test.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { before, describe, it } from "node:test";
import {
  callBrownianFrames,
  callDiffusion1dFrames,
  callPhiloxNormals,
  decodeFrankenSimResult,
  type FrankenSimExports,
  type FrankenSimResultJs,
  u64FromDecimal,
} from "./frankensimCalls.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";
import { loadPinnedBundle } from "./pinnedBundle.ts";

const wasmPath = resolve(
  "public/wasm",
  PINNED_ARTIFACT.bundleId,
  PINNED_ARTIFACT.hashPrefix,
  PINNED_ARTIFACT.wasmFile,
);
const hex = (x: number) => {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  return v.getBigUint64(0).toString(16).padStart(16, "0");
};
let fs: FrankenSimExports;
let frees = 0;

before(async () => {
  const loaded = await loadPinnedBundle({ wasmUrl: wasmPath, readBytes: (p) => readFile(p) });
  if (loaded.kind !== "loaded") throw new Error(loaded.message);
  const real = loaded.exports;
  // Count free() on every returned object.
  const counted =
    <A extends unknown[]>(f: (...a: A) => FrankenSimResultJs) =>
    (...a: A): FrankenSimResultJs => {
      const r = f(...a);
      return {
        get envelope() {
          return r.envelope;
        },
        get values() {
          return r.values;
        },
        free() {
          frees++;
          r.free();
        },
      };
    };
  fs = {
    brownian_frames: counted(real.brownian_frames.bind(real)),
    philox_normals: counted(real.philox_normals.bind(real)),
    diffusion1d_frames: counted(real.diffusion1d_frames.bind(real)),
    build_identity: () => real.build_identity(),
  };
});

describe("philox_normals through the pinned module", () => {
  it("every one of the 315 recorded positions in philox.vectors.json, bitwise, or a typed overflow", () => {
    const vectors = JSON.parse(
      readFileSync(resolve("src/physics/reference/philox.vectors.json"), "utf8"),
    ) as {
      positions: {
        seed: string;
        streamKernel: number;
        tile: number;
        index: string;
        normalBits: string;
      }[];
    };
    let ok = 0;
    let overflow = 0;
    for (const p of vectors.positions) {
      const r = callPhiloxNormals(fs, {
        seed: p.seed,
        streamKernel: p.streamKernel,
        tile: p.tile,
        startIndex: p.index,
        count: 1,
      });
      if (BigInt(p.index) + 2n > 18446744073709551615n) {
        assert.equal(r.kind, "refused", `${p.seed}/${p.index}`);
        if (r.kind === "refused") assert.equal(r.refusal.code, "stream-index-overflow");
        overflow++;
      } else {
        assert.equal(r.kind, "accepted", `${p.seed}/${p.index}`);
        if (r.kind === "accepted") assert.equal(hex(r.values[0] ?? Number.NaN), p.normalBits);
        ok++;
      }
    }
    assert.equal(vectors.positions.length, 315);
    assert.ok(ok > 0 && overflow > 0);
    assert.equal(ok + overflow, 315);
  });

  it("the budget miss arrives as {execution} and becomes the budget-exhausted outcome, not malformed-response", () => {
    const r = callPhiloxNormals(fs, {
      seed: "1",
      streamKernel: 0,
      tile: 0,
      startIndex: "0",
      count: 1048577,
    });
    assert.equal(r.kind, "outcome");
    if (r.kind === "outcome") assert.equal(r.outcome.outcome, "budget-exhausted");
  });

  it("seeds cross as BigInt: 2^53 and 2^53 + 1 are different streams; non-canonical strings never reach the module", () => {
    const a = callPhiloxNormals(fs, {
      seed: "9007199254740992",
      streamKernel: 0,
      tile: 0,
      startIndex: "0",
      count: 4,
    });
    const b = callPhiloxNormals(fs, {
      seed: "9007199254740993",
      streamKernel: 0,
      tile: 0,
      startIndex: "0",
      count: 4,
    });
    assert.ok(a.kind === "accepted" && b.kind === "accepted");
    if (a.kind === "accepted" && b.kind === "accepted")
      assert.notDeepEqual(Array.from(a.values, hex), Array.from(b.values, hex));
    for (const bad of ["-1", "1e3", " 1", "01", "18446744073709551616", ""]) {
      assert.equal(u64FromDecimal(bad), null, bad);
      const before = frees;
      const r = callPhiloxNormals(fs, {
        seed: bad,
        streamKernel: 0,
        tile: 0,
        startIndex: "0",
        count: 1,
      });
      assert.equal(r.kind, "outcome", bad);
      assert.equal(frees, before, "no module call was made");
    }
    assert.equal(u64FromDecimal("18446744073709551615"), 18446744073709551615n);
  });
});

describe("brownian_frames through the pinned module", () => {
  it("kernel 3 positions are each particle's own philox stream, bitwise, and the object is freed", () => {
    const before = frees;
    const r = callBrownianFrames(fs, {
      nParticles: 3,
      steps: 5,
      stepKernel: 3,
      seed: "9007199254740993",
      diffusion: 5e-13,
      dt: 1 / 64,
    });
    assert.equal(r.kind, "accepted");
    if (r.kind !== "accepted") return;
    assert.equal(r.ok.quantityId, "latentPosition1d");
    assert.equal(r.ok.unit, "metre");
    assert.equal(r.values.length, 18);
    const scale = Math.sqrt(2 * 5e-13 * (1 / 64));
    for (let p = 0; p < 3; p++) {
      const z = callPhiloxNormals(fs, {
        seed: "9007199254740993",
        streamKernel: 0x19050001,
        tile: p,
        startIndex: "0",
        count: 5,
      });
      assert.equal(z.kind, "accepted");
      if (z.kind !== "accepted") return;
      let x = 0;
      assert.equal(r.values[p * 6], 0);
      for (let s = 1; s <= 5; s++) {
        x += (z.values[s - 1] ?? Number.NaN) * scale;
        assert.equal(hex(r.values[p * 6 + s] ?? Number.NaN), hex(x), `particle ${p} step ${s}`);
      }
    }
    assert.equal(frees - before, 4, "one free per returned object");
  });

  it("refusals are typed with the upstream's own repair, and the budget miss is an outcome", () => {
    const k = callBrownianFrames(fs, {
      nParticles: 4,
      steps: 8,
      stepKernel: 4,
      seed: "1",
      diffusion: 5e-13,
      dt: 0.01,
    });
    assert.equal(k.kind, "refused");
    if (k.kind === "refused") {
      assert.equal(k.refusal.code, "unsupported-kernel");
      assert.match(k.refusal.rankedRepairs[0]?.label ?? "", /step_kernel 0/);
    }
    const n = callBrownianFrames(fs, {
      nParticles: 0,
      steps: 8,
      stepKernel: 3,
      seed: "1",
      diffusion: 5e-13,
      dt: 0.01,
    });
    assert.equal(n.kind, "refused");
    if (n.kind === "refused") {
      assert.equal(n.refusal.code, "invalid-parameter");
      assert.match(n.refusal.rankedRepairs[0]?.label ?? "", /n_particles >= 1/);
    }
    const nan = callBrownianFrames(fs, {
      nParticles: 4,
      steps: 8,
      stepKernel: 3,
      seed: "1",
      diffusion: Number.NaN,
      dt: 0.01,
    });
    assert.equal(nan.kind, "refused");
    if (nan.kind === "refused") assert.equal(nan.refusal.code, "nonfinite-input");
    const big = callBrownianFrames(fs, {
      nParticles: 1048577,
      steps: 1,
      stepKernel: 3,
      seed: "1",
      diffusion: 5e-13,
      dt: 0.01,
    });
    assert.equal(big.kind, "outcome");
    if (big.kind === "outcome") assert.equal(big.outcome.outcome, "budget-exhausted");
  });

  it("a negative or fractional count is refused before it reaches the module (wasm-bindgen would wrap it)", () => {
    const before = frees;
    for (const nParticles of [-1, 2.5, 2 ** 32]) {
      const r = callBrownianFrames(fs, {
        nParticles,
        steps: 8,
        stepKernel: 3,
        seed: "1",
        diffusion: 5e-13,
        dt: 0.01,
      });
      assert.equal(r.kind, "refused", String(nParticles));
      if (r.kind === "refused") assert.deepEqual(r.refusal.affected.parameterIds, ["nParticles"]);
    }
    assert.equal(frees, before);
  });
});

describe("diffusion1d_frames through the pinned module", () => {
  it("r just above 0.5 is the typed ftcs-unstable refusal, carried as an envelope; r = 0.5 is accepted", () => {
    const dtUp = (() => {
      const v = new DataView(new ArrayBuffer(8));
      v.setFloat64(0, 0.5);
      v.setBigUint64(0, v.getBigUint64(0) + 1n);
      return v.getFloat64(0);
    })();
    const r = callDiffusion1dFrames(fs, {
      n: 11,
      frames: 3,
      stepsPerFrame: 2,
      diffusion: 0.25,
      dx: 0.5,
      dt: dtUp,
      profile: 0,
    });
    assert.equal(r.kind, "refused");
    if (r.kind !== "refused") return;
    assert.equal(r.refusal.code, "ftcs-unstable");
    assert.ok(Number(r.refusal.details?.ratio) > 0.5);
    assert.equal(r.refusal.details?.upstreamCode, "ftcs-unstable");
    assert.equal(r.refusal.rankedRepairs.length, 3);
    const at = callDiffusion1dFrames(fs, {
      n: 11,
      frames: 3,
      stepsPerFrame: 2,
      diffusion: 0.25,
      dx: 0.5,
      dt: 0.5,
      profile: 0,
    });
    assert.equal(at.kind, "accepted");
    if (at.kind === "accepted") assert.equal(at.values.length, 33);
  });
});

describe("malformed output never becomes a value", () => {
  const ok = (n: number) =>
    JSON.stringify({
      ok: { export: "brownian_frames", valueCount: n, quantityId: "latentPosition1d" },
    });
  const cases: [string, string, Float64Array][] = [
    ["buffer shorter than declared", ok(4), new Float64Array(3)],
    ["a non-finite value", ok(2), Float64Array.from([0, Number.NaN])],
    ["an infinite value", ok(2), Float64Array.from([0, Number.POSITIVE_INFINITY])],
    ["an empty accepted buffer", ok(0), new Float64Array(0)],
    [
      "another export's ok",
      JSON.stringify({ ok: { export: "philox_normals", layout: { length: 1 } } }),
      new Float64Array(1),
    ],
    [
      "values beside a refusal",
      JSON.stringify({
        refusal: { code: "unsupported-kernel", message: "m", ranked_repairs: [], details: {} },
      }),
      new Float64Array(1),
    ],
    ["two keys", JSON.stringify({ ok: {}, refusal: {} }), new Float64Array(0)],
    ["not JSON", "{ok", new Float64Array(0)],
    [
      "an unregistered code",
      JSON.stringify({
        refusal: { code: "made-up", message: "m", ranked_repairs: [], details: {} },
      }),
      new Float64Array(0),
    ],
    [
      "an execution envelope naming a refusal code",
      JSON.stringify({
        execution: { code: "unsupported-kernel", message: "m", ranked_repairs: [], details: {} },
      }),
      new Float64Array(0),
    ],
  ];
  for (const [name, envelope, values] of cases)
    it(name, () => {
      const r = decodeFrankenSimResult("brownian_frames", envelope, values);
      assert.equal(r.kind, "outcome");
      if (r.kind === "outcome") assert.equal(r.outcome.outcome, "malformed-response");
    });
});
