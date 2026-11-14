import assert from "node:assert/strict";
import test from "node:test";
import { createMe03ComparisonSession } from "../../experiments/me03/comparisonSession.ts";
import { ME03_DEFAULTS } from "../../experiments/me03/definition.ts";
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

const adapter = comparisonReplayAdapter("me-03");
const owner = await adapter.loadCurrentOwner();
const catalogue = await adapter.loadCatalogue();
const passage = catalogue.passages[adapter.anchor];
assert.ok(passage);
const words = {
  before: "Private <script>energy-notes</script>",
  after: "The body lost energy, but that energy is still inside the body-plus-radiation boundary.",
  notes: "Moving a boundary changes the account, not the emission.",
};

function controlled(initial = {}, boundary = "combined-isolated-system") {
  const parameters = { ...ME03_DEFAULTS, ...initial };
  const controller = createMe03ComparisonSession(
    `boundary-save-${crypto.randomUUID()}`,
    parameters,
    owner.example,
  );
  controller.connect();
  assert.equal(controller.start(), true);
  if (boundary !== null) assert.equal(controller.apply({ ...parameters, boundary }), true);
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

async function finish(replay, options = owner) {
  const runner = createComparisonReplayRunner(replay, options);
  assert.equal(runner.getSnapshot().phase, "idle");
  assert.equal(runner.getSnapshot().baseline, null);
  runner.setSchedulingPaused(true);
  await runner.start();
  const state = runner.getSnapshot();
  runner.dispose();
  assert.equal(state.phase, "complete", state.message);
  assert.equal(state.reproduction, "matching-scalars");
  return state;
}

const input = { state: controlled(), passage, ...words, prediction: "larger" };
const entry = await makeReplayEntry(input, "boundary-saved", "2026-11-14T12:00:00.000Z");

test("mass–energy save, reload, export/import and replay preserve one measurement change in one emission", async () => {
  const saved = storage();
  assert.equal((await saveComparisonReplay(saved.store(), input)).ok, true);
  assert.deepEqual([...saved.records.keys()], [NOTEBOOK_KEY]);
  const loaded = saved.store();
  loaded.open();
  const document = parseNotebookDocument(
    JSON.parse(exportNotebookJson(loaded.getSnapshot().document)),
  );
  const restored = document.entries[0];
  const replay = restored.replay;
  assert.equal(restored.kind, "replay");
  assert.equal(restored.frame.paper, "mass-energy");
  assert.equal(restored.frame.anchor, "arg-me-small-speed");
  assert.equal(replay.kind, "me03-comparison");
  assert.equal(replay.tape.mode, "me-03:default");
  assert.equal(replay.tape.seed, "0");
  assert.equal(replay.tape.replayGrid, undefined);
  assert.deepEqual(replay.tape.events, [
    {
      actionIndex: 1,
      commandClass: "measurement-change",
      paramId: "boundary",
      previousValue: "body-alone",
      value: "combined-isolated-system",
    },
  ]);
  assert.equal(replay.tape.predictions[0].promptId, "me-03-predict-comparison-energy-change");
  assert.deepEqual(replay.tape.predictions[0].payload, { candidateId: "larger" });
  assert.equal(replay.tape.initialConditions.assignLightMass, "true");
  assert.equal(replay.baseline.parameters.assignLightMass, true);
  assert.equal(replay.baseline.runId, replay.variant.runId);
  assert.equal(replay.baseline.revisions.input, replay.variant.revisions.input);
  assert.ok(replay.variant.revisions.measurement > replay.baseline.revisions.measurement);
  assert.equal(replay.baseline.outputs.energyChange.value, -1);
  assert.equal(replay.variant.outputs.energyChange.value, 0);
  assert.ok(replay.baseline.outputs.massChange.value < 0);
  assert.equal(replay.variant.outputs.massChange.value, 0);
  assert.equal(await verifyReplayEvidence(replay), true);
  const before = JSON.stringify(restored);
  const result = await finish(replay);
  assert.notEqual(result.baseline.instanceId, replay.baseline.instanceId);
  assert.equal(result.baseline.runId, result.variant.runId);
  assert.equal(result.baseline.revisions.input, result.variant.revisions.input);
  assert.ok(result.variant.revisions.measurement > result.baseline.revisions.measurement);
  assert.deepEqual(result.baseline.parameters, replay.baseline.parameters);
  assert.deepEqual(result.variant.parameters, replay.variant.parameters);
  assert.deepEqual(result.baseline.outputs, replay.baseline.outputs);
  assert.deepEqual(result.variant.outputs, replay.variant.outputs);
  assert.equal(JSON.stringify(restored), before);
  assert.doesNotMatch(result.message, /particle|paths|worker/i);
});

test("all three boundaries replay in either direction without turning radiation rest mass into zero", async () => {
  const boundaries = ["body-alone", "radiation", "combined-isolated-system"];
  for (const baselineBoundary of boundaries) {
    for (const boundary of boundaries.filter((candidate) => candidate !== baselineBoundary)) {
      const accepted = controlled({ boundary: baselineBoundary, emittedEnergy: 2 }, boundary);
      const replay = await captureComparisonReplay(accepted, passage, words);
      const result = await finish(JSON.parse(JSON.stringify(replay)));
      for (const side of [result.baseline, result.variant]) {
        assert.equal(side.outputs.radiationMassChange.status, "not-applicable");
        assert.equal(side.outputs.radiationMassChange.value, null);
        assert.ok(side.outputs.radiationMassChange.reason.length > 0);
        assert.equal(side.outputs.systemEnergyChange.value, 0);
        assert.equal(side.outputs.systemMassChange.value, 0);
        if (side.parameters.boundary === "radiation") {
          assert.equal(side.outputs.energyChange.value, 2);
          assert.equal(side.outputs.massChange.status, "not-applicable");
          assert.equal(side.outputs.massChange.value, null);
          assert.equal(side.outputs.massChange.evidence.status, "not-applicable");
        } else {
          assert.equal(side.outputs.massChange.status, "value");
        }
      }
      assert.deepEqual(result.baseline.outputs, replay.baseline.outputs);
      assert.deepEqual(result.variant.outputs, replay.variant.outputs);
    }
  }
});

test("nondefault held settings and both Boolean wire values survive explicit recalculation", async () => {
  for (const disposition of ["escapes", "retained", "partly-retained"]) {
    for (const assignLightMass of [false, true]) {
      const initial = {
        disposition,
        emittedEnergy: 4,
        assignLightMass,
        notation: "modern",
        pulseSystem: "two-collinear",
        pulseEnergy: 2,
        boxMass: 3,
        boxLength: 2,
        magnification: 1e16,
        cardId: "me-03-card-coal",
      };
      const replay = await captureComparisonReplay(controlled(initial), passage, words);
      assert.equal(replay.tape.initialConditions.assignLightMass, String(assignLightMass));
      const result = await finish(replay);
      for (const [key, value] of Object.entries(initial)) {
        assert.equal(result.baseline.parameters[key], value, key);
        assert.equal(result.variant.parameters[key], value, key);
      }
      assert.deepEqual(result.baseline.outputs, replay.baseline.outputs);
      assert.deepEqual(result.variant.outputs, replay.variant.outputs);
    }
  }
});

test("an unchanged pair has no synthetic boundary event and replay can be cancelled before owner creation", async () => {
  const replay = await captureComparisonReplay(controlled({}, null), passage, words);
  assert.deepEqual(replay.tape.events, []);
  const result = await finish(replay);
  assert.equal(result.baseline.runId, result.variant.runId);
  assert.equal(result.baseline.actionIndex, result.variant.actionIndex);
  const runner = createComparisonReplayRunner(entry.replay, owner);
  const pending = runner.start();
  runner.stop();
  await pending;
  assert.equal(runner.getSnapshot().phase, "stopped");
  assert.equal(runner.getSnapshot().baseline, null);
  await runner.start();
  assert.equal(runner.getSnapshot().reproduction, "matching-scalars");
  runner.dispose();
});

test("import refuses altered physical settings, Boolean wire repairs, fabricated owners and numeric radiation mass", () => {
  for (const value of ["TRUE", "1", 1, true, "not-a-boolean"]) {
    const corrupt = structuredClone(entry.replay);
    corrupt.tape.initialConditions.assignLightMass = value;
    assert.throws(() => parseComparisonReplay(corrupt));
  }
  const missing = structuredClone(entry.replay);
  delete missing.tape.initialConditions.assignLightMass;
  assert.throws(() => parseComparisonReplay(missing));
  const drift = structuredClone(entry.replay);
  drift.variant.parameters.emittedEnergy = 2;
  assert.throws(() => parseComparisonReplay(drift));
  const changedRun = structuredClone(entry.replay);
  changedRun.variant.runId = "a-different-emission";
  assert.throws(() => parseComparisonReplay(changedRun), /must preserve the recorded run/);
  const fabricated = structuredClone(entry.replay);
  for (const side of ["baseline", "variant"])
    fabricated[side].outputs.massChange.evidence.ownerId = "invented-energy-owner";
  assert.throws(() => parseComparisonReplay(fabricated), {
    code: "invalid-replay-comparison-evidence",
  });
  const numericRadiation = structuredClone(entry.replay);
  numericRadiation.variant.outputs.radiationMassChange.status = "value";
  numericRadiation.variant.outputs.radiationMassChange.value = 0;
  assert.throws(() => parseComparisonReplay(numericRadiation));
});

test("(comparisonAdapters.ts:413) boundary replay checks source identity, checkpoint and instrument before replacing any saved evidence", async () => {
  assert.equal(comparisonReplayAdapterForKind("me03-comparison"), adapter);
  assert.equal(Object.hasOwn(owner, "workerFactory"), false);
  assert.equal(owner.identity.executionLabel, "host-calculation");
  assert.equal(owner.identity.sourceDigest, catalogue.identity.sourceDigest);
  await assert.rejects(
    adapter.createSession("foreign-owner", { ...owner, instrumentId: "lq-08" }),
    { code: "replay-owner-mismatch" },
  );
  const before = JSON.stringify(entry);
  const corrupt = structuredClone(entry.replay);
  const digest = corrupt.tape.acceptedCheckpoint.digest;
  corrupt.tape.acceptedCheckpoint.digest = digest.slice(0, -1) + (digest.endsWith("0") ? "1" : "0");
  let runner = createComparisonReplayRunner(corrupt, owner);
  await runner.start();
  assert.equal(runner.getSnapshot().phase, "failed");
  assert.equal(runner.getSnapshot().baseline, null);
  assert.match(runner.getSnapshot().message, /checkpoint/);
  runner.dispose();
  runner = createComparisonReplayRunner(entry.replay, {
    ...owner,
    identity: { ...owner.identity, modelVersion: "future-boundary-model" },
  });
  await runner.start();
  assert.equal(runner.getSnapshot().phase, "failed");
  assert.match(runner.getSnapshot().message, /model has changed/);
  await runner.start(true);
  assert.equal(runner.getSnapshot().phase, "complete");
  assert.equal(runner.getSnapshot().reproduction, "new-model");
  runner.dispose();
  runner = createComparisonReplayRunner(entry.replay, {
    ...owner,
    example: { ...owner.example, sourceDigest: "source:sha256:" + "f".repeat(64) },
  });
  await runner.start();
  assert.equal(runner.getSnapshot().phase, "failed");
  assert.equal(runner.getSnapshot().baseline, null);
  assert.match(runner.getSnapshot().message, /different versions/);
  runner.dispose();
  assert.equal(JSON.stringify(entry), before);
});

test("mass–energy passage resolution and readable export keep private explanations out of links and recipes", () => {
  assert.equal(replayCompatibility(entry.replay, adapter.anchor, catalogue).anchor, adapter.anchor);
  assert.equal(
    replayCompatibility(entry.replay, "arg-lq-photoelectric-energy", catalogue).anchor,
    null,
  );
  assert.throws(
    () => parseNotebookEntry({ ...entry, frame: { ...entry.frame, paper: "light-quanta" } }),
    /paper declared by its instrument/,
  );
  const html = exportNotebookHtml({ ...emptyNotebook(), entries: [entry] });
  assert.match(html, /The selected system’s energy change will be larger/);
  assert.match(html, /&lt;script&gt;energy-notes&lt;\/script&gt;/);
  assert.match(html, /not.applicable/i);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(notebookFrameHref(entry.frame), /energy-notes/);
  assert.doesNotMatch(JSON.stringify(entry.replay.tape), /energy-notes/);
});
