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
 * Spawns the real CLI. EBADF is retried by spawnObserved; a persistent EBADF
 * fails naming fd exhaustion. This never falls back to runCheckReceipts().
 */
function runCli(args: string[]): {
  code: number;
  stdout: string;
  stderr: string;
  jsonl: LogEntry[];
} {
  const logRunId = `e2e-run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const isBun = typeof Bun !== "undefined";
  const cliArgs = isBun
    ? ["scripts/check-receipts.ts", ...args, "--log-run-id", logRunId]
    : [
        "--experimental-strip-types",
        "scripts/check-receipts.ts",
        ...args,
        "--log-run-id",
        logRunId,
      ];
  const result = spawnObserved(process.execPath, cliArgs, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
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

test("E2E: check-receipts CLI exits 0 with --surveys on valid survey directory", () => {
  const { code, jsonl } = runCli(["--surveys-dir", "docs/provenance/survey", "--surveys"]);
  assert.equal(code, 0);
  const passEntries = jsonl.filter((e) => e.outcome === "pass");
  assert.equal(passEntries.length, 4); // 4 survey files in docs/provenance/survey
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
