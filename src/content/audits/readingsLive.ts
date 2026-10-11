/**
 * THE LIVE READINGS POPULATION, READ FROM DISK (am-8gbg criteria 1 and 2).
 *
 * `auditReadings()` takes a `ReadingsAuditInput` and does no I/O, which is what makes it testable
 * against hand-written targets. Something still has to build that input from
 * `content/editorial/readings-owners/`, and until now the only thing that did was a private
 * function inside `scripts/verify-content.ts`. That had two consequences worth naming:
 *
 * - `scripts/audit-readings.ts` could not run over the real corpus at all. It refused to start
 *   without `--fixture`, so the script named after the audit had never met its own population, and
 *   `scriptReachability.test.ts` carried an entry excusing it. A fixture-only entry point is the
 *   shape AGENTS.md warns about under "A Gate's Own Test Must Not Live Only In The Lane That Gate
 *   Controls": the audit was reachable only inside a five-minute central gate.
 * - Anyone who wanted a second reader of the same corpus had to copy sixty lines, and two readers
 *   of one corpus drift while both keep printing a plausible number.
 *
 * IT IS A SIBLING RATHER THAN PART OF `readings.ts` ON PURPOSE. The audit module has no `node:fs`
 * import and no filesystem knowledge, and keeping it that way is why its own tests can hand it a
 * target set directly. `misconceptions.ts` puts its loader beside its audit, which is fine there;
 * here it would also have shifted every line of `readings.ts` down, and `readingsCells.ts` cites
 * `audits/readings.ts:14` by line for `ReadingTargetKind`. A citation staled for no reason is the
 * defect recorded in AGENTS.md under the pre-commit `test:refusals` note, and not moving the lines
 * is cheaper than remapping them.
 *
 * AN UNPARSEABLE OWNER FILE IS REPORTED, NOT SWALLOWED, and that is the substantive change rather
 * than the move. The code this replaces ended:
 *
 *     } catch {
 *       // Ignore unparseable
 *     }
 *
 * so a readings-owner file with a YAML error contributed no owner and no targets, and the audit
 * then judged a corpus with that file's declarations missing. Nothing errored and no count looked
 * wrong, because the count was computed over what survived the catch. That is precisely the failure
 * AGENTS.md states under "A Check Inherits The Silence Of Whatever It Reads", and it is the failure
 * this bead's own title names: "a reading could vanish unnoticed".
 *
 * Measured 2026-10-11 before the change: 41 owner files, 41 parse, 0 do not. So the guard is added
 * while the family is clean, which is the only time it costs nothing, and `unparseable` is expected
 * to stay empty rather than to be a tolerated list.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import type {
  ReadingSet,
  ReadingsAuditInput,
  ReadingsOwnerEntry,
  ReadingTarget,
  ReadingTargetKind,
} from "./readings.ts";

/** One owner file that could not be read, kept so its absence is visible rather than silent. */
export type UnparseableOwnerFile = Readonly<{ fileName: string; reason: string }>;

export type LiveReadingsInput = Readonly<{
  input: ReadingsAuditInput;
  /** Owner files read from disk, so "0 findings" cannot be read as "all of them". */
  ownerFiles: number;
  /** Owner files whose YAML did not load. Any entry here means declarations went unjudged. */
  unparseable: readonly UnparseableOwnerFile[];
}>;

export const READINGS_OWNERS_DIR = "content/editorial/readings-owners";

export function loadLiveReadingsInput(
  rootDir: string,
  options?: { ownerBeadIds?: readonly string[] },
): LiveReadingsInput {
  const ownersDir = resolve(rootDir, READINGS_OWNERS_DIR);
  const owners: ReadingsOwnerEntry[] = [];
  const targets: ReadingTarget[] = [];
  const unparseable: UnparseableOwnerFile[] = [];
  let ownerFiles = 0;
  if (existsSync(ownersDir)) {
    for (const name of readdirSync(ownersDir).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const beadId = name.replace(".yaml", "");
      if (options?.ownerBeadIds && !options.ownerBeadIds.includes(beadId)) continue;
      ownerFiles += 1;
      let parsed: Record<string, unknown> | null;
      try {
        parsed = yaml.load(readFileSync(resolve(ownersDir, name), "utf8")) as Record<
          string,
          unknown
        > | null;
      } catch (error) {
        // NOT ignored: a file that does not load takes its declarations with it, and the caller is
        // told which file and why so the silence has a name.
        unparseable.push({
          fileName: name,
          reason:
            error instanceof Error ? (error.message.split("\n")[0] ?? "unreadable") : String(error),
        });
        continue;
      }
      const ownerBeadId = String(parsed?.ownerBeadId ?? parsed?.beadId ?? beadId);
      const targetIds: string[] = [];
      const targetKinds: ReadingTargetKind[] = [];
      if (Array.isArray(parsed?.targets)) {
        for (const rawTarget of parsed.targets) {
          const t = rawTarget as Record<string, unknown>;
          const kind: ReadingTargetKind =
            t.kind === "caption" || t.captions
              ? "instrument-caption"
              : ((t.kind as ReadingTargetKind) ?? "paragraph");
          const id =
            (t.id as string | undefined) ??
            (t.instrument ? `caption-${String(t.instrument)}` : undefined);
          if (!id) continue;
          targetIds.push(id);
          if (!targetKinds.includes(kind)) targetKinds.push(kind);
          if (t.readings) {
            targets.push({
              targetId: id,
              targetKind: kind,
              paper: String(parsed.paper ?? "brownian-motion"),
              readings: t.readings as ReadingSet,
              ...(Array.isArray(t.scopeCritical)
                ? { scopeCritical: t.scopeCritical.map(String) }
                : {}),
            });
          }
        }
      }
      owners.push({
        ownerBeadId,
        fileName: name,
        paper: String(parsed?.paper ?? "brownian-motion"),
        targetKinds: targetKinds.length > 0 ? targetKinds : ["paragraph"],
        targetIds,
      });
    }
  }
  return { input: { targets, owners }, ownerFiles, unparseable };
}
