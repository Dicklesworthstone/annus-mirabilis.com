/**
 * End-to-end test suite for reviewed diplomatic German ledger CLI.
 * Governed by bead am-edn-ledger-validator-edv.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { validateLedger } from "./validateLedger.ts";

const SUITE = "ledger-validator";
const BEAD_ID = "am-edn-ledger-validator-edv";
const _FIXTURES_DIR = path.join(process.cwd(), "src/testing/fixtures/ledgers");

interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutLines: string[];
  parsedLines: any[];
  summary: any | null;
  durationMs: number;
}

import { spawnSync } from "node:child_process";

async function runCli(args: string[], logRunId: string, testId: string): Promise<CliRunResult> {
  const start = performance.now();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  const _usedBunSpawn = false;

  const proc = spawnSync("bun", ["scripts/validate-ledger.ts", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  exitCode = proc.status ?? 0;
  stdout = proc.stdout ?? "";
  stderr = proc.stderr ?? "";

  const durationMs = performance.now() - start;

  const stdoutLines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const parsedLines: any[] = [];
  let summary: any | null = null;

  for (const line of stdoutLines) {
    const parsed = JSON.parse(line);
    parsedLines.push(parsed);
    if (parsed.type === "summary") {
      summary = parsed;
    }
  }

  // Retain failure and run evidence under artifacts/test-logs/ledger-validator/<log-run-id>/evidence/<test-id>/
  const evidenceDir = path.join(
    process.cwd(),
    "artifacts",
    "test-logs",
    SUITE,
    logRunId,
    "evidence",
    testId,
  );
  mkdirSync(evidenceDir, { recursive: true });

  writeFileSync(path.join(evidenceDir, "stdout.jsonl"), stdout);
  writeFileSync(path.join(evidenceDir, "stderr.txt"), stderr);
  writeFileSync(
    path.join(evidenceDir, "fixture-path.txt"),
    args[0] ? path.resolve(process.cwd(), args[0]) : "none",
  );
  writeFileSync(path.join(evidenceDir, "args.json"), JSON.stringify(args, null, 2));
  if (summary) {
    writeFileSync(
      path.join(evidenceDir, "resolved-config.json"),
      JSON.stringify(
        {
          mode: summary.mode,
          ledgerKey: summary.ledgerKey,
          configSection: summary.configSection,
          stats: summary.stats,
        },
        null,
        2,
      ),
    );
  }

  return {
    exitCode,
    stdout,
    stderr,
    stdoutLines,
    parsedLines,
    summary,
    durationMs,
  };
}

test("CLI: six canonical fixtures yield expected exit codes and parseable JSONL", async () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  const fixtures = [
    {
      testId: "cli-clean-fixture",
      ledger: "fixture-clean-reviewed.txt",
      flags: ["--paper", "brownian-motion"],
      expectedExitCode: 0,
      expectedMode: "completeness",
      expectedConfigSection: "defaults",
    },
    {
      testId: "cli-error-fixture",
      ledger: "fixture-error-reviewed.txt",
      flags: ["--paper", "brownian-motion"],
      expectedExitCode: 1,
      expectedMode: "structural",
      expectedConfigSection: "defaults",
    },
    {
      testId: "cli-warning-fixture",
      ledger: "fixture-warning-reviewed.txt",
      flags: ["--paper", "brownian-motion"],
      expectedExitCode: 2,
      expectedMode: "structural",
      expectedConfigSection: "defaults",
    },
    {
      testId: "cli-stale-allowlist-fixture",
      ledger: "fixture-stale-allowlist-reviewed.txt",
      flags: ["--paper", "fixture-stale-slug"],
      expectedExitCode: 2,
      expectedMode: "structural",
      expectedConfigSection: "defaults",
    },
    {
      testId: "cli-skeleton-require-complete-fixture",
      ledger: "fixture-skeleton-reviewed.txt",
      flags: ["--require-complete"],
      expectedExitCode: 1,
      expectedMode: "completeness",
      expectedConfigSection: "defaults",
    },
    {
      testId: "cli-two-ledger-scoped-fixture",
      ledger: "fixture-scoped-reviewed.txt",
      flags: ["--paper", "fixture-two-ledger"],
      expectedExitCode: 0,
      expectedMode: "completeness",
      expectedConfigSection: "ledgers.fixture-scoped",
    },
  ];

  for (const f of fixtures) {
    const ledgerRelPath = path.join("src/testing/fixtures/ledgers", f.ledger);
    const result = await runCli([ledgerRelPath, ...f.flags], logRunId, f.testId);

    // 1. Assert exit code
    assert.equal(
      result.exitCode,
      f.expectedExitCode,
      `Expected exit code ${f.expectedExitCode} for ${f.testId}, got ${result.exitCode}. Stderr: ${result.stderr}`,
    );

    // 2. Assert every stdout line is valid JSON with required fields
    for (const parsed of result.parsedLines) {
      assert.ok(parsed.type === "finding" || parsed.type === "summary");
      if (parsed.type === "finding") {
        assert.ok(typeof parsed.code === "string");
        assert.ok(typeof parsed.severity === "string");
        assert.ok(typeof parsed.ledgerLine === "number");
        assert.ok(typeof parsed.ledgerPage === "number");
        assert.ok(typeof parsed.message === "string");
        assert.ok(typeof parsed.excerpt === "string");
      }
    }

    // 3. Assert summary line matches library result
    assert.ok(result.summary, `Missing summary line in stdout for ${f.testId}`);
    assert.equal(result.summary.mode, f.expectedMode);
    assert.equal(result.summary.configSection, f.expectedConfigSection);

    // Compare with direct library execution
    const libResult = validateLedger(path.resolve(process.cwd(), ledgerRelPath), {
      paper: f.flags.includes("--paper") ? f.flags[f.flags.indexOf("--paper") + 1] : undefined,
      requireComplete: f.flags.includes("--require-complete"),
    });

    assert.equal(result.summary.valid, libResult.valid);
    assert.equal(result.summary.clean, libResult.clean);
    assert.equal(result.summary.errors, libResult.errors.length);
    assert.equal(result.summary.warnings, libResult.warnings.length);
    assert.equal(result.summary.info, libResult.info.length);
    assert.equal(result.summary.staleAllowlistEntries, libResult.staleAllowlistEntries.length);

    logger.log({
      testId: f.testId,
      beadId: BEAD_ID,
      expected: f.expectedExitCode,
      actual: result.exitCode,
      comparisonKind: "bitwise",
      outcome: "passed",
      durationMs: result.durationMs,
      message: `CLI fixture ${f.testId} exited ${result.exitCode} matching expected ${f.expectedExitCode}`,
      extra: {
        ledger: f.ledger,
        mode: result.summary.mode,
        configSection: result.summary.configSection,
      },
    });
  }
});

test("CLI error handling: unknown key and unknown configuration section exit 3", async () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  // 1. Unknown ledger file / key
  {
    const testId = "cli-unknown-key-exit-3";
    const result = await runCli(["non-existent-ledger-reviewed.txt"], logRunId, testId);
    assert.equal(result.exitCode, 3);

    logger.log({
      testId,
      beadId: BEAD_ID,
      expected: 3,
      actual: result.exitCode,
      comparisonKind: "bitwise",
      outcome: "passed",
      durationMs: result.durationMs,
      message: "Non-existent ledger file exited 3 as expected",
    });
  }

  // 2. Configuration section referencing an unknown key with no receipt
  {
    const testId = "cli-config-unknown-key-exit-3";
    const ledgerPath = "src/testing/fixtures/ledgers/fixture-clean-reviewed.txt";
    const result = await runCli([ledgerPath, "--paper", "bad-config-slug"], logRunId, testId);
    assert.equal(result.exitCode, 3);
    assert.ok(
      result.parsedLines.some((p) => p.code === "config-key-unknown"),
      "Expected config-key-unknown finding",
    );

    logger.log({
      testId,
      beadId: BEAD_ID,
      expected: 3,
      actual: result.exitCode,
      comparisonKind: "bitwise",
      outcome: "passed",
      durationMs: result.durationMs,
      message: "Configuration with unknown ledger key exited 3 with config-key-unknown finding",
    });
  }
});

test("Canary assertion (test-only, marked) proves failure evidence is retained on disk", async () => {
  const logRunId = newRunIdentity();
  const testId = "canary-evidence-retention";

  // Run the error fixture to generate real failure output
  const ledgerRelPath = "src/testing/fixtures/ledgers/fixture-error-reviewed.txt";
  const result = await runCli([ledgerRelPath, "--paper", "brownian-motion"], logRunId, testId);
  assert.equal(result.exitCode, 1);

  // Verify failure evidence files exist on disk
  const evidenceDir = path.join(
    process.cwd(),
    "artifacts",
    "test-logs",
    SUITE,
    logRunId,
    "evidence",
    testId,
  );

  assert.ok(existsSync(evidenceDir), `Evidence directory must exist at ${evidenceDir}`);

  const stdoutFile = path.join(evidenceDir, "stdout.jsonl");
  const stderrFile = path.join(evidenceDir, "stderr.txt");
  const fixtureFile = path.join(evidenceDir, "fixture-path.txt");
  const configFile = path.join(evidenceDir, "resolved-config.json");

  assert.ok(existsSync(stdoutFile), "stdout.jsonl must exist in evidence dir");
  assert.ok(existsSync(stderrFile), "stderr.txt must exist in evidence dir");
  assert.ok(existsSync(fixtureFile), "fixture-path.txt must exist in evidence dir");
  assert.ok(existsSync(configFile), "resolved-config.json must exist in evidence dir");

  // Read evidence files to verify they are non-empty and match the run
  const savedStdout = readFileSync(stdoutFile, "utf8");
  const savedFixture = readFileSync(fixtureFile, "utf8");
  const savedConfig = JSON.parse(readFileSync(configFile, "utf8"));

  assert.equal(savedStdout, result.stdout);
  assert.ok(savedFixture.includes("fixture-error-reviewed.txt"));
  assert.equal(savedConfig.mode, "structural");
  assert.equal(savedConfig.configSection, "defaults");
});
