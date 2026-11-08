import { afterAll, describe, expect, test } from "bun:test";
import { TestLogger } from "../../testing/log/logger.ts";
import {
  CheckpointValidationError,
  checkpointJson,
  decodeInstanceCheckpoint,
  MAX_CHECKPOINT_ARRAY_ELEMENTS,
  MAX_INSTANCE_CHECKPOINT_BYTES,
} from "./instanceCheckpoint.ts";
import { createInstanceStore, type RequestToken } from "./instanceStore.ts";

const logger = new TestLogger("instance-checkpoint");
afterAll(() => logger.flush());
function owner(instanceId = "reader-checkpoint") {
  return createInstanceStore({
    experimentId: "checkpoint-test",
    instanceId,
    initialParameters: { x: -0, observer: 0, seed: "18446744073709551615" },
    parameterClasses: { x: "input", observer: "observer", seed: "input" },
    outputs: {
      scalar: {
        unit: "m",
        semanticKind: "length",
        ownerId: "checkpoint.scalar",
        statuses: ["value"],
      },
      vector: {
        unit: "m",
        semanticKind: "length",
        ownerId: "checkpoint.vector",
        statuses: ["value"],
      },
    },
  });
}
function publish(
  store: ReturnType<typeof owner>,
  token: RequestToken,
  values = new Float64Array([-0, 1e-300, 1e300]),
) {
  expect(
    store.publish({
      ...token,
      stepIndex: token.actionIndex,
      simulationTime: token.actionIndex,
      final: true,
      outputs: [
        {
          quantityId: "scalar",
          unit: "m",
          semanticKind: "length",
          ownerId: "checkpoint.scalar",
          status: "value",
          value: -0,
        },
        {
          quantityId: "vector",
          unit: "m",
          semanticKind: "length",
          ownerId: "checkpoint.vector",
          status: "value",
          value: values,
        },
      ],
    }).accepted,
  ).toBe(true);
}
function prepared() {
  const store = owner();
  publish(store, store.issue("setup-change"));
  publish(store, store.issue("setup-change", { x: -0 }));
  publish(store, store.issue("observer-change", { observer: 2 }));
  return store;
}

describe("transactional accepted checkpoint import", () => {
  test("malformed checkpoints carry invalid-parameter while a complete checkpoint decodes", () => {
    const checkpoint = prepared().exportCheckpoint();
    expect(() => decodeInstanceCheckpoint(checkpoint)).not.toThrow();
    try {
      decodeInstanceCheckpoint({ checkpointVersion: 99 });
      throw new Error("The invalid checkpoint was admitted.");
    } catch (error) {
      expect(error).toBeInstanceOf(CheckpointValidationError);
      if (error instanceof CheckpointValidationError) expect(error.code).toBe("invalid-parameter");
    }
  });
  test("preserves exact accepted identity, scalar signs, float64 arrays and future counter continuity", () => {
    const original = prepared();
    const snapshot = original.getSnapshot().accepted;
    const checkpoint = original.exportCheckpoint();
    expect(checkpoint).not.toBeNull();
    const restored = owner();
    publish(restored, restored.issue("setup-change"));
    expect(restored.restoreCheckpoint(JSON.parse(checkpointJson(checkpoint)))).toEqual({
      kind: "restored",
    });
    const accepted = restored.getSnapshot().accepted;
    expect(accepted).toMatchObject({
      instanceId: snapshot?.instanceId,
      runId: snapshot?.runId,
      parentRunId: snapshot?.parentRunId,
      actionIndex: snapshot?.actionIndex,
      snapshotVersion: snapshot?.snapshotVersion,
      revisions: snapshot?.revisions,
      stepIndex: snapshot?.stepIndex,
      simulationTime: snapshot?.simulationTime,
    });
    expect(Object.is(accepted?.parameters.x, -0)).toBe(true);
    expect(accepted?.parameters.seed).toBe("18446744073709551615");
    const scalar = accepted?.outputs.find((output) => output.quantityId === "scalar");
    const vector = accepted?.outputs.find((output) => output.quantityId === "vector");
    if (
      scalar?.status !== "value" ||
      vector?.status !== "value" ||
      typeof vector.value === "number"
    )
      throw new Error("Missing accepted scalar or array.");
    expect(typeof scalar.value).toBe("number");
    expect(Object.is(scalar.value, -0)).toBe(true);
    expect(Object.is(vector.value.at(0), -0)).toBe(true);
    expect(vector.value.at(1)).toBe(1e-300);
    expect(vector.value.at(2)).toBe(1e300);
    vector.value.copy()[1] = 9;
    expect(vector.value.at(1)).toBe(1e-300);
    const continued = restored.issue("observer-change", { observer: 3 });
    expect(continued.runId).toBe(snapshot?.runId);
    expect(continued.actionIndex).toBe((snapshot?.actionIndex ?? 0) + 1);
    expect(continued.revisions.observer).toBe((snapshot?.revisions.observer ?? 0) + 1);
    publish(restored, continued);
    expect(restored.getSnapshot().accepted?.snapshotVersion).toBe(
      (snapshot?.snapshotVersion ?? 0) + 1,
    );
    const next = restored.issue("setup-change", { x: 4 });
    expect(next.runId).toBe("reader-checkpoint/run/3");
    expect(next.parentRunId).toBe(snapshot?.runId);
    logger.log({
      testId: "exact-checkpoint-continuation",
      beadId: "am-read-return-stack-oxa",
      outcome: "passed",
      message:
        "An accepted checkpoint keeps exact identities and finite IEEE-754 data, and continues monotonically after import.",
    });
  });

  test("invalid metadata, contracts and parameters leave every live snapshot and counter untouched", () => {
    const source = prepared().exportCheckpoint();
    if (!source) throw new Error("The source checkpoint is missing.");
    const store = owner();
    publish(store, store.issue("setup-change"));
    const before = store.getSnapshot();
    const mutations: ((value: Record<string, any>) => void)[] = [
      (value) => {
        value.checkpointVersion = 2;
      },
      (value) => {
        value.accepted.instanceId = "another-instance";
      },
      (value) => {
        value.accepted.parentRunId = null;
      },
      (value) => {
        value.accepted.actionIndex = Number.MAX_SAFE_INTEGER;
      },
      (value) => {
        value.accepted.revisions.input = 999;
      },
      (value) => {
        value.accepted.revisions.measurement = value.accepted.actionIndex;
      },
      (value) => {
        value.run.startedAtActionIndex = 1;
      },
      (value) => {
        value.accepted.parameters.surprise = 1;
      },
      (value) => {
        value.accepted.final = false;
      },
      (value) => {
        value.accepted.outputs[0] = value.accepted.outputs[0].replace('"unit":"m"', '"unit":"s"');
      },
      (value) => {
        value.accepted.outputs[0] = value.accepted.outputs[0].replace(
          '"ownerId":"checkpoint.scalar"',
          '"ownerId":"unregistered"',
        );
      },
    ];
    for (const mutate of mutations) {
      const damaged = JSON.parse(checkpointJson(source));
      mutate(damaged);
      expect(store.restoreCheckpoint(damaged).kind).toBe("not-restored");
      expect(store.getSnapshot()).toBe(before);
    }
    expect(store.issue("continue").actionIndex).toBe((before.accepted?.actionIndex ?? 0) + 1);
  });

  test("in-flight and rejected requests never become accepted archived state", () => {
    const store = prepared();
    const recorded = store.exportCheckpoint();
    const token = store.issue("setup-change", { x: 7 });
    const pending = store.getSnapshot();
    expect(store.exportCheckpoint()).toBeNull();
    expect(store.restoreCheckpoint(recorded).kind).toBe("not-restored");
    expect(store.getSnapshot()).toBe(pending);
    store.pause();
    expect(store.exportCheckpoint()).toBeNull();
    expect(store.getSnapshot().accepted?.parameters.x).toBe(-0);
    expect(token.parameters.x).toBe(7);
  });

  test("an advanced or already restored owner cannot rewind its identities or discard known runs", () => {
    const original = prepared();
    const checkpoint = original.exportCheckpoint();
    const before = original.getSnapshot();
    const runs = original.listRuns();
    expect(original.restoreCheckpoint(checkpoint).kind).toBe("not-restored");
    expect(original.getSnapshot()).toBe(before);
    expect(original.listRuns()).toEqual(runs);
    const fresh = owner();
    let notifications = 0;
    fresh.subscribe(() => {
      notifications++;
    });
    expect(fresh.restoreCheckpoint(checkpoint).kind).toBe("restored");
    expect(notifications).toBe(1);
    const restored = fresh.getSnapshot();
    expect(fresh.restoreCheckpoint(checkpoint).kind).toBe("not-restored");
    expect(fresh.getSnapshot()).toBe(restored);
    expect(notifications).toBe(1);
    expect(fresh.issue("continue").actionIndex).toBe((restored.accepted?.actionIndex ?? 0) + 1);
  });

  test("array and byte budgets refuse the whole archive rather than truncating scientific data", () => {
    const store = owner();
    publish(
      store,
      store.issue("setup-change"),
      new Float64Array(MAX_CHECKPOINT_ARRAY_ELEMENTS + 1),
    );
    const accepted = store.getSnapshot();
    expect(store.exportCheckpoint()).toBeNull();
    expect(store.getSnapshot()).toBe(accepted);
    expect(() => checkpointJson({ text: "x".repeat(MAX_INSTANCE_CHECKPOINT_BYTES) })).toThrow();
    expect(() =>
      checkpointJson({ text: "🧪".repeat(MAX_INSTANCE_CHECKPOINT_BYTES / 4) }),
    ).toThrow();
    const good = prepared().exportCheckpoint();
    expect(store.restoreCheckpoint({ ...good, privateNotes: "not checkpoint data" }).kind).toBe(
      "not-restored",
    );
    expect(store.getSnapshot()).toBe(accepted);
  });

  test("accessors, nonfinite values and hidden properties never run during checkpoint decoding", () => {
    let read = false;
    const input = Object.defineProperty({}, "accepted", {
      enumerable: true,
      get() {
        read = true;
        return {};
      },
    });
    const store = owner();
    const before = store.getSnapshot();
    expect(store.restoreCheckpoint(input).kind).toBe("not-restored");
    expect(store.getSnapshot()).toBe(before);
    expect(read).toBe(false);
    expect(() => checkpointJson({ x: Number.NaN })).toThrow();
    expect(() => checkpointJson({ x: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => checkpointJson(Object.defineProperty({}, "x", { value: 3 }))).toThrow();
  });
});
