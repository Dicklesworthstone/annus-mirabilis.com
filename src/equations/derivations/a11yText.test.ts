import { describe, expect, test } from "bun:test";
import { expressionToSpokenText, ruleInWords, stepAccessibleText } from "./a11yText.ts";
import { fixtureBrownianPedagogicalReconstruction } from "./fixtures.ts";

describe("am-eq-derivation-renderer-9gd7: a11yText and ClearSpeak descriptions", () => {
  const steps = fixtureBrownianPedagogicalReconstruction.steps;

  test("ruleInWords maps all transformation rules to human descriptive terms", () => {
    expect(ruleInWords("substitute")).toBe("Substitution");
    expect(ruleInWords("cancel-common-factor")).toBe("Cancel common factor");
    expect(ruleInWords("integrate")).toBe("Integrate");
    expect(ruleInWords("truncate-series")).toBe("Truncate series");
    expect(ruleInWords("registered-identity")).toBe("Registered identity");
  });

  test("expressionToSpokenText converts AST nodes to natural English math speech", () => {
    const symbolExpr = { kind: "symbol" as const, termId: "x_sum", quantityId: "x_sum" };
    expect(expressionToSpokenText(symbolExpr)).toBe("sum of x");

    const sumExpr = {
      kind: "sum" as const,
      args: [
        { kind: "symbol" as const, termId: "a", quantityId: "a" },
        { kind: "symbol" as const, termId: "b", quantityId: "b" },
      ],
    };
    expect(expressionToSpokenText(sumExpr)).toBe("a plus b");

    const rootExpr = {
      kind: "root" as const,
      degree: 2,
      radicand: { kind: "symbol" as const, termId: "t", quantityId: "t" },
    };
    expect(expressionToSpokenText(rootExpr)).toBe("square root of t");

    const relationExpr = {
      kind: "relation" as const,
      operator: "=" as const,
      left: { kind: "symbol" as const, termId: "E", quantityId: "energy" },
      right: { kind: "symbol" as const, termId: "mc2", quantityId: "energy" },
    };
    expect(expressionToSpokenText(relationExpr)).toBe("E equals mc2");
  });

  test("stepAccessibleText produces complete accessible name for regular step", () => {
    const step1 = steps[0];
    if (!step1) throw new Error("Missing step1");
    const text = stepAccessibleText(step1, 0);

    expect(text).toContain("Step 1.");
    expect(text).toContain("Rule: Substitution.");
    expect(text).toContain("From: x. To: sum of x.");
    expect(text).toContain("Foundation tool: random-walks.");
  });

  test("stepAccessibleText includes marked move label when step is the move", () => {
    const moveStep = steps.find((s) => s.isMove);
    if (!moveStep) throw new Error("Missing move step");
    const text = stepAccessibleText(moveStep, 2);

    expect(text).toContain("The move:");
    expect(text).toContain(
      "Cross terms average away because distinct displacements are independent",
    );
  });
});
