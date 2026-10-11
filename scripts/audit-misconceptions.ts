#!/usr/bin/env bun
/**
 * CLI for the misconceptions audit (am-cm-audit-scripts-d34).
 *
 * IT RUNS OVER THE REAL CORPUS BY DEFAULT, and over a fixture only when asked (am-8gbg criterion 1:
 * "audit-readings.ts and audit-misconceptions.ts run over the real corpus in a lane, not only with
 * --fixture, and each prints the number of records examined beside its verdict. A count of 0 fails").
 *
 * UNTIL NOW IT REFUSED TO START WITHOUT `--fixture`, exiting 2 with a usage line. That was not a
 * cosmetic limitation. `scriptReachability.test.ts` carried an entry excusing this file as
 * unreachable, whose reason argued that the audit "itself judges the real corpus" because
 * verify-content calls `auditMisconceptions()` directly -- which is true, and which is exactly the
 * shape AGENTS.md warns about under "A Gate's Own Test Must Not Live Only In The Lane That Gate
 * Controls": the only way to run this audit was inside a five-minute central gate, so nobody could
 * ask it a question while authoring a ledger, and the script that bore its name could only ever be
 * exercised against hand-written input. A fixture-only entry point is a gate that has never met its
 * own population.
 *
 * The live path reuses `loadLiveMisconceptionInput`, the SAME loader verify-content uses, rather than
 * re-deriving the population here. Two readers of one corpus drift, and the drift would be invisible
 * because both would print a plausible number.
 *
 * WHICH HALF CATCHES A ZERO, because this gate has two and they are not the same claim. The
 * criterion says "A count of 0 fails", and it already did before this file changed: `summarize()`
 * in src/content/audits/types.ts carries `declaredNothingToJudge`, so an audit that DECLARES a
 * population of zero is not `ok` (am-1hst, whose comment records that `ok` used to be
 * `errorCount === 0` alone and so returned a clean verdict over no records). Measured directly,
 * `auditMisconceptions({ papers: [] })` returns `ok: false` with zero findings.
 *
 * So THE CENSUS LINE BELOW IS THE REPORT, NOT THE CATCH, and the criterion's other half is what it
 * answers: "each prints the number of records examined beside its verdict". It makes the population
 * legible to a reader and to `parsePopulationLines`, where before it was a boolean nobody could
 * attribute. Both halves are kept because they fail for different reasons: a corpus of three
 * records is refused by the audit (for its own per-paper five-entry rule) AND reported as VACUOUS
 * by the census, and if either rule were ever relaxed the other would still speak.
 *
 * The floor is 20: measured 2026-10-11 the corpus holds 28 records across the four papers (5
 * light-quanta, 7 brownian-motion, 8 special-relativity, 8 mass-energy), and the audit refuses a
 * ledger with fewer than five entries per paper, so 20 is the smallest total a conforming
 * four-paper corpus can have. Raise it as ledgers grow; never lower it to make a thin run pass.
 *
 * `--root <dir>` EXISTS SO BOTH HALVES ARE PROVABLE. Without it the live population is fixed by the
 * script's own location, so the only way to watch either refusal fire would be to empty the real
 * `content/misconceptions`, which RULE 1 forbids and which no reviewer should have to do. Measured
 * 2026-10-11 against scratch roots: 28 records exits 0; three records prints
 * `examined 3 ledger records (minimum 20) VACUOUS` and exits 1; an empty root prints
 * `examined 0 ... VACUOUS` and exits 1. A floor nobody has watched fire is a floor nobody should
 * cite.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditMisconceptions,
  loadLiveMisconceptionInput,
  type MisconceptionAuditInput,
} from "../src/content/audits/misconceptions.ts";
import { reportPopulation } from "./gate-census/population.ts";

const rootIdx = process.argv.indexOf("--root");
const root =
  rootIdx !== -1 && process.argv[rootIdx + 1]
    ? resolve(process.argv[rootIdx + 1] as string)
    : resolve(fileURLToPath(new URL("..", import.meta.url)));
const idx = process.argv.indexOf("--fixture");
if ((idx !== -1 && !process.argv[idx + 1]) || (rootIdx !== -1 && !process.argv[rootIdx + 1])) {
  console.error(
    "Usage: bun scripts/audit-misconceptions.ts [--fixture <file.json>] [--root <dir>]",
  );
  process.exit(2);
}

let input: MisconceptionAuditInput;
let examined: number;
let papers: number;
let unjudgedSources = 0;

if (idx !== -1) {
  const raw = JSON.parse(readFileSync(process.argv[idx + 1] as string, "utf8")) as {
    papers: MisconceptionAuditInput["papers"];
    knownAnchors: string[];
    knownInstruments: string[];
    knownResults: string[];
    knownSources: string[];
  };
  input = {
    papers: raw.papers,
    knownAnchors: new Set(raw.knownAnchors),
    knownInstruments: new Set(raw.knownInstruments),
    knownResults: new Set(raw.knownResults),
    knownSources: new Set(raw.knownSources),
  };
  examined = raw.papers.reduce((n, p) => n + p.entries.length, 0);
  papers = raw.papers.length;
} else {
  const live = loadLiveMisconceptionInput(root);
  input = live.input;
  examined = live.entries;
  papers = live.input.papers.length;
  unjudgedSources = live.unjudgedSources;
}

const report = auditMisconceptions(input);
console.log(JSON.stringify(report, null, 2));

if (idx === -1) {
  console.log(
    `[audit-misconceptions] ${examined} ledger records in ${papers} paper(s); ` +
      `${input.knownAnchors.size} anchors, ${input.knownResults.size} results and ` +
      `${input.knownInstruments.size} instruments to resolve against; ` +
      `${unjudgedSources} prose citations not judged (the check resolves ids, the records carry prose).`,
  );
}

// A fixture is whatever the caller handed over, so its floor is 1: the question there is whether the
// audit reaches a verdict, not whether the corpus is whole. The live run is held to the corpus floor.
const vacuous = reportPopulation({
  gate: "audit-misconceptions",
  examined,
  noun: idx === -1 ? "ledger records" : "fixture ledger records",
  minimum: idx === -1 ? 20 : 1,
});

process.exit(report.ok && !vacuous ? 0 : 1);
