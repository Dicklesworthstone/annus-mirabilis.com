import { describe, expect, test } from "bun:test";
import { lessonText, sentences } from "./foundInference.shared.ts";

/**
 * am-found-statistics-inference-pzqv, foundInference.wording: "a wording check fails on phrases
 * equating a confidence interval with a posterior probability, and on any text calling the
 * synthetic exercise evidence for molecules. It also fails on text that calls the coefficient of φ
 * 'k' outside a quoted notation warning." Over the two lessons this bead owns.
 */

const LESSONS = ["error-and-inference", "two-measurements-two-unknowns"] as const;

/** A sentence that gives the interval, not the procedure, a probability of holding the unknown. */
export function intervalAsProbability(sentence: string): boolean {
  return (
    /probability (that )?(the )?(true|unknown|fixed)[^.]{0,60}\b(lies|is|falls) (in|inside|within)/i.test(
      sentence,
    ) ||
    /(95|ninety-five)[^.]{0,30}(per ?cent|%)[^.]{0,20}(chance|probability) that (the )?(true|unknown|fixed)/i.test(
      sentence,
    ) ||
    /\bthis interval (has|carries) a[^.]{0,20}(chance|probability)/i.test(sentence)
  );
}

/** A sentence about made-up data that calls it evidence for molecules without denying it. */
export function syntheticAsEvidence(sentence: string): boolean {
  const synthetic = /\b(synthetic|made[- ]up|generator)\b/i.test(sentence);
  const evidence = /\b(evidence|proof|proves|shows?)\b[^.]{0,40}\b(molecules?|atoms?)\b/i.test(
    sentence,
  );
  const denied = /\b(not|never|no|nothing)\b/i.test(sentence);
  return synthetic && evidence && !denied;
}

/** The coefficient of φ named k, which is Einstein's letter for the viscosity itself. */
export function coefficientCalledK(sentence: string): boolean {
  // Only the coefficient OF φ: "the diffusion coefficient … with k the liquid's viscosity" is right.
  return (
    /coefficient\s+k\s+of\s+(φ|\\varphi)/i.test(sentence) ||
    /coefficient of (φ|\\varphi)[^.]{0,40}\bk\b/i.test(sentence) ||
    /\bk\b[^.]{0,30}coefficient of (φ|\\varphi)/i.test(sentence)
  );
}

describe("the two lessons pass the three wording rules", () => {
  for (const slug of LESSONS)
    test(slug, () => {
      const all = sentences(lessonText(slug));
      expect(all.length).toBeGreaterThan(10);
      expect(all.filter(intervalAsProbability)).toEqual([]);
      expect(all.filter(syntheticAsEvidence)).toEqual([]);
      expect(all.filter(coefficientCalledK)).toEqual([]);
    });
});

describe("each rule finds what it forbids, and passes what the lessons say", () => {
  test("interval as probability", () => {
    expect(
      intervalAsProbability(
        "There is a 95 per cent probability that the true value lies inside this interval.",
      ),
    ).toBe(true);
    expect(
      intervalAsProbability("The probability that the unknown D is in the interval is 0.95."),
    ).toBe(true);
    expect(
      intervalAsProbability(
        "The procedure covers the true value in about 95 of every 100 repetitions.",
      ),
    ).toBe(false);
  });

  test("synthetic data as evidence", () => {
    expect(syntheticAsEvidence("The synthetic run is evidence for molecules.")).toBe(true);
    expect(
      syntheticAsEvidence(
        "The data here are made up, so the view tests the procedure, not molecules.",
      ),
    ).toBe(false);
  });

  test("the coefficient of φ called k", () => {
    expect(coefficientCalledK("The coefficient k of φ is 5/2.")).toBe(true);
    expect(coefficientCalledK("c the coefficient of φ in the viscosity law")).toBe(false);
    // Einstein's k is the viscosity; a sentence saying so beside "diffusion coefficient" is right.
    expect(
      coefficientCalledK(
        "The diffusion coefficient is D = RT/(N · 6πkP), with k the liquid's viscosity.",
      ),
    ).toBe(false);
  });
});
