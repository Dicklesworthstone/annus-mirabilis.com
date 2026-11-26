import { expect, test } from "bun:test";
import { parseExpression, type Expression } from "./ast.ts";
import { expressionToSpokenText } from "./derivations/a11yText.ts";
import { expressionToDerivationLatex } from "./derivations/mathRenderer.ts";
import { evaluateExpression } from "./derivations/spotCheck.ts";
import { checkDimensions } from "./dimensions.ts";
import { renderLatex } from "./latex/render.ts";
import { BROWNIAN_QUANTITIES } from "./quantities.ts";
import { evaluateForSpotCheck } from "./tree/evaluateForSpotCheck.ts";
import { parseAuthoring } from "./tree/parse.ts";
import { validateExpressionNode } from "./tree/schema.ts";

test("the printed-angle operation is the principal arctangent in both equation readers", () => {
  for (const slope of [-2, -1, 0, 1, 2]) {
    const raw = { kind: "function", name: "atan", argument: { kind: "number", value: String(slope) } };
    const expr = parseExpression(raw, "eq-model-slope", {});
    expect(evaluateExpression(expr, {})).toBeCloseTo(Math.atan(slope), 14);
    expect(checkDimensions(expr, {}).status).toBe("consistent");
    const authored = validateExpressionNode(parseAuthoring(`atan(${slope})`));
    const evaluated = evaluateForSpotCheck(authored, {});
    expect(evaluated.status).toBe("value");
    if (evaluated.status === "value") expect(evaluated.value).toBeCloseTo(Math.atan(slope), 14);
    expect(renderLatex(expr)).toContain("\\arctan");
    expect(expressionToDerivationLatex(expr)).toContain("\\arctan");
    expect(expressionToSpokenText(expr)).toBe(`arctangent of ${slope}`);
  }
});

test("a length alone cannot be the argument of an inverse trigonometric function", () => {
  const expr: Expression = {
    kind: "function",
    name: "atan",
    argument: { kind: "symbol", termId: "eq-model-slope.t.radius", quantityId: "particleRadius" },
  };
  expect(checkDimensions(expr, BROWNIAN_QUANTITIES).status).toBe("inconsistent");
});
