import assert from "node:assert/strict";
import test from "node:test";
import {
  markAccepted,
  markInput,
  markPainted,
  measureInputToAccepted,
  measureInputToPainted,
} from "../workers/scheduler/marks.ts";

test("Performance Marks: Emits am:input, am:accepted, am:painted with structured detail", () => {
  const instanceId = "test-instance-marks-1";
  const actionIndex = 42;
  const snapshotVersion = 7;

  // Clear existing entries if possible
  if (typeof performance.clearMarks === "function") {
    performance.clearMarks();
  }
  if (typeof performance.clearMeasures === "function") {
    performance.clearMeasures();
  }

  markInput(instanceId, actionIndex, 0);
  markAccepted(instanceId, actionIndex, snapshotVersion);
  markPainted(instanceId, actionIndex, snapshotVersion);

  const inputEntries = performance.getEntriesByName("am:input");
  assert.ok(inputEntries.length >= 1, "am:input mark was recorded");
  const lastInput = inputEntries[inputEntries.length - 1];
  assert.ok(lastInput);
  if ("detail" in lastInput && lastInput.detail) {
    const detail = lastInput.detail as {
      instanceId: string;
      actionIndex: number;
      snapshotVersion: number;
    };
    assert.equal(detail.instanceId, instanceId);
    assert.equal(detail.actionIndex, actionIndex);
    assert.equal(detail.snapshotVersion, 0);
  }

  const acceptedEntries = performance.getEntriesByName("am:accepted");
  assert.ok(acceptedEntries.length >= 1, "am:accepted mark was recorded");
  const lastAccepted = acceptedEntries[acceptedEntries.length - 1];
  assert.ok(lastAccepted);
  if ("detail" in lastAccepted && lastAccepted.detail) {
    const detail = lastAccepted.detail as {
      instanceId: string;
      actionIndex: number;
      snapshotVersion: number;
    };
    assert.equal(detail.instanceId, instanceId);
    assert.equal(detail.actionIndex, actionIndex);
    assert.equal(detail.snapshotVersion, snapshotVersion);
  }

  const paintedEntries = performance.getEntriesByName("am:painted");
  assert.ok(paintedEntries.length >= 1, "am:painted mark was recorded");
  const lastPainted = paintedEntries[paintedEntries.length - 1];
  assert.ok(lastPainted);
  if ("detail" in lastPainted && lastPainted.detail) {
    const detail = lastPainted.detail as {
      instanceId: string;
      actionIndex: number;
      snapshotVersion: number;
    };
    assert.equal(detail.instanceId, instanceId);
    assert.equal(detail.actionIndex, actionIndex);
    assert.equal(detail.snapshotVersion, snapshotVersion);
  }

  const measureAccepted = measureInputToAccepted(instanceId, actionIndex);
  assert.ok(measureAccepted !== null, "measureInputToAccepted created a measure");

  const measurePainted = measureInputToPainted(instanceId, actionIndex);
  assert.ok(measurePainted !== null, "measureInputToPainted created a measure");
});
