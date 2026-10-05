import assert from "node:assert/strict";
import test from "node:test";
import type { TapeV2 } from "./types.ts";
import {
  applyWalkthroughCheckpoint,
  sameWalkthroughSettings,
  type WalkthroughTarget,
} from "./walkthroughActions.ts";
import type { CheckpointWalkthrough } from "./walkthroughCheckpoints.ts";

// An adapter fixture: these tests exercise the player/action join, not a scientific evaluator.
const tape: TapeV2 = {
  tapeVersion: 2,
  experimentId: "me-01",
  mode: "me-01:default",
  modelIdentity: { modelId: "fixture", modelVersion: 1 },
  constantSetId: "fixture",
  seed: "0" as TapeV2["seed"],
  streamVersion: "deterministic",
  allocationId: "deterministic",
  initialConditions: { angle: 0 },
  events: [{ actionIndex: 2, commandClass: "setup-change", paramId: "angle", value: 90 }],
  acceptedCheckpoint: {
    acceptedActionIndex: 2,
    acceptedInputRevision: 0,
    digest: "host:0123456789abcdef",
  },
};
const walkthrough: CheckpointWalkthrough = {
  tapeId: "fixture",
  title: "A fixture walkthrough",
  experimentId: "me-01",
  checkpoints: [{ actionIndex: 2, label: "Broadside", settings: { angle: 90 }, tape }],
};

function sessionTarget(result: "restored" | "not-restored" = "restored") {
  const seen: TapeV2[] = [];
  const target: WalkthroughTarget = {
    kind: "session",
    experimentId: "me-01",
    restore(request) {
      seen.push(request);
      return result === "restored"
        ? { kind: "restored" }
        : { kind: "not-restored", notice: "The recorded constant set differs." };
    },
  };
  return { target, seen };
}

test("restoring a stop forwards its exact request and reports only a matched settings checkpoint", () => {
  const { target, seen } = sessionTarget();
  const out = applyWalkthroughCheckpoint(target, walkthrough, 0);
  assert.equal(out.kind, "replayed");
  assert.equal(seen.length, 1);
  assert.equal(seen[0], tape);
  assert.equal(seen[0]?.acceptedCheckpoint.digest, "host:0123456789abcdef");
  assert.match(out.notice, /Broadside/);
  assert.match(out.notice, /settings checkpoint/);
  assert.doesNotMatch(out.notice, /FrankenSim|empirically verified/);
});

test("a laboratory refusal is not turned into a successful restore", () => {
  const { target } = sessionTarget("not-restored");
  const out = applyWalkthroughCheckpoint(target, walkthrough, 0);
  assert.equal(out.kind, "refused");
  assert.equal(out.notice, "The recorded constant set differs.");
});

test("a walkthrough for another laboratory never reaches the adapter", () => {
  const { target, seen } = sessionTarget();
  const out = applyWalkthroughCheckpoint(target, { ...walkthrough, experimentId: "sr-03" }, 0);
  assert.equal(out.kind, "refused");
  assert.match(out.notice, /sr-03/);
  assert.deepEqual(seen, []);
});

test("invalid selection never changes a session", () => {
  const { target, seen } = sessionTarget();
  for (const index of [-1, 1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])
    assert.equal(applyWalkthroughCheckpoint(target, walkthrough, index).kind, "refused");
  assert.deepEqual(seen, []);
});

test("an unconvertible stop keeps the authored failure visible without calling restore", () => {
  const { target, seen } = sessionTarget();
  const out = applyWalkthroughCheckpoint(target, {
    ...walkthrough,
    checkpoints: [{ actionIndex: 0, label: "Opening", settings: {}, tape: null,
      unavailable: "The record does not carry a valid checkpoint digest." }],
  }, 0);
  assert.equal(out.kind, "refused");
  assert.match(out.notice, /digest/);
  assert.deepEqual(seen, []);
});

test("a missing refusal explanation still yields a visible refusal", () => {
  const { target } = sessionTarget();
  const out = applyWalkthroughCheckpoint(target, {
    ...walkthrough,
    checkpoints: [{ actionIndex: 0, label: "Opening", settings: {}, tape: null }],
  }, 0);
  assert.equal(out.kind, "refused");
  assert.match(out.notice, /no replayable/);
});

test("form laboratories receive stop settings, not events or a request to start a worker", () => {
  const seen: object[] = [];
  const target: WalkthroughTarget = {
    kind: "form",
    experimentId: "me-01",
    load(settings) { seen.push(settings); return { kind: "loaded" }; },
  };
  const out = applyWalkthroughCheckpoint(target, walkthrough, 0);
  assert.equal(out.kind, "loaded");
  assert.deepEqual(seen, [{ angle: 90 }]);
  assert.match(out.notice, /form only/);
  assert.match(out.notice, /new calculation/);
  assert.match(out.notice, /has not been verified/);
});

test("form-only loading does not pretend to verify a missing recorded digest", () => {
  const target: WalkthroughTarget = {
    kind: "form", experimentId: "me-01", load: () => ({ kind: "loaded" }),
  };
  const out = applyWalkthroughCheckpoint(target, {
    ...walkthrough,
    checkpoints: [{ actionIndex: 0, label: "Opening", settings: { angle: 0 }, tape: null }],
  }, 0);
  assert.equal(out.kind, "loaded");
  assert.match(out.notice, /has not been verified/);
});

test("a form validator refusal does not earn a loaded notice", () => {
  const target: WalkthroughTarget = {
    kind: "form", experimentId: "me-01",
    load: () => ({ kind: "not-restored", notice: "Choose an admitted distribution." }),
  };
  const out = applyWalkthroughCheckpoint(target, walkthrough, 0);
  assert.deepEqual(out, { kind: "refused", notice: "Choose an admitted distribution." });
});

test("unexpected adapter failures are visible and never claim rollback or success", () => {
  const target: WalkthroughTarget = {
    kind: "session", experimentId: "me-01",
    restore: () => { throw new Error("fixture failure"); },
  };
  const out = applyWalkthroughCheckpoint(target, walkthrough, 0);
  assert.equal(out.kind, "refused");
  assert.match(out.notice, /fixture failure/);
  assert.doesNotMatch(out.notice, /unchanged|default settings|restored and matched/);
});

test("matching accepted settings is order-independent and preserves sub-display precision", () => {
  assert.equal(sameWalkthroughSettings({ radius: 3e-7, mode: "a" }, { mode: "a", radius: 3e-7 }), true);
  assert.equal(sameWalkthroughSettings({ radius: 3e-7 }, { radius: 4e-7 }), false);
  assert.equal(sameWalkthroughSettings({ radius: 3e-7 }, { radius: 3e-7, mode: "a" }), false);
  assert.equal(sameWalkthroughSettings({ enabled: true }, { enabled: "true" }), false);
});

test("matching ignores inherited fields and never equates a missing own setting", () => {
  const inherited = Object.create({ radius: 3e-7 });
  assert.equal(sameWalkthroughSettings({ radius: 3e-7 }, inherited), false);
});
