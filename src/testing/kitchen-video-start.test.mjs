import assert from "node:assert/strict";
import test from "node:test";
import {
  appendVideoPoint,
  frameStamp,
  startCapture,
  videoGeometry,
} from "../experiments/bm07/kitchen/videoCapture.ts";

test("particle capture cannot lock an uncalibrated session into an unusable state", () => {
  const geometry = videoGeometry(640, 480, 60);
  assert.equal(geometry.kind, "ready");
  const state = startCapture(geometry.value, 30, "1");
  const frame = frameStamp(0, 0, 1, 30, 1, 60);
  assert.equal(state.kind, "ready");
  assert.equal(frame.kind, "ready");
  assert.equal(appendVideoPoint(state.value, frame.value, "particle", 20, 20).kind, "refused");
  assert.equal(state.value.points.length, 0);
});
