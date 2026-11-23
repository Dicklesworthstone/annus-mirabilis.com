import assert from "node:assert/strict";
import test from "node:test";
import {
  clearNamespacesWithReport,
  exportNamespaces,
} from "../../platform/storage/exportClear.ts";
import { listQuarantine } from "../../platform/storage/quarantine.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import {
  InMemoryStorage,
  type InMemoryStorageOptions,
  quotaExceededError,
} from "../../platform/storage/testSupport.ts";
import { createLocalPredictPersistence } from "./localPredictPersistence.ts";
import type { PredictionChoice } from "./predictState.ts";
import {
  decodePredictionsDocument,
  emptyPredictionsDocument,
  exportPreviewLines,
  getStoredPrompt,
  markVisited,
  PREDICTIONS_NAMESPACE,
  readPredictionsDocument,
  recordPrediction,
} from "./predictStorage.ts";

const LAB = "bm-05";
const PROMPT = "bm-05-predict-step-shape";
const choice = (candidateId: string): PredictionChoice => ({ form: "candidate", candidateId });

function fixture() {
  const failures: InMemoryStorageOptions = {};
  const storage = new InMemoryStorage(failures);
  const context = createStorageContext({ getStorage: () => storage });
  const persistence = createLocalPredictPersistence(context);
  const durable = () =>
    readPredictionsDocument(createStorageContext({ getStorage: () => storage }));
  return { failures, storage, context, persistence, durable };
}

function savedAnswer(candidateId = "saved") {
  return recordPrediction(
    markVisited(emptyPredictionsDocument(), LAB, PROMPT),
    LAB,
    PROMPT,
    choice(candidateId),
  );
}

test("a quota-failed overwrite stays readable and only a fresh action on that prompt saves it", () => {
  const f = fixture();
  const original = savedAnswer();
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(original));
  f.failures.throwOnSet = quotaExceededError();

  f.persistence.record(LAB, PROMPT, choice("first unsaved"));
  f.persistence.record(LAB, "second", choice("second unsaved"));

  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("first unsaved"));
  assert.deepEqual(f.persistence.read?.(LAB, "second"), choice("second unsaved"));
  assert.equal(f.persistence.asks(LAB, [PROMPT]), false);
  assert.equal(f.persistence.asks(LAB, ["second"]), false);
  assert.deepEqual(f.durable(), original);
  const exported = exportNamespaces(f.context, [PREDICTIONS_NAMESPACE]);
  assert.deepEqual(exported.namespaces[0]?.value, original);
  assert.deepEqual(exported.recoveryCopies?.[0]?.value, readPredictionsDocument(f.context));

  delete f.failures.throwOnSet;
  f.persistence.skip(LAB, "third");

  assert.deepEqual(getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction, choice("saved"));
  assert.equal(getStoredPrompt(f.durable(), LAB, "second"), undefined);
  assert.equal(getStoredPrompt(f.durable(), LAB, "third")?.status, "skipped");
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("first unsaved"));
  assert.deepEqual(f.persistence.read?.(LAB, "second"), choice("second unsaved"));

  f.persistence.record(LAB, PROMPT, choice("first unsaved"));
  assert.deepEqual(getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction, choice("first unsaved"));
  assert.equal(getStoredPrompt(f.durable(), LAB, "second"), undefined);
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), true);

  f.persistence.record(LAB, "second", choice("second unsaved"));
  assert.deepEqual(
    getStoredPrompt(f.durable(), LAB, "second")?.prediction,
    choice("second unsaved"),
  );
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), false);

  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer("later saved answer")));
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("later saved answer"));
});

test("a failed first save remains readable, and keeping a later answer private drops its content", () => {
  const f = fixture();
  f.failures.throwOnSet = quotaExceededError();

  f.persistence.record(LAB, PROMPT, choice("private answer"));
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("private answer"));
  assert.equal(f.persistence.asks(LAB, [PROMPT]), false);
  f.persistence.keep(LAB, PROMPT);
  f.persistence.skip(LAB, "second");

  assert.equal(f.persistence.read?.(LAB, PROMPT), undefined);
  assert.equal(f.persistence.asks(LAB, [PROMPT]), false);
  assert.equal(f.persistence.asks(LAB, ["second"]), false);
  const retained = readPredictionsDocument(f.context);
  assert.deepEqual(getStoredPrompt(retained, LAB, PROMPT), { status: "predicted-unrecorded" });
  assert.equal(JSON.stringify(retained).includes("private answer"), false);
  assert.equal(f.storage.rawGet(PREDICTIONS_NAMESPACE), undefined);
});

test("temporarily blocked storage does not erase the latest answer when the old saved data returns", () => {
  const f = fixture();
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer()));
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("saved"));

  f.failures.throwOnAnyAccess = new Error("Storage is temporarily blocked.");
  f.persistence.record(LAB, PROMPT, choice("while blocked"));
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("while blocked"));
  delete f.failures.throwOnAnyAccess;

  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("while blocked"));
  f.persistence.skip(LAB, "second");
  assert.deepEqual(getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction, choice("saved"));
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("while blocked"));

  f.persistence.record(LAB, PROMPT, choice("while blocked"));
  assert.deepEqual(getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction, choice("while blocked"));
  assert.equal(getStoredPrompt(f.durable(), LAB, "second")?.status, "skipped");
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), false);
});

test("an unrelated action preserves another tab's saved prompt and keeps the earlier pending answer local", () => {
  const f = fixture();
  const original = savedAnswer();
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(original));
  f.failures.throwOnSet = quotaExceededError();
  f.persistence.record(LAB, PROMPT, choice("local answer"));

  const otherTab = recordPrediction(
    markVisited(original, "sr-03", "other prompt"),
    "sr-03",
    "other prompt",
    choice("other tab answer"),
  );
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(otherTab));
  delete f.failures.throwOnSet;
  f.persistence.skip(LAB, "third");

  const saved = f.durable();
  assert.deepEqual(getStoredPrompt(saved, LAB, PROMPT)?.prediction, choice("saved"));
  assert.deepEqual(
    getStoredPrompt(saved, "sr-03", "other prompt")?.prediction,
    choice("other tab answer"),
  );
  assert.equal(getStoredPrompt(saved, LAB, "third")?.status, "skipped");
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("local answer"));
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), true);

  f.persistence.record(LAB, PROMPT, choice("fresh explicit answer"));
  assert.deepEqual(
    getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction,
    choice("fresh explicit answer"),
  );
  assert.deepEqual(
    getStoredPrompt(f.durable(), "sr-03", "other prompt")?.prediction,
    choice("other tab answer"),
  );
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), false);
});

test("a competing saved answer survives unrelated saves until a new explicit choice", () => {
  const f = fixture();
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer()));
  f.failures.throwOnSet = quotaExceededError();
  f.persistence.record(LAB, PROMPT, choice("local answer"));
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer("other tab answer")));
  delete f.failures.throwOnSet;

  f.persistence.skip(LAB, "different prompt");

  assert.deepEqual(
    getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction,
    choice("other tab answer"),
  );
  assert.equal(getStoredPrompt(f.durable(), LAB, "different prompt")?.status, "skipped");
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("local answer"));
  const exported = exportNamespaces(f.context, [PREDICTIONS_NAMESPACE]);
  assert.deepEqual(exported.namespaces[0]?.value, f.durable());
  assert.deepEqual(exported.recoveryCopies?.[0]?.value, readPredictionsDocument(f.context));

  f.persistence.record(LAB, PROMPT, choice("new explicit answer"));
  assert.deepEqual(
    getStoredPrompt(f.durable(), LAB, PROMPT)?.prediction,
    choice("new explicit answer"),
  );
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), false);
});

test("an external clear is not undone by saving a different prompt", () => {
  const f = fixture();
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer()));
  f.failures.throwOnSet = quotaExceededError();
  f.persistence.record(LAB, PROMPT, choice("unsaved before clear"));
  f.storage.removeItem(PREDICTIONS_NAMESPACE);
  delete f.failures.throwOnSet;

  f.persistence.skip(LAB, "new prompt");

  assert.equal(getStoredPrompt(f.durable(), LAB, PROMPT), undefined);
  assert.equal(getStoredPrompt(f.durable(), LAB, "new prompt")?.status, "skipped");
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("unsaved before clear"));
  assert.equal(exportNamespaces(f.context, [PREDICTIONS_NAMESPACE]).recoveryCopies?.length, 1);
});

test("clearing a quota-failed answer stays local until a fresh clear on that prompt can be saved", () => {
  const f = fixture();
  f.failures.throwOnSet = quotaExceededError();
  f.persistence.record(LAB, PROMPT, choice("answer to clear"));
  f.persistence.clear?.(LAB, PROMPT);

  assert.equal(f.persistence.read?.(LAB, PROMPT), undefined);
  assert.equal(f.persistence.asks(LAB, [PROMPT]), false);
  delete f.failures.throwOnSet;
  f.persistence.skip(LAB, "later prompt");
  assert.equal(getStoredPrompt(f.durable(), LAB, PROMPT), undefined);
  assert.equal(f.durable().visited[LAB]?.[PROMPT], undefined);
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), true);

  f.persistence.clear?.(LAB, PROMPT);
  assert.equal(getStoredPrompt(f.durable(), LAB, PROMPT), undefined);
  assert.equal(f.durable().visited[LAB]?.[PROMPT], true);
  assert.equal(f.context.fallback.has(PREDICTIONS_NAMESPACE), false);
});

test("an unreadable saved document stays protected while new answers remain available for the visit", () => {
  for (const raw of [
    JSON.stringify({ schemaVersion: 999, privateNotes: ["future data"] }),
    JSON.stringify({ schemaVersion: 1, visited: null, prompts: {}, entryOverrides: {} }),
  ]) {
    const f = fixture();
    f.storage.rawSet(PREDICTIONS_NAMESPACE, raw);

    f.persistence.record(LAB, PROMPT, choice("session answer"));
    assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("session answer"));
    assert.equal(f.persistence.asks(LAB, [PROMPT]), false);
    assert.equal(f.storage.rawGet(PREDICTIONS_NAMESPACE), raw);
    assert.equal(listQuarantine(f.context).length, 1);

    const exported = exportNamespaces(f.context, [PREDICTIONS_NAMESPACE]);
    assert.deepEqual(exported.namespaces[0]?.value, JSON.parse(raw));
    assert.equal(exported.recoveryCopies?.length, 1);
  }
});

test("instances share durable changes but keep failed session writes isolated, without eager storage access", () => {
  let accesses = 0;
  const storage = new InMemoryStorage({ throwOnSet: quotaExceededError() });
  const first = createLocalPredictPersistence(
    createStorageContext({
      getStorage: () => {
        accesses++;
        return storage;
      },
    }),
  );
  const second = createLocalPredictPersistence(
    createStorageContext({ getStorage: () => storage }),
  );
  assert.equal(accesses, 0);

  first.record(LAB, PROMPT, choice("first instance only"));
  assert.deepEqual(first.read?.(LAB, PROMPT), choice("first instance only"));
  assert.equal(second.read?.(LAB, PROMPT), undefined);

  storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer("other tab answer")));
  assert.deepEqual(second.read?.(LAB, PROMPT), choice("other tab answer"));
  assert.equal(second.asks(LAB, [PROMPT]), false);
  assert.deepEqual(first.read?.(LAB, PROMPT), choice("first instance only"));
});

test("a global clear of an already absent key cannot resurrect a failed first answer", () => {
  const f = fixture();
  // The real panel can offer Clear all because another registered namespace holds data.
  f.storage.rawSet("am:settings:v1:theme", "annalen");
  f.failures.throwOnSet = quotaExceededError();
  f.persistence.record(LAB, PROMPT, choice("before clear"));
  assert.equal(f.storage.rawGet(PREDICTIONS_NAMESPACE), undefined);

  const panel = createStorageContext({ getStorage: () => f.storage });
  const cleared = clearNamespacesWithReport(panel);
  assert.equal(cleared.cleared.includes(PREDICTIONS_NAMESPACE), true);
  assert.equal(cleared.failed.length, 0);
  delete f.failures.throwOnSet;

  f.persistence.skip(LAB, "after clear");

  assert.equal(getStoredPrompt(f.durable(), LAB, PROMPT), undefined);
  assert.equal(f.durable().visited[LAB]?.[PROMPT], undefined);
  assert.equal(getStoredPrompt(f.durable(), LAB, "after clear")?.status, "skipped");
  assert.deepEqual(f.persistence.read?.(LAB, PROMPT), choice("before clear"));
  const saved = f.storage.rawGet(PREDICTIONS_NAMESPACE);
  f.persistence.asks(LAB, [PROMPT]);
  f.persistence.read?.(LAB, PROMPT);
  assert.equal(f.storage.rawGet(PREDICTIONS_NAMESPACE), saved);
});

test("a clear followed by another tab's save cannot flush an older pending prompt", () => {
  const f = fixture();
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(savedAnswer()));
  f.failures.throwOnSet = quotaExceededError();
  f.persistence.record(LAB, "pending before clear", choice("old pending answer"));

  const panel = createStorageContext({ getStorage: () => f.storage });
  assert.deepEqual(clearNamespacesWithReport(panel, [PREDICTIONS_NAMESPACE]), {
    cleared: [PREDICTIONS_NAMESPACE],
    failed: [],
  });
  const afterClear = recordPrediction(
    markVisited(emptyPredictionsDocument(), "sr-03", "other tab prompt"),
    "sr-03",
    "other tab prompt",
    choice("after clear"),
  );
  f.storage.rawSet(PREDICTIONS_NAMESPACE, JSON.stringify(afterClear));
  delete f.failures.throwOnSet;

  f.persistence.skip(LAB, "new explicit action");

  const saved = f.durable();
  assert.equal(getStoredPrompt(saved, LAB, PROMPT), undefined);
  assert.equal(getStoredPrompt(saved, LAB, "pending before clear"), undefined);
  assert.equal(saved.visited[LAB]?.["pending before clear"], undefined);
  assert.deepEqual(
    getStoredPrompt(saved, "sr-03", "other tab prompt")?.prediction,
    choice("after clear"),
  );
  assert.equal(getStoredPrompt(saved, LAB, "new explicit action")?.status, "skipped");
  assert.deepEqual(f.persistence.read?.(LAB, "pending before clear"), choice("old pending answer"));
});

test("invalid-predictions-document refuses missing or malformed maps without accepting an empty replacement", () => {
  for (const document of [
    { schemaVersion: 1, visited: null, prompts: {}, entryOverrides: {} },
    { schemaVersion: 1, visited: {}, prompts: { [LAB]: [] }, entryOverrides: {} },
    { schemaVersion: 1, visited: {}, prompts: {}, entryOverrides: { [LAB]: "unknown" } },
  ]) {
    assert.throws(() => decodePredictionsDocument(JSON.stringify(document)), {
      name: "TypeError",
      message: "invalid-predictions-document",
    });
  }
  assert.deepEqual(decodePredictionsDocument(JSON.stringify(savedAnswer())), savedAnswer());
});

test("invalid-predictions-document rejects malformed payloads and the storage reader preserves their bytes", () => {
  for (const prediction of [
    {},
    { form: "candidate" },
    { form: "sketch" },
    { form: "sketch", points: [null] },
    { form: "sketch", points: [[0, "not a number"]] },
    { form: "verbal", directionId: "up" },
    { form: "values" },
    { form: "values", targets: [{}] },
    { form: "values", targets: [{ targetId: "distance", value: null }] },
  ]) {
    const raw = JSON.stringify({
      ...emptyPredictionsDocument(),
      prompts: { [LAB]: { [PROMPT]: { status: "predicted", prediction } } },
    });
    assert.throws(() => decodePredictionsDocument(raw), {
      name: "TypeError",
      message: "invalid-predictions-document",
    });
    const f = fixture();
    f.storage.rawSet(PREDICTIONS_NAMESPACE, raw);
    assert.deepEqual(readPredictionsDocument(f.context), emptyPredictionsDocument());
    assert.equal(f.storage.rawGet(PREDICTIONS_NAMESPACE), raw);
    assert.equal(listQuarantine(f.context)[0]?.rawValue, raw);
  }
});

test("all stored prediction forms remain readable and produce a safe export preview", () => {
  const examples: readonly { prediction: PredictionChoice; summary: string }[] = [
    { prediction: choice("wider-bell"), summary: "A wider bell" },
    { prediction: { form: "sketch", points: [[0, 1], [1, 2]] }, summary: "sketch (2 points)" },
    { prediction: { form: "verbal", directionId: "up", shapeId: "wider" }, summary: "up, wider" },
    {
      prediction: { form: "values", targets: [{ targetId: "distance", value: 2 }] },
      summary: "distance=2",
    },
  ];
  for (const { prediction, summary } of examples) {
    const document = recordPrediction(emptyPredictionsDocument(), LAB, PROMPT, prediction);
    const raw = JSON.stringify(document);
    const f = fixture();
    f.storage.rawSet(PREDICTIONS_NAMESPACE, raw);
    assert.deepEqual(decodePredictionsDocument(raw), document);
    assert.deepEqual(readPredictionsDocument(f.context), document);
    const preview = exportPreviewLines(readPredictionsDocument(f.context), {
      [LAB]: {
        [PROMPT]: {
          question: "What changes?",
          candidateLabelById: { "wider-bell": "A wider bell" },
        },
      },
    });
    assert.equal(preview[0]?.summary, summary);
  }
});

test("the storage reader preserves existing JSON and future-version quarantine reasons", () => {
  for (const { raw, reason } of [
    { raw: "{not JSON", reason: "invalid-json" },
    {
      raw: JSON.stringify({ schemaVersion: 999, privateNotes: ["future data"] }),
      reason: "schemaVersion 999 is newer than the known version 1.",
    },
  ]) {
    const f = fixture();
    f.storage.rawSet(PREDICTIONS_NAMESPACE, raw);
    assert.deepEqual(readPredictionsDocument(f.context), emptyPredictionsDocument());
    assert.equal(listQuarantine(f.context)[0]?.reason, reason);
    assert.equal(listQuarantine(f.context)[0]?.rawValue, raw);
    assert.equal(f.storage.rawGet(PREDICTIONS_NAMESPACE), raw);
  }
});
