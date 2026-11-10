import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { BM06_CURVE_PROMPT } from "../../experiments/bm06/prediction.ts";
import {
  checkedPredictionChoice,
  predictionForLink,
} from "../../experiments/predict/authoredChoice.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import { writeGlobalPredictEntry } from "../../experiments/predict/predictEntry.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import type { PredictionChoice } from "../../experiments/predict/predictState.ts";
import {
  getStoredPrompt,
  readPredictionsDocument,
} from "../../experiments/predict/predictStorage.ts";
import { type GeneratedPredictPrompt, PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { type PredictGateState, usePredictGate } from "./PredictGate.tsx";

const prompt = PREDICT_PROMPTS["bm-06"]?.find((entry) => entry.promptId === BM06_CURVE_PROMPT);
assert.ok(prompt?.curvePrediction, "The exercised curve prompt must exist in the authored data.");
const prompts = [prompt];
const original: PredictionChoice = {
  form: "values",
  targets: [
    { targetId: "at-zero", value: 0.4 },
    { targetId: "at-one", value: 0.25 },
    { targetId: "at-two", value: 0.05 },
  ],
};

async function mounted(
  run: (gate: () => PredictGateState) => Promise<void>,
  offeredPrompts: readonly GeneratedPredictPrompt[] = prompts,
): Promise<void> {
  let current: PredictGateState | undefined;
  function Harness() {
    current = usePredictGate("bm-06", offeredPrompts);
    return null;
  }
  const gate = () => {
    assert.ok(current, "The real predict hook must have mounted.");
    return current;
  };
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Harness)));
    await run(gate);
  } finally {
    await act(async () => root.unmount());
    removeContainer(container);
  }
}

function stored() {
  return getStoredPrompt(readPredictionsDocument(createStorageContext()), "bm-06", BM06_CURVE_PROMPT);
}

describe("prediction restoration keeps provenance and local privacy", () => {
  beforeEach(async () => {
    await installDom();
    installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
    writeGlobalPredictEntry(createStorageContext(), "predict-first");
  });
  afterEach(async () => {
    installPredictPersistence(REMEMBERS_NOTHING);
    await uninstallDom();
  });

  test("a prior recorded choice returns exactly; later guesses preserve it until explicit clearing", async () => {
    LOCAL_PREDICT_PERSISTENCE.record("bm-06", prompt.promptId, original);
    await mounted(async (gate) => {
      expect(gate().open).toBe(true);
      expect(gate().records.get(prompt.promptId)?.state).toBe("revealed");
      expect(gate().records.get(prompt.promptId)?.choice).toEqual(original);
      expect(gate().predictions).toEqual([predictionForLink(prompt.promptId, original)]);

      const later: PredictionChoice = { form: "candidate", candidateId: "two-peaks" };
      await act(async () => gate().amend(prompt.promptId, later));
      expect(gate().records.get(prompt.promptId)?.amendment).toEqual({
        choice: later,
        recordedAfterReveal: true,
      });
      expect(gate().records.get(prompt.promptId)?.choice).toEqual(original);
      expect(gate().predictions).toEqual([predictionForLink(prompt.promptId, original)]);
      expect(stored()).toEqual({ status: "predicted", prediction: original });

      await act(async () => gate().clear(prompt.promptId));
      expect(gate().records.get(prompt.promptId)?.state).toBe("cleared");
      expect(gate().records.get(prompt.promptId)?.choice).toBeNull();
      expect(gate().predictions).toEqual([]);
      expect(stored()).toBeUndefined();
      expect(gate().open).toBe(true);
    });
  });

  test("restoring and clearing a shared choice preserves the reader's stored original for a later visit", async () => {
    LOCAL_PREDICT_PERSISTENCE.record("bm-06", prompt.promptId, original);
    const before = readPredictionsDocument(createStorageContext());
    const shared: PredictionChoice = { form: "candidate", candidateId: "uniform-spread" };
    await mounted(async (gate) => {
      await act(async () => gate().restore([predictionForLink(prompt.promptId, shared)]));
      expect(gate().records.get(prompt.promptId)?.choice).toEqual(shared);
      expect(gate().predictions).toEqual([predictionForLink(prompt.promptId, shared)]);
      expect(readPredictionsDocument(createStorageContext())).toEqual(before);
      expect(stored()).toEqual({ status: "predicted", prediction: original });

      await act(async () => gate().clear(prompt.promptId));
      expect(gate().records.get(prompt.promptId)?.state).toBe("cleared");
      expect(gate().records.get(prompt.promptId)?.choice).toBeNull();
      expect(gate().predictions).toEqual([]);
      expect(readPredictionsDocument(createStorageContext())).toEqual(before);
      expect(stored()).toEqual({ status: "predicted", prediction: original });
    });
    await mounted(async (gate) => {
      expect(gate().records.get(prompt.promptId)?.state).toBe("revealed");
      expect(gate().records.get(prompt.promptId)?.choice).toEqual(original);
      expect(gate().predictions).toEqual([predictionForLink(prompt.promptId, original)]);
    });
  });

  for (const action of ["keep", "skip"] as const) {
    test(`${action}: acting on a second prompt leaves the imported record and its source event untouched`, async () => {
      const otherPrompt = PREDICT_PROMPTS["bm-06"]?.find(
        (entry) => entry.promptId !== prompt.promptId,
      );
      assert.ok(otherPrompt, "This isolation case needs a second authored prompt.");
      const incoming = Object.freeze([Object.freeze(predictionForLink(prompt.promptId, original))]);
      const sourceBefore = structuredClone(incoming);
      await mounted(
        async (gate) => {
          await act(async () => gate().restore(incoming));
          const importedBefore = structuredClone(gate().records.get(prompt.promptId));
          await act(async () => gate()[action](otherPrompt.promptId));
          expect(gate().records.get(prompt.promptId)).toEqual(importedBefore);
          expect(gate().records.get(prompt.promptId)?.choice).toEqual(original);
          expect(gate().predictions).toEqual(incoming);
          expect(incoming).toEqual(sourceBefore);
          expect(stored()).toBeUndefined();
          expect(
            getStoredPrompt(
              readPredictionsDocument(createStorageContext()),
              "bm-06",
              otherPrompt.promptId,
            ),
          ).toEqual({ status: action === "keep" ? "predicted-unrecorded" : "skipped" });
        },
        [prompt, otherPrompt],
      );
    });
  }

  test("a stale visited choice opens the laboratory without restoring or sharing a fabricated answer", async () => {
    LOCAL_PREDICT_PERSISTENCE.record("bm-06", prompt.promptId, {
      form: "candidate",
      candidateId: "removed-candidate",
    });
    await mounted(async (gate) => {
      expect(gate().open).toBe(true);
      expect(gate().records.get(prompt.promptId)?.state).toBe("skipped");
      expect(gate().records.get(prompt.promptId)?.choice).toBeNull();
      expect(gate().predictions).toEqual([]);
    });
  });

  test("unrelated and stale incoming choices leave the valid original unchanged", async () => {
    LOCAL_PREDICT_PERSISTENCE.record("bm-06", prompt.promptId, original);
    await mounted(async (gate) => {
      await act(async () =>
        gate().restore([
          {
            promptId: "another-prompt",
            form: "candidate",
            payload: { candidateId: "uniform-spread" },
          },
          {
            promptId: prompt.promptId,
            form: "values",
            payload: { targets: [{ targetId: "removed-target", value: 0.3 }] },
          },
        ]),
      );
      expect(gate().records.get(prompt.promptId)?.choice).toEqual(original);
      expect(gate().predictions).toEqual([predictionForLink(prompt.promptId, original)]);
      expect(stored()).toEqual({ status: "predicted", prediction: original });
    });
  });

  for (const action of ["keep", "skip"] as const) {
    test(`${action}: a visited private or skipped prompt never restores an older recorded guess`, async () => {
      LOCAL_PREDICT_PERSISTENCE.record("bm-06", prompt.promptId, original);
      LOCAL_PREDICT_PERSISTENCE[action]("bm-06", prompt.promptId);
      await mounted(async (gate) => {
        expect(gate().open).toBe(true);
        expect(gate().records.get(prompt.promptId)?.choice).toBeNull();
        expect(gate().predictions).toEqual([]);
        expect(stored()).toEqual({
          status: action === "keep" ? "predicted-unrecorded" : "skipped",
        });
      });
    });
  }

  test("explore directly opens a fresh laboratory without creating a stored answer", async () => {
    writeGlobalPredictEntry(createStorageContext(), "explore-directly");
    await mounted(async (gate) => {
      expect(gate().open).toBe(true);
      expect(gate().records.get(prompt.promptId)?.state).toBe("skipped");
      expect(gate().predictions).toEqual([]);
      expect(stored()).toBeUndefined();
    });
  });

  test("the embed's memory-only port neither reads existing local choices nor writes a new choice", async () => {
    LOCAL_PREDICT_PERSISTENCE.record("bm-06", prompt.promptId, original);
    const before = readPredictionsDocument(createStorageContext());
    installPredictPersistence(REMEMBERS_NOTHING);
    await mounted(async (gate) => {
      expect(gate().open).toBe(false);
      expect(gate().records.get(prompt.promptId)?.state).toBe("hidden");
      expect(gate().records.get(prompt.promptId)?.choice).toBeNull();
      const inMemory: PredictionChoice = { form: "candidate", candidateId: "symmetric-peak" };
      await act(async () => gate().record(prompt.promptId, inMemory));
      expect(gate().records.get(prompt.promptId)?.choice).toEqual(inMemory);
      expect(readPredictionsDocument(createStorageContext())).toEqual(before);
    });
  });
});

test("untrusted curve choices must still match the current authored targets and finite axis bounds", () => {
  expect(checkedPredictionChoice(original, prompt)).toEqual(original);
  const boundarySketch: PredictionChoice = {
    form: "sketch",
    points: [
      [-4, 0],
      [4, 0.5],
    ],
  };
  expect(checkedPredictionChoice(boundarySketch, prompt)).toEqual(boundarySketch);
  for (const raw of [
    { form: "candidate", candidateId: "removed-candidate" },
    { form: "sketch", points: [] },
    { form: "sketch", points: [[0, Infinity]] },
    { form: "sketch", points: [[7, 0.2]] },
    { form: "sketch", points: [[4.0001, 0.2]] },
    { form: "sketch", points: [[-4.0001, 0.2]] },
    { form: "sketch", points: [[0, 0.50001]] },
    { form: "sketch", points: [[0, -0.00001]] },
    { form: "values", targets: original.targets.slice(0, 2) },
    { form: "values", targets: [...original.targets.slice(0, 2), original.targets[0]] },
    { form: "values", targets: original.targets.map((target) => ({ ...target, value: -1 })) },
  ]) {
    expect(checkedPredictionChoice(raw, prompt)).toBeNull();
  }
});
