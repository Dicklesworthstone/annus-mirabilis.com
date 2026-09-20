import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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
 * Absolute paths under a macOS mount point or a user home.
 *
 * Assembled from fragments on purpose. Spelled contiguously, this file would match its own
 * constant and its own explanation, and the only ways out would be to exempt this file, which is
 * the allowlist-of-one the gate exists to forbid, or to stop describing what it looks for. A
 * checker that cannot tell a description of a thing from the thing is a defect in its own right;
 * dcg has the same one and it is filed as am-v5te.
 */
const SEP = "/";
const MACHINE_ROOTS = [`${SEP}Volumes${SEP}`, `${SEP}Users${SEP}`] as const;

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

  test("no test file contains an absolute path under /Volumes or /Users", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWLIST.includes(rel)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const root of MACHINE_ROOTS) {
          if (line.includes(root)) {
            offenders.push(`${rel}:${i + 1} contains ${root} — ${line.trim().slice(0, 96)}`);
          }
        }
      });
    }
    expect(
      offenders.length === 0
        ? []
        : [
            ...offenders,
                  `Use mkdtempSync(join(tmpdir(), "prefix-")) for scratch space. For a path used as test DATA, pick one that names no real machine.`,
          ],
    ).toEqual([]);
  });
});
