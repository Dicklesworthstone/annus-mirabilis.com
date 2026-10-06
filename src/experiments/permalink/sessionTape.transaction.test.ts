import assert from "node:assert/strict";
import test from "node:test";
import type { U64String } from "../identity/u64.ts";
import { prepareTapeReplay } from "./prepareReplay.ts";
import { replayTape } from "./replay.ts";
import {
  createSessionReplayRunner,
  type LabTapeBinding,
  replayTapeOnSession,
  restoreTape,
  restoreTapeFromUrl,
  type TapeDigestForm,
  type TapeSession,
  tapeStateDigestIn,
} from "./sessionTape.ts";
import type { TapeControlEvent, TapeV2 } from "./types.ts";

const defaults = { x: 1, y: 2, visible: true };
function validate(input: unknown) {
  const p = input as typeof defaults;
  return Number.isFinite(p.x) && p.x >= 0 && p.x <= 10 && Number.isFinite(p.y)
    ? { kind: "accepted" }
    : {
        kind: "refused",
        refusal: { details: { requirements: "x must lie between 0 and 10." } },
      };
}
function session(start = defaults) {
  let parameters = { ...start };
  let snapshot = { accepted: { revisions: { input: 0 } } };
  const applied: unknown[] = [];
  const live: TapeSession = {
    apply(input) {
      applied.push(input);
      const outcome = validate(input);
      if (outcome.kind !== "accepted") return outcome;
      parameters = { ...(input as typeof defaults) };
      snapshot = { accepted: { revisions: { input: snapshot.accepted.revisions.input + 1 } } };
      return outcome;
    },
    acceptedParameters: () => parameters,
    getSnapshot: () => snapshot,
  };
  return { live, applied };
}
const binding: LabTapeBinding = {
  environment: {
    experimentId: "transaction-fixture",
    mode: "reference",
    modelId: "transaction-fixture",
    modelVersion: 1,
    constantSetId: "fixture",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  },
  defaults,
  validate,
  createSession: () => session().live,
};
function tape(form: TapeDigestForm = "fnv1a64"): TapeV2 {
  return {
    tapeVersion: 2,
    experimentId: binding.environment.experimentId,
    mode: binding.environment.mode,
    modelIdentity: { modelId: binding.environment.modelId, modelVersion: 1 },
    constantSetId: binding.environment.constantSetId,
    seed: "0" as U64String,
    streamVersion: binding.environment.streamVersion,
    allocationId: binding.environment.allocationId,
    initialConditions: { ...defaults, visible: "true" },
    events: [{ actionIndex: 1, commandClass: "setup-change", paramId: "x", value: 3 }],
    acceptedCheckpoint: {
      acceptedActionIndex: 1,
      acceptedInputRevision: 2,
      digest: tapeStateDigestIn(form, { x: 3, y: 2, visible: "true" }, 1),
    },
  };
}

function assertUntouched(request: TapeV2, resolve?: (id: string) => TapeV2 | null) {
  const { live, applied } = session({ x: 8, y: 9, visible: false });
  const before = live.getSnapshot();
  const parameters = live.acceptedParameters();
  const result = restoreTape(binding, live, request, resolve);
  assert.equal(result.kind, "not-restored");
  assert.deepEqual(applied, [], "A failed preflight must never call the live session's apply.");
  assert.equal(live.getSnapshot(), before, "Keep snapshot and revision identity, not just values.");
  assert.equal(live.acceptedParameters(), parameters);
  return result;
}

test("a refused identity does not manufacture a live rollback revision", () => {
  const result = assertUntouched({ ...tape(), constantSetId: "historical" });
  if (result.kind === "not-restored") assert.match(result.notice, /constant set/);
});

test("a corrupt checkpoint is discovered without publishing any intermediate live settings", () => {
  assertUntouched({
    ...tape(),
    acceptedCheckpoint: { ...tape().acceptedCheckpoint, digest: "host:ffffffffffffffff" },
  });
});

test("a late invalid event preserves the previous run and carries the laboratory's repair", () => {
  const bad: TapeControlEvent = {
    actionIndex: 2,
    commandClass: "setup-change",
    paramId: "x",
    value: 11,
  };
  const result = assertUntouched({
    ...tape(),
    events: [...tape().events, bad],
    acceptedCheckpoint: { ...tape().acceptedCheckpoint, acceptedActionIndex: 2 },
  });
  if (result.kind === "not-restored") assert.match(result.notice, /x must lie between 0 and 10/);
});

test("initial conditions are defaults plus recorded settings, independent of prior edits", () => {
  const { live } = session({ x: 8, y: 9, visible: false });
  const request = { ...tape(), initialConditions: { x: 1 } };
  assert.equal(restoreTape(binding, live, request).kind, "restored");
  assert.deepEqual(live.acceptedParameters(), { x: 3, y: 2, visible: true });
});

test("a shared teaching reference resolves once and restores the authored controls", () => {
  const { live, applied } = session({ x: 8, y: 9, visible: false });
  let resolutions = 0;
  const request: TapeV2 = {
    ...tape(),
    initialConditions: { x: -999 },
    events: [],
    teachingTapeRef: { tapeId: "authored-fixture", stepIndex: 0 },
  };
  const result = restoreTape(binding, live, request, (id) => {
    assert.equal(id, "authored-fixture");
    resolutions++;
    return resolutions === 1 ? tape() : null;
  });
  assert.equal(result.kind, "restored");
  assert.equal(resolutions, 1);
  assert.equal(applied.length, 2);
  assert.deepEqual(live.acceptedParameters(), { x: 3, y: 2, visible: true });
});

test("missing and throwing walkthrough resolvers leave the accepted run untouched", () => {
  const request = { ...tape(), teachingTapeRef: { tapeId: "missing", stepIndex: 0 } };
  assertUntouched(request);
  assertUntouched(request, () => null);
  assertUntouched(request, () => {
    throw new Error("catalogue offline");
  });
});

test("all three supported settings digest forms still restore", () => {
  for (const form of ["fnv1a64", "fnv1a", "lq08-legacy"] as const) {
    const { live } = session();
    assert.equal(restoreTape(binding, live, tape(form)).kind, "restored", form);
    assert.deepEqual(live.acceptedParameters(), { x: 3, y: 2, visible: true });
  }
});

test("preparation captures immutable controls and never overwrites the recorded digest", () => {
  const source = tape();
  const trial = createSessionReplayRunner(binding, session().live);
  trial.resolveTeachingTape = () => source;
  const request = { ...source, teachingTapeRef: { tapeId: "fixture", stepIndex: 0 } };
  const prepared = prepareTapeReplay(request, trial);
  assert.equal(prepared.kind, "prepared");
  if (prepared.kind !== "prepared") return;
  assert.equal(prepared.tape.teachingTapeRef, undefined);
  assert.equal(prepared.tape.acceptedCheckpoint.digest, source.acceptedCheckpoint.digest);
  assert.ok(Object.isFrozen(prepared.tape.initialConditions));
  assert.ok(Object.isFrozen(prepared.tape.events));
  assert.ok(Object.isFrozen(prepared.tape.events[0]));
  (source.initialConditions as Record<string, number | string>).y = 99;
  const event = source.events[0];
  assert.ok(event);
  (event as { value: number }).value = 9;
  const fresh = session().live;
  assert.equal(
    replayTape(prepared.tape, createSessionReplayRunner(binding, fresh)).kind,
    "success",
  );
  assert.deepEqual(fresh.acceptedParameters(), { x: 3, y: 2, visible: true });
});

test("a preflight construction failure is reported without touching the live laboratory", () => {
  const { live, applied } = session();
  const result = replayTapeOnSession(
    {
      ...binding,
      createSession: () => {
        throw new Error("cannot create trial");
      },
    },
    live,
    tape(),
  );
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") assert.equal(result.reason, "replay-preparation-failed");
  assert.deepEqual(applied, []);
});

test("unexpected live failure attempts recovery and never reports replay success", () => {
  const { live } = session({ x: 8, y: 9, visible: false });
  const refusing: TapeSession = {
    ...live,
    apply(input) {
      if ((input as { x: number }).x === 3) return { kind: "refused" };
      return live.apply(input);
    },
  };
  assert.equal(restoreTape(binding, refusing, tape()).kind, "not-restored");
  assert.deepEqual(live.acceptedParameters(), { x: 8, y: 9, visible: false });
});

test("failure to recover a live session is not disguised as an ordinary refused link", () => {
  const { live } = session();
  const refusing: TapeSession = { ...live, apply: () => ({ kind: "refused" }) };
  const result = replayTapeOnSession(binding, refusing, tape());
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") assert.equal(result.reason, "replay-recovery-failed");
});

test("an explicitly new run bypasses recorded identity and digest but remains marked new", () => {
  const { live } = session();
  const result = replayTapeOnSession(
    binding,
    live,
    {
      ...tape(),
      constantSetId: "historical",
      acceptedCheckpoint: { ...tape().acceptedCheckpoint, digest: "host:ffffffffffffffff" },
    },
    { forceNewRun: true },
  );
  assert.equal(result.kind, "success");
  if (result.kind === "success") assert.equal(result.isNewRun, true);
  assert.deepEqual(live.acceptedParameters(), { x: 3, y: 2, visible: true });
});

test("ordinary page visits do not load a tape or change the experiment", async () => {
  const { live, applied } = session();
  for (const href of [
    "not a URL",
    "https://example.test/lab/fixture/",
    "https://example.test/?other=1",
  ]) {
    assert.deepEqual(await restoreTapeFromUrl(binding, live, href), { kind: "absent" });
  }
  assert.deepEqual(applied, []);
});
