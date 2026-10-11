/**
 * THE JOURNEY PAYLOAD'S REFUSAL, BOTH WAYS (am-hk4b, am-muyh).
 *
 * `assertJourneyExplainersPublishable` is what stops a build shipping a panel that would quietly
 * never appear, and the untested-refusal ratchet asked for this pair by name: "Add targeted tests
 * for each refusal throw site or accept/reject test pairs." A refusal nothing exercises is a guard
 * nobody has watched reach a verdict, which is the proposition AGENTS.md states about gates and
 * which applies to a throw site just as well.
 *
 * It is a PAIR on purpose. A test that only drives the refusal cannot tell a guard that refuses the
 * wrong thing from one that refuses everything, and this module's whole job is to let 39 good
 * records through.
 */
import { describe, expect, test } from "bun:test";
import {
  assertJourneyExplainersPublishable,
  JourneyExplanationsError,
} from "./journeyExplainerPayload.ts";

/** The smallest build shape the assertion reads: its problems, and a census it does not look at. */
function build(problems: readonly string[]) {
  return {
    payload: { pages: {} },
    problems,
    census: {
      files: 0,
      entries: 0,
      step: 0,
      own: 0,
      display: 0,
      stepsMatched: 0,
      stepsDeclared: 0,
      pageFormulasMatched: 0,
      pageFormulasDeclared: 0,
      boundPhrases: 0,
      distinctQuantities: 0,
    },
    drawn: 0,
  };
}

describe("assertJourneyExplainersPublishable", () => {
  test("REFUSES a build with problems, under its own code, naming each one", () => {
    const refused = build([
      "[journey-explanation-unknown-step] discover/probe: names step no-such-step",
      "[journey-explanation-unknown-quantity] discover/probe: binds notAQuantity",
    ]);
    expect(() => assertJourneyExplainersPublishable(refused)).toThrow(JourneyExplanationsError);
    try {
      assertJourneyExplainersPublishable(refused);
      throw new Error("the assertion did not refuse");
    } catch (error) {
      expect(error).toBeInstanceOf(JourneyExplanationsError);
      const thrown = error as JourneyExplanationsError;
      expect(thrown.code).toBe("journey-explanations-refused");
      // Every problem is named, not counted: a refusal that says "2 problems" sends the reader back
      // to the build to find out which.
      expect(thrown.message).toContain("no-such-step");
      expect(thrown.message).toContain("notAQuantity");
      expect(thrown.message).toContain("content/journey-explanations/");
    }
  });

  test("ACCEPTS a build with no problems, so the guard is not refusing everything", () => {
    expect(() => assertJourneyExplainersPublishable(build([]))).not.toThrow();
  });
});
