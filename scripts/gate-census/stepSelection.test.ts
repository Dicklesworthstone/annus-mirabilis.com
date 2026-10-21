/**
 * `--gate <id>` REFUSES RATHER THAN SELECTING NOTHING.
 *
 * The flag exists because a full `--plants` run executes all 60 recorded gates and then one more
 * whole gate run per plant, which is why 21 of 60 records carried `plants: []` on 2026-10-21: the
 * cost of the proof, not anyone's diligence, was the reason the proof went unwritten.
 *
 * ITS DANGEROUS FAILURE IS SILENCE. A filter that matched nothing would iterate zero steps, report
 * `findings: 0` and exit 0 -- indistinguishable from a clean census over all 66 registry steps.
 * That is the exact defect the census was built to notice, so the filter must not be able to
 * commit it. Hence a refusal, with the offending text named.
 *
 * `selectSteps` is pure and exported for this test, so the refusals are provable here without
 * spawning the script or running a single gate -- the same reason plantAnchors.test.ts reads
 * anchors instead of applying them. What this file cannot answer is whether `main` honours the
 * refusal; that was measured directly, without a pipe because `$?` after a pipe is `tail`'s:
 * unknown id exit 1, missing value exit 1, one valid gate exit 0.
 */

import { describe, expect, test } from "bun:test";
import { selectSteps } from "../gate-census.ts";
import { QUALITY_GATE_STEPS } from "../quality-gates/registry.ts";

/** A stand-in registry, so these cases do not move when a gate is registered or renamed. */
const STEPS = [
  { id: "alpha" },
  { id: "beta" },
  { id: "gamma" },
] as unknown as typeof QUALITY_GATE_STEPS;

describe("--gate selects, or refuses, but never selects nothing", () => {
  test("the real registry is the population this flag filters, and it is not empty", () => {
    console.log(`[census] step selection: ${QUALITY_GATE_STEPS.length} registry step(s)`);
    expect(QUALITY_GATE_STEPS.length).toBeGreaterThanOrEqual(40);
  });

  test("no flag selects every step, which keeps the old behaviour exact", () => {
    const got = selectSteps([], STEPS);
    expect(got.kind).toBe("all");
    if (got.kind !== "refused") expect(got.steps).toHaveLength(3);
  });

  test("other flags alone do not narrow anything", () => {
    const got = selectSteps(["--plants", "--list"], STEPS);
    expect(got.kind).toBe("all");
  });

  test("one id narrows to that step; two narrow to both, in registry order", () => {
    const one = selectSteps(["--gate", "beta"], STEPS);
    expect(one.kind).toBe("some");
    if (one.kind === "some") {
      expect(one.steps.map((s) => s.id)).toEqual(["beta"]);
      expect(one.ids).toEqual(["beta"]);
    }
    // Registry order, not the order they were typed, so output is stable across invocations.
    const two = selectSteps(["--gate", "gamma", "--plants", "--gate", "alpha"], STEPS);
    expect(two.kind).toBe("some");
    if (two.kind === "some") expect(two.steps.map((s) => s.id)).toEqual(["alpha", "gamma"]);
  });

  test("a repeated id is not a repeated step", () => {
    const got = selectSteps(["--gate", "alpha", "--gate", "alpha"], STEPS);
    expect(got.kind).toBe("some");
    if (got.kind === "some") expect(got.steps.map((s) => s.id)).toEqual(["alpha"]);
  });

  test("PLANTED: an id that matches no step REFUSES, and names it", () => {
    // The whole point. Returning `{kind:"some", steps: []}` here would print "findings: 0" and read
    // as a clean census over everything.
    const got = selectSteps(["--gate", "not-a-gate"], STEPS);
    expect(got.kind).toBe("refused");
    if (got.kind === "refused") expect(got.message).toContain("not-a-gate");

    // The control: one character different and it selects, so the refusal is about the id and not
    // about the parsing.
    expect(selectSteps(["--gate", "alpha"], STEPS).kind).toBe("some");
  });

  test("PLANTED: one bad id among good ones still refuses, rather than quietly dropping it", () => {
    const got = selectSteps(["--gate", "alpha", "--gate", "nope"], STEPS);
    expect(got.kind).toBe("refused");
    if (got.kind === "refused") {
      expect(got.message).toContain("nope");
      expect(got.message).not.toContain("alpha");
    }
  });

  test("PLANTED: a missing value refuses instead of selecting a step named after a flag", () => {
    // `--gate --plants` once read "--plants" as the id, which matches nothing: a refusal either
    // way, but this one says what is actually wrong.
    for (const argv of [["--gate"], ["--gate", "--plants"], ["--plants", "--gate"]]) {
      const got = selectSteps(argv, STEPS);
      expect(got.kind, `argv ${JSON.stringify(argv)} did not refuse`).toBe("refused");
      if (got.kind === "refused") expect(got.message).toContain("needs a step id");
    }
  });

  test("every id in the real registry is selectable, so the flag cannot be half-wired", () => {
    const unselectable = QUALITY_GATE_STEPS.filter(
      (step) => selectSteps(["--gate", step.id]).kind !== "some",
    ).map((step) => step.id);
    expect(unselectable, unselectable.join(", ")).toEqual([]);
  });
});
