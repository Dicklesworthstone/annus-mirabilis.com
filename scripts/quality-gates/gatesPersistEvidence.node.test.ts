/**
 * EVERY REGISTERED GATE WITH A SCRIPT OF ITS OWN PERSISTS ITS FINDINGS (am-uxh9).
 *
 * The bead was answered by hand against 27 registry steps and the registry now holds 48. Of the
 * twenty-one that landed afterwards, five persisted nothing, and nothing told anyone: a gate that
 * writes no artifact prints a perfectly convincing report and exits 0. This file is what stops the
 * measurement going stale again - step 49 cannot land silent without turning it red.
 *
 * IN THE NODE LANE, DELIBERATELY. This judges every registry step, and `bun run test` is one of them.
 * AGENTS.md: "keep a version of its proof in a DIFFERENT lane from the one it controls", on the
 * finding that `bun run test:node` refused to start for 49 commits and took 48 test files with it
 * while reading like diligence. A proof of a property of all 48 gates that lived only in the bun lane
 * would disappear at the moment that lane failed open, which is the one moment it is needed.
 *
 * THE DELEGATE LIST IS AN EXACT SET, not a predicate. Seven steps hand off to an external tool or a
 * config file and have no report of their own, so the question does not apply to them - and that is
 * exactly the shape an escape hatch takes. Naming the seven means a silent gate cannot be excused by
 * widening a pattern: moving one in turns this red.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditGatePersistence, localImportsOf } from "./gatesPersistEvidence.ts";
import { QUALITY_GATE_STEPS } from "./registry.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/**
 * The seven steps with no report of their own, each named with what it hands off to.
 *
 * tsconfig.json, biome.json, package.json and next.config.mjs are configuration, not programs: the
 * step runs tsc, biome, the bun test runner or next build, and those tools own their own output.
 * ubs is a third-party binary. None of them can be asked to emit a row in this repository's schema
 * without wrapping them, which is a different decision from this one.
 */
const DELEGATES: Readonly<Record<string, string>> = {
  typecheck: "tsconfig.json",
  lint: "biome.json",
  "format-check": "biome.json",
  "unit-tests": "package.json",
  "ubs-diff": "(no script)",
  "ubs-staged": "(no script)",
  build: "next.config.mjs",
};

const report = auditGatePersistence(QUALITY_GATE_STEPS, ROOT);

test("the audit examined a real registry, printed beside the verdict", () => {
  // A registry import that resolved to an empty array would report zero silent gates and read as a
  // fully audited chain. The floor is well under the 48 measured on 2026-10-06 so that adding gates
  // never trips it, and well over a stub so that losing the registry does.
  assert.ok(report.stepsExamined > 40, `only ${report.stepsExamined} registry steps examined`);
  assert.ok(
    report.persists.length > 20,
    `only ${report.persists.length} gates found to persist, which is too few to be this registry`,
  );
  console.log(
    `[gate evidence] ${report.stepsExamined} registry steps: ${report.persists.length} persist ` +
      `(${report.persists.filter((p) => p.via !== "self").length} through a one-hop import), ` +
      `${report.delegates.length} delegate to an external tool or config, ${report.silent.length} silent`,
  );
});

test("no registered gate with a script of its own persists nothing", () => {
  assert.deepEqual(
    report.silent,
    [],
    `these gates run and leave no artifact:\n${report.silent
      .map((s) => `  ${s.id} -> ${s.scriptPath}`)
      .join("\n")}`,
  );
});

test("the steps exempted from the question are exactly the seven named ones", () => {
  // An exact set in both directions. A new gate cannot be quietly classified as a delegate, and a
  // delegate that grows a script of its own stops being exempt.
  const found = Object.fromEntries(report.delegates.map((d) => [d.id, d.scriptPath]));
  assert.deepEqual(found, DELEGATES);
});

test("the one-hop follow is what credits a gate that persists through a helper", () => {
  // The property the bead's verifier recorded: verify-facsimile-pins.ts contains no fs write in its
  // 965 lines, so a method that read only the gate's own script would call it silent. Asserted on a
  // real gate rather than a fixture, because this is the exact case that produced two false positives
  // in the original sweep.
  const viaHop = report.persists.filter((p) => p.via !== "self");
  assert.ok(
    viaHop.length > 0,
    "no gate was credited through an import, so the one-hop follow is doing nothing and could be removed without this test noticing",
  );
  for (const p of viaHop) assert.match(p.via, /^one-hop:/);
});

test("PLANTED: silence is detected, a helper is credited, and a comment is not", () => {
  // Three directions through the real analyzer. Without the third, a gate whose docblock EXPLAINS how
  // it persists would be credited for the explanation - which is the failure AGENTS.md records under
  // "A gate that forbids a construct must read code, not text", with a gate's own repair notes as the
  // victim.
  const dir = mkdtempSync(join(tmpdir(), "am-uxh9-20261006T133000Z-"));
  writeFileSync(join(dir, "helper.ts"), 'export const w = () => appendLogLine("x");\n');
  writeFileSync(join(dir, "silent.ts"), 'console.log("I checked everything and said so");\n');
  writeFileSync(join(dir, "viaHelper.ts"), 'import { w } from "./helper.ts";\nw();\n');
  writeFileSync(
    join(dir, "commentOnly.ts"),
    "/** This gate used to call new TestLogger('x') and appendLogLine(row). */\nconsole.log('nothing');\n",
  );

  const steps = [
    { id: "plant-silent", availability: { scriptPath: "silent.ts" } },
    { id: "plant-via-helper", availability: { scriptPath: "viaHelper.ts" } },
    { id: "plant-comment-only", availability: { scriptPath: "commentOnly.ts" } },
  ];
  const planted = auditGatePersistence(steps, dir);

  assert.deepEqual(
    planted.persists.map((p) => p.id),
    ["plant-via-helper"],
  );
  assert.equal(planted.persists[0]?.via, "one-hop:helper.ts");
  assert.deepEqual(planted.silent.map((s) => s.id).sort(), ["plant-comment-only", "plant-silent"]);
  assert.deepEqual(planted.delegates, []);

  // And the import resolver only reports files that exist, so a dependency that was deleted cannot be
  // read as evidence of persistence.
  assert.deepEqual(localImportsOf(join(dir, "viaHelper.ts"), 'import { w } from "./gone.ts";'), []);
});

test("PLANTED: a non-config .mjs gate is AUDITED, while a .config.mjs still delegates", () => {
  // THE EXTENSION IS NOT THE QUESTION, and this is the plant for the defect that proved it. The
  // CONFIG_FILE pattern was `/\.(json|mjs|cjs)$/`, so every `.mjs` gate script landed in `delegates`
  // -- the set this audit EXEMPTS. A browser suite written as `.mjs` that persisted nothing would
  // therefore have read as an honest delegate rather than as silent, and only the extension stood
  // between that and a clean verdict.
  //
  // All three directions are planted, because the repair has to hold both ways: the dangerous
  // direction is a silent `.mjs` being excused, and the regression direction is `next.config.mjs`
  // losing its exemption and being reported silent for not writing a log it was never meant to write.
  const dir = mkdtempSync(join(tmpdir(), "am-mjs-persistence-"));
  writeFileSync(join(dir, "writes.mjs"), 'const p = logPathFor("suite", id, root);\n');
  writeFileSync(join(dir, "silent.mjs"), 'console.log("26 clause(s) checked; 0 failed");\n');
  writeFileSync(join(dir, "tool.config.mjs"), "export default { reactStrictMode: true };\n");

  const planted = auditGatePersistence(
    [
      { id: "plant-mjs-writes", availability: { scriptPath: "writes.mjs" } },
      { id: "plant-mjs-silent", availability: { scriptPath: "silent.mjs" } },
      { id: "plant-config-mjs", availability: { scriptPath: "tool.config.mjs" } },
    ],
    dir,
  );

  assert.deepEqual(
    planted.persists.map((p) => p.id),
    ["plant-mjs-writes"],
    "a .mjs that calls logPathFor must be credited, not exempted by its extension",
  );
  assert.deepEqual(
    planted.silent.map((s) => s.id),
    ["plant-mjs-silent"],
    "a .mjs gate that writes nothing must be reported silent; under the old pattern it was exempt",
  );
  assert.deepEqual(
    planted.delegates.map((d) => d.id),
    ["plant-config-mjs"],
    "a .config.mjs is a config module and stays exempt",
  );

  // The live consequence, asserted on the real registry rather than only on the fixture: the one
  // non-config .mjs step in the chain is now answered rather than excused.
  const live = report.persists.find((p) => p.id === "adversarial-runtime");
  assert.ok(
    live,
    `adversarial-runtime is a .mjs browser suite that writes JSONL through logPathFor; it must be audited, not a delegate (delegates: ${report.delegates.map((d) => d.id).join(", ")})`,
  );
  assert.equal(live.via, "self");
});

test("PLANTED: a registered gate whose script is missing counts as silent, not as a delegate", () => {
  // The dangerous misclassification. A missing script cannot persist, and calling it a delegate would
  // move it into the exempt set, where nothing would ever ask it again.
  const planted = auditGatePersistence(
    [{ id: "plant-missing", availability: { scriptPath: "scripts/does-not-exist.ts" } }],
    ROOT,
  );
  assert.deepEqual(planted.delegates, []);
  assert.equal(planted.silent.length, 1);
  assert.match(planted.silent[0]?.scriptPath ?? "", /missing/);
});
