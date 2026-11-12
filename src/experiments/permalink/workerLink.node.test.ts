import assert from "node:assert/strict";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import { bm08ReplayFixture, recordBm08Checkpoints } from "../../testing/bm08ReplayHarness.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { createBm08TapeBinding, createBm08WalkthroughTarget } from "../bm08/tape.ts";
import type { ScientificResult } from "../results/types.ts";
import type { PublishedResult } from "../store/instanceStore.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { draftTapeForSettings } from "./draftTape.ts";
import type { TapeV2 } from "./types.ts";
import { prepareWorkerLink } from "./workerLink.ts";

const fixture = await bm08ReplayFixture();
const stops = await recordBm08Checkpoints(fixture, {
  ...fixture.example.parameters,
  seed: "18446744073709551615",
  noiseSeed: "9007199254740993",
});
const last = stops.at(-1);
assert.ok(last);
const recorded = last.tape;

function laboratory() {
  const workers: { worker: Worker; disposed: boolean; requests: number; results: number }[] = [];
  const terminations: Promise<number>[] = [];
  const factory = (): WorkerChannel => {
    const worker = new Worker(
      new URL("../../testing/worker-fixtures/bm08NodeWorker.mjs", import.meta.url),
      { workerData: { digest: fixture.sourceDigest }, execArgv: ["--experimental-strip-types"] },
    );
    const control = { worker, disposed: false, requests: 0, results: 0 };
    workers.push(control);
    return {
      send(message) {
        if ((message as { messageKind?: string }).messageKind === "request") control.requests++;
        worker.postMessage(message);
      },
      listen(receive, failed) {
        const onMessage = (message: unknown) => {
          if ((message as { messageKind?: string }).messageKind === "result") control.results++;
          receive(message);
        };
        worker.on("message", onMessage);
        worker.on("error", failed);
        return () => {
          worker.off("message", onMessage);
          worker.off("error", failed);
        };
      },
      dispose() {
        control.disposed = true;
        terminations.push(worker.terminate());
      },
    };
  };
  const binding = createBm08TapeBinding(fixture.example, factory);
  const session = binding.createSession("worker-link-real-camera");
  const accepted: object[] = [];
  const target = createBm08WalkthroughTarget(binding, session, (settings) =>
    accepted.push(settings),
  );
  return {
    binding,
    session,
    target,
    workers,
    accepted,
    async dispose() {
      session.disconnect();
      await Promise.all(terminations);
    },
  };
}

test("opening a scientific camera permalink is inert; explicit restore verifies a real worker's full recording", {
  timeout: 30000,
}, async (t) => {
  const lab = laboratory();
  t.after(() => lab.dispose());
  const before = lab.session.getSnapshot();
  const original = JSON.stringify(recorded);
  const decoded = decodeTapePermalink(encodeTapePermalink(recorded));
  assert.equal(decoded.kind, "success");
  const incoming = await prepareWorkerLink(lab.binding, decoded.tape);
  assert.equal(incoming.kind, "checkpoint");
  assert.equal(incoming.compatibilityNotice, null);
  assert.equal(incoming.settings.seed, "18446744073709551615");
  assert.equal(incoming.settings.noiseSeed, "9007199254740993");
  assert.equal(incoming.settings.exposure, 0.5);
  assert.equal(incoming.settings.sigma, 0.2e-6);
  assert.equal(lab.workers.length, 0);
  assert.equal(lab.session.getSnapshot(), before);
  assert.deepEqual(lab.accepted, []);

  const result = await lab.target.restore(incoming.replay);
  assert.deepEqual(result, { kind: "restored" });
  assert.equal(lab.workers.length, 2, "one isolated replay worker and one live owner worker");
  assert.deepEqual(
    lab.workers.map((worker) => worker.requests),
    [3, 1],
  );
  assert.deepEqual(
    lab.workers.map((worker) => worker.results),
    [3, 1],
  );
  assert.equal(lab.workers[0]?.disposed, true);
  assert.equal(lab.workers[1]?.disposed, false);
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted);
  assert.notEqual(accepted, before.accepted);
  assert.equal(accepted.parameters.seed, "18446744073709551615");
  for (const id of ["latentWitness", "positions", "pairInterval"]) {
    const actual: PublishedResult | undefined = accepted.outputs.find(
      (output) => output.quantityId === id,
    );
    const expected: ScientificResult | undefined = last.publication.outputs.find(
      (output) => output.quantityId === id,
    );
    assert.ok(
      actual?.status === "value" && typeof actual.value === "object" && "copy" in actual.value,
    );
    assert.ok(expected?.status === "value");
    assert.deepEqual(actual.value.copy(), expected.value, id);
  }
  assert.deepEqual(lab.accepted, [lab.session.acceptedParameters()]);
  assert.equal(JSON.stringify(recorded), original);
  assert.deepEqual(incoming.tape, recorded);
});

test("a damaged scientific checkpoint is checked by a real worker before the accepted laboratory can change", {
  timeout: 30000,
}, async (t) => {
  const lab = laboratory();
  t.after(() => lab.dispose());
  const before = lab.session.getSnapshot();
  const incoming = await prepareWorkerLink(lab.binding, {
    ...recorded,
    acceptedCheckpoint: { ...recorded.acceptedCheckpoint, digest: `host:sha256:${"0".repeat(64)}` },
  });
  assert.equal(incoming.kind, "checkpoint");
  assert.equal(lab.workers.length, 0);
  const result = await lab.target.restore(incoming.replay);
  assert.equal(result.kind, "not-restored");
  assert.match(result.notice, /checkpoint|recording|digest/i);
  assert.equal(lab.session.getSnapshot(), before);
  assert.equal(lab.workers.length, 1);
  assert.equal(lab.workers[0]?.results, 3);
  assert.equal(lab.workers[0]?.disposed, true);
  assert.deepEqual(lab.accepted, []);
});

test("a different recorded source requires an explicit new worker run and keeps the old record unchanged", {
  timeout: 30000,
}, async (t) => {
  const lab = laboratory();
  t.after(() => lab.dispose());
  const before = lab.session.getSnapshot();
  const historical: TapeV2 = {
    ...recorded,
    modelIdentity: { ...recorded.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
  };
  const original = JSON.stringify(historical);
  const incoming = await prepareWorkerLink(lab.binding, historical);
  assert.equal(incoming.kind, "checkpoint");
  assert.match(incoming.compatibilityNotice ?? "", /Recorded artifact:/);
  assert.equal(lab.workers.length, 0);
  assert.equal(lab.session.getSnapshot(), before);
  assert.ok(lab.target.calculate);
  assert.deepEqual(await lab.target.calculate(incoming.settings), { kind: "calculated" });
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted);
  assert.notEqual(accepted.runId, before.accepted?.runId);
  assert.equal(accepted.parentRunId, before.accepted?.runId);
  assert.equal(accepted.parameters.seed, "18446744073709551615");
  assert.equal(accepted.parameters.exposure, 0.5);
  assert.equal(lab.workers.length, 1, "a new calculation does not claim a verification preflight");
  assert.equal(JSON.stringify(historical), original);
  assert.equal(incoming.tape.modelIdentity.artifactDigest, historical.modelIdentity.artifactDigest);
});

test("settings links, exact checkpoint prefixes, and catalogue references remain distinct without executing owners", async (t) => {
  const lab = laboratory();
  t.after(() => lab.dispose());
  const settings = draftTapeForSettings(lab.binding, fixture.example.parameters);
  assert.ok(settings);
  assert.deepEqual(await prepareWorkerLink(lab.binding, settings), {
    kind: "loaded",
    settings: fixture.example.parameters,
  });
  const withLaterEvents: TapeV2 = {
    ...recorded,
    events: [
      ...recorded.events,
      { actionIndex: 3, commandClass: "measurement-change", paramId: "sigma", value: 0.4e-6 },
    ],
  };
  const prefix = await prepareWorkerLink(lab.binding, withLaterEvents);
  assert.equal(prefix.kind, "checkpoint");
  assert.equal(prefix.settings.sigma, 0.2e-6);
  assert.equal(prefix.replay.events.length, 2);
  assert.equal(prefix.tape.events.length, 3);
  const reference: TapeV2 = {
    ...recorded,
    initialConditions: {},
    events: [],
    teachingTapeRef: { tapeId: "camera-bias", stepIndex: 1 },
  };
  const resolved = await prepareWorkerLink(lab.binding, reference, () => ({
    ...recorded,
    teachingTapeRef: { tapeId: "camera-bias", stepIndex: 0 },
  }));
  assert.equal(resolved.kind, "checkpoint");
  assert.deepEqual(resolved.replay.initialConditions, recorded.initialConditions);
  assert.deepEqual(resolved.replay.events, recorded.events);
  assert.equal(resolved.replay.teachingTapeRef, undefined);
  assert.deepEqual(resolved.tape, reference);
  for (const invalid of [
    { ...recorded, experimentId: "bm-07" },
    {
      ...recorded,
      events: [{ ...recorded.events[0], previousValue: 0.75 }, ...recorded.events.slice(1)],
    },
    { ...recorded, initialConditions: { ...recorded.initialConditions, inventedControl: 2 } },
    { ...recorded, events: [...recorded.events].reverse() },
  ]) {
    assert.equal((await prepareWorkerLink(lab.binding, invalid as TapeV2)).kind, "not-restored");
  }
  assert.equal((await prepareWorkerLink(lab.binding, reference, () => null)).kind, "not-restored");
  assert.equal(lab.workers.length, 0);
});
