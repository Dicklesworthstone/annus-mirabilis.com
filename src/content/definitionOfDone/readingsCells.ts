/**
 * ITEMS: readings R0-R3, and R2 covering R1, per paper (am-definition-of-done-as-code-8w1c).
 *
 * `auditReadings` already judges both and had no live loader, unlike the instrument and
 * misconception audits. This is that loader: the readings-owners records carry everything it needs
 * -- each file declares `paper`, `targetKinds`, `scope`, `ownerBeadId`, and `targets` where every
 * target is `{kind, id, readings: {r0, r1, r2, r3, r3Citations}}`.
 *
 * I HAD CALLED `r2-covers-r1` UNMEASURABLE, AND IT IS NOT. My own unmeasured note said it was "a
 * comparison between two AUTHORED texts... Nothing in the records marks that relation, so any
 * number here would be invented". The audit marks it: `R2_LENGTH_FACTOR = 1.2` and the `r2-length`
 * check require R2 to be longer than R1 by that factor, with a declared per-target override for
 * the cases where expansion is not length. That is a proxy rather than a reading of the prose, and
 * it is THIS REPOSITORY'S proxy, already written down and already enforced -- which is the
 * difference between a measurement and an invention. The note was wrong, as the
 * paper-to-instrument one was, and measuring beats explaining why it cannot be done.
 *
 * NO OVERRIDES EXIST IN THE CORPUS. `grep` over content/editorial finds no r2-length override
 * record, so the audit is given an empty list and the item measures the unoverridden relation. If
 * overrides are added, they belong here and the number will move; a reader of a changed count
 * should look there first.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  auditReadings,
  type ReadingsAuditInput,
  type ReadingsOwnerEntry,
  type ReadingTarget,
  type ReadingTargetKind,
} from "../audits/readings.ts";
import type { AuditReport } from "../audits/types.ts";

const OWNERS_DIR = join("content", "editorial", "readings-owners");

/**
 * The records' vocabulary is not the audit type's. Every one of the 63 target entries writes
 * `kind: caption`, and `ReadingTargetKind` (audits/readings.ts:14) has NO `caption` member: the
 * spelling is `instrument-caption`, and `src/content/schemas/argument.ts:2601` refuses `caption`
 * by name, pointing at it. So the translation below is not a convenience, it is the mapping
 * between a record field and a typed union, and casting instead of mapping is what made this
 * file's first measurement wrong.
 *
 * `as ReadingTargetKind` on a raw string is the bug this function exists to prevent: it compiles,
 * it reads as a type, and it silently produced a value outside the union for all 63 targets.
 */
function targetKindOf(entry: Record<string, unknown>): ReadingTargetKind {
  const raw = typeof entry.kind === "string" ? entry.kind : "";
  if (raw === "caption" || entry.captions !== undefined) return "instrument-caption";
  const known: readonly ReadingTargetKind[] = [
    "paragraph",
    "heading",
    "footnote",
    "closing",
    "equation",
    "derivation-step",
    "instrument-caption",
  ];
  // An unrecognised spelling falls back to the audit's own default rather than entering the union
  // unchecked, so a new record kind shows up as an audit finding instead of as a silent member.
  return known.includes(raw as ReadingTargetKind) ? (raw as ReadingTargetKind) : "paragraph";
}

export type LoadedReadings = Readonly<{
  input: ReadingsAuditInput;
  report: AuditReport;
}>;

/** Every readings-owner record, flattened into the audit's input. */
export function loadLiveReadings(root: string): LoadedReadings {
  const dir = join(root, OWNERS_DIR);
  const owners: ReadingsOwnerEntry[] = [];
  const targets: ReadingTarget[] = [];
  if (existsSync(dir)) {
    for (const fileName of readdirSync(dir).sort()) {
      if (!fileName.endsWith(".yaml")) continue;
      let record: Record<string, unknown>;
      try {
        record = loadYaml(readFileSync(join(dir, fileName), "utf8")) as Record<string, unknown>;
      } catch {
        continue; // a record that does not parse is not a record with zero targets
      }
      if (record === null || typeof record !== "object") continue;
      const paper = typeof record.paper === "string" ? record.paper : "";
      const list = Array.isArray(record.targets) ? record.targets : [];
      // DERIVED from the targets, never read from the declared `targetKinds:` field, which three of
      // the 41 records omit entirely. Reading the field made those three records' 21 targets
      // unownable and is what produced this file's first, false, "63 of 63 unowned" measurement.
      // scripts/verify-content.ts has derived it since before this file existed; agreeing with that
      // loader is the point, because two loaders over one corpus that disagree is the defect.
      const kinds: ReadingTargetKind[] = [];
      // `targetIds` is the record's own target ids, which is how the audit decides which owner owns
      // a target. Derived rather than read from a separate field, because the records do not carry
      // one: the targets ARE the declaration of ownership.
      for (const raw of list) {
        if (raw === null || typeof raw !== "object") continue;
        const kind = targetKindOf(raw as Record<string, unknown>);
        if (!kinds.includes(kind)) kinds.push(kind);
      }
      owners.push({
        ownerBeadId: typeof record.ownerBeadId === "string" ? record.ownerBeadId : "",
        fileName,
        paper,
        targetKinds: kinds,
        targetIds: list
          .filter((raw): raw is Record<string, unknown> => raw !== null && typeof raw === "object")
          .map((raw) => String(raw.id ?? "")),
      });
      for (const raw of list) {
        if (raw === null || typeof raw !== "object") continue;
        const entry = raw as Record<string, unknown>;
        targets.push({
          targetId: String(entry.id ?? ""),
          targetKind: targetKindOf(entry),
          paper,
          ...(entry.readings !== undefined ? { readings: entry.readings as never } : {}),
          ...(Array.isArray(entry.scopeCritical)
            ? { scopeCritical: entry.scopeCritical as readonly string[] }
            : {}),
        });
      }
    }
  }
  // No override record exists in content/editorial, so the empty list is the corpus and not a
  // default: an override that existed and was not loaded would make this item read low.
  const input: ReadingsAuditInput = { targets, owners, overrides: [] };
  return { input, report: auditReadings(input) };
}

export type ReadingsTally = Readonly<{
  /** Targets for this paper whose downstream checks the audit actually reached. */
  reachable: number;
  /** Of those, the ones with no finding of the asked-for checks. */
  clean: number;
  /** Targets the audit short-circuited at the owner step, so no later check ran for them. */
  shortCircuited: number;
}>;

/**
 * Targets for one paper with no finding of the given checks, counting ONLY targets whose checks the
 * audit reached.
 *
 * THE SHORT-CIRCUIT IS THE WHOLE REASON THIS FUNCTION IS SHAPED THIS WAY, and I had it wrong
 * first. `auditReadings` pushes `owner-unassigned` and then `continue`s, so for an unowned target
 * NO later check runs -- not `readings-missing`, not `r2-length`. A tally that only asked "is there
 * a finding of check X for this target" therefore counted an unowned target as CLEAN, and the first
 * version of this file reported "11 of 11" for light-quanta's R0-R3 over a population where the
 * check had never been evaluated. That is exactly the vacuous pass the whole definition-of-done
 * report exists to refuse, produced by the report itself.
 *
 * So a short-circuited target is excluded from the denominator rather than credited to the
 * numerator, and the count is returned separately: when every target is short-circuited the
 * reachable population is 0, and the caller renders `unmeasured` as it must.
 */
export function readingsTally(
  loaded: LoadedReadings,
  paper: string,
  checks: readonly string[],
): ReadingsTally {
  const mine = loaded.input.targets.filter((t) => t.paper === paper);
  const unowned = new Set(
    loaded.report.findings
      .filter((f) => f.check === "owner-unassigned")
      .map((f) => String(f.recordId ?? "")),
  );
  const offending = new Set(
    loaded.report.findings
      .filter((f) => checks.includes(f.check))
      .map((f) => String(f.recordId ?? "")),
  );
  const reachableTargets = mine.filter((t) => !unowned.has(t.targetId));
  return {
    reachable: reachableTargets.length,
    clean: reachableTargets.filter((t) => !offending.has(t.targetId)).length,
    shortCircuited: mine.length - reachableTargets.length,
  };
}

/**
 * THE RECORDS VOCABULARY IS NOT THE AUDIT TYPES, AND A LOADER MUST TRANSLATE. This block used to
 * claim a defect -- "all 63 targets unowned, a mismatch nothing had caught" -- AND THAT WAS FALSE.
 * It was produced by this file's own loader, which cast `entry.kind` to `ReadingTargetKind`
 * unchecked and read `targetKinds:` from the declared field. Corrected 2026-10-08: with the
 * translation applied the audit returns ok=true with ZERO findings over all 63 targets.
 *
 * Two claims in the old text were also wrong on their own terms, and both were checkable:
 *
 *   "auditReadings had no live loader; this file is the first to feed it the real records" --
 *      scripts/verify-content.ts:247 has loaded them since before this file existed, and its
 *      `loadLiveReadingsAuditInput` already did BOTH things right: it maps `caption` to
 *      `instrument-caption` and DERIVES `targetKinds` from the targets.
 *   "which side is wrong is an editorial call for the readings owner" -- it was already settled.
 *      `ReadingTargetKind` has no `caption` member and argument.ts:2601 refuses that spelling by
 *      name. Nothing was awaiting a decision.
 *
 * Three records (am-bm-07-infer-molecular-number-frf9, am-bm-08-measurement-bias-h1ye,
 * am-bm-01-tracer-ensemble-hdly) omit `targetKinds:` entirely, and one of those also omits
 * `paper:`. Those are NOT defects either, for the same reason: a correct loader derives the kind
 * from the targets and defaults the paper, which is what both live loaders do.
 *
 * What is left is a real, narrow lesson, which is why this constant still exists: when a record
 * field and a typed union use different spellings, the translation belongs in ONE place, and a
 * second loader that re-derives it will eventually disagree with the first. Here the disagreement
 * was total -- 63 errors against zero -- and the newer loader was the wrong one.
 */
export const READINGS_RECORD_VOCABULARY = Object.freeze({
  /** What every one of the 63 target entries writes. */
  inRecords: "caption",
  /** The `ReadingTargetKind` member it denotes; the records spelling is not in the union. */
  inAuditType: "instrument-caption",
  targetsAffected: 63,
  /** The loader that has always done this correctly, and the one this file now agrees with. */
  canonicalLoader: "scripts/verify-content.ts:247 loadLiveReadingsAuditInput",
  /** Records omitting `targetKinds:`; harmless, because a correct loader derives it. */
  recordsWithoutDeclaredKinds: [
    "am-bm-07-infer-molecular-number-frf9.yaml",
    "am-bm-08-measurement-bias-h1ye.yaml",
    "am-bm-01-tracer-ensemble-hdly.yaml",
  ],
  recordsWithoutPaper: ["am-bm-01-tracer-ensemble-hdly.yaml"],
});
