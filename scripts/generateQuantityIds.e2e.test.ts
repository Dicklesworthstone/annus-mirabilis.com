import { describe, expect, test } from "bun:test";

const REPO_ROOT = new URL("../", import.meta.url).pathname;
const REAL_LEGACY = `${REPO_ROOT}content/quantities/legacy-spellings.yaml`;
const EMPTY_LEGACY = `${REPO_ROOT}src/content/quantities/__fixtures__/empty-legacy-spellings.yaml`;

async function spawnCheck(args: readonly string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ["node", "--experimental-strip-types", `${REPO_ROOT}scripts/generate-quantity-ids.ts`, ...args],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { exitCode, stdout, stderr };
}

describe("generate-quantity-ids.ts --check", () => {
  test("over committed fixture: a record whose id is a legacy spelling fails, naming the canonical id", async () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/legacy-spelling-as-id`;
    const { exitCode, stdout, stderr } = await spawnCheck(["--check", "--dir", dir, "--legacy", `${dir}/legacy-spellings.yaml`, "--doc", "/dev/null"]);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain("gasConstant");
  });

  test("over committed fixture: a frame suffix disagreeing with frame fails, naming the record", async () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/frame-suffix-mismatch`;
    const { exitCode, stdout, stderr } = await spawnCheck(["--check", "--dir", dir, "--legacy", EMPTY_LEGACY, "--doc", "/dev/null"]);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain("exampleFieldMoving");
  });

  test("over committed fixture: a non-reduced dimension exponent fails, naming the record", async () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/non-reduced-exponent`;
    const { exitCode, stdout, stderr } = await spawnCheck(["--check", "--dir", dir, "--legacy", EMPTY_LEGACY, "--doc", "/dev/null"]);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain("not reduced to lowest terms");
  });

  test("over committed fixture: a duplicate id fails, naming the record", async () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/duplicate-id`;
    const { exitCode, stdout, stderr } = await spawnCheck(["--check", "--dir", dir, "--legacy", EMPTY_LEGACY, "--doc", "/dev/null"]);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain("exampleDuplicateQuantity");
  });

  test("over committed fixture: a stale copy of QUANTITY_IDS.md fails without writing it", async () => {
    const dir = `${REPO_ROOT}src/content/quantities/__fixtures__/stale-doc`;
    const docPath = `${dir}/QUANTITY_IDS.md`;
    const before = await Bun.file(docPath).text();
    const { exitCode, stdout, stderr } = await spawnCheck(["--check", "--dir", dir, "--legacy", EMPTY_LEGACY, "--doc", docPath]);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain("STALE");
    const after = await Bun.file(docPath).text();
    expect(after).toBe(before); // --check never writes
  });

  test("over the real records, exits zero and leaves docs/QUANTITY_IDS.md byte-identical", async () => {
    const { exitCode, stdout, stderr } = await spawnCheck(["--check", "--legacy", REAL_LEGACY, "--doc", `${REPO_ROOT}docs/QUANTITY_IDS.md`]);
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("OK:");
  });
});
