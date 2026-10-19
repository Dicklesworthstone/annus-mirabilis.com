/**
 * THE DIFF IS THE ONLY RECORD AN OVERWRITE LEAVES, SO IT IS CHECKED AGAINST AN OUTSIDE AUTHORITY.
 *
 * `am-edn-alignment-tooling-do1` scope B.6 requires `--update` to write a unified diff before it
 * replaces an authored block file. A diff that is subtly wrong is worse than none: it reads like a
 * recovery record and will not apply. The expectations pinned below were therefore captured from
 * the SYSTEM `diff -u` rather than from this module, and `unifiedDiff.node.test.ts` runs that
 * comparison as a gate in the other lane, over the real `content/source-blocks/` files. Thirteen
 * structural cases agreed on 2026-10-19, after that comparison found two defects here that this
 * file's own assertions would not have:
 *
 * - `x\n` against `x` returned the EMPTY STRING. Stripping the terminator before splitting made the
 *   two line arrays equal, so every op was `eq` and the function reported "identical" for inputs
 *   differing in their last byte. A false identical is the one answer a diff must never give,
 *   because the caller then records nothing for a real overwrite. Regression below.
 * - Two changes six unchanged lines apart were emitted as two hunks where diff(1) emits one. The
 *   gap that matters is the count of unchanged ops, and a replaced line contributes two ops, so the
 *   index distance overstated it by one per replacement. Regression below.
 *
 * The hunk-header sweep is the half that does not depend on an outside tool: it re-derives each
 * `@@ -a,b +c,d @@` from the hunk body it labels, which is arithmetic computed separately from the
 * arithmetic that emitted it. Its own control is a hand-written malformed header, so a sweep that
 * had stopped checking anything cannot pass quietly.
 */

import { describe, expect, test } from "bun:test";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import { LCS_LINE_CAP, unifiedDiff } from "./unifiedDiff.ts";

/** A source block the shape of the ones `--write-blocks` would replace. */
const BLOCK = [
  'id: "s0-p1"',
  'kind: "paragraph"',
  'paper: "brownian-motion"',
  'section: "s0"',
  "order: 3",
  "locators:",
  "  - pdfPageIndex: 1",
  "    printedPage: 549",
  'diplomaticText: "In dieser Arbeit soll gezeigt werden."',
  'lang: "de"',
].join("\n");
const OLD = `${BLOCK}\n`;

const LABELS = { oldLabel: "old/s0.yaml", newLabel: "new/s0.yaml" } as const;

/** How many hunks a diff emitted. */
function hunkCount(diff: string): number {
  return diff.split("\n").filter((line) => line.startsWith("@@ -")).length;
}

describe("unifiedDiff: the bytes, pinned against the system diff -u", () => {
  test("one replaced line yields one hunk with three lines of context each side", () => {
    const next = `${BLOCK.replace("order: 3", "order: 4")}\n`;
    expect(unifiedDiff(OLD, next, LABELS)).toBe(
      "--- old/s0.yaml\n" +
        "+++ new/s0.yaml\n" +
        "@@ -2,7 +2,7 @@\n" +
        ' kind: "paragraph"\n' +
        ' paper: "brownian-motion"\n' +
        ' section: "s0"\n' +
        "-order: 3\n" +
        "+order: 4\n" +
        " locators:\n" +
        "   - pdfPageIndex: 1\n" +
        "     printedPage: 549\n",
    );
  });

  test("two changes five unchanged lines apart are one hunk", () => {
    const next = `${BLOCK.replace('kind: "paragraph"', 'kind: "heading"').replace(
      "    printedPage: 549",
      "    printedPage: 550",
    )}\n`;
    const diff = unifiedDiff(OLD, next, LABELS);
    expect(diff).toBe(
      "--- old/s0.yaml\n" +
        "+++ new/s0.yaml\n" +
        "@@ -1,10 +1,10 @@\n" +
        ' id: "s0-p1"\n' +
        '-kind: "paragraph"\n' +
        '+kind: "heading"\n' +
        ' paper: "brownian-motion"\n' +
        ' section: "s0"\n' +
        " order: 3\n" +
        " locators:\n" +
        "   - pdfPageIndex: 1\n" +
        "-    printedPage: 549\n" +
        "+    printedPage: 550\n" +
        ' diplomaticText: "In dieser Arbeit soll gezeigt werden."\n' +
        ' lang: "de"\n',
    );
    expect(hunkCount(diff)).toBe(1);
  });

  /*
   * REGRESSION, AND THE BOUNDARY IS THE WHOLE POINT. The over-splitting defect was invisible at any
   * other distance: a first draft of this file asserted one hunk for two changes FIVE unchanged
   * lines apart, which both the broken and the repaired rule merge, so planting the defect back left
   * the suite green. 2 * context is 6, so 6 unchanged lines between two changes must merge and 7
   * must split, and only those two cases tell the rules apart.
   */
  test("the hunk-merge boundary: six unchanged lines between changes merge, seven split", () => {
    const wide = `${Array.from({ length: 20 }, (_, n) => `line ${n}`).join("\n")}\n`;
    const changeTwoLines = (first: number, second: number): string =>
      wide
        .split("\n")
        .map((l, i) => (i === first || i === second ? `# changed ${i}` : l))
        .join("\n");

    const merged = unifiedDiff(wide, changeTwoLines(2, 9), LABELS);
    expect(hunkCount(merged)).toBe(1);

    const split = unifiedDiff(wide, changeTwoLines(2, 10), LABELS);
    expect(hunkCount(split)).toBe(2);
    expect(split).toContain("@@ -1,6 +1,6 @@");
    expect(split).toContain("@@ -8,7 +8,7 @@");
  });

  test("REGRESSION: losing the trailing newline is a change, not an identity", () => {
    const next = BLOCK; // the same lines, no terminator
    const diff = unifiedDiff(OLD, next, LABELS);
    // The defect this replaces returned "" here.
    expect(diff).not.toBe("");
    expect(diff).toBe(
      "--- old/s0.yaml\n" +
        "+++ new/s0.yaml\n" +
        "@@ -7,4 +7,4 @@\n" +
        "   - pdfPageIndex: 1\n" +
        "     printedPage: 549\n" +
        ' diplomaticText: "In dieser Arbeit soll gezeigt werden."\n' +
        '-lang: "de"\n' +
        '+lang: "de"\n' +
        "\\ No newline at end of file\n",
    );
    // And the other direction, which is a different branch: the marker moves to the removed line.
    const reversed = unifiedDiff(next, OLD, LABELS);
    expect(reversed).toContain('-lang: "de"\n\\ No newline at end of file\n+lang: "de"\n');
  });

  test("byte-identical inputs produce the empty string, not a bare header", () => {
    expect(unifiedDiff(OLD, OLD, LABELS)).toBe("");
    expect(unifiedDiff("", "", LABELS)).toBe("");
  });

  test("an empty side is reported as a whole-file insertion or deletion", () => {
    expect(unifiedDiff("", "a\nb\n", LABELS)).toBe(
      "--- old/s0.yaml\n+++ new/s0.yaml\n@@ -0,0 +1,2 @@\n+a\n+b\n",
    );
    expect(unifiedDiff("a\nb\n", "", LABELS)).toBe(
      "--- old/s0.yaml\n+++ new/s0.yaml\n@@ -1,2 +0,0 @@\n-a\n-b\n",
    );
  });

  test("above the LCS cap the whole file is reported as one replacement hunk", () => {
    const big = (token: string) =>
      `${Array.from({ length: LCS_LINE_CAP + 1 }, (_, n) => `${token} ${n}`).join("\n")}\n`;
    const diff = unifiedDiff(big("old"), big("new"), LABELS);
    expect(diff).toContain(`@@ -1,${LCS_LINE_CAP + 1} +1,${LCS_LINE_CAP + 1} @@`);
    expect(diff.split("@@ -").length - 1).toBe(1);
    expect(diff).toContain("-old 0\n");
    expect(diff).toContain("+new 0\n");
    // Every old line is removed before any new line is added, so the record still applies.
    expect(diff.indexOf(`-old ${LCS_LINE_CAP}`)).toBeLessThan(diff.indexOf("+new 0"));
  });
});

/**
 * Parse `@@ -a,b +c,d @@` headers and re-derive each count from the body the header labels.
 * Returns a refusal string per inconsistency, so a caller can assert on the list rather than on a
 * boolean. Deliberately not the emitter's arithmetic: it counts the lines that were printed.
 */
function headerInconsistencies(diff: string): readonly string[] {
  const problems: string[] = [];
  const lines = diff.split("\n");
  type Hunk = {
    header: string;
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    body: string[];
  };
  const hunks: Hunk[] = [];
  for (const line of lines) {
    const header = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
    if (header) {
      hunks.push({
        header: line,
        oldStart: Number(header[1]),
        oldCount: Number(header[2]),
        newStart: Number(header[3]),
        newCount: Number(header[4]),
        body: [],
      });
      continue;
    }
    const open = hunks[hunks.length - 1];
    if (open === undefined) continue;
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line === "") continue;
    if (line === "\\ No newline at end of file") continue;
    open.body.push(line);
  }
  if (hunks.length === 0 && diff !== "")
    problems.push("a non-empty diff with no parseable hunk header");
  for (const hunk of hunks) {
    const removed = hunk.body.filter((l) => l.startsWith("-")).length;
    const added = hunk.body.filter((l) => l.startsWith("+")).length;
    const kept = hunk.body.filter((l) => l.startsWith(" ")).length;
    if (removed + kept !== hunk.oldCount) {
      problems.push(`${hunk.header} says ${hunk.oldCount} old lines, body has ${removed + kept}`);
    }
    if (added + kept !== hunk.newCount) {
      problems.push(`${hunk.header} says ${hunk.newCount} new lines, body has ${added + kept}`);
    }
    if (hunk.oldCount > 0 && hunk.oldStart < 1)
      problems.push(`${hunk.header} starts a non-empty old side below line 1`);
    if (hunk.newCount > 0 && hunk.newStart < 1)
      problems.push(`${hunk.header} starts a non-empty new side below line 1`);
    if (hunk.oldCount === 0 && hunk.oldStart !== 0)
      problems.push(`${hunk.header} names a start for an empty old side`);
    if (hunk.newCount === 0 && hunk.newStart !== 0)
      problems.push(`${hunk.header} names a start for an empty new side`);
  }
  return problems;
}

describe("unifiedDiff: every hunk header agrees with the hunk it labels", () => {
  test("CONTROL: the header check rejects a hand-written diff whose count is wrong", () => {
    const wrong = "--- a\n+++ b\n@@ -1,9 +1,3 @@\n a\n-b\n+c\n";
    const problems = headerInconsistencies(wrong);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain("says 9 old lines, body has 2");
    // And it passes the same diff with the counts repaired, so it is not refusing everything.
    expect(headerInconsistencies("--- a\n+++ b\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n")).toEqual([]);
  });

  test("every single-line mutation of a real-shaped block emits consistent headers", () => {
    const lines = BLOCK.split("\n");
    const mutations: { name: string; text: string; expectedHunks?: number }[] = [];
    for (const [i] of lines.entries()) {
      mutations.push({
        name: `replace ${i}`,
        text: lines.map((l, j) => (i === j ? "# replaced" : l)).join("\n"),
      });
      mutations.push({ name: `delete ${i}`, text: lines.filter((_, j) => i !== j).join("\n") });
      mutations.push({
        name: `insert at ${i}`,
        text: [...lines.slice(0, i), "# inserted", ...lines.slice(i)].join("\n"),
      });
    }
    /*
     * Pairs, so every distance between two changes is exercised, each carrying the hunk count a
     * reader can derive without this module: two replacements `j - i - 1` unchanged lines apart
     * merge when that gap is at most 2 * context and split otherwise. The block is ten lines, so
     * both branches occur. The header sweep alone cannot see an over-split, because two wrongly
     * separated hunks are each internally consistent.
     */
    for (const [i] of lines.entries()) {
      for (const j of lines.keys()) {
        if (j <= i) continue;
        mutations.push({
          name: `replace ${i} and ${j}`,
          text: lines.map((l, k) => (k === i || k === j ? `# ${k}` : l)).join("\n"),
          expectedHunks: j - i - 1 <= 6 ? 1 : 2,
        });
      }
    }

    const problems: string[] = [];
    let diffed = 0;
    for (const mutation of mutations) {
      const diff = unifiedDiff(OLD, `${mutation.text}\n`, LABELS);
      expect(diff).not.toBe("");
      diffed++;
      for (const problem of headerInconsistencies(diff)) {
        problems.push(`${mutation.name}: ${problem}`);
      }
      if (mutation.expectedHunks !== undefined && hunkCount(diff) !== mutation.expectedHunks) {
        problems.push(
          `${mutation.name}: ${String(mutation.expectedHunks)} hunks expected, ${String(hunkCount(diff))} emitted`,
        );
      }
    }
    expect(problems).toEqual([]);

    const vacuous = reportPopulation({
      gate: "unified-diff-headers",
      examined: diffed,
      noun: "mutated block diffs",
      minimum: 60,
    });
    expect(vacuous).toBe(false);
  });
});
