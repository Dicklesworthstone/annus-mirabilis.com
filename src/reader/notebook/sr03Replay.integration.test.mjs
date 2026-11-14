import assert from "node:assert/strict";
import test from "node:test";
import { prepareSr03Comparisons } from "../../content/sr03Comparison.ts";
import { sr03ComparisonIdentity } from "../../experiments/sr03/comparison.ts";
import { createSr03ComparisonSession } from "../../experiments/sr03/comparisonSession.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { comparisonReplayAdapter } from "./comparisonAdapters.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { predictionForAccepted, predictionIntent } from "./predictionIntent.ts";
import { replayCompatibility } from "./replayCompatibility.ts";
import {
  captureComparisonReplay,
  parseComparisonReplay,
  verifyReplayEvidence,
} from "./replayEntry.ts";
import { createComparisonReplayRunner } from "./replayRunner.ts";
import { makeReplayEntry, saveComparisonReplay } from "./saveReplay.ts";
import {
  emptyNotebook,
  NOTEBOOK_KEY,
  notebookFrameHref,
  parseNotebookDocument,
  parseNotebookEntry,
} from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";

// Only the Worker transport is replaced. The real SR03 owner, codecs, scheduler, comparison,
// notebook parser/storage and replay admission all execute. This digest is a fixture identity.
const sourceDigest = `source:sha256:${"e".repeat(64)}`;
const examples = await prepareSr03Comparisons(sourceDigest);
const example = examples[0];
assert.ok(example);
const identity = sr03ComparisonIdentity(example.baseline);
const passage = { contentRevision: "a".repeat(64), translationRevision: null };
const words = {
  before: "Private <script>event-notes</script>",
  after: "The same two events need not be simultaneous in both frames.",
  notes: "My signed time-separation explanation",
};

function transport(intercept = (message, deliver) => deliver(message)) {
  const metrics = { created: 0, disposed: 0, failures: [], replies: [] };
  const factory = () => {
    metrics.created++;
    let receive = () => {},
      onError = () => {};
    const host = createSr03Host((message) => {
      metrics.replies.push(structuredClone(message));
      intercept(structuredClone(message), (reply) => receive(structuredClone(reply)));
    }, sourceDigest);
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch((error) => {
          metrics.failures.push(error);
          onError();
        });
      },
      listen(listener, error) {
        receive = listener;
        onError = error;
        queueMicrotask(host.hello);
        return () => {
          receive = () => {};
          onError = () => {};
        };
      },
      dispose() {
        metrics.disposed++;
        host.dispose();
      },
    };
  };
  return { factory, metrics };
}

async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The accepted observer action must finish");
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

async function controlled(pair = example, frames = ["k"]) {
  const io = transport();
  const controller = createSr03ComparisonSession(
    `saved-observer-${crypto.randomUUID()}`,
    pair,
    io.factory,
  );
  controller.connect();
  assert.equal(controller.start(), true);
  await until(() => !controller.getSnapshot().pending);
  for (const frame of frames) {
    const previous = controller.getSnapshot();
    const requested = { ...previous.baseline.parameters, measuringFrame: frame };
    const intent = predictionIntent("smaller", previous, requested);
    assert.equal(controller.apply(requested), true);
    assert.equal(predictionForAccepted(intent, controller.getSnapshot()), null);
    await until(() => !controller.getSnapshot().pending);
    assert.equal(predictionForAccepted(intent, controller.getSnapshot()), "smaller");
  }
  const state = controller.getSnapshot();
  assert.equal(state.error, "");
  assert.equal(state.result.kind, "accepted");
  controller.disconnect();
  assert.deepEqual(io.metrics.failures, []);
  assert.equal(io.metrics.created, io.metrics.disposed);
  return state;
}

const state = await controlled();
const input = { state, passage, ...words, prediction: "smaller" };
const savedEntry = await makeReplayEntry(input, "observer-saved", "2026-11-13T12:00:00.000Z");

function storage() {
  const records = new Map();
  const backend = {
    get length() {
      return records.size;
    },
    key: (index) => [...records.keys()][index] ?? null,
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
    clear: () => records.clear(),
  };
  const context = createStorageContext({ getStorage: () => backend });
  return { records, store: () => createNotebookStore(createNotebookStorage(context)) };
}
function runner(replay, io, patch = {}) {
  return createComparisonReplayRunner(replay, {
    instrumentId: "sr-03",
    example: example.baseline,
    identity,
    workerFactory: io.factory,
    ...patch,
  });
}
async function finish(run, allowChanged = false) {
  await run.start(allowChanged);
  await until(() => !["checking", "baseline", "variant"].includes(run.getSnapshot().phase));
  return run.getSnapshot();
}

test("observer save → storage reload → JSON export/import → explicit replay preserves fixed events and inapplicable length", async () => {
  const saved = storage();
  assert.equal((await saveComparisonReplay(saved.store(), input)).ok, true);
  assert.deepEqual([...saved.records.keys()], [NOTEBOOK_KEY]);
  const loaded = saved.store();
  loaded.open();
  const document = parseNotebookDocument(
    JSON.parse(exportNotebookJson(loaded.getSnapshot().document)),
  );
  const entry = document.entries[0];
  assert.equal(entry.frame.paper, "special-relativity");
  assert.equal(entry.frame.anchor, "arg-sr-rod-events");
  assert.equal(entry.replay.kind, "sr03-comparison");
  assert.equal(entry.replay.tape.seed, "0");
  assert.equal(Object.hasOwn(entry.replay.tape.initialConditions, "seed"), false);
  assert.equal(entry.replay.tape.replayGrid, undefined);
  assert.deepEqual(entry.replay.tape.events, [
    {
      actionIndex: 1,
      commandClass: "observer-change",
      paramId: "measuringFrame",
      previousValue: "K",
      value: "k",
    },
  ]);
  assert.equal(
    entry.replay.tape.predictions[0].promptId,
    "sr-03-predict-comparison-time-separation",
  );
  assert.deepEqual(entry.replay.tape.predictions[0].payload, { candidateId: "smaller" });
  assert.deepEqual(entry.replay.passage, passage);
  assert.equal(entry.replay.explanationBefore, words.before);
  assert.equal(entry.replay.baseline.outputs.temporalSeparationK.value, 0);
  assert.equal(entry.replay.variant.outputs.temporalSeparationKPrime.value, -7.5);
  assert.equal(entry.replay.baseline.outputs.measuredLength.value, 10);
  assert.equal(entry.replay.variant.outputs.measuredLength.status, "not-applicable");
  assert.equal(entry.replay.variant.outputs.measuredLength.value, null);
  assert.ok(entry.replay.variant.outputs.measuredLength.reason.length > 0);
  assert.equal(await verifyReplayEvidence(entry.replay), true);
  const before = JSON.stringify(entry);
  const io = transport();
  const run = runner(entry.replay, io);
  assert.equal(io.metrics.created, 0);
  const result = await finish(run);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "matching-scalars");
  assert.equal(result.baseline.runId, result.variant.runId);
  assert.notEqual(result.baseline.instanceId, entry.replay.baseline.instanceId);
  assert.equal(
    result.variant.outputs.measuredLength.reason,
    entry.replay.variant.outputs.measuredLength.reason,
  );
  assert.match(result.message, /same fixed event pair/);
  assert.doesNotMatch(result.message, /particles|paths/);
  assert.equal(JSON.stringify(entry), before);
  assert.equal(io.metrics.created, 1);
  assert.equal(io.metrics.disposed, 1);
  assert.deepEqual(io.metrics.failures, []);
  run.dispose();
});

test("reverse observer and lightlike records survive JSON with typed reasons and zero interval", async () => {
  const reverse = { ...example, baseline: example.variant, variant: example.baseline };
  const lightlike = examples.find((pair) => pair.id === "lightlike");
  assert.ok(lightlike);
  for (const [pair, frames] of [
    [reverse, ["K"]],
    [lightlike, ["k"]],
  ]) {
    const accepted = await controlled(pair, frames);
    const raw = await makeReplayEntry({ ...input, state: accepted });
    const entry = parseNotebookEntry(JSON.parse(JSON.stringify(raw)));
    assert.equal(await verifyReplayEvidence(entry.replay), true);
    if (pair === reverse) {
      assert.equal(entry.replay.baseline.outputs.measuredLength.status, "not-applicable");
      assert.equal(entry.replay.baseline.outputs.measuredLength.value, null);
      assert.equal(entry.replay.variant.outputs.measuredLength.value, 10);
    } else {
      assert.equal(entry.replay.baseline.outputs.spacetimeIntervalSquared.value, 0);
      assert.equal(entry.replay.variant.outputs.spacetimeIntervalSquared.value, 0);
    }
    const io = transport();
    const run = runner(entry.replay, io);
    assert.equal((await finish(run)).reproduction, "matching-scalars");
    run.dispose();
  }
});

test("unchanged descriptions and a genuine K → k → K return admit an empty minimal recipe", async () => {
  for (const frames of [[], ["k", "K"]]) {
    const accepted = await controlled(example, frames);
    const replay = await captureComparisonReplay(accepted, passage, words);
    assert.equal(replay.tape.events.length, 0);
    assert.equal(replay.variant.revisions.observer >= replay.baseline.revisions.observer, true);
    const io = transport();
    const run = runner(JSON.parse(JSON.stringify(replay)), io);
    assert.equal((await finish(run)).reproduction, "matching-scalars");
    run.dispose();
    for (const key of ["instanceId", "runId"]) {
      const changed = structuredClone(replay);
      changed.variant[key] += "-other";
      assert.equal(await verifyReplayEvidence(changed), true);
      assert.throws(() => parseComparisonReplay(changed), {
        code: "invalid-replay-comparison-evidence",
      });
    }
    if (frames.length > 0) {
      const changed = structuredClone(replay);
      changed.baseline.revisions.observer = changed.variant.revisions.observer + 1;
      assert.throws(() => parseComparisonReplay(changed), {
        code: "invalid-replay-comparison-evidence",
      });
    }
  }
});

test("(replayEntry.ts:343) saved observer admission rejects tampered physical revisions and stale observer identity before any owner", async () => {
  for (const revision of ["input", "measurement", "estimator", "observer"]) {
    const changed = structuredClone(savedEntry.replay);
    changed.variant.revisions[revision] =
      revision === "observer"
        ? changed.baseline.revisions.observer
        : changed.variant.revisions[revision] + 1;
    if (revision === "input") {
      changed.variant.acceptedInputRevision = changed.variant.revisions.input;
      changed.tape.acceptedCheckpoint.acceptedInputRevision = changed.variant.revisions.input;
    }
    assert.equal(await verifyReplayEvidence(changed), true);
    const io = transport();
    assert.throws(() => runner(changed, io), { code: "invalid-replay-comparison-evidence" });
    assert.equal(io.metrics.created, 0);
  }
  for (const key of ["modelVersion", "sourceDigest", "artifactDigest", "executionLabel"]) {
    const changed = structuredClone(savedEntry.replay);
    changed.variant.identity[key] =
      key === "sourceDigest" ? `source:sha256:${"f".repeat(64)}` : "other";
    assert.throws(() => parseComparisonReplay(changed));
  }
});

test("frame-dependent event selection, fabricated output owners, and seed laundering cannot enter SR03 replay", async () => {
  for (const slot of ["baseline", "variant", "tape"]) {
    const changed = structuredClone(savedEntry.replay);
    const parameters = slot === "tape" ? changed.tape.initialConditions : changed[slot].parameters;
    parameters.endpointPairId = "frame-simultaneous";
    assert.throws(() => parseComparisonReplay(changed), { code: "observer-comparison-evidence" });
  }
  for (const seed of ["1", "18446744073709551615"]) {
    const changed = structuredClone(savedEntry.replay);
    changed.tape.seed = seed;
    assert.throws(() => parseComparisonReplay(changed), /identity/);
  }
  const fabricated = structuredClone(savedEntry.replay);
  for (const side of ["baseline", "variant"])
    fabricated[side].outputs.temporalSeparationK.evidence.ownerId = "unregistered-owner";
  assert.throws(() => parseComparisonReplay(fabricated), {
    code: "invalid-replay-comparison-evidence",
  });
  const io = transport();
  const run = runner(savedEntry.replay, io, {
    example: {
      ...example.baseline,
      parameters: { ...example.baseline.parameters, endpointPairId: "frame-simultaneous" },
    },
  });
  assert.equal((await finish(run)).phase, "failed");
  assert.equal(io.metrics.created, 0);
  run.dispose();
});

test("a corrupt scalar checkpoint or changed current model keeps saved evidence separate", async () => {
  const changed = structuredClone(savedEntry.replay);
  changed.baseline.outputs.measuredLength.value = 11;
  let io = transport();
  let run = runner(changed, io);
  const corrupt = await finish(run);
  assert.equal(corrupt.phase, "failed");
  assert.match(corrupt.message, /checkpoint/);
  assert.equal(io.metrics.created, 0);
  run.dispose();
  io = transport();
  run = runner(savedEntry.replay, io, { identity: { ...identity, modelVersion: "sr03-next" } });
  assert.equal((await finish(run)).phase, "failed");
  assert.equal(io.metrics.created, 0);
  const fresh = await finish(run, true);
  assert.equal(fresh.phase, "complete", fresh.message);
  assert.equal(fresh.reproduction, "new-model");
  assert.equal(savedEntry.replay.baseline.identity.modelVersion, identity.modelVersion);
  run.dispose();
});

test("registered paper/catalogue boundaries keep provenance and escaped private words out of URLs", async () => {
  assert.throws(
    () =>
      parseNotebookEntry({
        ...savedEntry,
        frame: { ...savedEntry.frame, paper: "brownian-motion" },
      }),
    /paper declared by its instrument/,
  );
  const catalogue = await comparisonReplayAdapter("sr-03").loadCatalogue();
  assert.equal(
    replayCompatibility(savedEntry.replay, "arg-sr-rod-events", catalogue).anchor,
    "arg-sr-rod-events",
  );
  assert.equal(replayCompatibility(savedEntry.replay, "arg-bm-observable", catalogue).anchor, null);
  const html = exportNotebookHtml({ ...emptyNotebook(), entries: [savedEntry] });
  assert.match(html, /signed time separation will be smaller/);
  assert.match(html, /&lt;script&gt;event-notes&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(notebookFrameHref(savedEntry.frame), /event-notes/);
  assert.doesNotMatch(JSON.stringify(savedEntry.replay.tape), /event-notes/);
});

test("(comparisonAdapters.ts:341) SR03 and tracer adapters reject a different owner before creating a worker", async () => {
  const io = transport();
  await assert.rejects(
    comparisonReplayAdapter("sr-03").createSession("wrong-owner", {
      instrumentId: "bm-01",
      example: example.baseline,
      identity,
      workerFactory: io.factory,
    }),
    { code: "replay-owner-mismatch" },
  );
  await assert.rejects(
    comparisonReplayAdapter("bm-01").createSession("wrong-owner", {
      instrumentId: "sr-03",
      example: example.baseline,
      identity,
      workerFactory: io.factory,
    }),
    { code: "replay-owner-mismatch" },
  );
  assert.equal(io.metrics.created, 0);
});
