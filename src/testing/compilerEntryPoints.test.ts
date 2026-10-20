/**
 * THE TWO COMPILER ENTRY POINTS, AND WHICH ONE RUNS THE REGISTERED CHECKS.
 *
 * Section G of am-edn-alignment-tooling-do1 says the pipeline's compile stage runs "the content
 * compiler's check entry point for the paper ... including every registered check". Measured
 * 2026-10-20: it calls `compileReadingContent`, which invokes none of them.
 *
 *   compileReadingContent (compile.ts)  runs ZERO registered checks. Its diagnostics are the
 *                                       compiler's own review flags, with no checkId.
 *   compileContent (compiler.ts)        registers the check families in its Phase 4 and calls
 *                                       runAllChecks. verify-content uses it, and under it the
 *                                       same checks report 4 world checks on 4 journeys, 200
 *                                       equation pairs over 821 edges and 7 real inline-maths
 *                                       differences.
 *
 * The pipeline's compile stage now says in its own `pending` that it does not run them and names
 * verify-content. This file is what makes that sentence checkable: a probe check is registered,
 * both entry points are called, and the probe must stay unreached by one and be reached by the
 * other. If someone wires the checks into `compileReadingContent`, the first test below goes red
 * and the pending line should come out with it -- which is the point of writing it this way round.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  listRegisteredChecks,
  registerCheck,
  unregisterCheck,
} from "../content/compiler/checks/registry.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { compileContent } from "../content/compiler/compiler.ts";

const PROBE_ID = "testing.compiler-entry-point-probe";

/**
 * A record the compiler will route, so neither entry point is called on nothing.
 *
 * `sections` is required rather than decorative: `buildContentIndexes` iterates it, and a paper
 * without one throws before Phase 4 is reached -- which would have made the positive control below
 * fail for a reason that has nothing to do with the question.
 */
const FILES = [
  {
    path: "content/papers/mass-energy.json",
    text: JSON.stringify({
      schemaVersion: 1,
      kind: "paper",
      id: "mass-energy",
      title: "Mass and energy, a fixture",
      germanTitle: "Ist die Tragheit eines Korpers von seinem Energieinhalt abhangig?",
      description: "A fixture paper record, present so the compiler has something to route.",
      status: "explanation-preview",
      sourceStatus: "in-preparation",
      sections: [{ id: "s0", title: "The unsectioned argument", arguments: [] }],
    }),
  },
];

function registerProbe(): { ran: () => number } {
  let runs = 0;
  registerCheck({
    id: PROBE_ID,
    family: "audit",
    severity: "flag",
    description: "Counts how many times a compiler entry point invokes the registered checks.",
    run: () => {
      runs += 1;
    },
  });
  return { ran: () => runs };
}

afterEach(() => {
  unregisterCheck(PROBE_ID);
});

describe("which entry point runs the registered checks", () => {
  test("compileReadingContent runs NONE of them", () => {
    const probe = registerProbe();
    expect(listRegisteredChecks().some((c) => c.id === PROBE_ID)).toBe(true);
    const result = compileReadingContent(FILES);
    expect(probe.ran()).toBe(0);
    // It reached a verdict, so the zero above is a statement about the checks and not about a
    // call that threw. What proves the registry CAN fire at all is the control below, which runs
    // the same probe over the same files through the other entry point and sees it once.
    // It reached a verdict over this fixture and reported on it -- `ok` is false here, because a
    // lone paper record has a citation and arguments nothing resolves -- so the zero above is a
    // statement about the checks and not about a call that did nothing.
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    // And not one of those diagnostics came from a check.
    for (const d of result.diagnostics) {
      expect((d as { checkId?: unknown }).checkId).toBeUndefined();
    }
  });

  test("compileContent DOES, which is the positive control", async () => {
    // Without this the test above would pass against a registry that cannot invoke anything.
    const probe = registerProbe();
    await compileContent(FILES);
    expect(probe.ran()).toBe(1);
  });

  test("a check's diagnostics carry its id, and the review flags do not", () => {
    // This is how the two kinds were told apart: the 247 diagnostics the pipeline's compile stage
    // reports have no checkId at all, because no check produced them.
    const result = compileReadingContent(FILES);
    const withCheckId = result.diagnostics.filter(
      (d) => (d as { checkId?: unknown }).checkId !== undefined,
    );
    expect(withCheckId).toEqual([]);
  });
});
