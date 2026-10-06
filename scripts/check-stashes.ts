/**
 * check-stashes.ts (am-70ig)
 *
 * Reports git stashes that nobody has reviewed. A stash survives `git status`, `git log`, the
 * beads tracker and every other gate; five sat for three to four days holding 1954 insertions
 * before a human looked by hand (am-8wv8). This is the only check in the repository that looks.
 *
 * READ-ONLY BY CONSTRUCTION. It runs `git stash list` and nothing else. It never drops, pops or
 * applies, because clearing a stash is the owner's decision under AGENTS.md Rule 1.
 *
 * LOCAL ONLY, and honestly so. `refs/stash` is not pushed: `git ls-remote origin` returns no
 * stash refs and a fresh clone has none, so a CI run can only ever see zero. The gate registry
 * entry sets `requiredInCi: false` so the chain records it as skipped-not-required, rather than
 * reporting a pass it did not earn.
 *
 * AND IT PERSISTS (am-uxh9). The defect this gate exists to catch is a change that is invisible to
 * every other gate, which makes an unrecorded run of it the worst of the five Class A cases: the
 * stash list is itself ephemeral local state, so a run that printed five unreviewed stashes and kept
 * nothing leaves no way to tell later whether they were landed, acknowledged, or dropped. A row per
 * stash with its age and subject, and a summary carrying the count examined.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TestLogger } from "../src/testing/log/logger.ts";
import {
  type AcknowledgedStash,
  ageInDays,
  parseStashList,
  reviewStashes,
} from "../src/testing/stashes/stashInventory.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "src/testing/stashes/acknowledgedStashes.json");

async function main(): Promise<number> {
  const logger = new TestLogger("stashes");
  const raw = execFileSync("git", ["stash", "list", "--format=%H|%cI|%gs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const entries = parseStashList(raw);
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as AcknowledgedStash[];
  const report = reviewStashes(entries, baseline);
  const now = new Date();

  if (entries.length === 0) {
    console.log("[stashes] none present.");
  } else {
    console.log(
      `[stashes] ${entries.length} present, ${report.acknowledgedPresent} reviewed under a bead.`,
    );
  }

  for (const s of report.stale) {
    console.log(
      `[stashes] acknowledged entry no longer present, the file can be tidied: ${s.sha.slice(0, 12)} (${s.date}, ${s.reviewedUnder})`,
    );
    logger.log({
      testId: `stale:${s.sha.slice(0, 12)}`,
      outcome: "skipped",
      message: `acknowledged entry no longer present (${s.date}, reviewed under ${s.reviewedUnder})`,
    });
  }

  // EMITTED BEFORE THE EARLY RETURN, so a clean run is recorded rather than only a dirty one. A gate
  // whose artifact appears only when it fails cannot be told apart from a gate that never ran, which
  // is the reasoning the three earlier Class A repairs on this bead recorded for perf-budget-diff.
  const summary = {
    testId: "stashes-summary",
    outcome: report.unacknowledged.length === 0 ? ("passed" as const) : ("failed" as const),
    message:
      `${entries.length} stash(es) present, ${report.acknowledgedPresent} reviewed under a bead, ` +
      `${report.unacknowledged.length} unreviewed, ${report.stale.length} acknowledged but gone`,
  };

  if (report.unacknowledged.length === 0) {
    logger.log(summary);
    await logger.flush();
    console.log(`[stashes] Structured log: ${logger.filePath}`);
    return 0;
  }
  logger.log(summary);

  console.error(
    `\n[stashes] ${report.unacknowledged.length} stash(es) nobody has reviewed. A stash is invisible to every other gate:\n`,
  );
  for (const s of report.unacknowledged) {
    const days = ageInDays(s.committedAt, now);
    const stat = execFileSync("git", ["stash", "show", "--stat", s.sha], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .at(-1);
    console.error(`  ${s.sha.slice(0, 12)}  ${days} day(s) old  ${s.subject}`);
    console.error(`      ${(stat ?? "").trim()}`);
    logger.log({
      testId: `unreviewed:${s.sha.slice(0, 12)}`,
      outcome: "failed",
      message: `${days} day(s) old :: ${s.subject} :: ${(stat ?? "").trim()}`,
    });
  }
  console.error(
    "\nDetermine what is in each one (git stash show -p <sha>), then either land it or record\n" +
      "the verdict in src/testing/stashes/acknowledgedStashes.json. Do not drop a stash to clear\n" +
      "this gate: that is the owner's decision.\n",
  );
  await logger.flush();
  console.log(`[stashes] Structured log: ${logger.filePath}`);
  return 1;
}

process.exit(await main());
