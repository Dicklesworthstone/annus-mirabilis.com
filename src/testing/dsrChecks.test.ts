/**
 * THE MIRROR IS PINNED HERE, BECAUSE NOTHING ELSE CAN NOTICE IT SHRINKING (am-7bkr).
 *
 * `DSR_CHECKS` mirrors `~/.config/dsr/repos.yaml`, `tools.annus-mirabilis.checks`, which is outside
 * the repository and absent on some machines, so no test can read the source. Its consumers assert
 * that every entry RESOLVES to a `package.json` script, which catches a mirror that names something
 * that does not exist.
 *
 * It does NOT catch the opposite, and that was measured rather than assumed. Removing `test:node`
 * from the list and running the three consumers:
 *
 *     scripts/quality-gates/subprocessE2eSplit.test.ts   FAILED  (it asks for that name)
 *     src/testing/ciGateWiring.test.ts                   passed
 *     scripts/perf/gateRegistration.test.ts              passed
 *
 * Both of those build their population FROM the list and then assert their own count against
 * `DSR_CHECKS.length`, so a shorter list is self-consistent: the population narrows and every
 * assertion stays true over what is left. That is the shape AGENTS.md records as a validator that
 * rebuilds a key set and drops the unknowns, and the direction is the dangerous one -- a gate that
 * quantifies over "the checks the CI runs" silently stops covering one.
 *
 * So the names are pinned here, by name, with their provenance. This is NOT a tautology against the
 * constant: it is a claim about something outside the repository, and the only way to satisfy it
 * after dsr's configuration changes is to change it deliberately, here, where the comment says what
 * the source is.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DSR_CHECKS, isDsrCheck } from "./dsrChecks.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("the mirror of dsr's checks for this repository", () => {
  test("names exactly the four checks dsr runs, so a silent shrink fails here", () => {
    // From ~/.config/dsr/repos.yaml, tools.annus-mirabilis.checks:
    //   bun run typecheck / bun run test / bun run test:node / bun run gates
    // Change this only when that file changes, and say so in the commit.
    expect([...DSR_CHECKS]).toEqual(["typecheck", "test", "test:node", "gates"]);
  });

  test("every mirrored check resolves to a package.json script, which is what the consumers rely on", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const missing = DSR_CHECKS.filter((name) => typeof pkg.scripts?.[name] !== "string");
    expect(missing).toEqual([]);
    // Non-vacuity: an emptied mirror would make the filter above run zero times and pass.
    expect(DSR_CHECKS.length).toBeGreaterThan(0);
    // And each body is non-empty, since a declared-but-blank script runs nothing.
    for (const name of DSR_CHECKS) {
      expect((pkg.scripts?.[name] ?? "").length).toBeGreaterThan(0);
    }
  });

  test("test:node is the node-only runner, which is the one entry another guard depends on by name", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["test:node"]).toContain("scripts/run-node-only-tests.ts");
  });

  test("isDsrCheck admits the mirrored names and refuses others", () => {
    for (const name of DSR_CHECKS) expect(isDsrCheck(name)).toBe(true);
    // The positive control: real scripts that dsr does NOT run must not pass. `test:browser` is one
    // of ten verification scripts in no lane and no registry entry (am-7mw9), and `lint` is a real
    // script the CI reaches only inside `gates`.
    expect(isDsrCheck("test:browser")).toBe(false);
    expect(isDsrCheck("test:reference")).toBe(false);
    expect(isDsrCheck("")).toBe(false);
    expect(isDsrCheck("typecheck ")).toBe(false);
  });
});
