import assert from "node:assert/strict";
import test from "node:test";
import { pinBaseline } from "./Baseline.ts";
import { comparisonDownload, serializeComparison } from "./comparisonExport.ts";

const contract = {
  experimentId: "export-fixture",
  inputs: {
    radius: {
      label: "Radius",
      unit: "cm",
      displayFactor: 100,
      command: "setup-change",
      comparable: true,
    },
    seed: {
      label: "Seed",
      unit: "",
      displayFactor: 1,
      command: "setup-change",
      comparable: false,
    },
  },
  outputs: [{ id: "reading", label: "Reading", displayUnit: "cm", displayFactor: 100 }],
};
const identity = {
  modelVersion: "model-1",
  streamVersion: "stream-1",
  allocationId: "allocation-1",
  constantSetId: "constants-1",
  sourceDigest: "source-1",
  artifactDigest: null,
  executionLabel: "host-calculation",
};
function baseline(variant = false, payload = { status: "value", value: 1.23456789 }) {
  return pinBaseline(
    {
      experimentId: contract.experimentId,
      instanceId: "instance-1",
      runId: variant ? "run-2" : "run-1",
      snapshotVersion: variant ? 2 : 1,
      actionIndex: variant ? 2 : 1,
      final: true,
      revisions: { input: variant ? 2 : 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { radius: variant ? 2 : 1, seed: "18446744073709551615" },
      outputs: [
        {
          quantityId: "reading",
          unit: "m",
          semanticKind: "distance",
          ownerId: "reference.distance",
          ...payload,
        },
      ],
    },
    identity,
    ["reading"],
  );
}

test("export preserves unrounded values, exact seeds, units and both calculation identities", () => {
  const a = baseline(),
    b = baseline(true);
  const json = serializeComparison(a, b, contract);
  const record = JSON.parse(json);
  assert.equal(record.format, "annus-mirabilis-comparison");
  assert.equal(record.version, 1);
  assert.equal(record.baseline.parameters.seed, "18446744073709551615");
  assert.equal(record.baseline.outputs.reading.value, 1.23456789);
  assert.equal(record.baseline.outputs.reading.unit, "m");
  assert.equal(record.contract.outputs[0].displayUnit, "cm");
  assert.equal(record.contract.outputs[0].displayFactor, 100);
  assert.deepEqual(record.baseline.identity, identity);
  assert.equal(record.variant.runId, "run-2");
  assert.equal(record.comparison.rows[0].ratio.value, 1);
  assert.match(record.statement, /Radius from 100 cm to 200 cm/);
  assert.match(record.interpretation.replay, /not a replay tape/);
  assert.equal(serializeComparison(a, b, contract), json);
});

test("download is a bounded, self-contained JSON link that needs no client-side scripting", () => {
  const a = baseline(),
    b = baseline(true);
  const download = comparisonDownload(a, b, contract);
  assert.equal(download.kind, "ready");
  assert.equal(download.filename, "export-fixture-comparison.json");
  assert.ok(download.href.startsWith("data:application/json;charset=utf-8,"));
  const json = decodeURIComponent(download.href.slice(download.href.indexOf(",") + 1));
  assert.equal(json, serializeComparison(a, b, contract));
});

test("a symbolic result and its owner survive export without inventing a number", () => {
  const a = baseline(false, {
    status: "symbolic",
    expressionRef: "energy.absolute",
    unspecifiedSymbols: ["E₀"],
  });
  const record = JSON.parse(serializeComparison(a, baseline(true), contract));
  assert.equal(record.baseline.outputs.reading.value, null);
  assert.deepEqual(record.baseline.outputs.reading.evidence.unspecifiedSymbols, ["E₀"]);
  assert.equal(record.baseline.outputs.reading.evidence.ownerId, "reference.distance");
  assert.equal(record.comparison.rows[0].ratio.status, "not-applicable");
  assert.match(record.comparison.rows[0].ratio.reason, /Supply E₀/);
});

test("incompatible identities are not exported as an accepted comparison", () => {
  const a = baseline(),
    b = { ...baseline(true), identity: { ...identity, sourceDigest: "different" } };
  assert.throws(() => serializeComparison(a, b, contract), TypeError);
  assert.equal(comparisonDownload(a, b, contract).kind, "unavailable");
});

test("large records fail visibly rather than truncating scientific evidence", () => {
  const a = baseline(false, { status: "not-applicable", reason: "α".repeat(100_000) });
  const download = comparisonDownload(a, baseline(true), contract);
  assert.equal(download.kind, "unavailable");
  assert.match(download.message, /download budget/);
  assert.equal(a.outputs.reading.evidence.reason.length, 100_000);
});
