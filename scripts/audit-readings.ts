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
import baseline from "../src/content/audits/readingCoverage.baseline.json" with { type: "json" };
import {
  type CoverageBaseline,
  coverageCensusLine,
  coverageFindings,
  measureReadingCoverage,
} from "../src/content/audits/readingCoverage.ts";
import { auditReadings, type ReadingsAuditInput } from "../src/content/audits/readings.ts";
import { loadLiveReadingsInput } from "../src/content/audits/readingsLive.ts";
import { retainLaneRun } from "./gate-census/laneEvidence.ts";

const rootIdx = process.argv.indexOf("--root");
/** The repository, where a retained run is written whatever corpus this invocation audited. */
const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root =
  rootIdx !== -1 && process.argv[rootIdx + 1] ? resolve(process.argv[rootIdx + 1] as string) : REPO;
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

/*
 * EVERY FAILURE IS GATHERED BEFORE THE VERDICT IS WRITTEN, and that ordering is the point rather
 * than tidiness. The coverage block below used to call `process.exit(1)` where it now pushes, so a
 * corpus that failed the floor or the ratchet left the process before anything was retained: the one
 * run worth re-reading tomorrow was the only one that kept nothing. `gatesPersistEvidence` caught
 * this gate writing no artifact at all (am-uxh9), and an early exit is the same defect wearing a
 * success path's clothes.
 */
const failures: string[] = [];
for (const finding of report.findings)
  if (finding.severity === "error")
    failures.push(`[${finding.check}] ${finding.recordId ?? ""} ${finding.message}`.trim());

/*
 * EVERY READING POPULATION, BESIDE THE OWNERSHIP REPORT (am-rc1001-bridge-plan-pcjk.14).
 *
 * `auditReadings` above judges OWNERSHIP of declared targets, whose population is the 63 instrument
 * captions -- all of which already carry four readings, which is why that gate could not fail. The
 * census below is the other five populations it never read, with a floor each so a loader that drops
 * a directory is caught, and a ratchet so the shortfalls may only fall.
 */
let coverageExtra: Readonly<Record<string, unknown>> = {};
if (idx === -1) {
  const pops = measureReadingCoverage(root);
  console.log(`[audit-readings] ${coverageCensusLine(pops)}`);
  for (const pop of pops) {
    const shortfalls = pop.applicable
      .map((level) => `${level} ${pop.missing[level].length}`)
      .join(", ");
    console.log(
      `  ${pop.name.padEnd(12)} ${String(pop.examined).padStart(4)} examined (floor ${pop.floor})` +
        `  missing ${shortfalls}` +
        (pop.declared.length > 0 ? `  declared ${pop.declared.join(", ")}` : ""),
    );
  }
  const coverage = coverageFindings(pops, baseline.shortfalls as CoverageBaseline);
  for (const finding of coverage) console.error(`  [${finding.severity}] ${finding.message}`);
  for (const finding of coverage) failures.push(`[${finding.check}] ${finding.message}`);
  coverageExtra = {
    coverage: Object.fromEntries(
      pops.map((pop) => [
        pop.name,
        {
          examined: pop.examined,
          floor: pop.floor,
          missing: Object.fromEntries(pop.applicable.map((l) => [l, pop.missing[l].length])),
          declared: pop.declared.length,
        },
      ]),
    ),
  };
}

if (idx === -1) {
  console.log(
    `[audit-readings] ${input.owners.length} owner file(s) declaring ${targets} reading target(s)` +
      (unparseable.length > 0 ? `; ${unparseable.length} owner file(s) DID NOT PARSE` : ""),
  );
  for (const u of unparseable) {
    console.error(
      `  [ERROR] ${u.fileName} did not parse (${u.reason}), so its declarations were not judged.`,
    );
    failures.push(`${u.fileName} did not parse (${u.reason})`);
  }
}

/*
 * THE RUN IS RETAINED THROUGH THE SAME WRITER THE BROWSER LANES USE, which prints the census in the
 * same call, so this gate cannot report a verdict and forget to say what it examined. It is written
 * under the REPOSITORY even when `--root` pointed somewhere else, because a provability run's
 * evidence is worth keeping and a scratch directory takes it away; the corpus actually audited is
 * recorded beside it.
 *
 * A fixture is whatever the caller handed over, so its floor is 1: the question there is whether the
 * audit reaches a verdict, not whether the corpus is whole. The live run is held to the corpus floor
 * of 30 owner files; measured 2026-10-11 there are 41 declaring 63 targets.
 */
const { vacuous } = retainLaneRun({
  lane: "readings-owners",
  root: REPO,
  examined,
  noun: idx === -1 ? "readings-owner files" : "fixture readings-owner files",
  minimum: idx === -1 ? 30 : 1,
  failures,
  extra: {
    auditedRoot: root === REPO ? "the repository" : root,
    fixture: idx === -1 ? null : process.argv[idx + 1],
    declaredTargets: targets,
    unparseableOwnerFiles: unparseable.length,
    report,
    ...coverageExtra,
  },
});

process.exit(report.ok && !vacuous && failures.length === 0 ? 0 : 1);
