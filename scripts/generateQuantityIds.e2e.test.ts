import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../", import.meta.url).pathname;
const REAL_LEGACY = `${REPO_ROOT}content/quantities/legacy-spellings.yaml`;
const EMPTY_LEGACY = `${REPO_ROOT}src/content/quantities/__fixtures__/empty-legacy-spellings.yaml`;

function spawnCheck(args: readonly string[]): { exitCode: number; stdout: string; stderr: string } {
  if (typeof Bun !== "undefined" && typeof Bun.spawnSync === "function") {
    const proc = Bun.spawnSync(
      [
        "node",
        "--experimental-strip-types",
        `${REPO_ROOT}scripts/generate-quantity-ids.ts`,
        ...args,
      ],
      { cwd: REPO_ROOT },
    );
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString("utf8"),
      stderr: proc.stderr.toString("utf8"),
    };
  }
  const proc = spawnSync(
    "node",
    ["--experimental-strip-types", `${REPO_ROOT}scripts/generate-quantity-ids.ts`, ...args],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    },
  );
  if (proc.error) {
    throw new Error(`Failed to spawn scripts/generate-quantity-ids.ts: ${proc.error.message}`, {
      cause: proc.error,
    });
  }
  return {
    exitCode: proc.status ?? (proc.signal ? 1 : 0),
    stdout: proc.stdout || "",
    stderr: proc.stderr || "",
  };
}

describe("generate-quantity-ids.ts --check", () => {
  it("over committed fixture: a record whose id is a legacy spelling fails, naming the canonical id", () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/legacy-spelling-as-id`;
    const { exitCode, stdout, stderr } = spawnCheck([
      "--check",
      "--dir",
      dir,
      "--legacy",
      `${dir}/legacy-spellings.yaml`,
      "--doc",
      "/dev/null",
    ]);
    assert.notEqual(exitCode, 0);
    assert.match(stdout + stderr, /gasConstant/);
  });

  it("over committed fixture: a frame suffix disagreeing with frame fails, naming the record", () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/frame-suffix-mismatch`;
    const { exitCode, stdout, stderr } = spawnCheck([
      "--check",
      "--dir",
      dir,
      "--legacy",
      EMPTY_LEGACY,
      "--doc",
      "/dev/null",
    ]);
    assert.notEqual(exitCode, 0);
    assert.match(stdout + stderr, /exampleFieldMoving/);
  });

  it("over committed fixture: a non-reduced dimension exponent fails, naming the record", () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/non-reduced-exponent`;
    const { exitCode, stdout, stderr } = spawnCheck([
      "--check",
      "--dir",
      dir,
      "--legacy",
      EMPTY_LEGACY,
      "--doc",
      "/dev/null",
    ]);
    assert.notEqual(exitCode, 0);
    assert.match(stdout + stderr, /not reduced to lowest terms/);
  });

  it("over committed fixture: a duplicate id fails, naming the record", () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/duplicate-id`;
    const { exitCode, stdout, stderr } = spawnCheck([
      "--check",
      "--dir",
      dir,
      "--legacy",
      EMPTY_LEGACY,
      "--doc",
      "/dev/null",
    ]);
    assert.notEqual(exitCode, 0);
    assert.match(stdout + stderr, /exampleDuplicateQuantity/);
  });

  it("over committed fixture: a stale copy of QUANTITY_IDS.md fails without writing it", () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/stale-doc`;
    const docPath = `${dir}/QUANTITY_IDS.md`;
    const before = readFileSync(docPath, "utf8");
    const { exitCode, stdout, stderr } = spawnCheck([
      "--check",
      "--dir",
      dir,
      "--legacy",
      EMPTY_LEGACY,
      "--doc",
      docPath,
    ]);
    assert.notEqual(exitCode, 0);
    assert.match(stdout + stderr, /STALE/);
    const after = readFileSync(docPath, "utf8");
    assert.equal(after, before); // --check never writes
  });

  it("over the real records, exits zero and leaves docs/QUANTITY_IDS.md byte-identical", () => {
    const { exitCode, stdout, stderr } = spawnCheck([
      "--check",
      "--legacy",
      REAL_LEGACY,
      "--doc",
      `${REPO_ROOT}docs/QUANTITY_IDS.md`,
    ]);
    assert.equal(exitCode, 0);
    assert.match(stdout + stderr, /OK:/);
  });
});
