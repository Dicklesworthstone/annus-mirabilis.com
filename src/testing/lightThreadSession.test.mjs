import assert from "node:assert/strict";
import test from "node:test";
import {
  createLightThreadSession,
  LIGHT_THREAD_OWNERS,
} from "../experiments/lightThread/session.ts";
import {
  evaluateLightThread,
  LIGHT_THREAD_BOUNDS,
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

/**
 * Refusal sites in experiments/lightThread/session.ts (am-r3qt).
 *
 * The file has four. ONE IS REACHABLE and is driven below. THE OTHER THREE ARE UNREACHABLE
 * through the session's own surface and stay counted rather than covered, on the pattern
 * lq06.session.test.ts set. Each was measured on 2026-09-21, not argued from the source:
 *
 *   :90  the initial publication. Its outputs are built by this module's own
 *        scientificResults() from the evaluator's accepted snapshot, and its contracts are
 *        built from the same LIGHT_THREAD_QUANTITIES record, so the two agree by
 *        construction; the store's remaining refusals all need a previous accepted snapshot,
 *        which a first publish does not have. Driven across the envelope below, every
 *        construction publishes.
 *   :121 the missing command. `token` is null only when the setup patch is empty, and the
 *        branch above returns early when the setup patch AND the observer patch are both
 *        empty, so reaching the throw needs a non-empty observer patch whose issue() returned
 *        a falsy token - and issue() returns a RequestToken or throws. All sixteen subsets of
 *        the four settings are driven below, which is the whole input space of that branch.
 *   :134 the update publication, for :90's reason plus one more: an observer change keeps the
 *        run and advances the action index, so the non-monotone rule cannot fire either.
 *
 * None of those three codes is named in any test name or assertion here, so no case below can
 * collect a credit for a site nothing drives. They stay in the untested baseline, which is the
 * honest place for a site whose refusal no caller can provoke.
 */

test("the constructor refuses settings outside the admission bounds (session.ts:73)", () => {
  // The distinguishing negative: apply() RETURNS a refusal for the same settings, and only
  // the constructor throws. A session that reported the constructor's refusal by returning
  // would hand the caller a half-built session object instead of nothing.
  let thrown;
  try {
    createLightThreadSession("light-thread-refusal", { ...LIGHT_THREAD_DEFAULTS, beta: 1 });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, "an out-of-bounds beta must not build a session");
  assert.equal(thrown.code, "parameters-rejected");
  assert.equal(thrown.experimentId, "light-thread");
  assert.ok(thrown.message.includes("beta"), thrown.message);

  const built = createLightThreadSession("light-thread-refusal-apply");
  assert.equal(built.apply({ ...LIGHT_THREAD_DEFAULTS, beta: 1 }).kind, "refused");
});

test("every subset of the four settings publishes, so no change is left without a command", () => {
  // The exhaustive half of the reachability claim above. Sixteen subsets: the empty one takes
  // the early return, the other fifteen must each produce a command and an accepted
  // publication. A future edit that adds a parameter class this branch does not map would
  // show up here as a throw rather than as a silently unpublished change.
  const alternatives = {
    frequencyHz: 8e14,
    pulseEnergyJ: 3,
    beta: -0.4,
    angleDeg: 45,
  };
  const keys = Object.keys(alternatives);
  for (let mask = 0; mask < 1 << keys.length; mask++) {
    const label = keys.filter((_, i) => mask & (1 << i)).join("+") || "nothing-changed";
    const session = createLightThreadSession(`subset-${mask}`);
    const before = accepted(session);
    const next = { ...LIGHT_THREAD_DEFAULTS };
    for (const [i, key] of keys.entries()) if (mask & (1 << i)) next[key] = alternatives[key];
    const result = session.apply(next);
    assert.equal(result.kind, "accepted", `${label} was not accepted`);
    const after = accepted(session);
    assert.deepEqual(after.parameters, next, label);
    if (mask === 0) {
      // The early return: no command, no new snapshot, the same accepted object.
      assert.equal(after, before, "an unchanged apply must not republish");
    } else {
      assert.ok(after.snapshotVersion > before.snapshotVersion, `${label} did not publish`);
    }
  }
});

/**
 * THE SESSION'S REMAINING THREE REFUSALS CANNOT FIRE, AND THIS IS THE MEASUREMENT.
 *
 *   :90  publication-refused    the initial publish
 *   :121 no-command-for-change  no command issued for a changed setting
 *   :134 publication-refused    the publish inside apply()
 *
 * :121 is dead by the eleven lines above it. apply() returns early when both the setup and
 * observer patches are empty, so by the time the token is checked at least one of them has a
 * key - and each non-empty patch issues its own command. There is no third bucket that could
 * be non-empty without issuing anything.
 *
 * :90 and :134 publish against a token the store has just issued, with stepIndex and
 * simulationTime fixed at 0 and final true. Every channel publish() can deny on - unknown
 * message keys, stale revisions, a non-monotone step, a parameter mismatch, no outstanding
 * request - is settled by construction at the call site, so the refusal has no input that
 * reaches it.
 *
 * Kept as a test rather than a comment so that it stops being true LOUDLY. If a later change
 * makes any of the three reachable, this goes red, and whoever made it reachable is the person
 * who should drive it. Verified to be a working pawl rather than a decorative one: deleting
 * the early return above :121 turns this test red.
 */
test("light-thread session: :90, :121 and :134 cannot fire across the admitted envelope", () => {
  const observed = new Set();
  let sessions = 0;
  let applies = 0;
  const keys = Object.keys(LIGHT_THREAD_DEFAULTS);

  // Three points per axis, taken from the declared admission bounds rather than invented.
  const samples = {};
  for (const key of keys) {
    const { min, max } = LIGHT_THREAD_BOUNDS[key];
    samples[key] = [min, LIGHT_THREAD_DEFAULTS[key], max];
  }

  for (const startKey of keys) {
    for (const start of samples[startKey]) {
      const base = { ...LIGHT_THREAD_DEFAULTS, [startKey]: start };
      if (evaluateLightThread(base, LIGHT_THREAD_OWNERS).kind !== "accepted") continue;
      sessions += 1;
      const session = createLightThreadSession(`lt-${startKey}-${start}`, base);

      // Every single-axis move, including the observer axis on its own, which is the one
      // that reaches :121's token check by a different route from the setup axes.
      for (const key of keys) {
        for (const target of samples[key]) {
          applies += 1;
          try {
            session.apply({ ...base, [key]: target });
          } catch (err) {
            observed.add(`apply(${key}):${err?.code}`);
          }
        }
      }
      // And a no-change apply, which is the case the early return owns.
      applies += 1;
      try {
        session.apply({ ...base });
      } catch (err) {
        observed.add(`apply(nochange):${err?.code}`);
      }
    }
  }

  // Reachability before the claim: without these, an envelope that produced no sessions at
  // all would report "nothing refuses" forever.
  assert.ok(sessions >= 8, `expected the admitted envelope to build sessions, got ${sessions}`);
  assert.ok(applies >= 100, `expected the whole single-axis space, got ${applies} apply calls`);
  assert.deepEqual([...observed], [], "no refusal fires anywhere in the admitted envelope");
});
