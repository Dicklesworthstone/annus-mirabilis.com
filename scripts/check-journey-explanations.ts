#!/usr/bin/env bun
/**
 * An author's strict check of the discovery journeys' formula explanations (am-hk4b):
 *
 *   bun scripts/check-journey-explanations.ts [--missing] [--root <dir>]
 *
 * `content/journey-explanations/` held 39 authored entries that NOTHING READ -- no loader, no
 * renderer, no test, no checker -- so a `quantityId` naming nothing, a `latex` matching no formula,
 * or a `step` naming no derivation step would all have sat there indefinitely. This is the gate half;
 * `src/content/journeyExplanations.ts` carries the judgement and its docblock carries the shape
 * decision.
 *
 * THE SITES ARE THE DERIVATION STEPS THE TWO INVESTIGATE PAGES ALREADY RENDER, read by IMPORTING the
 * modules rather than by grepping their source, because a source regex over a `const steps = [...]`
 * array undercounts the moment an entry spans lines in a way the pattern did not anticipate -- this
 * repository has recorded a registry regex reporting 32 of 48 steps. The two modules spell the field
 * DIFFERENTLY, `latex` on a mass-energy step and `formula` on a relativity card, which is exactly the
 * per-population spelling difference that has cost this session one wrong measurement already.
 *
 * `--root <dir>` EXISTS SO THE REFUSALS ARE PROVABLE without editing the real corpus, which RULE 1
 * forbids and no reviewer should have to do.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkJourneyExplanations,
  journeyExplanationCensusLine,
} from "../src/content/journeyExplanations.ts";
import { PAGE_FORMULAS } from "../src/discovery/journeyFormulaList.ts";
import { ARGUMENT_STEPS } from "../src/discovery/massEnergyArgument.ts";
import { RELATIVITY_CARDS } from "../src/discovery/specialRelativityInvestigation.ts";
import { retainLaneRun } from "./gate-census/laneEvidence.ts";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rootIdx = process.argv.indexOf("--root");
const root =
  rootIdx !== -1 && process.argv[rootIdx + 1] ? resolve(process.argv[rootIdx + 1] as string) : REPO;

/** `page|stepId` to the formula that step prints. */
const sites = new Map<string, string>();
for (const step of ARGUMENT_STEPS)
  sites.set(`discover/mass-energy/investigate|${step.id}`, step.latex);
for (const card of RELATIVITY_CARDS)
  sites.set(`discover/special-relativity/investigate|${card.id}`, card.formula);

/**
 * Whether `content/equation-explanations/` holds a record for a display id.
 *
 * Read from disk rather than through the compiler, because the question is whether the FILE the
 * entry points at exists: a compiler that had already dropped an unresolvable reference would answer
 * about its own output, which is the silence AGENTS.md names under "A Check Inherits The Silence Of
 * Whatever It Reads".
 */
function hasDisplayRecord(displayId: string): boolean {
  // The papers are the directory's own subdirectories rather than an imported slug list, so a fifth
  // paper needs no change here and a slug list that drifted cannot narrow the search.
  const dir = join(root, "content/equation-explanations");
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (existsSync(join(dir, entry.name, `${displayId}.yaml`))) return true;
  }
  return false;
}

const quantityIds = new Set<string>();
{
  const { load } = await import("js-yaml");
  const dir = join(root, "content/quantities");
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    if (!/\.ya?ml$/.test(name)) continue;
    const parsed = load(readFileSync(join(dir, name), "utf8"));
    const seq = Array.isArray(parsed)
      ? parsed
      : (((parsed ?? {}) as { quantities?: unknown }).quantities ?? []);
    for (const q of Array.isArray(seq) ? seq : [])
      if (q !== null && typeof q === "object" && typeof (q as { id?: unknown }).id === "string")
        quantityIds.add((q as { id: string }).id);
  }
}

/**
 * Every formula the discover pages draw in their own markup, by latex.
 *
 * `PAGE_FORMULAS` has held this as data since dispatch 276, with
 * `src/app/discover/formulaCensus.test.tsx` holding the list and the rendered pages to each other
 * both ways. am-hk4b's second finding said the site-finding half "has no counterpart and this is a
 * feature rather than a missing path"; it does have one, and this is it.
 */
const pageFormulaLatex = new Set(Object.values(PAGE_FORMULAS).map((f) => f.latex));

const report = checkJourneyExplanations(root, {
  sites,
  pageFormulaLatex,
  isRegisteredQuantity: (id) => quantityIds.has(id),
  hasDisplayRecord,
});

console.log(`journey formulas: ${journeyExplanationCensusLine(report.census)}`);
console.log(`  ${quantityIds.size} canonical quantity ids read from content/quantities/`);
for (const problem of report.problems)
  console.error(`  ${problem.code}: ${problem.where} ${problem.message}`);
if (process.argv.includes("--missing"))
  for (const site of report.missing) console.log(`  no gloss: ${site}`);

const { vacuous } = retainLaneRun({
  lane: "journey-explanations",
  root: REPO,
  examined: report.census.entries,
  noun: "journey-formula entries",
  // Measured 2026-10-11: 39 entries over six files. A floor of 30 notices a directory read
  // half-way; raise it as entries land, and never lower it to make a thin run pass.
  minimum: root === REPO ? 30 : 1,
  failures: report.problems.map((p) => `[${p.code}] ${p.where} ${p.message}`),
  extra: {
    auditedRoot: root === REPO ? "the repository" : root,
    census: report.census,
    stepsWithNoGloss: report.missing.length,
  },
});

process.exit(report.problems.length === 0 && !vacuous ? 0 : 1);
