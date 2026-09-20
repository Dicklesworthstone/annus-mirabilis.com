/**
 * The CLI's exit codes (am-src-ocr-orchestrator-u1e0, criterion 2).
 *
 * Criterion 2 reads "every refusal in requirement 7 is typed, logged, AND EXITS
 * NON-ZERO". The typed half is well covered: every one of the ten refusal codes is
 * asserted somewhere. The exit-code half was not covered at all, because every existing
 * test calls runOcrOrchestrator directly and reads the returned object. The mapping from
 * that object to a process exit code lives only in the CLI block at the bottom of
 * scripts/ocr-ledgers.ts, and nothing ran it.
 *
 * That mapping carries a real distinction a caller depends on: a refusal exits 1, and an
 * outage PAUSE exits 2, so an operator can tell "this run is wrong" from "this run is
 * waiting". A refusal that reached `process.exit(0)` would look like a successful OCR run
 * that transcribed nothing.
 *
 * These cases drive the real binary as a subprocess. The pause path is not among them:
 * the CLI selects an adapter by name and cannot be told to fail at a chunk, so exit 2 is
 * unreachable from the command line with the committed adapters. That is stated rather
 * than worked around, and it is why the pause is exercised through the library in
 * ocr-ledgers.e2e.test.ts instead.
 */

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = "scripts/ocr-ledgers.ts";
const PLAN = "scripts/sources/ocr-plans/fixture-3p.yaml";

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("bun", [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf-8",
    env: { ...process.env, NODE_ENV: "test" },
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("OCR orchestrator CLI: refusals exit non-zero and name themselves", () => {
  it("an unknown adapter exits non-zero and prints the typed code", () => {
    const { status, stderr } = runCli(["--plan", PLAN, "--adapter", "definitely-not-real"]);
    assert.notEqual(status, 0, "A refusal must never exit 0");
    assert.equal(status, 1);
    // The operator has to be able to tell WHICH refusal this was from the output alone.
    assert.ok(stderr.includes("NO_ADAPTER"), `stderr did not name the refusal: ${stderr}`);
  });

  it("an adapter named after a local OCR engine exits non-zero and says why", () => {
    // The hard resource policy at the command-line boundary, not only in the guard scan.
    const { status, stderr } = runCli(["--plan", PLAN, "--adapter", "tesseract"]);
    assert.notEqual(status, 0);
    assert.equal(status, 1);
    assert.ok(stderr.includes("FORBIDDEN_ADAPTER_NAME"), `stderr: ${stderr}`);
    assert.ok(stderr.toLowerCase().includes("local ocr"), `stderr: ${stderr}`);
  });

  it("no arguments exits non-zero with usage rather than doing something", () => {
    const { status, stderr } = runCli([]);
    assert.notEqual(status, 0);
    assert.ok(stderr.includes("Usage:"), `stderr: ${stderr}`);
  });

  it("a plan that does not exist exits non-zero", () => {
    const { status } = runCli([
      "--plan",
      "scripts/sources/ocr-plans/no-such-plan.yaml",
      "--adapter",
      "fixture",
    ]);
    assert.notEqual(status, 0, "A missing plan must not be treated as an empty one");
  });
});
