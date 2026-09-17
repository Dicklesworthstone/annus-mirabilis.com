import { describe, expect, test } from "bun:test";
import type { ArgumentNode } from "../content/schemas/argument.ts";
import {
  projectLimitation,
  ResultsProjectionError,
} from "../reader/faces/results/resultsProjection.ts";

/**
 * am-read-results-face-uzh: "the rendered text is byte-identical to the argument node's
 * limitations; editing the node changes every card that references it in one compile; an
 * empty limitations fails with the rule id and the node id."
 */
function fixtureNode(limitations: readonly string[]): ArgumentNode {
  return {
    id: "arg-bm-04-displacement-law",
    paper: "brownian-motion",
    question: "How does the mean displacement grow with time?",
    conclusion: "lambda_x = sqrt(2 D t)",
    logicalRole: "derivation",
    limitations,
    meanings: {
      argumentStatus: "derived",
      modelStatus: "idealized",
      evidentialRole: "theoretical-prediction",
      historicalStatus: "as-printed",
    },
    premises: [],
    evidence: [],
    sourceSupport: [{ paper: "brownian-motion", id: "s5" }],
    prerequisites: [],
    coverageObligation: { required: false },
    authorship: { authoredBy: "editorial", date: "2026-01-01" },
    reviewState: "draft",
  } as unknown as ArgumentNode;
}

describe("resultsProjection.limitation: reference, not a copy", () => {
  test("rendered text is the argument node's limitations joined into one line", () => {
    const node = fixtureNode([
      "Holds only where the interval is long compared with the momentum relaxation time.",
      "Assumes an unbounded, homogeneous liquid.",
    ]);
    const limitation = projectLimitation("arg-bm-04-displacement-law", node);
    expect(limitation.argumentId).toBe("arg-bm-04-displacement-law");
    expect(limitation.text).toBe(
      "Holds only where the interval is long compared with the momentum relaxation time. Assumes an unbounded, homogeneous liquid.",
    );
  });

  test("editing the node's limitations changes what a second projection of the same node returns -- one authored copy, not a per-card one", () => {
    const before = projectLimitation("arg-x", fixtureNode(["Original limit."]));
    const after = projectLimitation("arg-x", fixtureNode(["Corrected limit."]));
    expect(before.text).toBe("Original limit.");
    expect(after.text).toBe("Corrected limit.");
    expect(before.text).not.toBe(after.text);
  });

  test("an empty limitations array fails with result-limitation-missing, naming the node", () => {
    let caught: unknown;
    try {
      projectLimitation("arg-bm-04-blank", fixtureNode([]));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResultsProjectionError);
    const error = caught as InstanceType<typeof ResultsProjectionError>;
    expect(error.rule).toBe("result-limitation-missing");
    expect(error.message).toContain("arg-bm-04-blank");
  });

  test("a historian's-margin record id passes through when the limit is a later finding, not the paper's own qualification", () => {
    const limitation = projectLimitation(
      "arg-lq-04-wien-regime",
      fixtureNode(["Valid only in the Wien regime."]),
      "margin-planck-1900-correction",
    );
    expect(limitation.historiansMarginRecordId).toBe("margin-planck-1900-correction");
  });

  test("no margin record id is present when the limit is the paper's own qualification", () => {
    const limitation = projectLimitation(
      "arg-x",
      fixtureNode(["A limit Einstein himself states."]),
    );
    expect(limitation.historiansMarginRecordId).toBeUndefined();
  });
});
