import assert from "node:assert/strict";
import test from "node:test";
import {
  createLightThreadSession,
  LIGHT_THREAD_OWNERS,
} from "../experiments/lightThread/session.ts";
import {
  evaluateLightThread,
  LIGHT_THREAD_DEFAULTS,
  LIGHT_THREAD_QUANTITIES,
} from "../physics/reference/lightThread.ts";
import { dopplerFactor, lightComplexFactors } from "../physics/reference/waves.ts";

function accepted(session) {
  const snapshot = session.getSnapshot().accepted;
  assert.ok(snapshot);
  return snapshot;
}
function value(snapshot, id) {
  const output = snapshot.outputs.find((item) => item.quantityId === id);
  assert.equal(output?.status, "value");
  assert.equal(typeof output.value, "number");
  return output.value;
}
const close = (a, b) =>
  assert.ok(Math.abs(a - b) <= 2e-10 * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE));

test("production wiring uses both existing wave owners and the complete output contract", () => {
  assert.equal(LIGHT_THREAD_OWNERS.frequencyFactor, dopplerFactor);
  for (const beta of [-0.999999, -0.6, 0, 0.6, 0.999999]) {
    for (const angleDeg of [0, 90, 180]) {
      const p = { ...LIGHT_THREAD_DEFAULTS, beta, angleDeg };
      const theta = (angleDeg * Math.PI) / 180;
      const evaluated = evaluateLightThread(p, LIGHT_THREAD_OWNERS);
      assert.equal(evaluated.kind, "accepted");
      close(evaluated.snapshot.values.energyFactor, lightComplexFactors(beta, theta).energyFactor);
      close(evaluated.snapshot.values.frequencyFactor, dopplerFactor(beta, theta));
      close(
        evaluated.snapshot.values.quantumRatioMoving,
        evaluated.snapshot.values.quantumRatioStationary,
      );
      const snapshot = accepted(createLightThreadSession(`production-${beta}-${angleDeg}`, p));
      assert.equal(snapshot.outputs.length, Object.keys(LIGHT_THREAD_QUANTITIES).length);
      for (const id of Object.keys(LIGHT_THREAD_QUANTITIES))
        close(value(snapshot, id), evaluated.snapshot.values[id]);
    }
  }
});

test("observer changes preserve the physical run and source pulse; setup changes create a run", () => {
  const session = createLightThreadSession("observer-lifetime");
  const initial = accepted(session);
  assert.equal(session.apply({ ...LIGHT_THREAD_DEFAULTS, beta: -0.6 }).kind, "accepted");
  const changed = accepted(session);
  assert.equal(changed.runId, initial.runId);
  assert.equal(changed.revisions.input, initial.revisions.input);
  assert.ok(changed.revisions.observer > initial.revisions.observer);
  assert.equal(value(changed, "energyStationary"), value(initial, "energyStationary"));
  assert.equal(value(changed, "frequencyStationary"), value(initial, "frequencyStationary"));
  assert.notEqual(value(changed, "energyMoving"), value(initial, "energyMoving"));
  assert.equal(
    session.apply({ ...LIGHT_THREAD_DEFAULTS, beta: -0.6, pulseEnergyJ: 2 }).kind,
    "accepted",
  );
  assert.notEqual(accepted(session).runId, changed.runId);
});

test("refused, mixed, repeated and independent-instance updates cannot mix snapshots", () => {
  const left = createLightThreadSession("left");
  const right = createLightThreadSession("right");
  const before = accepted(left);
  const rightBefore = accepted(right);
  assert.equal(left.apply({ ...LIGHT_THREAD_DEFAULTS, beta: 1 }).kind, "refused");
  assert.equal(accepted(left), before);
  assert.equal(left.apply(LIGHT_THREAD_DEFAULTS).kind, "accepted");
  assert.equal(accepted(left), before);
  const p = { ...LIGHT_THREAD_DEFAULTS, beta: -0.4, frequencyHz: 8e14, pulseEnergyJ: 3 };
  assert.equal(left.apply(p).kind, "accepted");
  assert.deepEqual(accepted(left).parameters, p);
  assert.equal(accepted(right), rightBefore);
  assert.equal(left.getServerSnapshot().accepted, before);
  close(
    value(accepted(left), "quantumRatioMoving"),
    value(accepted(left), "quantumRatioStationary"),
  );
});
