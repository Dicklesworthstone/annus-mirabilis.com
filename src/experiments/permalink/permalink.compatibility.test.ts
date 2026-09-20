import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import {
  FIXTURE_ENVIRONMENT,
  FIXTURE_TEACHING_TAPE_EINSTEIN_08,
  FixtureRunner,
} from "./fixture.ts";
import { replayTape } from "./replay.ts";
import type { ExperimentEnvironment, TapeCompatibilityRefusalCode, TapeV2 } from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

const COMPATIBILITY_MISMATCH_CASES: readonly {
  name: string;
  expectedRefusal: TapeCompatibilityRefusalCode;
  modifyTape?: (tape: TapeV2) => TapeV2;
  modifyEnv?: (env: ExperimentEnvironment) => ExperimentEnvironment;
}[] = [
  {
    name: "version unsupported",
    expectedRefusal: "tape-version-unsupported",
    modifyTape: (t) => ({ ...t, tapeVersion: 1 as unknown as 2 }),
  },
  {
    name: "model id mismatch",
    expectedRefusal: "tape-model-mismatch",
    modifyEnv: (e) => ({ ...e, modelId: "differentKernelModel" }),
  },
  {
    name: "model version mismatch",
    expectedRefusal: "tape-model-mismatch",
    modifyEnv: (e) => ({ ...e, modelVersion: 2 }),
  },
  {
    name: "artifact digest mismatch",
    expectedRefusal: "tape-artifact-mismatch",
    modifyEnv: (e) => ({
      ...e,
      artifactDigest: "blake3:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    }),
  },
  {
    name: "constant set mismatch",
    expectedRefusal: "tape-constant-set-mismatch",
    modifyEnv: (e) => ({ ...e, constantSetId: "2026-codata-constants" }),
  },
  {
    name: "stream version mismatch",
    expectedRefusal: "tape-stream-version-mismatch",
    modifyEnv: (e) => ({ ...e, streamVersion: 2 }),
  },
  {
    name: "allocation id mismatch",
    expectedRefusal: "tape-allocation-mismatch",
    modifyEnv: (e) => ({ ...e, allocationId: "bm01-secondary-stream" }),
  },
  {
    name: "replay grid mismatch",
    expectedRefusal: "tape-grid-mismatch",
    modifyEnv: (e) => ({
      ...e,
      replayGrid: { baseSpacing: 0.05, horizon: 20.0 },
    }),
  },
];

// Accept test
test("permalink.compatibility: accept identical tape and environment", () => {
  const check = checkTapeCompatibility(FIXTURE_TEACHING_TAPE_EINSTEIN_08, FIXTURE_ENVIRONMENT);
  assert.equal(check.compatible, true);
});

// Site 1: (compatibility.ts:37) tape-version-unsupported
test("permalink.compatibility: Site (compatibility.ts:37) rejects unsupported tape version with tape-version-unsupported", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08, tapeVersion: 1 as unknown as 2 };
  const env: ExperimentEnvironment = { ...FIXTURE_ENVIRONMENT };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-version-unsupported");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-version-unsupported");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});

// Site 2: (compatibility.ts:54) tape-model-mismatch
test("permalink.compatibility: Site (compatibility.ts:54) rejects model id/version mismatch with tape-model-mismatch", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
  const env: ExperimentEnvironment = { ...FIXTURE_ENVIRONMENT, modelId: "differentKernelModel" };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-model-mismatch");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-model-mismatch");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});

// Site 3: (compatibility.ts:72) tape-artifact-mismatch
test("permalink.compatibility: Site (compatibility.ts:72) rejects artifact digest mismatch with tape-artifact-mismatch", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
  const env: ExperimentEnvironment = {
    ...FIXTURE_ENVIRONMENT,
    artifactDigest: "blake3:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-artifact-mismatch");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-artifact-mismatch");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});

// Site 4: (compatibility.ts:86) tape-constant-set-mismatch
test("permalink.compatibility: Site (compatibility.ts:86) rejects constant set mismatch with tape-constant-set-mismatch", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
  const env: ExperimentEnvironment = {
    ...FIXTURE_ENVIRONMENT,
    constantSetId: "2026-codata-constants",
  };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-constant-set-mismatch");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-constant-set-mismatch");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});

// Site 5: (compatibility.ts:100) tape-stream-version-mismatch
test("permalink.compatibility: Site (compatibility.ts:100) rejects stream version mismatch with tape-stream-version-mismatch", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
  const env: ExperimentEnvironment = {
    ...FIXTURE_ENVIRONMENT,
    streamVersion: 2,
  };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-stream-version-mismatch");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-stream-version-mismatch");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});

// Site 6: (compatibility.ts:114) tape-allocation-mismatch
test("permalink.compatibility: Site (compatibility.ts:114) rejects stream allocation mismatch with tape-allocation-mismatch", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
  const env: ExperimentEnvironment = {
    ...FIXTURE_ENVIRONMENT,
    allocationId: "bm01-secondary-stream",
  };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-allocation-mismatch");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-allocation-mismatch");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});

// Site 7: (compatibility.ts:140) tape-grid-mismatch
test("permalink.compatibility: Site (compatibility.ts:140) rejects replay grid mismatch with tape-grid-mismatch", () => {
  const tape: TapeV2 = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
  const env: ExperimentEnvironment = {
    ...FIXTURE_ENVIRONMENT,
    replayGrid: { baseSpacing: 0.05, horizon: 20.0 },
  };

  const check = checkTapeCompatibility(tape, env);
  assert.equal(check.compatible, false);
  if (!check.compatible) {
    assert.equal(check.refusalCode, "tape-grid-mismatch");
    assert.ok(check.offerNewRun);
    assert.ok(check.notice.length > 0);
    assert.ok(check.repair.length > 0);
  }

  const runner = new FixtureRunner(env);
  const replayRes = replayTape(tape, runner);
  assert.equal(replayRes.kind, "refusal");
  if (replayRes.kind === "refusal") {
    assert.equal(replayRes.refusalCode, "tape-grid-mismatch");
    assert.ok(replayRes.offerNewRun);
  }

  const newRunRes = replayTape(tape, runner, { forceNewRun: true });
  assert.equal(newRunRes.kind, "success");
  if (newRunRes.kind === "success") {
    assert.equal(newRunRes.isNewRun, true);
  }
});
