import { describe, expect, test } from "bun:test";
import { explainResult } from "../experiments/results/explanations.ts";
import {
  lq02DivergentExample,
  notApplicableExample,
  planStatusExamples,
} from "../experiments/results/planExamples.ts";
import { type OutputStatus, outputStatusRegistry } from "../experiments/results/types.ts";

/**
 * am-rt-typed-results-mqb: "the proof I want is a test per status asserting the distinct
 * reader-facing text -- and specifically that the divergent integral and the below-threshold
 * case do not render as the same thing, because both are the ones most likely to be collapsed."
 *
 * The existing coverage (results.divergentVsOutcome.test.ts, results.explanations.test.tsx)
 * proves divergent carries its own status tag and that its text differs from every EXECUTION
 * OUTCOME. Neither proves the thing BoldHarbor named: that divergent's rendered text differs
 * from not-applicable's -- the other output STATUS a UI is most likely to collapse it into,
 * since both are "the quantity has no ordinary value" cases. This closes that gap, plus the
 * more general failure mode: a future edit that copies one status's generic fallback message
 * onto another would not be caught by any existing test.
 */
describe("results.statusTextDistinct: no two output statuses render the same reader text", () => {
  test("the bead's own named pair: LQ-02 divergent vs LQ-08 not-applicable (below threshold) render distinct text", () => {
    const divergent = explainResult(lq02DivergentExample);
    const notApplicable = explainResult(notApplicableExample);
    expect(divergent.message).not.toBe(notApplicable.message);
    expect(divergent.nextAction).not.toBe(notApplicable.nextAction);
    // The specific failure mode named: neither collapses to a generic "error" label.
    expect(divergent.message.toLowerCase()).not.toContain("error");
    expect(notApplicable.message.toLowerCase()).not.toContain("error");
    expect(divergent.message).toContain("classical spectral energy density");
    expect(notApplicable.message).toContain("Below threshold frequency");
  });

  test("every one of the bead's plan-example payloads renders reader text distinct from every other", () => {
    const resolved = planStatusExamples.map((example) => ({
      status: example.status,
      quantityId: example.quantityId,
      explanation: explainResult(example),
    }));
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i];
        const b = resolved[j];
        if (!a || !b) throw new Error("unreachable");
        if (a.explanation.message === b.explanation.message) {
          throw new Error(
            `${a.status}(${a.quantityId}) and ${b.status}(${b.quantityId}) render the same message: "${a.explanation.message}"`,
          );
        }
      }
    }
  });

  test("the seven generic fallback messages (used when a payload carries no authored/rate/reason text) are pairwise distinct", () => {
    // This is the insurance test: it does not depend on any fixture's authored text, only on
    // outputStatusRegistry itself, so a copy-paste that made two statuses share a fallback
    // message would fail here even before any instrument's fixture caught it.
    const statuses = Object.keys(outputStatusRegistry) as OutputStatus[];
    expect(statuses).toHaveLength(7);
    const messages = statuses.map((s) => outputStatusRegistry[s].message);
    const nextActions = statuses.map((s) => outputStatusRegistry[s].nextAction);
    expect(new Set(messages).size).toBe(statuses.length);
    expect(new Set(nextActions).size).toBe(statuses.length);
    // Named explicitly, since these are the two the bead calls out as most likely to collapse.
    expect(outputStatusRegistry.divergent.message).not.toBe(
      outputStatusRegistry["not-applicable"].message,
    );
  });

  test("two different payloads sharing one status (both analytic-limit) still render distinct text, because the payload's own description is used, not a shared template", () => {
    const analyticLimitExamples = planStatusExamples.filter((e) => e.status === "analytic-limit");
    expect(analyticLimitExamples.length).toBeGreaterThanOrEqual(2);
    const texts = analyticLimitExamples.map((e) => explainResult(e).message);
    expect(new Set(texts).size).toBe(analyticLimitExamples.length);
  });
});
