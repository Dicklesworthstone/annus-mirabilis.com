/**
 * THE DECLARED-AGAINST-PINNED GATE, RUN ON THE POPULATION IT WAS BUILT FOR (am-f3e4, clause 1).
 *
 * am-f3e4 asks that the gate be "verified against the real gap before anything is fixed". It was
 * written after the gap closed, so it is verified against the gap as git still holds it: the same
 * computation, over the pins file as it stood at 11b9d2cd~1, the commit before this bead's first
 * catalogue entry. It reported 88 of 108 there and 15 of 108 today, which is how the numbers below
 * were chosen.
 *
 * WHAT IS ASSERTED, AND WHAT IS ONLY REPORTED. Both measurements are computed and logged BEFORE any
 * assertion, so a failing one can no longer hide the other. Then: the historical pin count, which is
 * a fact about a commit and cannot move; the shrink property, which holds at any size; and two
 * FLOORS on today's declared population, which are non-vacuity guards rather than a census.
 *
 * WHY THIS FILE IS IN THE NODE LANE. It reads the historical pins with `git show`, and bun's test
 * runner cannot spawn a process on this host (posix_spawn returns EBADF), which is why bunfig.toml
 * routes a dozen files here already. Its sibling declaredPins.test.ts runs in the bun lane over the
 * current pins, so the two halves of this gate cannot fail open together.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readDeclaredKernels, reportDeclaredPins, summarizeDeclaredPins } from "./declaredPins.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const HISTORICAL = "11b9d2cd~1";

test("the gate reports the real gap over the historical pins, and both counts", () => {
  const declared = readDeclaredKernels(root);
  const historical = execFileSync("git", ["show", `${HISTORICAL}:src/content/kernel/pins.json`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const keys = new Set(
    Object.keys((JSON.parse(historical) as { functions: Record<string, string> }).functions),
  );
  const report = reportDeclaredPins(declared, keys);
  const currentText = execFileSync("git", ["show", "HEAD:src/content/kernel/pins.json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const current = reportDeclaredPins(
    declared,
    new Set(
      Object.keys((JSON.parse(currentText) as { functions: Record<string, string> }).functions),
    ),
  );
  // BOTH MEASUREMENTS BEFORE ANY ASSERTION. Until 2026-09-28 the census below sat above this second
  // computation, so a declaration added anywhere turned the lane red at the census and the property
  // was never evaluated: the run printed the historical line and no HEAD line at all. Measured with
  // a planted declaration on the version this replaces, `at HEAD` appeared 0 times in the output.
  console.log(`[declared pins] at ${HISTORICAL}: ${summarizeDeclaredPins(report)}`);
  console.log(`[declared pins] at HEAD: ${summarizeDeclaredPins(current)}`);

  // THE PROPERTY FIRST, because it is the one that carries the gate's meaning and it holds at any
  // size: the gap against today's pins is strictly smaller than the gap against the historical ones.
  // Adding a declaration cannot satisfy it, since an unpinned declaration raises both sides.
  assert.ok(
    current.missing.length < report.missing.length,
    `HEAD reports ${current.missing.length} unpinned, the historical population ${report.missing.length}`,
  );

  // A FACT ABOUT A COMMIT, which cannot move: 11b9d2cd~1 carried 22 pins.
  assert.equal(report.pins, 22, "historical pins");

  // FLOORS, NOT A CENSUS (AGENTS.md, "A Count Is For Reporting, Not For Asserting"). These two were
  // equalities at 108/88, then at 109/89 for four hours, because they measure TODAY'S declarations
  // and three panes are declaring kernels this week. An equality on a growing population breaks on
  // correct work, and it broke on me-01 declaring initializeMassEnergyLedger (am-1nnj, dispatch 354).
  //
  // The floors are the numbers the gate was first verified against, now as a lower bound, and both
  // quantities only GROW under this campaign: a new declaration adds a distinct key, and against a
  // frozen historical pin set it adds a missing key too. So correct work can never breach them.
  //
  // WHAT A FLOOR LETS THROUGH, stated rather than assumed: a declaration removed and another added
  // in the same commit. The equality did not catch that either, because it read a total and not an
  // identity, so nothing is lost. What both catch is the failure worth catching here, a
  // readDeclaredKernels that returns a short or empty population and reports a clean gap over it.
  assert.ok(
    report.distinctDeclared >= 108,
    `declared functions fell to ${report.distinctDeclared}, below the 108 this gate was verified against`,
  );
  assert.ok(
    report.missing.length >= 88,
    `the historical gap fell to ${report.missing.length}, below the 88 measured at the start of am-f3e4`,
  );
});
