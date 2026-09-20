import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findMachinePathSinks, MACHINE_PATH_ROOTS } from "./machineSpecificPaths.ts";

/**
 * am-yhus. Seventeen test files carried absolute paths rooted in one machine's filesystem: an
 * external volume mounted under the macOS Volumes root, and home directories under the Users root.
 * Several of them did real work there, calling mkdir and writeFile into the mounted volume, so
 * they passed on the machine where it is mounted and failed everywhere else with
 * "EACCES: permission denied, mkdir '/Volumes'". Every run of quality-gates.yml in a 60-run
 * window failed at the same step for that reason.
 *
 * This is the mirror of an untracked file that a shared working tree hides. There a dependency
 * was present locally and missing from HEAD; here a path is present locally and missing on the
 * runner. Both keep every local lane green while the real target cannot pass, and neither is
 * visible without running somewhere clean.
 *
 * The allowlist is empty and is asserted to stay empty. A test that needs scratch space uses
 * mkdtempSync under os.tmpdir(); a test that needs a path as DATA uses one that names no real
 * machine.
 */

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const TEST_FILE = /\.test\.(ts|tsx|mjs|js)$/;

/**
 * Deliberately empty, and checked below. An entry here would mean a test file is allowed to
 * depend on one person's filesystem layout, which is the defect itself.
 */
const ALLOWLIST: readonly string[] = [];

/**
 * The roots themselves now live in ./machineSpecificPaths.ts, spelled out.
 *
 * The previous version assembled them from fragments, because a line matcher
 * would otherwise have matched its own constant and its own explanation, and
 * the only ways out were to exempt this file - the allowlist-of-one the gate
 * forbids - or to stop describing what it looks for. Scoping the rule to paths
 * that reach a filesystem call removes the problem rather than hiding from it:
 * a root named in a comment, a constant, or a fixture string is data, and only
 * a destination is a dependency. This file names all three roots in plain text
 * below and the sweep over it is clean. The general defect, a checker that
 * cannot tell a description of a thing from the thing, is filed as am-v5te.
 */

function walk(dir: string, out: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEST_FILE.test(entry.name)) out.push(full);
  }
  return out;
}

describe("no test depends on one machine's filesystem layout (am-yhus)", () => {
  const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "scripts"))];

  test("the sweep still finds the test files it is meant to read", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  test("the allowlist is empty, so no file is permitted to carry a machine-specific path", () => {
    expect(ALLOWLIST).toEqual([]);
  });

  test("no absolute path rooted in one machine reaches a filesystem call", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWLIST.includes(rel)) continue;
      for (const v of findMachinePathSinks(readFileSync(file, "utf8"), rel)) {
        offenders.push(`${rel}:${v.line} ${v.sink}(...) receives ${v.path} (${v.via})`);
      }
    }
    expect(
      offenders.length === 0
        ? []
        : [
            ...offenders,
            'Use mkdtempSync(join(tmpdir(), "prefix-")) for scratch space. A path used as test DATA is fine; a path used as a DESTINATION is a dependency on one machine.',
          ],
    ).toEqual([]);
  });

  // The roots a blanket username rewrite escaped. am-yhus's repair turned
  // /Users/<name>/... into /home/agent/..., which no root in the first version
  // of this gate matched, so it went quiet while the rewritten path existed on
  // no machine at all and the test it "fixed" began failing everywhere.
  test("the machine roots include the one a username rewrite moved to", () => {
    expect([...MACHINE_PATH_ROOTS]).toContain("/home/");
    expect([...MACHINE_PATH_ROOTS]).toContain("/Users/");
    expect([...MACHINE_PATH_ROOTS]).toContain("/Volumes/");
  });

  test("a destination is caught, through a local constant, and portable scratch is not", () => {
    const caught = findMachinePathSinks(
      [
        'const scratchDir = "/home/agent/.gemini/brain/scratch";',
        "fs.mkdirSync(scratchDir, { recursive: true });",
      ].join("\n"),
      "src/fixture/caught.test.ts",
    );
    expect(caught.map((v) => ({ sink: v.sink, via: v.via }))).toEqual([
      { sink: "mkdirSync", via: "local constant" },
    ]);

    expect(
      findMachinePathSinks(
        'fs.writeFileSync("/Volumes/USBNVME16TB/temp_agent_space/x.md", "hi");',
        "src/fixture/direct.test.ts",
      ).length,
    ).toBe(1);

    expect(
      findMachinePathSinks(
        [
          'const dir = fs.mkdtempSync(join(tmpdir(), "am-"));',
          'fs.writeFileSync(join(dir, "x.md"), "hi");',
        ].join("\n"),
        "src/fixture/portable.test.ts",
      ),
    ).toEqual([]);
  });

  // The other direction, and the reason the line matcher had to go: six of the
  // seven files carrying such a path use it as DATA. Rejecting an absolute
  // pipeline path is the assertion; a cargo transcript quotes the paths cargo
  // printed. None of them touch a disk, and demanding they change would push
  // authors to weaken real fixtures.
  test("a machine path used as data, not as a destination, is permitted", () => {
    expect(
      findMachinePathSinks(
        'loadDataset(yaml, { sourcePath: "/home/agent/projects/x/data/pipeline/raw.yaml" });',
        "src/fixture/data.test.ts",
      ),
    ).toEqual([]);

    expect(
      findMachinePathSinks(
        "const transcript = `Compiling asupersync v0.5.0 (/home/agent/projects/asupersync)`;",
        "src/fixture/transcript.test.ts",
      ),
    ).toEqual([]);

    expect(
      findMachinePathSinks(
        'const d = diagnoseRustLldRpath(PIN, "/home/agent/.rustup/toolchains/x/bin/rust-lld", []);',
        "src/fixture/pure.test.ts",
      ),
    ).toEqual([]);
  });
});
