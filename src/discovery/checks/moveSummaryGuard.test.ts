import { describe, expect, test } from "bun:test";
import { checkMoveSummary } from "./moveSummaryGuard.ts";

describe("moveSummaryGuard", () => {
  test("accepts a plain one-sentence summary with digits, articles, and parentheticals", () => {
    const valid =
      "Connecting the observable spreading rate to osmotic pressure determines the number of particles (an Avogadro scale) from four times longer and twice as wide displacements.";
    const result = checkMoveSummary(valid);
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  test("accepts allowed single-letter English words like 'a', 'A', and 'I'", () => {
    const valid =
      "I compare a single tracer step with a collective diffusion flux across an imaginary boundary.";
    const result = checkMoveSummary(valid);
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  test("rejects math delimiters ($ and LaTeX commands)", () => {
    const withDollar = "The displacement scale follows $2Dt$ over time.";
    const resDollar = checkMoveSummary(withDollar);
    expect(resDollar.valid).toBe(false);
    expect(resDollar.issues.some((i) => i.rule === "move-summary-no-math-delimiters")).toBe(true);

    const withFrac = "The fraction \\frac{1}{2} describes the step symmetry.";
    const resFrac = checkMoveSummary(withFrac);
    expect(resFrac.valid).toBe(false);
    expect(resFrac.issues.some((i) => i.rule === "move-summary-no-math-delimiters")).toBe(true);
  });

  test("rejects math symbols (=, √, etc.)", () => {
    const withEquals = "The resulting value = double the original.";
    const resEquals = checkMoveSummary(withEquals);
    expect(resEquals.valid).toBe(false);
    expect(resEquals.issues.some((i) => i.rule === "move-summary-forbidden-character")).toBe(true);

    const withSqrt = "We take the √ of the mean square displacement.";
    const resSqrt = checkMoveSummary(withSqrt);
    expect(resSqrt.valid).toBe(false);
    expect(resSqrt.issues.some((i) => i.rule === "move-summary-forbidden-character")).toBe(true);
  });

  test("rejects Greek letters", () => {
    const withLambda = "The step length λ governs the rate of spread.";
    const res = checkMoveSummary(withLambda);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.rule === "move-summary-no-greek-letters")).toBe(true);
  });

  test("rejects lone symbol letter such as 'N' or 'c'", () => {
    const withN = "Where N is the number of molecules in a gram mole.";
    const resN = checkMoveSummary(withN);
    expect(resN.valid).toBe(false);
    expect(
      resN.issues.some((i) => i.rule === "move-summary-no-lone-symbols" && i.token === "N"),
    ).toBe(true);

    const withC = "The velocity c represents the speed of light.";
    const resC = checkMoveSummary(withC);
    expect(resC.valid).toBe(false);
    expect(
      resC.issues.some((i) => i.rule === "move-summary-no-lone-symbols" && i.token === "c"),
    ).toBe(true);
  });

  test("rejects superscript/subscript characters like 10⁻³", () => {
    const withSuperSub = "The concentration decreases to 10⁻³ of its initial value.";
    const res = checkMoveSummary(withSuperSub);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.rule === "move-summary-no-superscript-subscript")).toBe(true);
  });

  test("rejects multiple sentences", () => {
    const twoSentences = "It spreads. It grows.";
    const res = checkMoveSummary(twoSentences);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.rule === "move-summary-single-sentence")).toBe(true);
  });

  test("rejects sentence exceeding 100 words", () => {
    const longSentence = `${"word ".repeat(101)}.`;
    const res = checkMoveSummary(longSentence);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.rule === "move-summary-word-count")).toBe(true);
  });

  test("rejects psychological copy guard phrases like 'What Einstein thought'", () => {
    const withThought = "What Einstein thought was that Brownian motion proved atoms.";
    const res = checkMoveSummary(withThought);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.rule === "move-summary-forbidden-phrase")).toBe(true);

    const withProcess = "This step illustrates Einstein's thought process.";
    const resProcess = checkMoveSummary(withProcess);
    expect(resProcess.valid).toBe(false);
    expect(resProcess.issues.some((i) => i.rule === "move-summary-forbidden-phrase")).toBe(true);
  });

  describe("move-summary-empty (moveSummaryGuard.ts:58)", () => {
    test("reject: (moveSummaryGuard.ts:58) empty or whitespace-only summary yields move-summary-empty", () => {
      const resEmpty = checkMoveSummary("");
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.issues.some((i) => i.rule === "move-summary-empty")).toBe(true);

      const resWhitespace = checkMoveSummary("   \n\t  ");
      expect(resWhitespace.valid).toBe(false);
      expect(resWhitespace.issues.some((i) => i.rule === "move-summary-empty")).toBe(true);
    });

    test("accept: non-empty plain summary does not yield move-summary-empty", () => {
      const res = checkMoveSummary("The observable displacement increases with time.");
      expect(res.issues.some((i) => i.rule === "move-summary-empty")).toBe(false);
    });
  });

  describe("move-summary-terminal-punctuation (moveSummaryGuard.ts:69)", () => {
    test("reject: (moveSummaryGuard.ts:69) missing terminal punctuation yields move-summary-terminal-punctuation", () => {
      const res = checkMoveSummary("The particle moves through the fluid without stopping");
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.rule === "move-summary-terminal-punctuation")).toBe(true);
    });

    test("accept: sentences ending with . ? or ! are accepted", () => {
      expect(
        checkMoveSummary("Does the particle move through the fluid?").issues.some(
          (i) => i.rule === "move-summary-terminal-punctuation",
        ),
      ).toBe(false);
      expect(
        checkMoveSummary("The particle moves through the fluid!").issues.some(
          (i) => i.rule === "move-summary-terminal-punctuation",
        ),
      ).toBe(false);
      expect(
        checkMoveSummary("The particle moves through the fluid.").issues.some(
          (i) => i.rule === "move-summary-terminal-punctuation",
        ),
      ).toBe(false);
    });
  });

  describe("move-summary-no-math-markup (moveSummaryGuard.ts:117)", () => {
    test("reject: (moveSummaryGuard.ts:117) summary containing math tags yields move-summary-no-math-markup", () => {
      const resMath = checkMoveSummary("The value is defined by <math>x</math>.");
      expect(resMath.valid).toBe(false);
      expect(resMath.issues.some((i) => i.rule === "move-summary-no-math-markup")).toBe(true);

      const resKatex = checkMoveSummary("The equation renders via <katex>y</katex>.");
      expect(resKatex.valid).toBe(false);
      expect(resKatex.issues.some((i) => i.rule === "move-summary-no-math-markup")).toBe(true);

      const resDataMath = checkMoveSummary("The span has [data-math] formatting.");
      expect(resDataMath.valid).toBe(false);
      expect(resDataMath.issues.some((i) => i.rule === "move-summary-no-math-markup")).toBe(true);
    });

    test("accept: plain sentences without HTML/MathML markup are accepted", () => {
      const res = checkMoveSummary("The concentration drops across the membrane over time.");
      expect(res.issues.some((i) => i.rule === "move-summary-no-math-markup")).toBe(false);
    });
  });
});
