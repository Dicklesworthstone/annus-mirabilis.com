import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnObserved } from "./spawnObserved.ts";

const FIXTURES_DIR = path.resolve("src/testing/fixtures/provenance");

type LogEntry = {
  severity?: string;
  rule?: string;
  outcome?: string;
  [key: string]: unknown;
};

/**
 * Spawns the real CLI under node. These tests are excluded from `bun test`
 * (bunfig pathIgnorePatterns) because bun's runner cannot posix_spawn node
 * on this host (EBADF). Run them with `bun run test:node`.
 * spawnObserved retries EBADF then fails; it never calls runCheckReceipts().
 */
function runCli(args: string[]): {
  code: number;
  stdout: string;
  stderr: string;
  jsonl: LogEntry[];
} {
  const logRunId = `e2e-run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const result = spawnObserved(
    "node",
    ["--experimental-strip-types", "scripts/check-receipts.ts", ...args, "--log-run-id", logRunId],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(result.kind, "subprocess");

  const logFile = path.join("artifacts", "test-logs", "receipts", `${logRunId}.jsonl`);
  let jsonl: LogEntry[] = [];
  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);
    jsonl = lines.map((l) => JSON.parse(l) as LogEntry);
  }

  return { code: result.exitCode, stdout: result.stdout, stderr: result.stderr, jsonl };
}

test("E2E: check-receipts CLI exits 0 on valid single receipt", () => {
  const { code, jsonl } = runCli(["--dir", FIXTURES_DIR, "--key", "ap-99-001"]);
  assert.equal(code, 0);
  const errors = jsonl.filter((e) => e.severity === "error");
  assert.equal(errors.length, 0);
});

/**
 * A literal count here was a time bomb, and this is the relation it was standing in for.
 *
 * It asserted `passEntries.length === 4` over the live docs/provenance/survey directory. That
 * passes today and goes stale the moment ap-19-289's survey lands - at which point it fails in
 * whoever writes that survey, who has no reason to connect their work to a number in an e2e test
 * four papers away. It is also in a node-only file, so it would not fail until the node lane ran.
 *
 * The relation the count meant is: every survey record in the directory passes. That is asserted
 * directly, and it does not go stale - a fifth survey simply adds a fifth pass. The four papers
 * that have surveys today are then named individually, so the test cannot pass vacuously on an
 * empty directory the way a bare "no failures" check would.
 */
test("E2E: check-receipts CLI exits 0 with --surveys on valid survey directory", () => {
  const { code, jsonl } = runCli(["--surveys-dir", "docs/provenance/survey", "--surveys"]);
  assert.equal(code, 0);

  const surveyEntries = jsonl.filter(
    (e) => typeof e.testId === "string" && e.testId.startsWith("survey-"),
  );
  const notPassed = surveyEntries.filter((e) => e.outcome !== "pass");
  assert.deepEqual(
    notPassed.map((e) => e.key),
    [],
    "every survey record in docs/provenance/survey must pass",
  );

  // The floor, by identity rather than by count. Adding ap-19-289's survey does not break this.
  const passedKeys = new Set(surveyEntries.map((e) => e.key));
  for (const key of ["ap-17-132", "ap-17-549", "ap-17-891", "ap-18-639"]) {
    assert.ok(passedKeys.has(key), `survey ${key} must be checked and pass`);
  }
});

test("E2E: check-receipts CLI exits 1 on fixture directory containing errors", () => {
  const { code, jsonl } = runCli(["--dir", FIXTURES_DIR]);
  assert.equal(code, 1);
  const errors = jsonl.filter((e) => e.severity === "error");
  assert.ok(errors.length > 20);
});

test("E2E: check-receipts CLI --require-local escalates missing local files to error", () => {
  const { code, jsonl } = runCli([
    "--dir",
    FIXTURES_DIR,
    "--key",
    "flag-absent-local-only",
    "--require-local",
  ]);
  assert.equal(code, 1);
  const localErr = jsonl.find((e) => e.rule === "receipt-local-file-missing");
  assert.ok(localErr, "Expected receipt-local-file-missing error under --require-local");
});
