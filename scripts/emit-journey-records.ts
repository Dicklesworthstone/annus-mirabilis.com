/**
 * EMIT content/journeys/<paper>.yaml FROM THE COMPOSED JOURNEYS (am-4k0m, acceptance item 1).
 *
 * The bead asks that each journey exist as a record the compiler reads, and that "the prose is moved,
 * not rewritten, and a diff shows no reader-facing text lost". The only way to make that second clause
 * a fact rather than a promise is to COPY the prose mechanically out of the typed modules that hold it
 * today, which is what this does: it serialises the `Journey` objects `realJourneys.ts` composes by
 * reference from journeyI.ts to journeyIV.ts. No sentence is retyped at any point, by a person or by me.
 *
 * `realJourneys.test.ts` then asserts the emitted YAML parses back to objects deeply equal to the
 * composed ones, so the record is proven faithful rather than assumed to be. That equality is what will
 * make the next step -- the pages rendering from the record instead of from the modules -- a refactor
 * with a proof behind it rather than a prose migration done by hand.
 *
 * Run: bun scripts/emit-journey-records.ts
 *
 * It is idempotent and prints what it wrote. It does not delete anything.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { JOURNEY_LINEAGE, REAL_JOURNEYS } from "../src/discovery/journeys/realJourneys.ts";

const ROOT = process.cwd();
const DIR = join(ROOT, "content/journeys");

const HEADER = (paper: string): string =>
  [
    `# The discovery journey for ${paper}, as a record the compiler can read (am-4k0m).`,
    "#",
    "# EMITTED, NOT TYPED. Every sentence here was copied out of the paper's own journey module by",
    "# scripts/emit-journey-records.ts, which serialises the Journey that src/discovery/journeys/",
    "# realJourneys.ts composes by reference. Nobody retyped a word, and realJourneys.test.ts asserts",
    "# this file parses back to exactly that object, so the record is proven faithful rather than",
    "# assumed. Regenerate with: bun scripts/emit-journey-records.ts",
    "#",
    "# `completeness: partial` is the honest value: `stages` and `exercises.instrumented` are declared",
    "# in pendingElements with their reasons, because composing them would be authoring content rather",
    "# than moving it. A journey claiming complete with two elements missing is the defect am-4k0m is",
    "# about.",
    "#",
    "# The page still renders from the module. Pointing it here is the next step, and the equality test",
    "# is what makes that step safe.",
    "",
  ].join("\n");

function main(): void {
  mkdirSync(DIR, { recursive: true });
  const written: string[] = [];
  for (const journey of REAL_JOURNEYS) {
    const path = join(DIR, `${journey.paper}.yaml`);
    /**
     * THE RECORD IS THE JOURNEY PLUS ITS REVISION METADATA (am-4k0m).
     *
     * `lineage` is added here rather than carried on the `Journey`, because it is a fact about how the
     * FILE reached this revision and not part of what the journey claims. AGENTS.md asks for exactly
     * that separation ("keep contentRevision, sourceAssetDigest, translationRevision ... separate"),
     * and `computeCanonicalRecordHash` already excludes revision metadata from a record's content hash
     * for the same reason. `check-revisions.ts` reads this key from the YAML by name and requires it of
     * any record past revision 1; mass-energy went to 2 when its record gained the admittedImports
     * declaration its own card had been carrying alone.
     *
     * The faithfulness test compares the record against the composed journey with this key excluded, so
     * adding it here does not weaken "no reader-facing text lost": a lineage entry is not reader-facing
     * text, and nothing else in the file comes from anywhere but the modules.
     */
    const lineage = JOURNEY_LINEAGE[journey.paper];
    const record = {
      ...JSON.parse(JSON.stringify(journey)),
      ...(lineage === undefined ? {} : { lineage }),
    };
    // `sortKeys: false` keeps the schema's own order, which reads as the skeleton does.
    const body = yaml.dump(record, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
      noRefs: true,
    });
    const next = `${HEADER(journey.paper)}${body}`;
    const unchanged = existsSync(path) && readFileSync(path, "utf8") === next;
    if (!unchanged) writeFileSync(path, next);
    written.push(
      `${journey.paper}: ${next.length} bytes, ${journey.shelf.length} shelf cards, ${journey.forks.length} forks${unchanged ? " (unchanged)" : ""}`,
    );
  }
  console.log(`[journey records] wrote ${written.length} record(s) to content/journeys/`);
  for (const line of written) console.log(`  ${line}`);
}

main();
