/**
 * A `(beads)`-scoped commit touches only `.beads/` (am-ii21).
 *
 * WHY THIS RULE AND NOT A FILE-COUNT THRESHOLD. am-ii21 records three real
 * incidents of a bare `git commit` reading a shared index. I measured all 2591
 * non-merge commits before choosing a predicate, and file count separates none
 * of them: the worst offender by files (4c0af995, 43) sits below d373e025 (372,
 * an honest Biome sweep), 2b765aa0 (58) and 6f0eaf7b (48), and one of the three
 * incidents touched a single file. A threshold that fires on those three fires
 * on honest work first.
 *
 * What does separate is scope coherence, and only for this one scope, because
 * only this one has a mechanical definition of "in scope". Measured: 445
 * commits carry a `(beads)` scope and 440 of them - 98.9% - touch nothing but
 * `.beads/`. That is not a threshold anyone chose; it is what the repository
 * already does. The five that do not are recorded below, and a sixth fails.
 *
 * WHAT THIS GATE DOES NOT CATCH, stated so nobody mistakes its scope for
 * am-ii21's. Of the three incidents it catches one:
 *
 *   4c0af995  chore(beads), 43 files, 42 outside .beads/     CAUGHT, and it is
 *             the single most scope-incoherent commit in the history.
 *   ca2b4d29  fix(mobile), 64 files across 47 directories    NOT CAUGHT. It
 *             ranks 10th by foreign-area files, below six commits that are
 *             legitimate, and a02a35a6 spans 70 directories honestly. No
 *             size or spread predicate separates it.
 *   511d13e4  refactor(chrome), 1 file, correct scope        NOT CAUGHT, and
 *             not catchable here. It carried a peer's 37-line block inside a
 *             file that genuinely belonged to its message. The contamination is
 *             intra-file, so no commit-metadata predicate can see it at all.
 *
 * Two of three are a documented refusal rather than an oversight: a gate that
 * fired on them would fire on honest wide commits, and a gate nobody trusts
 * gets disabled within a day.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * The five `(beads)` commits that predate this gate and touch other paths.
 * Two-sided: a sixth fails, and an entry here that no longer violates also
 * fails, so the list cannot rot into a permanent excuse.
 */
const KNOWN_VIOLATIONS: ReadonlyMap<string, number> = new Map([
  ["4c0af995", 42],
  ["75dbe3a4", 16],
  ["aca14ae2", 15],
  ["18f1f4bd", 3],
  ["fa281691", 1],
]);

interface Commit {
  readonly sha: string;
  readonly subject: string;
  readonly files: readonly string[];
}

function beadsScopedCommits(): Commit[] {
  const raw = execFileSync("git", ["log", "--no-merges", "--name-only", "--format=%x00%H%x09%s"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out: Commit[] = [];
  for (const chunk of raw.split("\0")) {
    if (!chunk.trim()) continue;
    const [header, ...rest] = chunk.split("\n");
    const [sha, subject] = (header ?? "").split("\t");
    if (!sha || !subject) continue;
    if (!/^\w+\(([^)]*\b)?beads(\b[^)]*)?\):/.test(subject)) continue;
    out.push({ sha: sha.slice(0, 8), subject, files: rest.filter(Boolean) });
  }
  return out;
}

/**
 * THIS FILE IS NODE-LANE, and bunfig.toml ignores it, for a measured reason:
 * bun cannot spawn git in this environment at all. execFileSync and
 * Bun.spawnSync both fail with `EBADF: bad file descriptor, posix_spawn
 * '/usr/bin/git'`, at module scope and inside a test body alike. The other
 * history-reading tests - outFreshness.fixture and trackedImports - are already
 * ignored by bunfig for the same reason. Run it with
 * `node --experimental-strip-types --test`.
 */
let cache: { commits: Commit[]; outside: Map<string, string[]> } | null = null;
function history(): { commits: Commit[]; outside: Map<string, string[]> } {
  if (cache) return cache;
  const commits = beadsScopedCommits();
  const outside = new Map<string, string[]>();
  for (const c of commits) {
    const foreign = c.files.filter((f) => !f.startsWith(".beads/"));
    if (foreign.length > 0) outside.set(c.sha, foreign);
  }
  cache = { commits, outside };
  return cache;
}

describe("a (beads)-scoped commit touches only .beads/ (am-ii21)", () => {
  test("THE DENOMINATOR: the history walk reaches a real population", () => {
    // Without this the gate passes in a shallow clone, where `git log` returns
    // little or nothing, and reports conformance over a sweep it never ran.
    const found = history().commits.length;
    assert.ok(
      found > 300,
      `Only ${found} (beads) commits found. A shallow clone or a failed git call makes this ` +
        "gate vacuous; it is not evidence of conformance.",
    );
  });

  test("no unrecorded (beads) commit touches a path outside .beads/", () => {
    const unrecorded = [...history().outside]
      .filter(([sha]) => !KNOWN_VIOLATIONS.has(sha))
      .map(([sha, files]) => `${sha}: ${files.length} file(s) outside .beads/, e.g. ${files[0]}`);
    assert.deepEqual(
      unrecorded,
      [],
      "A (beads) commit carried source files. That is the am-ii21 shape: a bare `git commit` " +
        "reading a shared index sweeps whatever peers left dirty. Commit with an explicit " +
        "pathspec, or if the mixture is deliberate, say so and record the sha here.",
    );
  });

  test("every recorded violation still exists and still violates, so the list cannot rot", () => {
    const stale: string[] = [];
    for (const [sha, expected] of KNOWN_VIOLATIONS) {
      const actual = history().outside.get(sha)?.length;
      if (actual === undefined) {
        stale.push(`${sha}: recorded as a violation but no longer found as one - remove it`);
      } else if (actual !== expected) {
        stale.push(`${sha}: recorded ${expected} files outside .beads/, measured ${actual}`);
      }
    }
    assert.deepEqual(stale, [], "The recorded violations drifted from the history they describe.");
  });
});
