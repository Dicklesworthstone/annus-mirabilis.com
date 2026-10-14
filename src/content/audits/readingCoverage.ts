/**
 * EVERY READING POPULATION, NOT THE ONE THAT WAS ALREADY COMPLETE (am-rc1001-bridge-plan-pcjk.14).
 *
 * `auditReadings` judges OWNERSHIP of declared targets: that each readings-owner file is named for
 * its bead, that no target is claimed twice, that none is unclaimed. Its population is
 * `content/editorial/readings-owners/`, which is 41 files declaring 63 instrument captions, and all
 * 63 carry four readings. So the gate was green over the one population with nothing left to find,
 * and silent about the five where the shortfalls are. That bead's words: "paragraph bindings,
 * passages, displays, headings and closings are never read".
 *
 * MEASURED 2026-10-11, and every figure below matches the bead's 2026-10-01 measurement, so nothing
 * moved in between:
 *
 *   population              size   r0    r1    r2    r3
 *   paragraphs+footnotes     210   210    -     -     -     r0 only, BY DESIGN
 *   passages                  48    48    48    48    48
 *   displays                 200   200   200   200    71
 *   headings                  26     0     0     0     0
 *   closings                   9     0     0     0     0
 *   captions                  63    63    63    63    63
 *
 * So the project's readings debt is exactly three things -- 129 displays without an r3, 26 headings
 * and 9 closings with no reading at all -- and this is the module that says so out loud.
 *
 * EACH POPULATION SPELLS THE FOUR READINGS DIFFERENTLY, which is why a single naive reader reports
 * nonsense. An argument passage keys them `overview`, `full`, `steps`, `margin`; a display and a
 * caption key them `r0` to `r3`; a paragraph binding carries `r0` alone. Reading `r0` off an
 * argument record returns nothing, and my first measurement of this corpus duly reported 0 of 48
 * passages with any reading -- a number the bead itself contradicts. The spelling is declared per
 * population below rather than guessed, which is the same rule as "the corpus declares what a label
 * holds".
 *
 * WHAT IT ASSERTS, AND WHAT IT DELIBERATELY DOES NOT. Two things fail:
 *
 *   1. A POPULATION UNDER ITS FLOOR. The floor is that population's size, so a loader that silently
 *      drops files is caught -- which is the acceptance criterion's own reason for the floor. This
 *      is the half that cannot be argued with: 200 displays exist, so a run that judged 7 has lost
 *      its directory and must not report a clean verdict over the 7.
 *   2. A SHORTFALL ABOVE ITS BASELINE. Today's missing counts are recorded, and they may only fall.
 *      AGENTS.md: "a baseline that only ever rises is a budget."
 *
 * It does NOT assert which readings a heading or a closing is obliged to carry, because no clause
 * says. AGENTS.md's ownership paragraph puts "paragraph, heading, footnote, and closing readings"
 * in a readings bead's scope, and its four-readings table names "every paragraph, every equation,
 * and every instrument caption" -- headings and closings are owned but their required level is
 * unstated. Inventing one here would make this gate the author of an editorial obligation, which is
 * the owner's to set. So their 35 zeros are recorded as a debt that cannot grow, and the authoring
 * is somebody's bead rather than this module's opinion.
 *
 * Likewise a paragraph binding carries r0 and nothing else BY DESIGN -- AGENTS.md: "Every printed
 * paragraph is bound to one or more passages and has its own r0 overview" -- so its R1 to R3 live in
 * the passages it is bound to. Counting 210 paragraphs as missing three readings each, which my
 * first pass did, is a category error and not a finding.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import type { AuditFinding } from "./types.ts";

export const READING_LEVELS = ["r0", "r1", "r2", "r3"] as const;
export type Level = (typeof READING_LEVELS)[number];

/** How one population stores its readings, and how many of it there must be. */
export type PopulationSpec = Readonly<{
  name: string;
  /** The smallest size that is not a dropped directory: this population's measured size. */
  floor: number;
  /** The key each level is stored under, for this population's records. */
  keys: Readonly<Record<Level, string>>;
  /** Levels this population is OBLIGED to carry. Empty where no clause states one. */
  obliged: readonly Level[];
  /**
   * Levels this population COULD carry, which is not the same question. A paragraph binding holds
   * r0 and nothing else by design, so its r1 to r3 are not a debt and are not baselined: listing
   * them as 210 missing would present a design fact as a shortfall, and a ratchet over them would
   * freeze a number that means nothing. Everywhere else all four are applicable, including a
   * display's optional r3, which IS a real debt at 129 and is ratcheted as one.
   */
  applicable: readonly Level[];
}>;

export type PopulationCoverage = Readonly<{
  name: string;
  examined: number;
  floor: number;
  applicable: readonly Level[];
  present: Readonly<Record<Level, number>>;
  missing: Readonly<Record<Level, readonly string[]>>;
  /** Ids declared as deliberately unexplained, which are not missing anything. */
  declared: readonly string[];
}>;

const RN = { r0: "r0", r1: "r1", r2: "r2", r3: "r3" } as const;
const ARG = { r0: "overview", r1: "full", r2: "steps", r3: "margin" } as const;

export const POPULATIONS: readonly PopulationSpec[] = Object.freeze([
  // r0 only, by design: the other three live in the passages each paragraph is bound to.
  Object.freeze({
    name: "paragraphs",
    floor: 210,
    keys: RN,
    obliged: ["r0"] as const,
    applicable: ["r0"] as const,
  }),
  Object.freeze({
    name: "passages",
    applicable: READING_LEVELS,
    floor: 48,
    keys: ARG,
    obliged: READING_LEVELS,
  }),
  // r3 is optional and has its own ratchet in historianMargin.baseline.json; r0 to r2 are obliged.
  Object.freeze({
    name: "displays",
    applicable: READING_LEVELS,
    floor: 200,
    keys: RN,
    obliged: ["r0", "r1", "r2"] as const,
  }),
  // Owned by readings beads, with no clause stating a level. Recorded, not asserted.
  Object.freeze({
    name: "headings",
    applicable: READING_LEVELS,
    floor: 26,
    keys: RN,
    obliged: [] as const,
  }),
  Object.freeze({
    name: "closings",
    applicable: READING_LEVELS,
    floor: 9,
    keys: RN,
    obliged: [] as const,
  }),
  Object.freeze({
    name: "captions",
    applicable: READING_LEVELS,
    floor: 63,
    keys: RN,
    obliged: READING_LEVELS,
  }),
]);

function readYaml(path: string): unknown {
  return yaml.load(readFileSync(path, "utf8"));
}

function filesIn(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(full, ext));
    else if (entry.name.endsWith(ext) && entry.name !== "manifest.yaml") out.push(full);
  }
  return out;
}

type Record_ = Readonly<{ id: string; readings: Readonly<Record<string, unknown>> }>;

/** Each population's records, read from disk rather than from a loader that can drop one. */
function recordsFor(root: string, name: string): { records: Record_[]; declared: string[] } {
  const records: Record_[] = [];
  const declared: string[] = [];
  if (name === "paragraphs") {
    for (const f of filesIn(resolve(root, "content/bindings"), ".yaml")) {
      const d = readYaml(f) as { paper?: unknown; paragraphs?: unknown } | null;
      for (const raw of Array.isArray(d?.paragraphs) ? d.paragraphs : []) {
        const e = raw as Record<string, unknown>;
        const id = `${String(d?.paper)}/${String(e.unit)}`;
        records.push({ id, readings: e });
        // `status: unexplained` with a reason is a declaration that no PASSAGE explains this unit.
        // It still carries its own r0, so it is not missing a reading; the bead asks that these be
        // reported as declared rather than counted as a shortfall.
        if (e.status === "unexplained") declared.push(id);
      }
    }
  } else if (name === "passages") {
    for (const f of filesIn(resolve(root, "content/arguments"), ".json")) {
      const d = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
      if (!String(d.id ?? "").startsWith("arg-")) continue;
      records.push({ id: String(d.id), readings: (d.readings ?? {}) as Record<string, unknown> });
    }
  } else if (name === "displays") {
    // Paper-qualified, like the paragraph ids above, because a printed display id is unique only
    // WITHIN its paper. Measured 2026-10-14: of the 125 records lacking an r3, there are 83
    // distinct bare ids, and `eq-s3-d3`, `eq-s4-d2`, `eq-s4-d4`, `eq-s4-d5`, `eq-s3-d4` and
    // `eq-s3-d8` each name a record in three papers. The shortfall COUNT was right, because this
    // list keeps duplicates, but nothing could be traced back to a paper and any consumer that
    // deduped would have lost 42 of the 125.
    for (const f of filesIn(resolve(root, "content/equation-explanations"), ".yaml")) {
      const d = readYaml(f) as Record<string, unknown> | null;
      const paper = basename(dirname(f));
      const display = d?.display === undefined ? basename(f) : String(d.display);
      records.push({ id: `${paper}/${display}`, readings: (d ?? {}) as Record<string, unknown> });
    }
  } else if (name === "headings" || name === "closings") {
    const want = name === "headings" ? new Set(["heading", "part-heading"]) : new Set(["closing"]);
    for (const f of filesIn(resolve(root, "content/source-blocks"), ".yaml")) {
      const d = readYaml(f);
      if (!d || typeof d !== "object" || Array.isArray(d)) continue;
      const rec = d as Record<string, unknown>;
      if (!want.has(String(rec.kind))) continue;
      records.push({ id: String(rec.id ?? f), readings: rec });
    }
  } else if (name === "captions") {
    for (const f of filesIn(resolve(root, "content/editorial/readings-owners"), ".yaml")) {
      const d = readYaml(f) as { targets?: unknown } | null;
      for (const raw of Array.isArray(d?.targets) ? d.targets : []) {
        const t = raw as Record<string, unknown>;
        records.push({
          id: String(t.id ?? f),
          readings: (t.readings ?? {}) as Record<string, unknown>,
        });
      }
    }
  }
  return { records, declared };
}

export function measureReadingCoverage(root: string): readonly PopulationCoverage[] {
  return POPULATIONS.map((spec) => {
    const { records, declared } = recordsFor(root, spec.name);
    const present: Record<Level, number> = { r0: 0, r1: 0, r2: 0, r3: 0 };
    const missing: Record<Level, string[]> = { r0: [], r1: [], r2: [], r3: [] };
    for (const rec of records)
      for (const level of READING_LEVELS) {
        const value = rec.readings[spec.keys[level]];
        const filled =
          typeof value === "string"
            ? value.trim().length > 0
            : Array.isArray(value)
              ? value.length > 0
              : value !== undefined && value !== null;
        if (filled) present[level] += 1;
        else missing[level].push(rec.id);
      }
    return Object.freeze({
      name: spec.name,
      examined: records.length,
      floor: spec.floor,
      applicable: spec.applicable,
      present: Object.freeze(present),
      missing: Object.freeze({
        r0: Object.freeze(missing.r0),
        r1: Object.freeze(missing.r1),
        r2: Object.freeze(missing.r2),
        r3: Object.freeze(missing.r3),
      }),
      declared: Object.freeze(declared),
    });
  });
}

/** `examined 210 paragraphs, 48 passages, 200 displays, 26 headings, 9 closings, 63 captions` */
export function coverageCensusLine(pops: readonly PopulationCoverage[]): string {
  return `examined ${pops.map((p) => `${p.examined} ${p.name}`).join(", ")}`;
}

export type CoverageBaseline = Readonly<Record<string, Readonly<Record<string, number>>>>;

/**
 * Under-floor is an error, and a shortfall above its baseline is an error. Nothing else fails: the
 * per-level counts for headings and closings are REPORTED so the debt is visible and cannot grow.
 */
export function coverageFindings(
  pops: readonly PopulationCoverage[],
  baseline: CoverageBaseline,
): readonly AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const pop of pops) {
    if (pop.examined < pop.floor)
      findings.push({
        check: "readings-population-under-floor",
        family: "readings",
        severity: "error",
        recordId: pop.name,
        message:
          `The ${pop.name} population examined ${pop.examined} of a floor of ${pop.floor}. ` +
          `A run that judged fewer has lost files rather than found a clean corpus, so this is a ` +
          `failed citation and not a pass.`,
      });
    const base = baseline[pop.name] ?? {};
    for (const level of pop.applicable) {
      const now = pop.missing[level].length;
      const was = base[level];
      if (was === undefined) continue;
      if (now > was)
        findings.push({
          check: "readings-shortfall-grew",
          family: "readings",
          severity: "error",
          recordId: `${pop.name}.${level}`,
          message:
            `${pop.name} missing ${level} rose from ${was} to ${now}. A baseline is the record of ` +
            `a debt, not a budget: ${pop.missing[level].slice(0, 5).join(", ")}` +
            `${now > 5 ? ` and ${now - 5} more` : ""}.`,
        });
    }
  }
  return findings;
}
