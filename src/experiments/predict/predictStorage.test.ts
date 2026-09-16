import assert from "node:assert/strict";
import test from "node:test";
import { clearNamespaces, exportNamespaces } from "../../platform/storage/exportClear.ts";
import { estimateNamespaceSize } from "../../platform/storage/size.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { InMemoryStorage } from "../../platform/storage/testSupport.ts";
import {
  clearEntryOverride,
  clearPrediction,
  emptyPredictionsDocument,
  exportPreviewLines,
  getEntryOverride,
  getStoredPrompt,
  hasVisited,
  markVisited,
  PREDICTIONS_NAMESPACE,
  readPredictionsDocument,
  recordPrediction,
  recordUnrecordedStatus,
  setEntryOverride,
  withoutPredictions,
  writePredictionsDocument,
} from "./predictStorage.ts";

function contextWith(storage: Storage) {
  return createStorageContext({ getStorage: () => storage });
}

test("the am:predictions:v1 document shape and schemaVersion", () => {
  const doc = emptyPredictionsDocument();
  assert.equal(doc.schemaVersion, 1);
  assert.deepEqual(doc.visited, {});
  assert.deepEqual(doc.prompts, {});
  assert.deepEqual(doc.entryOverrides, {});
  assert.equal(PREDICTIONS_NAMESPACE, "am:predictions:v1");
});

test("recordPrediction, recordUnrecordedStatus, and clearPrediction round-trip through real storage", () => {
  const ctx = contextWith(new InMemoryStorage());
  let doc = emptyPredictionsDocument();
  doc = recordPrediction(doc, "bm-05", "bm-05-predict-step-shape", {
    form: "candidate",
    candidateId: "wider-bell",
  });
  doc = recordUnrecordedStatus(doc, "bm-05", "bm-05-predict-second", "predicted-unrecorded");
  writePredictionsDocument(ctx, doc);

  const reread = readPredictionsDocument(ctx);
  assert.deepEqual(getStoredPrompt(reread, "bm-05", "bm-05-predict-step-shape"), {
    status: "predicted",
    prediction: { form: "candidate", candidateId: "wider-bell" },
  });
  assert.deepEqual(getStoredPrompt(reread, "bm-05", "bm-05-predict-second"), {
    status: "predicted-unrecorded",
  });

  const cleared = clearPrediction(reread, "bm-05", "bm-05-predict-step-shape");
  assert.equal(getStoredPrompt(cleared, "bm-05", "bm-05-predict-step-shape"), undefined);
  assert.notEqual(getStoredPrompt(cleared, "bm-05", "bm-05-predict-second"), undefined);
});

test("a missing or corrupt document reads as empty", () => {
  const missing = contextWith(new InMemoryStorage());
  assert.deepEqual(readPredictionsDocument(missing), emptyPredictionsDocument());

  const corruptStorage = new InMemoryStorage();
  corruptStorage.setItem(PREDICTIONS_NAMESPACE, "not json");
  assert.deepEqual(
    readPredictionsDocument(contextWith(corruptStorage)),
    emptyPredictionsDocument(),
  );
});

test("first-visit flags are per instrument and per prompt", () => {
  let doc = emptyPredictionsDocument();
  assert.equal(hasVisited(doc, "bm-05", "bm-05-predict-step-shape"), false);
  doc = markVisited(doc, "bm-05", "bm-05-predict-step-shape");
  assert.equal(hasVisited(doc, "bm-05", "bm-05-predict-step-shape"), true);
  assert.equal(hasVisited(doc, "bm-05", "bm-05-predict-second"), false);
  assert.equal(hasVisited(doc, "bm-01", "bm-05-predict-step-shape"), false);
});

test("a per-instrument entry override sets and clears independently of other instruments", () => {
  let doc = emptyPredictionsDocument();
  doc = setEntryOverride(doc, "bm-05", "explore-directly");
  assert.equal(getEntryOverride(doc, "bm-05"), "explore-directly");
  assert.equal(getEntryOverride(doc, "bm-01"), undefined);
  doc = clearEntryOverride(doc, "bm-05");
  assert.equal(getEntryOverride(doc, "bm-05"), undefined);
});

test("export and clear of only this namespace, using the real generic export/clear mechanism", () => {
  const ctx = contextWith(new InMemoryStorage());
  const doc = recordPrediction(emptyPredictionsDocument(), "bm-05", "bm-05-predict-step-shape", {
    form: "candidate",
    candidateId: "wider-bell",
  });
  writePredictionsDocument(ctx, doc);

  const exported = exportNamespaces(ctx, [PREDICTIONS_NAMESPACE]);
  assert.equal(exported.namespaces.length, 1);
  assert.equal(exported.namespaces[0]?.key, PREDICTIONS_NAMESPACE);
  assert.deepEqual(exported.namespaces[0]?.value, doc);

  const cleared = clearNamespaces(ctx, [PREDICTIONS_NAMESPACE]);
  assert.deepEqual(cleared, [PREDICTIONS_NAMESPACE]);
  assert.deepEqual(readPredictionsDocument(ctx), emptyPredictionsDocument());
});

test("size accounting against maxBytes uses the real namespace size estimator", () => {
  const ctx = contextWith(new InMemoryStorage());
  writePredictionsDocument(ctx, emptyPredictionsDocument());
  const size = estimateNamespaceSize(ctx, PREDICTIONS_NAMESPACE);
  assert.equal(size.namespace, PREDICTIONS_NAMESPACE);
  assert.ok(size.bytes > 0);
  assert.equal(size.overLimit, false);
});

test("exportPreviewLines renders from the stored document plus a manifest lookup, never a second copy", () => {
  let doc = emptyPredictionsDocument();
  doc = recordPrediction(doc, "bm-05", "bm-05-predict-step-shape", {
    form: "candidate",
    candidateId: "wider-bell",
  });
  doc = recordUnrecordedStatus(doc, "bm-05", "bm-05-predict-second", "predicted-unrecorded");

  const lookups = {
    "bm-05": {
      "bm-05-predict-step-shape": {
        question: "After many steps, what happens?",
        candidateLabelById: { "wider-bell": "Make a wider bell" },
      },
      "bm-05-predict-second": {
        question: "What happens to the mean?",
        candidateLabelById: {},
      },
    },
  };
  const lines = exportPreviewLines(doc, lookups);
  assert.equal(lines.length, 2);
  const recorded = lines.find((l) => l.promptId === "bm-05-predict-step-shape");
  const unrecorded = lines.find((l) => l.promptId === "bm-05-predict-second");
  assert.equal(recorded?.summary, "Make a wider bell");
  assert.equal(unrecorded?.summary, "kept to yourself, not recorded");
});

test("withoutPredictions removes every prompt entry but keeps visited flags and overrides", () => {
  let doc = emptyPredictionsDocument();
  doc = recordPrediction(doc, "bm-05", "p1", { form: "candidate", candidateId: "x" });
  doc = markVisited(doc, "bm-05", "p1");
  doc = setEntryOverride(doc, "bm-05", "explore-directly");
  const stripped = withoutPredictions(doc);
  assert.deepEqual(stripped.prompts, {});
  assert.equal(hasVisited(stripped, "bm-05", "p1"), true);
  assert.equal(getEntryOverride(stripped, "bm-05"), "explore-directly");
});
