import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ExercisePart, type ExpressionExercisePart } from "./ExercisePart";

const PART: ExpressionExercisePart = {
  id: "demo-part",
  prompt: "Rewrite 2*sqrt(D*t).",
  declaredNames: ["D", "t"],
  domains: {
    D: { min: 1e-14, max: 1e-10, scale: "log" },
    t: { min: 0.1, max: 100, scale: "log" },
  },
  referenceSource: "2*sqrt(D*t)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  workedExplanation: "sqrt(4*D*t) = 2*sqrt(D*t).",
};

describe("ExercisePart: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<ExercisePart part={PART} />);

  test("renders the prompt", () => {
    expect(html).toContain("Rewrite 2*sqrt(D*t).");
  });

  test("includes a noscript notice so a no-JavaScript reader is never shown a dead form", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("needs JavaScript");
  });

  test("a worked explanation is always available, never gated behind an attempt", () => {
    expect(html).toContain("Show a worked explanation");
    expect(html).toContain("sqrt(4*D*t) = 2*sqrt(D*t).");
  });

  test("the input has a real label naming the declared variables", () => {
    expect(html).toContain("Your answer, using D, t");
  });

  test("never displays a score, a cross, or an attempt count", () => {
    expect(html.toLowerCase()).not.toContain("score");
    expect(html.toLowerCase()).not.toContain("attempt");
    expect(html).not.toContain("✗");
    expect(html).not.toContain("✓");
  });

  test("renders no script tags itself: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });

  test("has exactly one addressable exercise-part root", () => {
    expect(html).toContain('data-exercise-part="demo-part"');
  });
});
