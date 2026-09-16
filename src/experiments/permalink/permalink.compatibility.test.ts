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

for (const tc of COMPATIBILITY_MISMATCH_CASES) {
  test(`permalink.compatibility: mismatch in ${tc.name} is refused with code "${tc.expectedRefusal}"`, () => {
    let tape = { ...FIXTURE_TEACHING_TAPE_EINSTEIN_08 };
    if (tc.modifyTape) {
      tape = tc.modifyTape(tape);
    }
    let env = { ...FIXTURE_ENVIRONMENT };
    if (tc.modifyEnv) {
      env = tc.modifyEnv(env);
    }

    const check = checkTapeCompatibility(tape, env);
    assert.equal(check.compatible, false);
    if (!check.compatible) {
      assert.equal(check.refusalCode, tc.expectedRefusal);
      assert.ok(check.offerNewRun);
      assert.ok(check.notice.length > 0);
      assert.ok(check.repair.length > 0);
    }

    // Test with ReplayRunner
    const runner = new FixtureRunner(env);
    const replayRes = replayTape(tape, runner);
    assert.equal(replayRes.kind, "refusal");
    if (replayRes.kind === "refusal") {
      assert.equal(replayRes.refusalCode, tc.expectedRefusal);
      assert.ok(replayRes.offerNewRun);
    }

    // Now accept the offer to start a new run
    const newRunRes = replayTape(tape, runner, { forceNewRun: true });
    assert.equal(newRunRes.kind, "success");
    if (newRunRes.kind === "success") {
      assert.equal(newRunRes.isNewRun, true);
      assert.ok(newRunRes.runId.includes("new"));
    }

    logger.log({
      testId: `permalink-compatibility-${tc.expectedRefusal}`,
      beadId: "am-inst-permalink-tape-s677",
      outcome: "passed",
      message: `Compatibility mismatch ${tc.name} refused with ${tc.expectedRefusal} and offered a new run`,
      extra: {
        refusalCode: tc.expectedRefusal,
      },
    });
  });
}
