import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { chiSquareInterval, inverseBias } from "../physics/reference/inference.ts";

/**
 * The numbers the error-and-inference lesson prints (am-found-statistics-inference-pzqv), each
 * recomputed with the audited reference evaluator and rounded to the precision the lesson uses.
 * The bead pins them: the q = 100 quantiles 74.2219 and 129.5612, the interval [0.3319, 0.5793]
 * μm²/s from a synthetic estimate of 0.43, and the inversion bias factor q/(q − 2) = 1.020408.
 */

const lesson = readFileSync(
  new URL("../../content/foundations/error-and-inference.json", import.meta.url),
  "utf8",
);
const record = JSON.parse(lesson) as { explanation: { kind: string; text?: string }[] };
const prose = record.explanation
  .map((b) => b.text ?? "")
  .join(" ")
  .replace(/\s+/g, " ");

describe("the chi-square interval", () => {
  const interval = chiSquareInterval({ dHat: 0.43, q: 100, alpha: 0.05 });

  test("the evaluator accepts the worked case", () => {
    expect(interval.kind).toBe("accepted");
  });

  test("the lesson prints the two quantiles the interval is built from", () => {
    if (interval.kind !== "accepted") return;
    // The interval is [q·D/χ²(0.975), q·D/χ²(0.025)], so each quantile is q·D over an endpoint.
    const upperQuantile = (100 * 0.43) / interval.data.lower;
    const lowerQuantile = (100 * 0.43) / interval.data.upper;
    expect(prose).toContain(`${lowerQuantile.toFixed(4)} and ${upperQuantile.toFixed(4)}`);
    expect(lesson).toContain(`{${upperQuantile.toFixed(4)}}`);
    expect(lesson).toContain(`{${lowerQuantile.toFixed(4)}}`);
  });

  test("the lesson prints the interval's endpoints", () => {
    if (interval.kind !== "accepted") return;
    expect(lesson).toContain(
      `[${interval.data.lower.toFixed(4)},\\\\ ${interval.data.upper.toFixed(4)}]`,
    );
  });
});

describe("the inversion bias", () => {
  test("the lesson prints q/(q − 2) for q = 100 to six decimals", () => {
    const bias = inverseBias(100);
    expect(bias.kind).toBe("accepted");
    if (bias.kind !== "accepted") return;
    expect(prose).toContain(`q/(q − 2) = ${bias.data.meanFactor.toFixed(6)}`);
  });
});

describe("what an interval is not", () => {
  test("every sentence that gives an interval a chance or probability denies it", () => {
    // Anchored to sentences about an interval: "model uncertainty is the chance that the formula
    // does not fit" is a different claim, and an unanchored match flagged it.
    const sentences = prose.split(/(?<=[.:;])\s+/);
    const claims = sentences.filter(
      (s) => /\binterval\b/.test(s) && /\b(chance|probability) that\b/.test(s),
    );
    // Non-vacuity: the lesson does raise the point; a lesson that never did would pass the
    // loop below while saying nothing.
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) expect(claim, `"${claim}" must be a denial`).toMatch(/\bnot\b/);
  });
});
