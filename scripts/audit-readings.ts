#!/usr/bin/env bun
/**
 * CLI for the readings audit (am-cm-audit-scripts-d34).
 *
 * IT RUNS OVER THE REAL CORPUS BY DEFAULT, and over a fixture only when asked (am-8gbg criterion 1:
 * "audit-readings.ts and audit-misconceptions.ts run over the real corpus in a lane, not only with
 * --fixture, and each prints the number of records examined beside its verdict. A count of 0 fails").
 *
 * UNTIL NOW IT REFUSED TO START WITHOUT `--fixture`. The audit itself was reachable, because
 * verify-content builds the live input and calls `auditReadings()`, but the SCRIPT named after the
 * audit had never met its own population, and `scriptReachability.test.ts` carried an entry
 * excusing it. That is the shape AGENTS.md warns about under "A Gate's Own Test Must Not Live Only
 * In The Lane That Gate Controls": the only way to ask this audit a question was to run a
 * five-minute central gate, which nobody does while authoring a readings-owner file.
 *
 * It reads through `loadLiveReadingsInput`, the SAME loader verify-content now uses, rather than
 * re-deriving the population here. Two readers of one corpus drift, and the drift is invisible
 * because both keep printing a plausible number.
 *
 * AN UNPARSEABLE OWNER FILE IS A FAILURE HERE TOO, and it is the reason this was worth doing rather
 * than only the reachability. The loader this replaces ended `} catch { // Ignore unparseable }`,
 * so a readings-owner file with a YAML error contributed no owner and no targets and the audit
 * judged a corpus with that file's declarations missing -- "a reading could vanish unnoticed", which
 * is this bead's own title. The count was computed over what survived the catch, so nothing looked
 * wrong.
 *
 * WHICH HALF CATCHES A ZERO. `summarize()` already refuses a DECLARED population of zero
 * (`declaredNothingToJudge`, am-1hst), and verify-content additionally refuses an empty owner or
 * target list by name. The census line below is therefore the REPORT the criterion asks for rather
 * than the catch, and the floor of 30 owner files is what notices a directory read half-way:
 * measured 2026-10-11 there are 41 owner files declaring 63 targets. Raise it as owners land; never
 * lower it to make a thin run pass.
 *
 * `--root <dir>` EXISTS SO THOSE REFUSALS ARE PROVABLE without emptying or corrupting the real
 * `content/editorial/readings-owners`, which RULE 1 forbids and which no reviewer should have to do.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditReadings, type ReadingsAuditInput } from "../src/content/audits/readings.ts";
import { loadLiveReadingsInput } from "../src/content/audits/readingsLive.ts";
import { reportPopulation } from "./gate-census/population.ts";

const rootIdx = process.argv.indexOf("--root");
const root =
  rootIdx !== -1 && process.argv[rootIdx + 1]
    ? resolve(process.argv[rootIdx + 1] as string)
    : resolve(fileURLToPath(new URL("..", import.meta.url)));
const idx = process.argv.indexOf("--fixture");
if ((idx !== -1 && !process.argv[idx + 1]) || (rootIdx !== -1 && !process.argv[rootIdx + 1])) {
  console.error("Usage: bun scripts/audit-readings.ts [--fixture <file.json>] [--root <dir>]");
  process.exit(2);
}

let input: ReadingsAuditInput;
let examined: number;
let targets: number;
let unparseable: readonly Readonly<{ fileName: string; reason: string }>[] = [];

if (idx !== -1) {
  input = JSON.parse(readFileSync(process.argv[idx + 1] as string, "utf8")) as ReadingsAuditInput;
  examined = input.owners.length;
  targets = input.targets.length;
} else {
  const live = loadLiveReadingsInput(root);
  input = live.input;
  examined = live.ownerFiles;
  targets = live.input.targets.length;
  unparseable = live.unparseable;
}

const report = auditReadings(input);
console.log(JSON.stringify(report, null, 2));

if (idx === -1) {
  console.log(
    `[audit-readings] ${input.owners.length} owner file(s) declaring ${targets} reading target(s)` +
      (unparseable.length > 0 ? `; ${unparseable.length} owner file(s) DID NOT PARSE` : ""),
  );
  for (const u of unparseable) {
    console.error(
      `  [ERROR] ${u.fileName} did not parse (${u.reason}), so its declarations were not judged.`,
    );
  }
}

// A fixture is whatever the caller handed over, so its floor is 1: the question there is whether the
// audit reaches a verdict, not whether the corpus is whole. The live run is held to the corpus floor.
const vacuous = reportPopulation({
  gate: "audit-readings",
  examined,
  noun: idx === -1 ? "readings-owner files" : "fixture readings-owner files",
  minimum: idx === -1 ? 30 : 1,
});

process.exit(report.ok && !vacuous && unparseable.length === 0 ? 0 : 1);
