import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createControlledComparison } from "../../experiments/compare/controlledComparison.ts";
import {
  LQ08_COMPARISON,
  lq08ComparisonIdentity,
  verifyLq08Comparison,
} from "../../experiments/lq08/comparison.ts";
import { createLq08Session } from "../../experiments/lq08/session.ts";
import { encodeResult, parseResult } from "../../experiments/results/codec.ts";
import { thresholdFrequencyFromEv } from "../../physics/reference/photoelectric.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { comparisonReplayAdapter, comparisonReplayAdapterForKind } from "./comparisonAdapters.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { createNotebookStore } from "./notebookStore.ts";
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

// Use the real prepared evaluator identity. Every variant below is accepted by the live owner.
const example = JSON.parse(
  await readFile(new URL("../../generated/lq08-example.json", import.meta.url), "utf8"),
);
const identity = lq08ComparisonIdentity(example);
const adapter = comparisonReplayAdapter("lq-08");
const catalogue = await adapter.loadCatalogue();
const passage = catalogue.passages["arg-lq-photoelectric-energy"];
assert.ok(passage);
const words = {
  before: "Private <script>photoelectric-notes</script>",
  after: "More quanta arrive; each still has the same energy at this frequency.",
  notes: "Keep energy per quantum separate from the arrival rate.",
};

function controlled(initial = {}, change = { incidentPower: 0.002 }) {
  const owner = createLq08Session("photoelectric-save-" + crypto.randomUUID(), example);
  assert.equal(owner.apply({ ...example.parameters, ...initial }).kind, "accepted");
  const baseline = owner.getSnapshot().accepted;
  assert.ok(baseline);
  const controller = createControlledComparison(owner, {
    contract: LQ08_COMPARISON,
    identity,
    baseline,
    variant: baseline,
    verifyAccepted: verifyLq08Comparison,
  });
  controller.connect();
  assert.equal(controller.start(), true);
  if (change !== null) assert.equal(controller.apply({ ...baseline.parameters, ...change }), true);
  const state = controller.getSnapshot();
  assert.equal(state.phase, "live");
  assert.equal(state.pending, false);
  assert.equal(state.error, "");
  assert.equal(state.result.kind, "accepted");
  controller.disconnect();
  return state;
}

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

function runner(replay, patch = {}) {
  return createComparisonReplayRunner(replay, {
    instrumentId: "lq-08",
    example,
    identity,
    ...patch,
  });
}

async function finish(run, allowChangedModel = false) {
  await run.start(allowChangedModel);
  const state = run.getSnapshot();
  assert.ok(!["checking", "baseline", "variant"].includes(state.phase));
  return state;
}

const state = controlled();
const input = { state, passage, ...words, prediction: "same" };
const savedEntry = await makeReplayEntry(input, "photoelectric-saved", "2026-11-14T12:00:00.000Z");

test("photoelectric save, storage reload, export/import and explicit replay preserve the one physical change", async () => {
  const saved = storage();
  assert.equal((await saveComparisonReplay(saved.store(), input)).ok, true);
  assert.deepEqual([...saved.records.keys()], [NOTEBOOK_KEY]);
  const loaded = saved.store();
  loaded.open();
  const document = parseNotebookDocument(
    JSON.parse(exportNotebookJson(loaded.getSnapshot().document)),
  );
  const entry = document.entries[0];
  assert.equal(entry.kind, "replay");
  assert.equal(entry.frame.paper, "light-quanta");
  assert.equal(entry.frame.anchor, "arg-lq-photoelectric-energy");
  assert.equal(entry.replay.kind, "lq08-comparison");
  assert.equal(entry.replay.tape.mode, "lq-08:default");
  assert.equal(entry.replay.tape.seed, "0");
  assert.equal(Object.hasOwn(entry.replay.tape.initialConditions, "seed"), false);
  assert.equal(entry.replay.tape.replayGrid, undefined);
  assert.deepEqual(entry.replay.tape.events, [
    {
      actionIndex: 1,
      commandClass: "setup-change",
      paramId: "incidentPower",
      previousValue: 0.001,
      value: 0.002,
    },
  ]);
  assert.equal(
    entry.replay.tape.predictions[0].promptId,
    "lq-08-predict-comparison-quantum-energy",
  );
  assert.deepEqual(entry.replay.tape.predictions[0].payload, { candidateId: "same" });
  assert.deepEqual(entry.replay.passage, passage);
  assert.equal(entry.replay.explanationBefore, words.before);
  assert.equal(
    entry.replay.variant.outputs.quantumEnergy.value,
    entry.replay.baseline.outputs.quantumEnergy.value,
  );
  assert.equal(
    entry.replay.variant.outputs.stoppingPotentialMagnitude.value,
    entry.replay.baseline.outputs.stoppingPotentialMagnitude.value,
  );
  assert.equal(
    entry.replay.variant.outputs.photocurrent.value,
    2 * entry.replay.baseline.outputs.photocurrent.value,
  );
  assert.equal(await verifyReplayEvidence(entry.replay), true);

  const before = JSON.stringify(entry);
  const run = runner(entry.replay);
  assert.equal(run.getSnapshot().phase, "idle");
  assert.equal(run.getSnapshot().baseline, null);
  run.setSchedulingPaused(true);
  const replayed = await finish(run);
  assert.equal(replayed.phase, "complete", replayed.message);
  assert.equal(replayed.reproduction, "matching-scalars");
  assert.notEqual(replayed.baseline.instanceId, entry.replay.baseline.instanceId);
  assert.notEqual(replayed.baseline.runId, replayed.variant.runId);
  assert.deepEqual(replayed.baseline.parameters, entry.replay.baseline.parameters);
  assert.deepEqual(replayed.variant.parameters, entry.replay.variant.parameters);
  assert.deepEqual(replayed.baseline.outputs, entry.replay.baseline.outputs);
  assert.deepEqual(replayed.variant.outputs, entry.replay.variant.outputs);
  assert.equal(JSON.stringify(entry), before);
  assert.doesNotMatch(replayed.message, /particle|paths|worker/i);
  run.dispose();
});

test("frequency and work-function variants replay independently without changing the held apparatus", async () => {
  for (const change of [{ frequency: 8e14 }, { workFunction: 2.5 }]) {
    const accepted = controlled({}, change);
    const replay = await captureComparisonReplay(accepted, passage, words);
    assert.equal(replay.tape.events.length, 1);
    const key = Object.keys(change)[0];
    assert.equal(replay.tape.events[0].paramId, key);
    assert.equal(replay.tape.events[0].commandClass, "setup-change");
    for (const held of Object.keys(example.parameters).filter((name) => name !== key))
      assert.equal(replay.baseline.parameters[held], replay.variant.parameters[held]);
    const run = runner(JSON.parse(JSON.stringify(replay)));
    const replayed = await finish(run);
    assert.equal(replayed.phase, "complete", replayed.message);
    assert.equal(replayed.reproduction, "matching-scalars");
    assert.deepEqual(replayed.variant.outputs, replay.variant.outputs);
    run.dispose();
  }
});

test("below-threshold energies, partial-retarding current and zero power retain distinct typed meanings", async () => {
  const cases = [
    {
      name: "below threshold",
      initial: { frequency: 4.5e14 },
      energyStatus: "not-applicable",
      currentStatus: "value",
      currentValue: 0,
    },
    {
      name: "partly retarding collector",
      initial: { collectorPotential: -0.1 },
      energyStatus: "value",
      currentStatus: "underdetermined",
      currentValue: null,
    },
    {
      name: "collector stops all electrons",
      initial: { collectorPotential: -1 },
      energyStatus: "value",
      currentStatus: "value",
      currentValue: 0,
    },
    {
      name: "zero incident power",
      initial: { incidentPower: 0 },
      energyStatus: "value",
      currentStatus: "value",
      currentValue: 0,
    },
  ];
  for (const item of cases) {
    const accepted = controlled(item.initial);
    const entry = await makeReplayEntry({ ...input, state: accepted, prediction: null });
    const restored = parseNotebookEntry(JSON.parse(JSON.stringify(entry)));
    const baseline = restored.replay.baseline.outputs;
    assert.equal(baseline.maxKineticEnergy.status, item.energyStatus, item.name);
    assert.equal(baseline.stoppingPotentialMagnitude.status, item.energyStatus, item.name);
    assert.equal(baseline.photocurrent.status, item.currentStatus, item.name);
    assert.equal(baseline.photocurrent.value, item.currentValue, item.name);
    if (item.energyStatus === "not-applicable") {
      assert.equal(baseline.maxKineticEnergy.value, null);
      assert.match(baseline.maxKineticEnergy.reason, /no emitted electron/);
      assert.equal(baseline.emissionRate.value, 0);
    }
    if (item.currentStatus === "underdetermined") {
      assert.ok(baseline.photocurrent.evidence.compatibleFamily.length > 0);
      assert.ok(baseline.photocurrent.evidence.neededInformation.length > 0);
      assert.equal(baseline.photocurrent.evidence.status, "underdetermined");
    }
    if (item.initial.incidentPower === 0) {
      assert.equal(baseline.quantumRate.value, 0);
      assert.equal(baseline.emissionRate.value, 0);
      assert.ok(baseline.quantumEnergy.value > 0);
      assert.ok(baseline.maxKineticEnergy.value > 0);
    }
    const run = runner(restored.replay);
    const replayed = await finish(run);
    assert.equal(replayed.phase, "complete", replayed.message);
    assert.equal(replayed.reproduction, "matching-scalars");
    assert.deepEqual(replayed.baseline.outputs, restored.replay.baseline.outputs);
    assert.deepEqual(replayed.variant.outputs, restored.replay.variant.outputs);
    run.dispose();
  }
});

test("the exact threshold remains a numeric zero energy rather than becoming an absent electron", async () => {
  const threshold = thresholdFrequencyFromEv(example.parameters.workFunction);
  assert.equal(threshold.status, "value");
  const accepted = controlled({ frequency: threshold.value });
  const replay = await captureComparisonReplay(accepted, passage, words);
  for (const side of [replay.baseline, replay.variant]) {
    assert.equal(side.outputs.maxKineticEnergy.status, "value");
    assert.equal(side.outputs.maxKineticEnergy.value, 0);
    assert.equal(side.outputs.stoppingPotentialMagnitude.status, "value");
    assert.equal(side.outputs.stoppingPotentialMagnitude.value, 0);
  }
  const run = runner(JSON.parse(JSON.stringify(replay)));
  assert.equal((await finish(run)).reproduction, "matching-scalars");
  run.dispose();
});

test("an unchanged accepted pair has an empty recipe and still explicitly recalculates", async () => {
  const accepted = controlled({}, null);
  const replay = await captureComparisonReplay(accepted, passage, words);
  assert.equal(replay.tape.events.length, 0);
  const run = runner(replay);
  const replayed = await finish(run);
  assert.equal(replayed.reproduction, "matching-scalars");
  assert.notEqual(replayed.baseline.instanceId, replay.baseline.instanceId);
  assert.equal(replayed.baseline.runId, replayed.variant.runId);
  run.dispose();
});

test("the synchronous registered owner needs no worker and recomputes a stale prepared readout", async () => {
  const current = await adapter.loadCurrentOwner();
  assert.equal(current.instrumentId, "lq-08");
  assert.equal(Object.hasOwn(current, "workerFactory"), false);
  assert.equal(current.identity.sourceDigest, example.sourceDigest);
  assert.equal(current.identity.executionLabel, "host-calculation");
  assert.equal(current.identity.artifactDigest, null);
  assert.equal(comparisonReplayAdapterForKind("lq08-comparison"), adapter);
  const stale = {
    ...example,
    results: example.results.map((raw) => {
      const result = parseResult(raw);
      return encodeResult(
        result.quantityId === "quantumEnergy" ? { ...result, value: result.value * 2 } : result,
      );
    }),
  };
  const run = runner(savedEntry.replay, { example: stale });
  const replayed = await finish(run);
  assert.equal(replayed.phase, "complete", replayed.message);
  assert.equal(replayed.reproduction, "matching-scalars");
  assert.equal(
    replayed.baseline.outputs.quantumEnergy.value,
    savedEntry.replay.baseline.outputs.quantumEnergy.value,
  );
  run.dispose();
});

test("a corrupt checkpoint, changed model or mismatched prepared identity cannot replace saved evidence", async () => {
  const original = JSON.stringify(savedEntry);
  const corrupt = structuredClone(savedEntry.replay);
  const digest = corrupt.tape.acceptedCheckpoint.digest;
  corrupt.tape.acceptedCheckpoint.digest = digest.slice(0, -1) + (digest.endsWith("0") ? "1" : "0");
  let run = runner(corrupt);
  let result = await finish(run);
  assert.equal(result.phase, "failed");
  assert.match(result.message, /checkpoint/);
  assert.equal(result.baseline, null);
  run.dispose();

  run = runner(savedEntry.replay, { identity: { ...identity, modelVersion: "lq08-next-model" } });
  result = await finish(run);
  assert.equal(result.phase, "failed");
  assert.match(result.message, /model has changed/);
  result = await finish(run, true);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "new-model");
  run.dispose();

  run = runner(savedEntry.replay, {
    example: { ...example, sourceDigest: "source:sha256:" + "f".repeat(64) },
  });
  result = await finish(run);
  assert.equal(result.phase, "failed");
  assert.match(result.message, /different versions/);
  assert.equal(result.baseline, null);
  assert.equal(JSON.stringify(savedEntry), original);
  run.dispose();
});

test("(comparisonAdapters.ts:291) photoelectric replay requires complete valid apparatus settings", () => {
  assert.deepEqual(adapter.parameters(example.parameters), example.parameters);
  const missingFrequency = Object.fromEntries(
    Object.entries(example.parameters).filter(([key]) => key !== "frequency"),
  );
  for (const parameters of [
    missingFrequency,
    { ...example.parameters, seed: "0" },
    { ...example.parameters, frequency: 0 },
    { ...example.parameters, frequency: Number.NaN },
    { ...example.parameters, quantumEfficiency: 1.1 },
    { ...example.parameters, collectorPotential: -100 },
  ]) {
    assert.throws(() => adapter.parameters(parameters), { code: "invalid-replay-parameters" });
  }
});

test("(comparisonAdapters.ts:302) extra changes, arbitrary seeds, foreign owners and fabricated evidence are refused", async () => {
  const extra = structuredClone(savedEntry.replay);
  extra.variant.parameters.frequency = 8e14;
  assert.throws(() => parseComparisonReplay(extra));
  for (const seed of ["1", "18446744073709551615"]) {
    const changed = structuredClone(savedEntry.replay);
    changed.tape.seed = seed;
    assert.throws(() => parseComparisonReplay(changed), /identity/);
  }
  const fabricated = structuredClone(savedEntry.replay);
  for (const side of ["baseline", "variant"])
    fabricated[side].outputs.quantumEnergy.evidence.ownerId = "unregistered-photoelectric-owner";
  assert.throws(() => parseComparisonReplay(fabricated), {
    code: "invalid-replay-comparison-evidence",
  });
  const unchanged = await captureComparisonReplay(controlled({}, null), passage, words);
  for (const [key, value] of [
    ["quantumEfficiency", 0.2],
    ["collectorPotential", -0.1],
  ]) {
    const locked = structuredClone(unchanged);
    locked.variant.parameters[key] = value;
    assert.throws(() => parseComparisonReplay(locked), /held fixed/);
  }
  const workerFactory = () => assert.fail("A foreign replay owner must be refused before work");
  await assert.rejects(
    adapter.createSession("wrong-owner", {
      instrumentId: "bm-01",
      example,
      identity,
      workerFactory,
    }),
    { code: "replay-owner-mismatch" },
  );
  await assert.rejects(
    comparisonReplayAdapter("bm-01").createSession("wrong-owner", {
      instrumentId: "lq-08",
      example,
      identity,
    }),
    { code: "replay-owner-mismatch" },
  );
  assert.throws(() => runner(savedEntry.replay, { instrumentId: "bm-01", workerFactory }), {
    code: "replay-owner-mismatch",
  });
});

test("stopping during checkpoint admission cancels the pending synchronous replay", async () => {
  const run = runner(savedEntry.replay);
  const pending = run.start();
  run.stop();
  await pending;
  assert.equal(run.getSnapshot().phase, "stopped");
  assert.equal(run.getSnapshot().baseline, null);
  const resumed = await finish(run);
  assert.equal(resumed.phase, "complete", resumed.message);
  assert.equal(resumed.reproduction, "matching-scalars");
  run.dispose();
});

test("the light-quanta catalogue and readable export retain source ownership and private words", () => {
  assert.equal(
    replayCompatibility(savedEntry.replay, "arg-lq-photoelectric-energy", catalogue).anchor,
    "arg-lq-photoelectric-energy",
  );
  assert.equal(replayCompatibility(savedEntry.replay, "arg-bm-observable", catalogue).anchor, null);
  assert.throws(
    () =>
      parseNotebookEntry({
        ...savedEntry,
        frame: { ...savedEntry.frame, paper: "brownian-motion" },
      }),
    /paper declared by its instrument/,
  );
  const html = exportNotebookHtml({ ...emptyNotebook(), entries: [savedEntry] });
  assert.match(html, /Energy per quantum will stay the same/);
  assert.match(html, /&lt;script&gt;photoelectric-notes&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(notebookFrameHref(savedEntry.frame), /photoelectric-notes/);
  assert.doesNotMatch(JSON.stringify(savedEntry.replay.tape), /photoelectric-notes/);
});
