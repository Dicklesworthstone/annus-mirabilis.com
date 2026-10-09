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
      const kinds = Array.isArray(record.targetKinds)
        ? (record.targetKinds.filter((k) => typeof k === "string") as ReadingTargetKind[])
        : [];
      const list = Array.isArray(record.targets) ? record.targets : [];
      // `targetIds` is the record's own target ids, which is how the audit decides which owner owns
      // a target. Derived rather than read from a separate field, because the records do not carry
      // one: the targets ARE the declaration of ownership.
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
          targetKind: String(entry.kind ?? "") as ReadingTargetKind,
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
 * WHY EVERY TARGET IS CURRENTLY SHORT-CIRCUITED, measured 2026-10-09 and worth stating because it
 * is a defect in the records that nothing had caught.
 *
 * The 41 readings-owners records declare `targetKinds: ["instrument-caption"]` (38 occurrences)
 * while the targets inside them declare `kind: "caption"` (all 63). `ownerFor` matches an owner to
 * a target with `owner.targetKinds.includes(target.targetKind)`, so "instrument-caption" never
 * matches "caption" and the audit reports `owner-unassigned` for all 63 -- 63 errors, ok=false.
 *
 * It had never been seen because `auditReadings` had no live loader: this file is the first thing
 * to feed it the real records. One record (am-bm-01-tracer-ensemble-hdly.yaml) also carries no
 * `paper` field, so it is unattributable to a paper on top of being unowned.
 *
 * Which side is wrong -- the type's `instrument-caption` or the records' `caption` -- is an
 * editorial call for the readings owner, not a one-word edit for me to make across 41 records, so
 * it is reported rather than fixed.
 */
export const READINGS_OWNER_KIND_MISMATCH = Object.freeze({
  declaredByOwners: "instrument-caption",
  declaredByTargets: "caption",
  targetsAffected: 63,
  recordsWithoutPaper: ["am-bm-01-tracer-ensemble-hdly.yaml"],
});
