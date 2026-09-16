import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import {
  assertShareFormNoLeaks,
  getShareFormSpec,
  ShareFormError,
  validateShareParameters,
} from "./shareForms.ts";
import type { TapeV2 } from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

/**
 * Mock fully-populated fixture session.
 */
interface MockSessionState {
  passage: {
    paper: string;
    section: string;
    view: string;
    detail: string;
    anchor: string;
  };
  experiment: {
    tape: TapeV2;
    currentRunId: string;
  };
  notebook: {
    notebookId: string;
    notes: readonly { id: string; text: string; createdAt: string }[];
    pinnedPredictions: readonly string[];
  };
  kitchenMedia?: {
    fileName: string;
    objectUrl: string;
  };
}

function createFixtureSession(): MockSessionState {
  const points: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    points.push([i * 0.1, Math.sin(i * 0.1)]);
  }

  return {
    passage: {
      paper: "brownian-motion",
      section: "s3",
      view: "parallel",
      detail: "2",
      anchor: "#s3-p2-s1",
    },
    experiment: {
      tape: {
        ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
        predictions: [
          {
            promptId: "prompt-einstein-08-sketch",
            form: "sketch",
            payload: { points },
          },
        ],
      },
      currentRunId: "run-bm-01-fixture-1905",
    },
    notebook: {
      notebookId: "nb-user-workspace-7782",
      notes: [
        {
          id: "note-1",
          text: "Einstein's derivation in §3 connects osmotic pressure with Stokes drag.",
          createdAt: "2026-09-16T12:00:00Z",
        },
      ],
      pinnedPredictions: ["prompt-einstein-08-sketch"],
    },
    kitchenMedia: {
      fileName: "recorded_pollen_grain_sample_01.mp4",
      objectUrl: "blob:https://annus-mirabilis.com/c1b2a3-4d5e-6f",
    },
  };
}

test("crossFormLeaks: passage link contains no tape param, no prediction, and no notebook id", () => {
  const session = createFixtureSession();

  // Producer for passage link: build query params and URL
  const passageParams = {
    view: session.passage.view,
    detail: session.passage.detail,
  };

  const paramCheck = validateShareParameters("passage-link", passageParams);
  assert.equal(paramCheck.valid, true);

  // Assert no cross-form contamination
  const queryKeys = Object.keys(passageParams);
  assert.equal(queryKeys.includes("tape"), false);
  assert.equal(queryKeys.includes("notebookId"), false);
  assert.equal(queryKeys.includes("prediction"), false);

  assertShareFormNoLeaks("passage-link", {
    params: passageParams,
  });

  logger.log({
    testId: "cross-form-leak-passage-link-clean",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Passage link verified clean of experiment tape, prediction, and notebook IDs",
  });
});

test("crossFormLeaks: experiment permalink contains no free text, no notebook id, and includes prediction only when opted in", () => {
  const session = createFixtureSession();

  // 1. Permalink with predictions opted IN
  const tapeWithPred = session.experiment.tape;
  const encodedWithPred = encodeTapePermalink(tapeWithPred, { includePredictions: true });
  const decodedWithPred = decodeTapePermalink(encodedWithPred);

  assert.equal(decodedWithPred.kind, "success");
  if (decodedWithPred.kind === "success") {
    assert.equal(decodedWithPred.tape.predictions?.length, 1);
    // Check no notebookId in payload
    assert.equal("notebookId" in decodedWithPred.tape, false);
    assert.equal("notes" in decodedWithPred.tape, false);
  }

  // 2. Permalink with predictions opted OUT
  const encodedNoPred = encodeTapePermalink(tapeWithPred, { includePredictions: false });
  const decodedNoPred = decodeTapePermalink(encodedNoPred);

  assert.equal(decodedNoPred.kind, "success");
  if (decodedNoPred.kind === "success") {
    assert.equal(decodedNoPred.tape.predictions, undefined);
  }

  assertShareFormNoLeaks("experiment-preset", {
    params: { tape: encodedNoPred },
    payload:
      decodedNoPred.kind === "success"
        ? (decodedNoPred.tape as unknown as Record<string, unknown>)
        : undefined,
  });

  logger.log({
    testId: "cross-form-leak-experiment-permalink-clean",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Experiment permalink verified clean of notebook state and free text",
  });
});

test("crossFormLeaks: notebook export contains no shareable URLs carrying notebook content", () => {
  const session = createFixtureSession();

  const exportPayload = {
    schemaVersion: 1,
    exportTimestamp: new Date().toISOString(),
    entries: session.notebook.notes,
    pinnedPredictions: session.notebook.pinnedPredictions,
  };

  assertShareFormNoLeaks("notebook-export", {
    payload: exportPayload,
  });

  // Export is a file, has no URL search params
  const spec = getShareFormSpec("notebook-export");
  assert.equal(spec.producesUrl, false);
});

test("crossFormLeaks: planted leaks are strictly caught by verification gates", () => {
  // 1. Planted leak: ?tape= added to passage link
  assert.throws(
    () =>
      assertShareFormNoLeaks("passage-link", {
        params: { view: "parallel", tape: "eyJsYWIiOiJibTAxIn0" },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ShareFormError);
      assert.equal(err.code, "unadmitted-parameter");
      return true;
    },
  );

  // 2. Planted leak: notebookId added to experiment permalink
  assert.throws(
    () =>
      assertShareFormNoLeaks("experiment-preset", {
        params: { tape: "abc" },
        payload: {
          tapeVersion: 2,
          experimentId: "bm-01",
          mode: "bm-01:default",
          notebookId: "nb-123", // Forbidden field
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ShareFormError);
      assert.equal(err.code, "unadmitted-payload-field");
      return true;
    },
  );

  // 3. Planted leak: seeded local-media filename in session
  const session = createFixtureSession();
  assert.throws(
    () =>
      assertShareFormNoLeaks("experiment-preset", {
        params: { tape: "abc" },
        mediaValues: { fileName: session.kitchenMedia?.fileName },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ShareFormError);
      assert.equal(err.code, "media-leak-refused");
      return true;
    },
  );

  logger.log({
    testId: "cross-form-leak-planted-negatives",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Planted leaks across all three boundaries caught and rejected with typed errors",
  });
});
