import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runCheckReceipts } from "./check-receipts.ts";

const FIXTURES_DIR = path.resolve("src/testing/fixtures/provenance");

type LogEntry = {
  severity?: string;
  rule?: string;
  outcome?: string;
  [key: string]: unknown;
};

async function runCli(args: string[]): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  jsonl: LogEntry[];
}> {
  const logRunId = `e2e-run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let code = 0;
  let stdout = "";
  let stderr = "";

  try {
    const fullArgs = [
      "--experimental-strip-types",
      "scripts/check-receipts.ts",
      ...args,
      "--log-run-id",
      logRunId,
    ];
    stdout = cp.execFileSync("node", fullArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e: unknown) {
    const err = e as { code?: string; status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    if (err.code === "EBADF") {
      stdout = "";
      stderr = "";
      const origLog = console.log;
      const origErr = console.error;
      const origWarn = console.warn;
      console.log = (...a: unknown[]) => {
        stdout += a.join(" ") + "\n";
      };
      console.error = (...a: unknown[]) => {
        stderr += a.join(" ") + "\n";
      };
      console.warn = (...a: unknown[]) => {
        stderr += a.join(" ") + "\n";
      };
      try {
        code = await runCheckReceipts([...args, "--log-run-id", logRunId]);
      } finally {
        console.log = origLog;
        console.error = origErr;
        console.warn = origWarn;
      }
    } else {
      code = typeof err.status === "number" ? err.status : 1;
      stdout = err.stdout ? err.stdout.toString() : "";
      stderr = err.stderr ? err.stderr.toString() : "";
    }
  }

  const logFile = path.join("artifacts", "test-logs", "receipts", `${logRunId}.jsonl`);
  let jsonl: LogEntry[] = [];
  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);
    jsonl = lines.map((l) => JSON.parse(l) as LogEntry);
  }

  return { code, stdout, stderr, jsonl };
}

test("E2E: check-receipts CLI exits 0 on valid single receipt", async () => {
  const { code, jsonl } = await runCli(["--dir", FIXTURES_DIR, "--key", "ap-99-001"]);
  assert.equal(code, 0);
  const errors = jsonl.filter((e) => e.severity === "error");
  assert.equal(errors.length, 0);
});

test("E2E: check-receipts CLI exits 0 with --surveys on valid survey directory", async () => {
  const { code, jsonl } = await runCli(["--surveys-dir", "docs/provenance/survey", "--surveys"]);
  assert.equal(code, 0);
  const passEntries = jsonl.filter((e) => e.outcome === "pass");
  assert.equal(passEntries.length, 4); // 4 survey files in docs/provenance/survey
});

test("E2E: check-receipts CLI exits 1 on fixture directory containing errors", async () => {
  const { code, jsonl } = await runCli(["--dir", FIXTURES_DIR]);
  assert.equal(code, 1);
  const errors = jsonl.filter((e) => e.severity === "error");
  assert.ok(errors.length > 20);
});

test("E2E: check-receipts CLI --require-local escalates missing local files to error", async () => {
  const { code, jsonl } = await runCli([
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
