/**
 * A MEASUREMENT THAT HAPPENED IS NOT LOST WHEN THE NEXT RUN CANNOT HAPPEN (am-1bso).
 *
 * `bun run build` takes several minutes and four panes commit production files every few minutes, so the
 * interval in which out/ is fresh is frequently shorter than build-plus-gate takes to complete. The bead
 * recorded the consequence directly:
 *
 *     run 1, before 29050744   gate RAN      53.5s   924 pairs measured, a real result
 *     run 2, after  29050744   gate REFUSED  67ms    naming real page.tsx files, correctly
 *
 * The refusal was right. What was wrong is that "the first run's regression names were lost with it", so the
 * only two gates that measure what a reader actually gets produced nothing anybody could act on.
 *
 * WHAT THIS DOES AND DOES NOT CHANGE. It does not change any verdict: a stale out/ still fails, with the same
 * message. It records each run that DID measure, against the commit out/ was built from, and lets a later
 * refusal say what the last real measurement found. The bead is explicit that attributing a gate's promise to
 * a pinned commit - "the build I measured did not overflow" rather than "the current tree does not overflow" -
 * is a real weakening that needs the owner. This is the other thing: the verdict stays attached to the current
 * tree, and only the EVIDENCE is kept.
 *
 * So a reader of a refusal gets the refusal AND the last thing anyone knew, which is the difference between a
 * gate that is unrunnable and a gate that is silent. The bead's third harm is that a stale refusal trains
 * people to treat staleness as noise; a refusal that also carries a real finding is not noise.
 *
 * The record is one file per gate under artifacts/, deliberately NOT in git: it is a cache of evidence, and a
 * committed one would be a second source of truth about what the tree does.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type LastMeasurement = Readonly<{
  /** The gate that measured, as it names itself. */
  gate: string;
  /** The commit out/ was built from, where it could be determined. */
  buildCommit?: string | undefined;
  /** When the measurement was taken. */
  takenAt: string;
  /** How many things it examined: the denominator, so a reader can judge the finding. */
  examined: number;
  /** How many violations it found. */
  violations: number;
  /** The violations themselves, or the first few, in the gate's own words. */
  findings: readonly string[];
}>;

const DIR = join("artifacts", "measurements");

function pathFor(root: string, gate: string): string {
  return resolve(root, DIR, `${gate.replace(/[^a-z0-9-]/gi, "-")}.json`);
}

/** Record a run that actually measured. Never throws: a failure to cache must not fail a gate. */
export function recordMeasurement(root: string, measurement: LastMeasurement): void {
  try {
    const file = pathFor(root, measurement.gate);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(measurement, null, 2)}\n`, "utf8");
  } catch {
    // Deliberately silent. This is evidence-keeping, not a verdict, and a read-only artifacts
    // directory must not turn a passing gate red.
  }
}

/** The last run that measured, or null. Never throws, for the same reason. */
export function readLastMeasurement(root: string, gate: string): LastMeasurement | null {
  try {
    const file = pathFor(root, gate);
    if (!existsSync(file)) return null;
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const m = parsed as Partial<LastMeasurement>;
    if (typeof m.gate !== "string" || typeof m.takenAt !== "string") return null;
    if (typeof m.examined !== "number" || typeof m.violations !== "number") return null;
    return {
      gate: m.gate,
      buildCommit: typeof m.buildCommit === "string" ? m.buildCommit : undefined,
      takenAt: m.takenAt,
      examined: m.examined,
      violations: m.violations,
      findings: Array.isArray(m.findings) ? m.findings.filter((f) => typeof f === "string") : [],
    };
  } catch {
    return null;
  }
}

/**
 * What a refusal should say about the last real measurement.
 *
 * Returns a sentence a reader can act on, or one saying plainly that nothing has ever been measured - which is
 * itself the more alarming state and should not look like silence.
 */
export function lastMeasurementNote(root: string, gate: string): string {
  const last = readLastMeasurement(root, gate);
  if (!last)
    return `No run of ${gate} has ever recorded a measurement here, so nothing is known about what a reader gets.`;
  const where = last.buildCommit ? ` of commit ${last.buildCommit.slice(0, 8)}` : "";
  const found =
    last.violations === 0
      ? "no violation"
      : `${last.violations} violation(s): ${last.findings.slice(0, 5).join(" | ")}`;
  return `The last real measurement${where}, taken ${last.takenAt}, examined ${last.examined} and found ${found}.`;
}
