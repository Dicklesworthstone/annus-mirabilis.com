import assert from "node:assert/strict";
import test from "node:test";
import { compareBitwise, withinTolerance } from "../../units/tolerance.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createBm01Recording, measureBm01 } from "../../workers/operations/bm01.ts";
import { pinBaseline } from "../compare/Baseline.ts";
import { compareBaselines } from "../compare/compatibility.ts";
import { encodeResult } from "../results/codec.ts";
import { BM01_COMPARISON, bm01ComparisonIdentity } from "./comparison.ts";
import { createBm01ComparisonSession } from "./comparisonSession.ts";
import { BM01_DEFAULTS } from "./definition.ts";
import { createBm01Session } from "./session.ts";

// Fixed seed, grid and sample count: these are coupled, not independent trials.
// Relative 1e-12 tests the path-scaling identity, not a statistical confidence band.
const parameters = {
  ...BM01_DEFAULTS,
  T: 290.15,
  eta: 1.35e-3,
  M: 64,
  h: 0.1,
  H: 4,
  seed: "18446744073709551615",
};
const sourceDigest = `source:sha256:${"a".repeat(64)}`; // Fixture protocol identity, not a production digest.
const unwrap = (result) => {
  assert.equal(result.kind, "accepted");
  return result.data;
};
const scalar = (outputs, id) => {
  const value = outputs.find((output) => output.quantityId === id);
  assert.equal(value?.status, "value");
  assert.equal(typeof value.value, "number");
  return value.value;
};
function prepared(p, evaluation) {
  return {
    parameters: p,
    sourceDigest,
    results: evaluation.outputs.map(encodeResult),
    stepIndex: evaluation.stepIndex,
    simulationTime: evaluation.simulationTime,
  };
}
async function examples() {
  const recording = unwrap(await createBm01Recording(parameters, { yieldControl: async () => {} }));
  const baseline = prepared(parameters, unwrap(measureBm01(recording, parameters, false)));
  const doubled = { ...parameters, a: parameters.a * 2 };
  const other = unwrap(await createBm01Recording(doubled, { yieldControl: async () => {} }));
  return {
    schemaVersion: 1,
    baseline,
    doubledRadius: prepared(doubled, unwrap(measureBm01(other, doubled, false))),
    allocationId: recording.allocationId,
    streamVersion: recording.normalVersion,
  };
}
function pinned(id, example, identity) {
  const session = createBm01Session(id, example, () => {
    throw new Error("Static projection started a worker");
  });
  return pinBaseline(
    session.getServerSnapshot().accepted,
    identity,
    BM01_COMPARISON.outputs.map((output) => output.id),
  );
}

for (const key of ["a", "eta", "T"]) {
  test(`the real owner propagates a doubled ${key} into diffusivity and both RMS readouts`, async () => {
    const example = await examples(),
      identity = bm01ComparisonIdentity(example);
    const p = { ...parameters, [key]: parameters[key] * 2 };
    const recording = unwrap(await createBm01Recording(p, { yieldControl: async () => {} }));
    const evaluated = unwrap(measureBm01(recording, p, false));
    const result = compareBaselines(
      pinned("baseline", example.baseline, identity),
      pinned("variant", prepared(p, evaluated), identity),
      BM01_COMPARISON,
    );
    assert.equal(result.kind, "accepted");
    const expectedD = key === "T" ? 2 : 0.5;
    for (const [id, expected] of [
      ["diffusionCoefficient", expectedD],
      ["rmsDisplacement1d", Math.sqrt(expectedD)],
      ["sampleRms", Math.sqrt(expectedD)],
    ]) {
      const ratio = result.rows.find((row) => row.id === id)?.ratio;
      assert.equal(ratio?.status, "value");
      assert.ok(
        withinTolerance(ratio.value, expected, { relative: 1e-12 }).ok,
        `${id}: ${ratio.value}`,
      );
    }
    // The misconception must fail against the actual sampled displacement, not a copied expectation.
    if (key !== "T") {
      const actual = result.rows.find((row) => row.id === "sampleRms").ratio.value;
      assert.equal(withinTolerance(actual, 0.5, { relative: 1e-12 }).ok, false);
    }
  });
}
test("remeasurement consumes no draws and leaves every latent coordinate bitwise intact", async () => {
  const recording = unwrap(await createBm01Recording(parameters, { yieldControl: async () => {} }));
  const before = recording.values.slice(),
    draws = recording.draws;
  const first = unwrap(measureBm01(recording, parameters, true));
  const second = unwrap(measureBm01(recording, { ...parameters, interval: 4 }, true));
  assert.ok(compareBitwise(recording.values, before).ok);
  assert.equal(recording.draws, draws);
  assert.equal(scalar(second.outputs, "recordingDraws"), scalar(first.outputs, "recordingDraws"));
  assert.equal(scalar(second.outputs, "reusedRecording"), 1);
  assert.ok(
    withinTolerance(
      scalar(second.outputs, "rmsDisplacement1d") / scalar(first.outputs, "rmsDisplacement1d"),
      2,
      { relative: 1e-12 },
    ).ok,
  );
});
test("zero time stays a typed apparent-speed limit and off-grid time is refused", async () => {
  const recording = unwrap(await createBm01Recording(parameters, { yieldControl: async () => {} }));
  const zero = unwrap(measureBm01(recording, { ...parameters, interval: 0 }, true));
  assert.equal(
    zero.outputs.find((output) => output.quantityId === "modelApparentSpeed").status,
    "not-applicable",
  );
  assert.equal(measureBm01(recording, { ...parameters, interval: 0.15 }, true).kind, "refused");
});

test("the real session, scheduler, codec and owner preserve a warm recording across a comparison", async () => {
  const example = await examples();
  let creates = 0,
    disposals = 0;
  const replies = [],
    failures = [];
  // Replace only the Worker transport boundary. The numerical owner and protocol are real.
  function channel() {
    creates++;
    let onMessage = () => {},
      onError = () => {};
    const host = createBm01Host((message) => {
      replies.push(message);
      onMessage(structuredClone(message));
    }, sourceDigest);
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch((error) => {
          failures.push(error);
          onError();
        });
      },
      listen(message, error) {
        onMessage = message;
        onError = error;
        queueMicrotask(() => host.hello());
        return () => {
          onMessage = () => {};
          onError = () => {};
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    };
  }
  const comparison = createBm01ComparisonSession("runtime-comparison", example, channel);
  async function complete(action) {
    assert.equal(action(), true);
    if (!comparison.getSnapshot().pending) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("Comparison did not finish"));
      }, 10000);
      const unsubscribe = comparison.subscribe(() => {
        if (!comparison.getSnapshot().pending) {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      });
    });
    assert.equal(comparison.getSnapshot().error, "");
  }
  try {
    assert.equal(creates, 0);
    comparison.connect();
    await complete(() => comparison.start());
    const baseline = comparison.getSnapshot().baseline;
    await complete(() => comparison.apply({ ...parameters, interval: 4 }));
    const measured = comparison.getSnapshot();
    assert.equal(measured.variant.runId, baseline.runId);
    assert.equal(measured.variant.instanceId, baseline.instanceId);
    assert.equal(scalar(measured.variantSnapshot.outputs, "reusedRecording"), 1);
    assert.equal(measured.variant.revisions.input, baseline.revisions.input);
    assert.ok(measured.variant.revisions.measurement > baseline.revisions.measurement);
    const plot = (s) =>
      s.outputs.find((output) => output.quantityId === "plotSampleRms").value.copy();
    assert.ok(compareBitwise(plot(measured.baselineSnapshot), plot(measured.variantSnapshot)).ok);
    const requests = replies.length;
    assert.equal(comparison.apply({ ...parameters, interval: 4, a: parameters.a * 2 }), false);
    assert.equal(replies.length, requests);
    assert.equal(comparison.pinCurrent(), true);
    await complete(() => comparison.apply({ ...parameters, interval: 4, a: parameters.a * 2 }));
    assert.notEqual(comparison.getSnapshot().variant.runId, baseline.runId);
    assert.equal(creates, 1);
    assert.deepEqual(failures, []);
  } finally {
    comparison.disconnect();
  }
  assert.equal(disposals, 1);
});
