#!/usr/bin/env bun
import { defaultScenarioDirs, loadScenarios } from "../src/testing/scenario-registry/load.ts";
import { runLoadedScenarios } from "../src/testing/scenario-registry/run.ts";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const kind = arg("--kind");
const owner = arg("--owner");
const paper = arg("--paper");
const id = arg("--id");
const extraPath = arg("--path");
const dirs = extraPath ? [extraPath, ...defaultScenarioDirs()] : defaultScenarioDirs();

let loaded = loadScenarios(dirs);
if (id) loaded = loaded.filter((item) => item.scenario.id === id);

if (kind) loaded = loaded.filter((item) => item.scenario.kind === kind);
if (owner) loaded = loaded.filter((item) => item.scenario.owner === owner);
if (paper) {
  loaded = loaded.filter((item) => item.scenario.provenance?.paper === paper);
}

const { results, logRunId, failed, notAvailable } = runLoadedScenarios(loaded);
const passed = results.filter((r) => r.status === "passed").length;
const byKind: Record<string, { passed: number; failed: number; notAvailable: number }> = {};
let roundsTo = 0;
let independentIdentities = 0;
for (const row of results) {
  let bucket = byKind[row.kind];
  if (!bucket) {
    bucket = { passed: 0, failed: 0, notAvailable: 0 };
    byKind[row.kind] = bucket;
  }
  if (row.status === "passed") bucket.passed += 1;
  else if (row.status === "failed") bucket.failed += 1;
  else bucket.notAvailable += 1;
  if (row.extra.roundingIntervalLow !== undefined) roundsTo += 1;
  if (row.kind === "identity" && row.extra.identityIndependence === true)
    independentIdentities += 1;
}

console.log(
  JSON.stringify({
    event: "scenarios-run",
    logRunId,
    passed,
    failed,
    notAvailable,
    byKind,
    roundsToRows: roundsTo,
    independentIdentities,
    results: results.map((r) => ({
      id: r.scenarioId,
      kind: r.kind,
      status: r.status,
      message: r.message,
    })),
  }),
);

if (failed > 0) process.exit(1);
