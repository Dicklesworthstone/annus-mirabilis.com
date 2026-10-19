/**
 * THE DIFF IS CHECKED AGAINST diff(1), OVER THE REAL BLOCK FILES IT WILL BE ASKED TO DESCRIBE.
 *
 * `unifiedDiff.test.ts` pins expected bytes and re-derives every hunk header from the body it
 * labels. Both of those are this repository checking its own arithmetic. This file asks an outside
 * authority instead: for each mutation it runs the system `diff -u` over the same two files and
 * requires the hunk text to match character for character.
 *
 * It lives in the NODE lane, and the pinning tests live in the bun lane, because AGENTS.md asks that
 * a gate's proof not sit only in the lane that gate controls. Here the split is also practical: the
 * bun lane cannot be relied on to spawn a subprocess in this checkout, and a comparison against an
 * outside tool is worthless if the spawn silently fails. So the half that needs a subprocess runs
 * where subprocesses run, and the half that needs none runs in the fast lane.
 *
 * It found two defects on 2026-10-19 that the pinned half, written first, did not:
 *   - `x\n` against `x` returned the empty string, a false "identical";
 *   - two changes exactly 2 * context apart were split into two hunks where diff(1) emits one.
 * Both are now regressions in the bun-lane file as well, which is the point of writing the outside
 * check first and keeping it.
 *
 * `diff` is POSIX-mandated and this is fail-closed on its absence: a machine without it gets a
 * refusal naming the missing tool, never a quiet pass. A comparison that cannot run has not
 * succeeded.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;
const WORK = mkdtempSync(join(tmpdir(), "unified-diff-oracle-"));

/** Everything after the first `@@`, which is the part diff(1) and this module must agree on. */
function hunksOf(diff: string): string {
  const at = diff.indexOf("@@");
  return at === -1 ? "" : diff.slice(at);
}

function systemHunks(oldText: string, newText: string): string {
  const a = join(WORK, "a.yaml");
  const b = join(WORK, "b.yaml");
  writeFileSync(a, oldText, "utf8");
  writeFileSync(b, newText, "utf8");
  const run = spawnSync("diff", ["-u", a, b], { encoding: "utf8" });
  // diff(1) exits 0 when identical, 1 when different, >1 on trouble. Only >1 is a failure here, and
  // it must not be read as "no difference".
  assert.ok(
    run.status !== null && run.status <= 1,
    `diff -u failed with status ${String(run.status)}: ${run.stderr ?? ""}`,
  );
  return hunksOf(run.stdout ?? "");
}

/**
 * A deterministic sample of the real corpus: every eighth block file of each paper, sorted, which
 * takes in all four papers and every block kind without spawning `diff` 460 times.
 */
function sampleBlockFiles(): readonly string[] {
  const picked: string[] = [];
  for (const paper of PAPERS) {
    const dir = join(ROOT, "content", "source-blocks", paper);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".yaml") && !name.startsWith("manifest"))
      .sort();
    for (const [index, name] of files.entries()) {
      if (index % 8 === 0) picked.push(join(dir, name));
    }
  }
  return picked;
}

/** The mutations applied to each sampled file. Named, so a disagreement says which shape broke. */
function mutationsOf(text: string): readonly { name: string; text: string }[] {
  const lines = text.split("\n");
  const middle = Math.max(1, Math.floor(lines.length / 2));
  const replaceAt = (i: number, value: string): string =>
    lines.map((line, j) => (i === j ? value : line)).join("\n");
  return [
    { name: "replace one line in the middle", text: replaceAt(middle, "# replaced") },
    { name: "delete one line", text: lines.filter((_, j) => j !== middle).join("\n") },
    {
      name: "insert one line",
      text: [...lines.slice(0, middle), "# inserted", ...lines.slice(middle)].join("\n"),
    },
    {
      name: "two changes seven lines apart",
      text: lines
        .map((line, j) => (j === 1 || j === 8 ? `# changed ${String(j)}` : line))
        .join("\n"),
    },
    {
      name: "two changes eight lines apart",
      text: lines
        .map((line, j) => (j === 1 || j === 9 ? `# changed ${String(j)}` : line))
        .join("\n"),
    },
    {
      name: "trailing newline removed",
      text: text.endsWith("\n") ? text.slice(0, -1) : `${text}\n`,
    },
    { name: "emptied", text: "" },
  ];
}

describe("unifiedDiff agrees with the system diff -u over the real source-block corpus", () => {
  it("spawns diff(1) at all, so the comparisons below are real", () => {
    const probe = spawnSync("diff", ["-u", "/dev/null", "/dev/null"], { encoding: "utf8" });
    assert.ok(
      probe.error === undefined && probe.status === 0,
      `diff(1) is not usable here, so this gate cannot reach a verdict: ${String(probe.error ?? probe.status)}`,
    );
    // And it reports a difference when there is one, so a comparison against it is discriminating.
    const differing = systemHunks("a\n", "b\n");
    assert.ok(
      differing.includes("-a"),
      `diff -u reported no change between "a" and "b": ${differing}`,
    );
  });

  it("every mutation of every sampled block file produces the same hunks diff -u does", () => {
    const files = sampleBlockFiles();
    const disagreements: string[] = [];
    let compared = 0;

    for (const file of files) {
      const original = readFileSync(file, "utf8");
      for (const mutation of mutationsOf(original)) {
        const mine = hunksOf(
          unifiedDiff(original, mutation.text, { oldLabel: "a", newLabel: "b" }),
        );
        const theirs = systemHunks(original, mutation.text);
        compared++;
        if (mine !== theirs) {
          disagreements.push(
            `${file} / ${mutation.name}\n  diff -u:\n${theirs}\n  unifiedDiff:\n${mine}`,
          );
        }
      }
    }

    const vacuous = reportPopulation({
      gate: "unified-diff-oracle",
      examined: compared,
      noun: "corpus diffs compared with diff -u",
      minimum: 100,
    });
    assert.equal(
      vacuous,
      false,
      `only ${String(compared)} comparisons ran; the sample is too small`,
    );
    assert.equal(files.length > 0, true, "no source-block files were sampled");
    assert.deepEqual(disagreements, [], disagreements.join("\n\n"));
  });
});
