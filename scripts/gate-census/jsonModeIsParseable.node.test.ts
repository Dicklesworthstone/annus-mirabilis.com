/**
 * A GATE'S `--json` STDOUT IS DATA, AND NOTHING ELSE RIDES ON IT.
 *
 * `coverage-report --json` printed its census line after the report, so its stdout could not be
 * parsed; that is how a case in the bun lane came to be red for six days. The shape turned out to
 * be a class rather than an accident. Every script that prints a report under `--json` and also
 * reports a population was run on 2026-10-14, and ALL FIVE were unparseable:
 *
 *     coverage-report           census after the JSON
 *     definition-of-done        Extra data at 14924 of 15011
 *     verify-facsimile-anchors  Extra data at 3134 of 3345, census and a `Structured log:` line
 *     verify-facsimile-pins     Extra data at 3050 of 3243, the same two
 *     resource-stress           Expecting value at 1: the census printed BEFORE the report
 *
 * A sixth joined them for a different reason: `audit-instruments --json` printed its human
 * markdown table before the report, so that output was unparseable from the first byte.
 *
 * The census stays visible in every case: `parsePopulationLines` reads a gate's COMBINED output,
 * so sending the line to stderr under `--json` costs the census reader nothing.
 *
 * This file spawns the real scripts, because that is the only way to see what a caller sees, and
 * it therefore lives in the node lane: bun's runner cannot reliably spawn here, which is the same
 * reason the git-dependent files are listed in bunfig.toml. Nine seconds for all five, measured.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

/** Each gate that prints a report under `--json`, with the census noun it reports. */
const JSON_GATES = [
  "scripts/coverage-report.ts",
  "scripts/definition-of-done.ts",
  "scripts/verify-facsimile-anchors.ts",
  "scripts/verify-facsimile-pins.ts",
  "scripts/resource-stress.ts",
  // Reaches the network, and is safe here anyway: readLiveIdentity catches a fetch failure and
  // returns a note rather than throwing, so stdout is valid JSON whether or not the live site
  // answers. Its census line goes to stderr under --json for exactly this test's reason.
  "scripts/release-freshness.ts",
  // Not a census case: this one printed its human markdown table on stdout before the report, so
  // the output was unparseable from the first byte. The defect is the same shape -- something
  // that is not data on the data stream -- and the test is the same test.
  "scripts/audit-instruments.ts",
] as const;

test("every gate that prints JSON prints ONLY JSON on stdout", () => {
  const findings: string[] = [];
  let parsed = 0;
  for (const script of JSON_GATES) {
    const run = spawnSync("bun", [script, "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 600_000,
    });
    const stdout = run.stdout ?? "";
    const stderr = run.stderr ?? "";
    const censusOnStdout = stdout.split("\n").filter((l) => l.startsWith("[census]")).length;
    const censusOnStderr = stderr.split("\n").filter((l) => l.startsWith("[census]")).length;

    // What the run produced, before any verdict is read from it: a script that printed nothing
    // and a script that printed a clean report are both "no parse error" to a careless check.
    console.log(
      `[json mode] ${script} exit ${run.status}, stdout ${stdout.length}B, ` +
        `census stdout ${censusOnStdout} stderr ${censusOnStderr}`,
    );
    if (run.error) {
      findings.push(`${script}: spawn failed, ${String(run.error)}`);
      continue;
    }
    if (stdout.trim().length === 0) {
      findings.push(`${script}: printed nothing on stdout under --json`);
      continue;
    }
    if (censusOnStdout > 0) {
      findings.push(`${script}: printed ${censusOnStdout} census line(s) on stdout`);
    }
    try {
      JSON.parse(stdout);
      parsed += 1;
    } catch (err) {
      findings.push(`${script}: stdout does not parse as JSON, ${(err as Error).message}`);
    }
  }
  assert.deepEqual(findings, []);
  // Non-vacuity: every gate in the list really printed a report, so "no findings" is a result and
  // not a loop that ran over nothing.
  assert.equal(
    parsed,
    JSON_GATES.length,
    `only ${parsed} of ${JSON_GATES.length} printed a report`,
  );
});
