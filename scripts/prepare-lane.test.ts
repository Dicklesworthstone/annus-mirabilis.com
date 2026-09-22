import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { documentsFromCompiled } from "../src/search/documents.ts";
import {
  firstErrorLine,
  formatFailure,
  PREPARE_FAILED_EXIT,
  PREPARE_PHASES,
  prepareSteps,
  runPrepare,
} from "./prepare-lane.ts";

const ROOT = process.cwd();

/**
 * THE REAL FAULT, produced by the real code path, not a copied string.
 *
 * This is the light-thread outage: an instrument registered in the catalogue with no search-paper
 * mapping. `documentsFromCompiled` throws it from src/search/documents.ts:287, and it is what
 * scripts/build-search-index.ts surfaced when it stopped the chain and made `bun run typecheck`
 * exit 1 without ever reaching tsc. Running it here means the stack this test parses is a stack
 * this repository actually produces, so a change to how the fault is thrown reaches these
 * assertions instead of going unnoticed beside a hand-written fixture.
 */
function realRegistryFaultStack(): string {
  try {
    documentsFromCompiled(
      [],
      [],
      [{ id: "not-a-declared-instrument", status: "registered", title: "t", question: "why" }],
      "scaffold",
    );
  } catch (err) {
    const stack = (err as Error).stack ?? String(err);
    assert.ok(
      stack.includes("Registered instrument needs a search paper mapping"),
      `the registry fault no longer reads as expected, so this fixture proves nothing: ${stack.slice(0, 200)}`,
    );
    return stack;
  }
  throw new Error(
    "documentsFromCompiled accepted an unmapped registered instrument, so the fault this lane exists to report can no longer be produced",
  );
}

describe("prepare lane: the chain is derived, not restated", () => {
  test("every phase of the real package.json contributes steps, in order", async () => {
    const pkg = (await import("../package.json", { with: { type: "json" } })).default as {
      scripts: Record<string, string>;
    };
    const steps = prepareSteps(pkg.scripts);

    // The denominator, stated. The bead counted 34 and there are more now; a hand-maintained
    // second copy of this list is exactly what would have kept saying 34.
    assert.ok(steps.length >= 35, `expected at least 35 generators, derived ${steps.length}`);
    assert.equal(steps[0]?.phase, "prepare:content");
    assert.equal(steps[0]?.command, "bun scripts/build-content.ts");
    assert.equal(steps.at(-1)?.phase, "prepare:offline");
    for (const [i, step] of steps.entries()) {
      assert.equal(step.index, i + 1);
      assert.equal(step.total, steps.length);
    }
    // Phases stay in chain order; running offline before content would generate from stale content.
    const order = PREPARE_PHASES.map((p) => steps.findIndex((s) => s.phase === p));
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
    );
  });

  test("REJECT: a missing phase is a fault, not an empty phase", () => {
    // A lane that silently runs zero generators and reports success is a check passing on an
    // empty set, which is the failure this repository keeps finding.
    assert.throws(
      () => prepareSteps({ "prepare:content": "bun scripts/build-content.ts" }),
      /has no "prepare:lab" script/,
    );
  });
});

describe("prepare lane: the population is every generator, not the visible few", () => {
  /** Scripts in the chain that can throw, measured from their source rather than quoted. */
  function chainThrowers(steps: readonly { command: string }[]): readonly string[] {
    const throwers: string[] = [];
    for (const step of steps) {
      const file = step.command.split(/\s+/).at(-1) ?? "";
      let src: string;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (/\bthrow\s+new\b/.test(src)) throwers.push(file);
    }
    return throwers;
  }

  test("every generator that can throw is a step this lane runs", async () => {
    const pkg = (await import("../package.json", { with: { type: "json" } })).default as {
      scripts: Record<string, string>;
    };
    const steps = prepareSteps(pkg.scripts);
    const throwers = chainThrowers(steps);

    // RE-DERIVED, NOT QUOTED. am-w6sn measured 34 steps, 24 throwers and 71 throw sites; the tree
    // now has 35 steps and 70 sites, which is why the bound is a floor rather than an equality and
    // why the list is computed here instead of copied from the bead.
    assert.ok(
      throwers.length >= 23,
      `expected at least 23 throwing generators, found ${throwers.length}`,
    );

    const covered = new Set(steps.map((s) => s.command.split(/\s+/).at(-1)));
    const uncovered = throwers.filter((f) => !covered.has(f));
    assert.deepEqual(
      uncovered,
      [],
      `generators that can throw and no boundary runs: ${uncovered.join(", ")}`,
    );
  });

  test("REJECT: a lane covering one phase leaves the other phases' throwers unguarded", () => {
    // The negative a naive implementation fails. Attributing only the phase whose failure you
    // happened to see is the mistake this test exists to catch: prepare:lab holds the majority of
    // the generators, and a boundary around prepare:content alone would report a clean chain for
    // every one of them.
    const contentOnly = prepareSteps({
      "prepare:content": "bun scripts/build-content.ts",
      "prepare:lab": "bun scripts/generate-lab.mjs",
      "prepare:offline": "bun scripts/build-offline-chapters.ts",
    });
    const narrow = contentOnly.filter((s) => s.phase === "prepare:content");
    const throwers = chainThrowers(contentOnly);
    const covered = new Set(narrow.map((s) => s.command.split(/\s+/).at(-1)));
    const uncovered = throwers.filter((f) => !covered.has(f));
    assert.ok(
      uncovered.length > 0,
      "a single-phase lane must leave throwers uncovered, or this assertion proves nothing",
    );
  });
});

describe("prepare lane: a generator fault is legible and is not a type error", () => {
  test("the real registry fault keeps its message and loses its stack", () => {
    const stack = realRegistryFaultStack();
    assert.ok(stack.includes("\n    at "), "the real fault must carry stack frames to strip");

    const line = firstErrorLine(stack);
    assert.match(
      line,
      /Registered instrument needs a search paper mapping: not-a-declared-instrument/,
    );
    assert.ok(!line.includes(" at "), `the extracted line still carries a stack frame: ${line}`);
    assert.equal(line.split("\n").length, 1);
  });

  test("a plain diagnostic with no error prefix still comes back non-empty", () => {
    // A generator may fail by printing a diagnostic and exiting non-zero rather than throwing -
    // three of them do exactly that. Returning "" for those would report a failure with no reason.
    assert.equal(
      firstErrorLine("content/papers/brownian.yaml: unknown key 'auther'\n"),
      "content/papers/brownian.yaml: unknown key 'auther'",
    );
    assert.equal(firstErrorLine(""), "");
  });

  test("the diagnostic names the step and says what it is NOT", () => {
    const steps = prepareSteps({
      "prepare:content": "bun scripts/build-content.ts && bun scripts/build-search-index.ts",
      "prepare:lab": "bun scripts/generate-lab.mjs",
      "prepare:offline": "bun scripts/build-offline-chapters.ts",
    });
    const failure = runPrepare(steps, (command) =>
      command.includes("build-search-index")
        ? { status: 1, stderr: realRegistryFaultStack() }
        : { status: 0, stderr: "" },
    );
    assert.ok(failure, "the injected failing step was not reported");

    // It stops AT the failing step, which is the && semantics it replaces.
    assert.equal(failure.step.command, "bun scripts/build-search-index.ts");
    assert.equal(failure.step.phase, "prepare:content");
    assert.equal(failure.step.index, 2);

    const text = formatFailure(failure);
    assert.match(text, /PREPARE FAILED/);
    assert.match(text, /NOT a type error/);
    assert.match(text, /bun scripts\/build-search-index\.ts/);
    assert.match(text, /prepare:content/);
    assert.match(text, /step\s+: 2 of 4/);
    assert.match(text, /Registered instrument needs a search paper mapping/);
    assert.match(text, /check:types/);
    // The whole point: a reader is not sent to the generator's internals.
    assert.ok(!/\n\s+at /.test(text), "the diagnostic leaked a stack frame");
  });

  test("a clean chain reports no failure and runs every step", () => {
    const steps = prepareSteps({
      "prepare:content": "a && b",
      "prepare:lab": "c",
      "prepare:offline": "d",
    });
    const ran: string[] = [];
    const failure = runPrepare(steps, (command) => {
      ran.push(command);
      return { status: 0, stderr: "" };
    });
    assert.equal(failure, null);
    assert.deepEqual(ran, ["a", "b", "c", "d"]);
  });
});

describe("prepare lane: the exit status distinguishes the chain from the types", () => {
  test("PREPARE_FAILED_EXIT collides with neither tsc outcome", () => {
    // tsc exits 1 for type errors and 2 for configuration or syntax faults. The whole defect was
    // that a generator fault and a type error were both 1.
    assert.notEqual(PREPARE_FAILED_EXIT, 0);
    assert.notEqual(PREPARE_FAILED_EXIT, 1);
    assert.notEqual(PREPARE_FAILED_EXIT, 2);
  });

  test("the wired lane exits with it, end to end", () => {
    // Run the real script against a crafted package.json in a temp cwd. No environment sniffing:
    // the lane reads the chain from the working directory it is given, which is the same thing it
    // does in the repository.
    const dir = mkdtempSync(join(tmpdir(), "am-prepare-lane-"));
    writeFileSync(
      join(dir, "package.json"),
      `${JSON.stringify(
        {
          name: "prepare-lane-fixture",
          scripts: {
            "prepare:content":
              "node --eval process.stderr.write('TypeError: authored data is wrong\\n');process.exit(1)",
            "prepare:lab": "node --eval 0",
            "prepare:offline": "node --eval 0",
          },
        },
        null,
        2,
      )}\n`,
    );

    const run = spawnSync("bun", [join(ROOT, "scripts/prepare-lane.ts")], {
      cwd: dir,
      encoding: "utf8",
      // Explicit, not inherited. Under `bun test` an inherited descriptor makes posix_spawn fail
      // with EBADF before the child runs at all, which reports as status undefined and would read
      // like the lane returning the wrong code rather than never having started.
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(
      run.status,
      PREPARE_FAILED_EXIT,
      `expected ${PREPARE_FAILED_EXIT}, got ${run.status}; spawn error: ${run.error?.message ?? "none"}; stderr: ${run.stderr?.slice(0, 300)}`,
    );
    assert.match(run.stderr ?? "", /PREPARE FAILED/);
    assert.match(run.stderr ?? "", /prepare:content/);
  });

  test("a clean run exits 0 and states its denominator", () => {
    const dir = mkdtempSync(join(tmpdir(), "am-prepare-lane-ok-"));
    writeFileSync(
      join(dir, "package.json"),
      `${JSON.stringify(
        {
          name: "prepare-lane-fixture",
          scripts: {
            "prepare:content": "node --eval 0",
            "prepare:lab": "node --eval 0",
            "prepare:offline": "node --eval 0",
          },
        },
        null,
        2,
      )}\n`,
    );
    const run = spawnSync("bun", [join(ROOT, "scripts/prepare-lane.ts")], {
      cwd: dir,
      encoding: "utf8",
      // Explicit, not inherited. Under `bun test` an inherited descriptor makes posix_spawn fail
      // with EBADF before the child runs at all, which reports as status undefined and would read
      // like the lane returning the wrong code rather than never having started.
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(
      run.status,
      0,
      `spawn error: ${run.error?.message ?? "none"}; stderr: ${run.stderr}`,
    );
    assert.match(run.stdout ?? "", /3 generators ran, all clean/);
  });
});
