import assert from "node:assert/strict";
import test from "node:test";
import { BM07_CLASSES, BM07_DEFAULTS, BM07_OUTPUTS } from "../experiments/bm07/definition.ts";
import { createBm07Session } from "../experiments/bm07/session.ts";
import { createBm07TapeBinding, createBm07WalkthroughTarget } from "../experiments/bm07/tape.ts";
import { bm07CheckpointDigest, bm07ScientificState } from "../experiments/bm07/tapeCheckpoint.ts";
import { draftTapeForSettings, loadDraftTape } from "../experiments/permalink/draftTape.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
} from "../experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createBm07Host } from "../workers/host/bm07Host.ts";
import { createBm07Recording, measureBm07 } from "../workers/operations/bm07.ts";
import { BM07_PROTOCOL, decodeLabHello, decodeLabResponse } from "../workers/protocol/bm07.ts";
import { createHostScheduler } from "../workers/scheduler/hostScheduler.ts";

const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const accept = (value) => {
  assert.equal(value.kind, "accepted", JSON.stringify(value));
  return value.data;
};
const initial = { ...BM07_DEFAULTS, seed: "1909" };
const baseRecording = accept(
  await createBm07Recording(BM07_DEFAULTS, { yieldControl: async () => {} }),
);
const evaluated = accept(await measureBm07(baseRecording, BM07_DEFAULTS, false));
const example = {
  sourceDigest,
  parameters: BM07_DEFAULTS,
  results: evaluated.outputs.map(encodeResult),
  stepIndex: evaluated.stepIndex,
  simulationTime: evaluated.simulationTime,
};

/** Exercise the production host and protocol; only the structured-clone transport is in process. */
function factory(counts, corrupt = (message) => message) {
  return () => {
    counts.created++;
    let listener = null;
    let onError = null;
    const host = createBm07Host(
      (message) => listener?.(corrupt(structuredClone(message))),
      sourceDigest,
    );
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch((error) => onError?.(error));
      },
      listen(onMessage, error) {
        listener = onMessage;
        onError = error;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
          onError = null;
        };
      },
      dispose() {
        counts.disposed++;
        listener = null;
        onError = null;
        host.dispose();
      },
    };
  };
}

function setup(t, id, corrupt) {
  const counts = { created: 0, disposed: 0 };
  const channel = factory(counts, corrupt);
  const binding = createBm07TapeBinding(example, channel);
  const session = createBm07Session(id, example, channel);
  t.after(() => session.disconnect());
  return { binding, session, counts };
}

async function recordStops() {
  const counts = { created: 0, disposed: 0 };
  const binding = createBm07TapeBinding(example, factory(counts));
  const session = binding.createSession("record-bm07-checkpoints");
  const tapes = [],
    publications = [];
  for (const [actionIndex, p] of [initial, { ...initial, radiusKnown: true }].entries()) {
    let publication;
    assert.equal(
      (
        await applyWorkerSettings(session, p, {
          verifyPublication: async (value) => {
            publication = value;
            return null;
          },
        })
      ).kind,
      "restored",
    );
    assert.ok(publication);
    const calculated = await bm07CheckpointDigest(publication, sourceDigest, actionIndex);
    assert.equal(calculated.kind, "digest");
    const draft = draftTapeForSettings(binding, initial);
    assert.ok(draft);
    tapes.push({
      ...draft,
      events:
        actionIndex === 0
          ? []
          : [
              {
                actionIndex: 1,
                commandClass: "estimator-change",
                paramId: "radiusKnown",
                value: "true",
                previousValue: "false",
              },
            ],
      acceptedCheckpoint: {
        acceptedActionIndex: actionIndex,
        acceptedInputRevision: 0,
        digest: calculated.digest,
        scientificState: bm07ScientificState(p),
      },
    });
    publications.push(publication);
  }
  session.disconnect();
  assert.equal(counts.created, counts.disposed);
  return { tapes, publications };
}
const recorded = await recordStops();
const out = (snapshot, id) => snapshot.outputs.find((output) => output.quantityId === id);

test("the direct worker scheduler publishes science without transport metadata and still validates that metadata", async (t) => {
  const store = createInstanceStore({
    experimentId: "bm-07",
    instanceId: "direct-scheduler",
    initialParameters: initial,
    parameterClasses: BM07_CLASSES,
    outputs: BM07_OUTPUTS,
    allowPartial: true,
  });
  const counts = { created: 0, disposed: 0 };
  let corrupt = false;
  const scheduler = createHostScheduler(
    store,
    factory(counts, (message) => {
      if (corrupt && message.messageKind === "result" && message.result.kind === "accepted")
        message.result.data.recordingCheckpoint.seed = "123";
      return message;
    }),
    sourceDigest,
    { version: BM07_PROTOCOL, decodeHello: decodeLabHello, decodeResponse: decodeLabResponse },
  );
  t.after(() => scheduler.dispose());
  const run = async (seed) => {
    const settled = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("Worker did not settle"));
      }, 10000);
      const unsubscribe = store.subscribe(() => {
        if (["accepted", "unavailable"].includes(store.getSnapshot().status)) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(store.getSnapshot());
        }
      });
    });
    scheduler.request(store.issue("setup-change", { seed }));
    return settled;
  };
  const accepted = await run("1909");
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.accepted.outputs.length, Object.keys(BM07_OUTPUTS).length);
  assert.equal(Object.hasOwn(accepted.accepted, "recordingCheckpoint"), false);
  corrupt = true;
  const refused = await run("1910");
  assert.equal(refused.status, "unavailable");
  assert.equal(refused.accepted, accepted.accepted);
});

test("BM07 draft links preserve the complete seed and start no owner; counters describe every real tile", (t) => {
  const { session, binding, counts } = setup(t, "draft-only");
  const p = { ...initial, seed: "18446744073709551615", radiusKnown: true };
  const draft = draftTapeForSettings(binding, p);
  assert.ok(draft);
  const loaded = loadDraftTape(binding, draft);
  assert.equal(loaded.kind, "loaded");
  assert.equal(loaded.settings.seed, p.seed);
  assert.equal(loaded.settings.radiusKnown, true);
  assert.equal(draft.constantSetId, "scenario-bm07-hidden-number");
  assert.equal(counts.created, 0);
  assert.equal(session.getSnapshot(), session.getServerSnapshot());
  const state = bm07ScientificState(p);
  assert.equal(state.seed, p.seed);
  assert.equal(state.streamPositions.length, 4097);
  assert.deepEqual(state.streamPositions[0], {
    allocationId: "bm-07.generator-parameter.v1",
    streamKernelId: "0x19050007",
    tile: "0",
    index: "1",
  });
  assert.ok(
    state.streamPositions
      .slice(1)
      .every(
        (position, step) =>
          position.allocationId === "bm-07.synthetic-latent.v1" &&
          position.streamKernelId === "0x19050003" &&
          position.tile === String(step) &&
          position.index === "4",
      ),
  );
});

test("BM07 both recorded stops restore; declaring a radius keeps the same observations, draws and run", async (t) => {
  const { session, binding } = setup(t, "two-stops");
  assert.deepEqual(await restoreWorkerTape(binding, session, recorded.tapes[0]), {
    kind: "restored",
  });
  const a = session.getSnapshot().accepted;
  assert.equal(out(a, "avogadroNumberEstimate").status, "underdetermined");
  assert.deepEqual(await restoreWorkerTape(binding, session, recorded.tapes[1]), {
    kind: "restored",
  });
  const b = session.getSnapshot().accepted;
  assert.equal(out(b, "avogadroNumberEstimate").status, "value");
  assert.equal(b.runId, a.runId);
  assert.deepEqual(
    out(b, "observationIncrements").value.copy(),
    out(a, "observationIncrements").value.copy(),
  );
  assert.equal(out(b, "recordingDraws").value, 16385);
  assert.equal(out(b, "requestDraws").value, 0);
  assert.equal(out(b, "observationDigest").value, out(a, "observationDigest").value);
  // A different live measurement does not become part of the recorded inference.
  assert.equal((await applyWorkerSettings(session, { ...initial, M: 8, dt: 2 })).kind, "restored");
  assert.equal((await restoreWorkerTape(binding, session, recorded.tapes[1])).kind, "restored");
  assert.deepEqual(
    out(session.getSnapshot().accepted, "observationIncrements").value.copy(),
    out(a, "observationIncrements").value.copy(),
  );
});

test("BM07 corrupt live path or scientific output cannot replace the accepted snapshot after preflight", async (t) => {
  for (const corruptField of ["path", "output"]) {
    const id = `corrupt-${corruptField}`;
    const { session, binding } = setup(t, id, (message) => {
      if (
        message.messageKind === "result" &&
        message.token.instanceId === id &&
        message.result.kind === "accepted"
      ) {
        if (corruptField === "path")
          message.result.data.recordingCheckpoint.digest = `host:sha256:${"f".repeat(64)}`;
        else out(message.result.data, "diffusionCoefficientEstimate").value *= 1.001;
      }
      return message;
    });
    const previous = session.getSnapshot().accepted;
    const result = await restoreWorkerTape(binding, session, recorded.tapes[1]);
    assert.equal(result.kind, "not-restored");
    assert.match(result.notice, /do not match/);
    assert.equal(session.getSnapshot().accepted, previous);
  }
});

test("BM07 rejects incomplete setup, false stream positions and misclassified controls before starting work", async (t) => {
  const { session, binding, counts } = setup(t, "bad-record");
  for (const corrupt of [
    (tape) => {
      delete tape.initialConditions.generatorRadius;
    },
    (tape) => {
      tape.acceptedCheckpoint.scientificState.streamPositions[1].index = "5";
    },
    (tape) => {
      tape.events[0].commandClass = "setup-change";
    },
    (tape) => {
      tape.events[0].previousValue = "true";
    },
    (tape) => {
      tape.seed = "9007199254740993";
    },
  ]) {
    const tape = structuredClone(recorded.tapes[1]);
    corrupt(tape);
    assert.equal((await restoreWorkerTape(binding, session, tape)).kind, "not-restored");
    assert.equal(session.getSnapshot(), session.getServerSnapshot());
  }
  assert.equal(counts.created, 0);
});

test("BM07 science digest ignores cache cost but binds uncertainty, observations and hidden path", async () => {
  const publication = recorded.publications[1];
  const digest = async (value) => (await bm07CheckpointDigest(value, sourceDigest, 1)).digest;
  const expected = await digest(publication);
  const cached = structuredClone(publication);
  out(cached, "requestDraws").value = 16385;
  out(cached, "reusedRecording").value = 0;
  out(cached, "retainedBytes").value = 0;
  assert.equal(await digest(cached), expected);
  for (const mutate of [
    (value) => {
      out(value, "observationIncrements").value[0] += 1e-9;
    },
    (value) => {
      out(value, "avogadroNumberEstimate").uncertainty.upper *= 1.01;
    },
    (value) => {
      value.recordingCheckpoint.digest = `host:sha256:${"b".repeat(64)}`;
    },
  ]) {
    const changed = structuredClone(publication);
    mutate(changed);
    assert.notEqual(await digest(changed), expected);
  }
});

test("BM07 paused restore starts no private worker; cancellation keeps the original result", async (t) => {
  const { session, binding, counts } = setup(t, "pause-cancel");
  const previous = session.getSnapshot().accepted;
  session.setSchedulingPaused(true);
  const controller = new AbortController();
  const restoring = restoreWorkerTape(binding, session, recorded.tapes[1], {
    signal: controller.signal,
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(counts.created, 0);
  controller.abort();
  assert.equal((await restoring).kind, "not-restored");
  assert.equal(session.getSnapshot().accepted, previous);
  session.setSchedulingPaused(false);
  assert.equal((await restoreWorkerTape(binding, session, recorded.tapes[1])).kind, "restored");
});

test("BM07 explicit calculate creates a new run and updates controls only after final publication", async (t) => {
  const { session, binding } = setup(t, "explicit-new-run");
  assert.equal((await restoreWorkerTape(binding, session, recorded.tapes[1])).kind, "restored");
  const previous = session.getSnapshot().accepted;
  const accepted = [];
  const target = createBm07WalkthroughTarget(binding, session, (parameters) =>
    accepted.push(parameters),
  );
  const calculating = target.calculate({
    ...recorded.tapes[0].initialConditions,
    radiusKnown: "true",
  });
  assert.equal(accepted.length, 0);
  assert.deepEqual(await calculating, { kind: "calculated" });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].radiusKnown, true);
  assert.notEqual(session.getSnapshot().accepted.runId, previous.runId);
});
