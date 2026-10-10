#!/usr/bin/env bun
/**
 * THE ADVERSARIAL AUDIT, AND ITS REPORT (am-ver-adversarial-audit-1ef).
 *
 * The bead's technical approach: this script "runs the paired wrong-computation tests in
 * src/testing/adversarial/ and writes the report". It is the artefact launch readiness consumes,
 * so it has to be a measurement rather than a summary of intentions.
 *
 * WHAT IT REFUSES, which is most of its value:
 *
 *   - a row marked `implemented` with no test file on disk, and a test file for a row the registry
 *     still calls outstanding. Either way the audit's account of itself has drifted from the audit,
 *     and a report that says "14 of 15" while 13 files exist is worse than no report.
 *   - a row whose test file reports zero assertions. A test that ran and examined nothing is
 *     indistinguishable in an exit code from one that proved something.
 *   - any failing row.
 *
 * WHAT IT DERIVES RATHER THAN RESTATES. The wrong-computation names per row are read from each test
 * file's own import of `wrongComputations.ts`, not from a hand-kept table, because a table beside
 * the code is a second source that drifts. The row count, claims and owners come from
 * ADVERSARIAL_ROWS by import, not by grep: counting that registry with
 * `grep -c 'state: "implemented"'` reports one too many, because the type declaration
 * `state: "implemented" | "not-yet"` contains both strings.
 *
 * THE MISCONCEPTION LINKS ARE CANDIDATES AND SAY SO. The bead asks the report to cross-link
 * matching misconception entries "where they exist", while the misconception prose itself is
 * explicitly out of this bead's scope. So a link here is a keyword candidate for an editor to
 * confirm, never an assertion that the two describe the same error.
 *
 * Usage: bun scripts/audit-adversarial.ts [--no-run] [--out <path>]
 *   --no-run   write the report from the registry and the files on disk without running the tests.
 *              Prints that it did so, and never claims a row passed.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ADVERSARIAL_ROWS } from "../src/testing/adversarial/rows.ts";
import { appendLogLine, logPathFor, newLogRunId } from "./scaffold/logLine.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROW_DIR = join(ROOT, "src/testing/adversarial");
const SUITE = "adversarial";
const BEAD = "am-ver-adversarial-audit-1ef";

const args = process.argv.slice(2);
const noRun = args.includes("--no-run");
const outIndex = args.indexOf("--out");
const outPath =
  outIndex === -1 || !args[outIndex + 1]
    ? join(ROOT, "docs/audits/ADVERSARIAL_AUDIT.md")
    : resolve(args[outIndex + 1] as string);

type RowFile = Readonly<{ row: number; file: string }>;

/** `row07.lightComplexVolume.test.ts` -> { row: 7, file }. */
function rowFiles(): RowFile[] {
  return readdirSync(ROW_DIR)
    .filter((name) => /^row\d{2}\..*\.test\.ts$/.test(name))
    .map((file) => ({ row: Number(file.slice(3, 5)), file }))
    .sort((a, b) => a.row - b.row);
}

/** The `wrong*` names a row's test actually imports, read from the file. */
function wrongComputationsIn(file: string): string[] {
  const text = readFileSync(join(ROW_DIR, file), "utf8");
  const match = text.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/wrongComputations\.ts["']/);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter((name) => name.length > 0 && !name.startsWith("type "))
    .sort();
}

/**
 * The misconception record a row DECLARES, checked to exist.
 *
 * This replaced a keyword search, and the replacement is the point. The keyword version matched any
 * record sharing a word longer than seven characters with the row's claim, and row 13 came back with
 * 28 of the 29 records because "Einstein" appears in nearly all of them. That is a column of
 * plausible links nobody checked, which this script's own docblock warns against and which I then
 * built. A link is now declared in the registry after someone read the record, and an undeclared row
 * reports nothing rather than a guess.
 */
function declaredMisconception(
  id: string | undefined,
): Readonly<{ text: string; missing: boolean }> {
  if (!id) return { text: "not declared", missing: false };
  const path = join(ROOT, "content/misconceptions", `${id}.json`);
  return existsSync(path)
    ? { text: `\`${id}\``, missing: false }
    : { text: `**MISSING** \`${id}\``, missing: true };
}

/**
 * Escapes a pipe for a markdown table cell.
 *
 * Row 15's claim is "A neutral conductor with current violates |J/rho| < c", whose two pipes split
 * that row into eleven cells and shifted every column after the claim. The generated table had been
 * wrong since the first run, and it is the kind of wrong a reader attributes to the renderer rather
 * than to the data, so nobody reads it as a defect.
 */
function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}

type RowResult = Readonly<{
  row: number;
  file: string | null;
  pass: number;
  fail: number;
  assertions: number;
  ran: boolean;
}>;

/** Runs ONE row's test file and reads the counts out of the output, not out of the exit code. */
function runRow(file: string): Omit<RowResult, "row" | "file"> {
  const result = spawnSync(
    "bun",
    ["test", join("src/testing/adversarial", file), "--isolate", "--timeout", "60000"],
    { cwd: ROOT, encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const pass = Number(/^\s*(\d+) pass$/m.exec(output)?.[1] ?? "0");
  const fail = Number(/^\s*(\d+) fail$/m.exec(output)?.[1] ?? "0");
  const assertions = Number(/(\d+) expect\(\) calls/.exec(output)?.[1] ?? "0");
  return { pass, fail, assertions, ran: true };
}

const files = rowFiles();
const onDisk = new Map(files.map((f) => [f.row, f.file]));
const marked = new Set(ADVERSARIAL_ROWS.filter((r) => r.state === "implemented").map((r) => r.row));

// THE REGISTRY AND THE DISK MUST AGREE BEFORE ANYTHING IS REPORTED.
const missingFile = [...marked].filter((row) => !onDisk.has(row)).sort((a, b) => a - b);
const unmarked = [...onDisk.keys()].filter((row) => !marked.has(row)).sort((a, b) => a - b);
const drift: string[] = [];
if (missingFile.length > 0)
  drift.push(`marked implemented with no test file: ${missingFile.join(", ")}`);
if (unmarked.length > 0) drift.push(`test file present but not marked: ${unmarked.join(", ")}`);

const logRunId = newLogRunId();
const logPath = logPathFor(SUITE, logRunId, ROOT);
mkdirSync(dirname(logPath), { recursive: true });

const results: RowResult[] = ADVERSARIAL_ROWS.map((row) => {
  const file = onDisk.get(row.row) ?? null;
  if (!file || noRun || drift.length > 0)
    return { row: row.row, file, pass: 0, fail: 0, assertions: 0, ran: false };
  return { row: row.row, file, ...runRow(file) };
});

const byRow = new Map(results.map((r) => [r.row, r]));
const vacuous = results.filter((r) => r.ran && r.fail === 0 && r.assertions === 0);
const failing = results.filter((r) => r.ran && r.fail > 0);

for (const row of ADVERSARIAL_ROWS) {
  const result = byRow.get(row.row);
  const file = result?.file ?? null;
  const outcome =
    row.state !== "implemented"
      ? "not-yet"
      : !result?.ran
        ? "not-run"
        : result.fail > 0
          ? "failed"
          : result.assertions === 0
            ? "vacuous"
            : "passed";
  appendLogLine(logPath, {
    suite: SUITE,
    logRunId,
    testId: `adversarial-row-${String(row.row).padStart(2, "0")}`,
    beadId: BEAD,
    outcome: outcome === "passed" ? "pass" : "fail",
    message: `row ${row.row}: ${row.claim}`,
    extra: {
      row: row.row,
      rowStatus: outcome,
      owner: row.owner,
      testFile: file,
      wrongComputations: file ? wrongComputationsIn(file) : [],
      pass: result?.pass ?? 0,
      fail: result?.fail ?? 0,
      assertions: result?.assertions ?? 0,
    },
  });
}

const implemented = ADVERSARIAL_ROWS.filter((r) => r.state === "implemented");
const lines: string[] = [];
lines.push("# Adversarial fixture audit");
lines.push("");
lines.push(
  "Generated by `bun scripts/audit-adversarial.ts` (`am-ver-adversarial-audit-1ef`). Do not hand-edit:",
);
lines.push("every column below is read from the registry, the files on disk, or a test run.");
lines.push("");
lines.push(`- Rows declared: **${ADVERSARIAL_ROWS.length}**`);
lines.push(`- Rows implemented: **${implemented.length}**`);
lines.push(`- Row test files on disk: **${files.length}**`);
lines.push(
  `- Rows run in this report: **${results.filter((r) => r.ran).length}**${noRun ? " (`--no-run`, so no row is claimed to pass)" : ""}`,
);
// The DIRECTORY, not this run's file. The report is committed, so naming the per-run id rewrote one
// line of a tracked file on every run, in a shared checkout where several agents read each other's
// diffs. Churn with no semantic content is how a diff stops being read. The run's own id goes to
// stderr below and into the gate's JSONL, where a reader who needs it will actually look.
lines.push(
  `- Structured logs: \`artifacts/test-logs/${SUITE}/\` (this run's id is printed on stderr)`,
);
lines.push("");
if (drift.length > 0) {
  lines.push("> **REFUSED.** The registry and the files on disk disagree, so no result below is");
  lines.push(`> trustworthy: ${drift.join("; ")}.`);
  lines.push("");
}
lines.push(
  "| Row | Claim | Owner | Wrong computation | Tests | Assertions | State | Misconception |",
);
lines.push("|---:|---|---|---|---:|---:|---|---|");
for (const row of ADVERSARIAL_ROWS) {
  const result = byRow.get(row.row);
  const file = result?.file ?? null;
  const wrong = file ? wrongComputationsIn(file) : [];
  const state =
    row.state !== "implemented"
      ? "not yet"
      : !result?.ran
        ? "not run"
        : result.fail > 0
          ? `**FAILED** (${result.fail})`
          : result.assertions === 0
            ? "**VACUOUS**"
            : "passed";
  const link = declaredMisconception(row.misconception);
  if (link.missing)
    drift.push(`row ${row.row} declares misconception ${row.misconception}, which is not on disk`);
  lines.push(
    `| ${row.row} | ${cell(row.claim)} | \`${cell(row.owner)}\` | ${
      wrong.length > 0 ? wrong.map((w) => `\`${w}\``).join(", ") : "-"
    } | ${result?.ran ? `${result.pass}/${result.pass + result.fail}` : "-"} | ${
      result?.assertions ?? "-"
    } | ${state} | ${link.text} |`,
  );
}
lines.push("");
lines.push("## What the columns mean");
lines.push("");
lines.push(
  "- **Wrong computation** is read from each row test's own import of `wrongComputations.ts`, so it cannot drift from the code.",
);
lines.push(
  "- **Assertions** is the `expect()` count. A row that runs and asserts nothing is reported **VACUOUS** and fails this audit, because an empty run and a clean run have the same exit code.",
);
lines.push(
  '- **Misconception** is a link DECLARED in the registry after someone read the record and found the same error, never a keyword match. An earlier keyword version returned 28 of 29 records for row 13, because "Einstein" appears in nearly all of them. An undeclared row says so rather than guessing.',
);
lines.push(
  "- A row marked implemented with no test file, or a test file for an unmarked row, REFUSES the whole report rather than producing a plausible one.",
);
lines.push("");

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join("\n"), "utf8");

const examined = results.filter((r) => r.ran).length;
const totalAssertions = results.reduce((sum, r) => sum + r.assertions, 0);
console.error(
  `[audit-adversarial] ${ADVERSARIAL_ROWS.length} rows declared, ${implemented.length} implemented, ` +
    `${files.length} test files on disk, ${examined} run, ${totalAssertions} assertion(s); ` +
    `report written to ${outPath.slice(ROOT.length + 1)}; log ${logPath.slice(ROOT.length + 1)}`,
);
if (drift.length > 0) console.error(`[audit-adversarial] REFUSED: ${drift.join("; ")}`);
for (const row of failing)
  console.error(`[audit-adversarial] row ${row.row} FAILED: ${row.fail} failing test(s)`);
for (const row of vacuous)
  console.error(`[audit-adversarial] row ${row.row} is VACUOUS: it ran and asserted nothing`);

process.exit(drift.length > 0 || failing.length > 0 || vacuous.length > 0 ? 1 : 0);
