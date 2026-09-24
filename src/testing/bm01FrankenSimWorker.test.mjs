// BM-01 through a real worker thread whose ensemble is recorded by the pinned FrankenSim module
// (am-frankensim-repin-and-bind-jvhg). The worker is the Node twin of the browser entry
// src/workers/host/bm01Worker.ts: load and verify the module, or fall back to the host recorder.
// The page session (createBm01Session) is the one TracerLab uses, so the accepted snapshot here is
// the snapshot the lab labels. Runs under bun test and node --experimental-strip-types --test.
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { createBm01Session } from "../experiments/bm01/session.ts";
import example from "../generated/bm01-example.json" with { type: "json" };
import { createBm01Recording } from "../workers/operations/bm01.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";

const pinnedPath = resolve(
  "public/wasm",
  PINNED_ARTIFACT.bundleId,
  PINNED_ARTIFACT.hashPrefix,
  PINNED_ARTIFACT.wasmFile,
);
const parameters = { ...BM01_DEFAULTS, M: 60, H: 4, interval: 2, seed: "9007199254740993" };
const out = (s, id) => s.outputs.find((o) => o.quantityId === id);

function factory(wasmPath, bundles) {
  return () => {
    const worker = new Worker(
      new URL("./worker-fixtures/bm01FrankenSimNodeWorker.mjs", import.meta.url),
      {
        workerData: { digest: example.sourceDigest, wasmPath },
        execArgv: ["--experimental-strip-types"],
      },
    );
    return {
      send: (m) => worker.postMessage(m),
      listen: (message, error) => {
        const onMessage = (m) => {
          if (m && typeof m === "object" && "fixtureBundle" in m) bundles.push(m);
          else message(m);
        };
        worker.on("message", onMessage);
        worker.on("error", error);
        return () => {
          worker.off("message", onMessage);
          worker.off("error", error);
        };
      },
      dispose: () => void worker.terminate(),
    };
  };
}

function accepted(session) {
  const first = session.getServerSnapshot().accepted;
  const done = (v) => v.status === "accepted" && v.accepted && v.accepted !== first;
  if (done(session.getSnapshot())) return Promise.resolve(session.getSnapshot());
  return new Promise((resolveView, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`No accepted snapshot: ${JSON.stringify(session.getSnapshot().status)}`));
    }, 20000);
    const off = session.subscribe(() => {
      const v = session.getSnapshot();
      if (v.status === "refused" || v.status === "unavailable") {
        clearTimeout(timer);
        off();
        reject(
          new Error(`Worker path ended ${v.status}: ${JSON.stringify(v.refusal ?? v.outcome)}`),
        );
      }
      if (done(v)) {
        clearTimeout(timer);
        off();
        resolveView(v);
      }
    });
  });
}

test("the worker loads the pinned module and its accepted snapshot names FrankenSim as the owner of the positions", async (t) => {
  const bundles = [];
  const session = createBm01Session("bm01-fs-worker", example, factory(pinnedPath, bundles));
  t.after(() => session.disconnect());
  assert.equal(session.apply(parameters).kind, "accepted");
  const view = await accepted(session);
  assert.deepEqual(bundles, [{ fixtureBundle: "loaded", outcome: null }]);
  assert.equal(out(view.accepted, "tracerPositions").ownerId, "fs-wasm.brownian_frames");
  assert.equal(out(view.accepted, "traceCoordinates").ownerId, "fs-wasm.brownian_frames");
  assert.equal(out(view.accepted, "recordingDraws").ownerId, "fs-wasm.brownian_frames");
  assert.equal(out(view.accepted, "sampleMean").ownerId, "diffusion.ensembleMoments");
  // The published positions are the endpoints of the host reference's recording, within the
  // tolerance frankensimTracerRecorder.test.ts states, and not bitwise identical to it.
  const host = await createBm01Recording(parameters, { yieldControl: async () => {} });
  assert.equal(host.kind, "accepted");
  const published = out(view.accepted, "tracerPositions").value.copy();
  assert.equal(published.length, parameters.M * 3);
  const steps = host.data.setup.steps;
  const amplitude = Math.sqrt(2 * host.data.setup.D * host.data.setup.h);
  const bound = steps * 64 * Number.EPSILON * amplitude;
  const endpoint = Math.round(parameters.interval / parameters.h);
  let equal = 0;
  for (let series = 0; series < parameters.M * 3; series++) {
    const expected = host.data.values[series * (steps + 1) + endpoint];
    const diff = Math.abs(published[series] - expected);
    assert.ok(diff <= bound, `series ${series}: ${diff} > ${bound}`);
    if (diff === 0) equal++;
  }
  assert.ok(
    equal < parameters.M * 3,
    "every endpoint bitwise equal would mean the host recorded it",
  );
});

test("with a module that fails verification the worker falls back, and the snapshot names the host", async (t) => {
  const dir = mkdtempSync(join(process.env.AM_TEST_TMP ?? tmpdir(), "am-bm01-fs-"));
  const tampered = join(dir, "tampered_bg.wasm");
  copyFileSync(pinnedPath, tampered);
  const bytes = readFileSync(tampered);
  bytes[bytes.length - 1] ^= 0xff;
  writeFileSync(tampered, bytes);
  const bundles = [];
  const session = createBm01Session("bm01-fs-fallback", example, factory(tampered, bundles));
  t.after(() => session.disconnect());
  session.apply(parameters);
  const view = await accepted(session);
  assert.deepEqual(bundles, [{ fixtureBundle: "refused", outcome: "artifact-mismatch" }]);
  for (const id of ["tracerPositions", "traceCoordinates", "recordingDraws"])
    assert.equal(out(view.accepted, id).ownerId, "diffusion.recordTracers", id);
});
