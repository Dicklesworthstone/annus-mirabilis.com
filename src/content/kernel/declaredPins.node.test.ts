/**
 * THE DECLARED-AGAINST-PINNED GATE, RUN ON THE POPULATION IT WAS BUILT FOR (am-f3e4, clause 1).
 *
 * am-f3e4 asks that the gate be "verified against the real gap before anything is fixed". It was
 * written after the gap closed, so it is verified against the gap as git still holds it: the same
 * computation, over the pins file as it stood at 11b9d2cd~1, the commit before this bead's first
 * catalogue entry. If it reports 88 of 108 there and 15 of 108 today, it is measuring the thing the
 * clause names rather than agreeing with whatever the tree happens to hold.
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
  console.log(`[declared pins] at ${HISTORICAL}: ${summarizeDeclaredPins(report)}`);
  assert.equal(report.pins, 22, "historical pins");
  // THE TWO NUMBERS BELOW ARE A CENSUS OF TODAY'S DECLARATIONS, not of the history this test is
  // about, so they move whenever a manifest declares a kernel it did not declare before. On
  // 2026-09-28 me-01 declared initializeMassEnergyLedger, the function that names the four body
  // energies symbolically and refuses an Mc^2 seed (am-1nnj, dispatch 354), and 108/88 became
  // 109/89. The historical fact this test exists for is untouched: 22 pins then, and the gap
  // against them still shrinks, which is the assertion below and the one that cannot be satisfied
  // by adding anything.
  assert.equal(report.distinctDeclared, 109, "declared functions, resolved through barrels");
  assert.equal(report.missing.length, 89, "declared with no pin at the start of am-f3e4");
  // The gate must also SHRINK against today's pins, or it is measuring nothing that moved.
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
  console.log(`[declared pins] at HEAD: ${summarizeDeclaredPins(current)}`);
  assert.ok(
    current.missing.length < report.missing.length,
    `HEAD reports ${current.missing.length} unpinned, the historical population ${report.missing.length}`,
  );
});
