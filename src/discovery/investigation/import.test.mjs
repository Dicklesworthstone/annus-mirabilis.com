import assert from "node:assert/strict";
import test from "node:test";
import { createInvestigationStore, exportInvestigationJson } from "./core.ts";
import {
  INVESTIGATION_IMPORT_BYTES,
  parseInvestigationImport,
  readInvestigationImport,
} from "./import.ts";
import { INVESTIGATIONS } from "./specs.ts";

/** The real report producer over an accepted-view boundary fixture, with no numerical substitute. */
function reportFor(paper = "brownian-motion") {
  const spec = INVESTIGATIONS[paper];
  const identity = {
    experimentId: spec.experimentId,
    instanceId: "placement-A",
    runId: "run-1",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { radius: 5e-7, seed: "18446744073709551615", offset: -0 },
  };
  const view = {
    status: "accepted",
    pending: false,
    requested: identity,
    accepted: {
      ...identity,
      snapshotVersion: 1,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: spec.quantities.map(({ id }) => ({
        quantityId: id,
        ownerId: "fixture.owner",
        semanticKind: "fixture-scalar",
        unit: "m",
        status: "value",
        value: 1e-7,
      })),
    },
  };
  const store = createInvestigationStore(spec);
  store.connect({ getSnapshot: () => view, subscribe: () => () => {} }, "fixture-source-v1");
  assert.equal(
    store.begin("The spread gets smaller.", {
      promptId: spec.promptId,
      task: "What happens when a setting changes?",
      perturbPrompt: "Change one setting.",
      explainPrompt: "Explain the change and limits.",
    }).ok,
    true,
  );
  assert.equal(store.explain("A model comparison, not a measurement.").ok, true);
  return store.getSnapshot().report;
}

for (const paper of Object.keys(INVESTIGATIONS)) {
  test(`${paper}: exported JSON reopens with the exact seed, signed zero and saved readings`, async () => {
    const original = reportFor(paper);
    const text = exportInvestigationJson(original);
    const result = await readInvestigationImport(
      new File([text], "investigation.json", { type: "application/json" }),
      INVESTIGATIONS[paper],
    );
    assert.equal(result.ok, true);
    assert.equal(exportInvestigationJson(result.report), text);
    assert.equal(result.report.baseline.reading.parameters.seed, "18446744073709551615");
    assert.equal(Object.is(result.report.baseline.reading.parameters.offset, -0), true);
    const destination = createInvestigationStore(INVESTIGATIONS[paper]);
    assert.equal(destination.restore(result.report).ok, true);
    assert.equal(destination.getSnapshot().restored, true);
    assert.equal(destination.capture("Cannot mix with another session").ok, false);
  });
}

test("oversized files are refused before reading, and dishonest size metadata cannot bypass the bound", async () => {
  let reads = 0;
  const first = await readInvestigationImport(
    {
      size: INVESTIGATION_IMPORT_BYTES + 1,
      text: async () => {
        reads++;
        return "{}";
      },
    },
    INVESTIGATIONS["brownian-motion"],
  );
  assert.equal(first.reason, "size");
  assert.equal(reads, 0);
  const second = await readInvestigationImport(
    { size: 1, text: async () => " ".repeat(INVESTIGATION_IMPORT_BYTES + 1) },
    INVESTIGATIONS["brownian-motion"],
  );
  assert.equal(second.reason, "size");
  assert.equal(
    parseInvestigationImport(
      "ü".repeat(INVESTIGATION_IMPORT_BYTES / 2 + 1),
      INVESTIGATIONS["brownian-motion"],
    ).reason,
    "size",
  );
});

test("unreadable files, malformed JSON and future formats leave an existing investigation intact", async () => {
  const spec = INVESTIGATIONS["brownian-motion"];
  const current = createInvestigationStore(spec);
  const original = reportFor();
  assert.equal(current.restore(original).ok, true);
  const unreadable = await readInvestigationImport(
    { size: 1, text: async () => Promise.reject(new Error("private file path")) },
    spec,
  );
  assert.equal(unreadable.reason, "read");
  assert.equal(unreadable.message.includes("private file path"), false);
  assert.equal(parseInvestigationImport("<html>printable version</html>", spec).reason, "json");
  assert.equal(parseInvestigationImport("{", spec).reason, "json");
  for (const mutation of [
    { ...original, version: 99 },
    { ...original, futureField: "keep the original" },
    { schemaVersion: 1, report: original },
  ]) {
    const result = parseInvestigationImport(JSON.stringify(mutation), spec);
    assert.equal(result.reason, "format");
    assert.match(result.message, /Keep the original file/);
  }
  assert.equal(current.getSnapshot().report, original);
});

test("another journey gets its known local destination, never the source URL supplied by a file", () => {
  const original = { ...reportFor("light-quanta"), sourceHref: "javascript:alert(1)" };
  const result = parseInvestigationImport(
    JSON.stringify(original),
    INVESTIGATIONS["brownian-motion"],
  );
  assert.equal(result.reason, "journey");
  assert.equal(
    result.journeyHref,
    `/discover/light-quanta/#${INVESTIGATIONS["light-quanta"].promptId}`,
  );
});

test("inconsistent task, instrument, placement, source and selected quantities are refused", () => {
  const original = reportFor();
  const baseline = original.baseline.reading;
  const observation = { label: "Changed reading", reading: baseline };
  const mutations = [
    { ...original, paper: "unknown-paper" },
    { ...original, promptId: "other-task" },
    { ...original, task: { ...original.task, promptId: "other-task" } },
    { ...original, experimentId: "sr-05" },
    {
      ...original,
      baseline: { ...original.baseline, reading: { ...baseline, experimentId: "sr-05" } },
    },
    {
      ...original,
      observations: [{ ...observation, reading: { ...baseline, instanceId: "another-placement" } }],
    },
    {
      ...original,
      observations: [{ ...observation, reading: { ...baseline, sourceDigest: "another-model" } }],
    },
    {
      ...original,
      baseline: {
        ...original.baseline,
        reading: { ...baseline, outputs: baseline.outputs.slice(1) },
      },
    },
    {
      ...original,
      baseline: {
        ...original.baseline,
        reading: { ...baseline, outputs: [...baseline.outputs, baseline.outputs[0]] },
      },
    },
  ];
  for (const mutation of mutations) {
    const result = parseInvestigationImport(
      JSON.stringify(mutation),
      INVESTIGATIONS["brownian-motion"],
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, "identity");
  }
});
