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
import { isDeepStrictEqual } from "node:util";
import yaml from "js-yaml";
import { type Journey, validateJourney } from "../src/content/schemas/journey.ts";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import { JOURNEY_LINEAGE, REAL_JOURNEYS } from "../src/discovery/journeys/realJourneys.ts";

const ROOT = process.cwd();
const DIR = join(ROOT, "content/journeys");

const HEADER = (paper: string, hasAuthoredStages: boolean): string =>
  hasAuthoredStages
    ? [
        `# The discovery journey for ${paper}, as a record the compiler can read (am-4k0m).`,
        "#",
        "# Emitted from the journey's typed source records by scripts/emit-journey-records.ts.",
        "# The page renders the same authored stages, including the existing narrative, their",
        "# shelf premises, worked comparisons and qualifications. realJourneys.test.ts verifies",
        "# that this YAML and the composed journey carry exactly the same content.",
        "#",
        "# pendingElements names the remaining gaps. Recording the stages does not claim that",
        "# the separate derivation-chain or editorial review work is complete.",
        "# Regenerate with: bun scripts/emit-journey-records.ts",
        "",
      ].join("\n")
    : [
        `# The discovery journey for ${paper}, as a record the compiler can read (am-4k0m).`,
        "#",
        "# EMITTED, NOT TYPED. Every sentence here was copied out of the paper's own journey module by",
        "# scripts/emit-journey-records.ts, which serialises the Journey that src/discovery/journeys/",
        "# realJourneys.ts composes by reference. Nobody retyped a word, and realJourneys.test.ts asserts",
        "# this file parses back to exactly that object, so the record is proven faithful rather than",
        "# assumed. Regenerate with: bun scripts/emit-journey-records.ts",
        "#",
        "# `completeness: partial` is the honest value, and pendingElements says which elements and why,",
        "# because composing them would be authoring content rather than moving it. A journey claiming",
        "# complete with elements missing is the defect am-4k0m is about. The list is NOT the same for",
        "# all four. Read the current pendingElements below for the remaining gaps; exercise counts",
        "# and authored stages change as the corresponding reader-facing work lands.",
        "#",
        "# The page still renders from the module. Pointing it here is the next step, and the equality test",
        "# is what makes that step safe.",
        "",
      ].join("\n");

/** Keep ordinary YAML readable while spelling multiline strings in the compiler's subset. */
function serializeRecord(record: Record<string, unknown>): string {
  // The canonical parser accepts Unicode escapes, but not js-yaml's `|-` or `\n` spellings.
  // Replace only multiline values during emission. The prefix cannot occur anywhere in the
  // source record, so replacing its temporary scalars cannot rewrite an authored sentence/key.
  const source = JSON.stringify(record);
  let prefix = "__journey_multiline__";
  while (source.includes(prefix)) prefix += "_";
  const replacements = new Map<string, string>();
  const controlEscapes: Readonly<Record<string, string>> = {
    "\\b": "\\u0008",
    "\\f": "\\u000c",
    "\\n": "\\u000a",
    "\\r": "\\u000d",
    "\\t": "\\u0009",
  };
  let body = yaml.dump(record, {
    indent: 2,
    lineWidth: -1,
    sortKeys: false,
    noRefs: true,
    replacer: (_key, value) => {
      if (typeof value !== "string" || !/[\n\r]/.test(value)) return value;
      const token = `${prefix}${replacements.size}__`;
      // Match escaped backslashes too, so literal backslash-n remains literal backslash-n.
      const quoted = JSON.stringify(value).replace(
        /\\[\\bfnrt]/g,
        (sequence) => controlEscapes[sequence] ?? sequence,
      );
      replacements.set(token, quoted);
      return token;
    },
  });
  for (const [token, quoted] of replacements) body = body.replaceAll(token, () => quoted);
  return body;
}

export class JourneySerializationError extends Error {
  readonly code = "journey-serialization-changed-data";

  constructor(paper: string) {
    super(`Journey serialization changed authored data: ${paper}`);
    this.name = "JourneySerializationError";
  }
}

/** Prepare a faithful compiler-readable record; no output is written until this succeeds. */
export function serializeJourneyRecord(journey: Journey): string {
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
  const body = serializeRecord(record);
  const next = `${HEADER(journey.paper, journey.stages.length > 0)}${body}`;
  // Exercise the real compiler boundary before writing, not the emitter's permissive parser.
  const parsed = strictParse(next, "yaml", path);
  validateJourney(parsed);
  if (!isDeepStrictEqual(parsed, record)) throw new JourneySerializationError(journey.paper);
  return next;
}

function main(): void {
  mkdirSync(DIR, { recursive: true });
  const written: string[] = [];
  for (const journey of REAL_JOURNEYS) {
    const path = join(DIR, `${journey.paper}.yaml`);
    const next = serializeJourneyRecord(journey);
    const unchanged = existsSync(path) && readFileSync(path, "utf8") === next;
    if (!unchanged) writeFileSync(path, next);
    written.push(
      `${journey.paper}: ${next.length} bytes, ${journey.shelf.length} shelf cards, ${journey.forks.length} forks${unchanged ? " (unchanged)" : ""}`,
    );
  }
  console.log(`[journey records] wrote ${written.length} record(s) to content/journeys/`);
  for (const line of written) console.log(`  ${line}`);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) main();
