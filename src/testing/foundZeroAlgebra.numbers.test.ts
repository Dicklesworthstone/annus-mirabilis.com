import { describe, expect, test } from "bun:test";
import { type ConstantSet, getConstantSet } from "../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../physics/reference/diffusion.ts";
import { allText, BRIDGES, bridge, explanationText } from "./foundZeroAlgebra.shared.ts";

/**
 * am-found-zero-algebra-rest-oipl: "Every displacement figure names its constant set; no bridge
 * text contains a bare '6.1 μm'", and the letter bridge's figures agree with the Brownian scenario:
 * the printed set gives 0.7948 μm at 1 s and 6.1564 μm at 60 s, and the modern Boltzmann constant
 * gives 0.7935 μm and 6.1467 μm (a = 0.5 μm, η = 1.35 × 10⁻³ Pa·s, T = 290.15 K).
 */

function lambdaMicrometres(set: ConstantSet, seconds: number): string {
  const D = stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, set).result;
  if (D.status !== "value" || typeof D.value !== "number") throw new TypeError(D.status);
  const lambda = rmsDisplacement(D.value, seconds).result;
  if (lambda.status !== "value" || typeof lambda.value !== "number")
    throw new TypeError(lambda.status);
  return (lambda.value * 1e6).toFixed(4);
}

/** A 6.1 μm with no further digits: a rounding that hides which constant set produced it. */
export function bareRoundings(text: string): readonly string[] {
  return [...text.matchAll(/(?<![\d.])6\.1(?!\d)\s*(μm|micrometres?)/g)].map((m) => m[0]);
}

const letter = allText(bridge("bridge-letter-for-quantity"));

describe("the letter bridge's figures are the scenario's, each with its set named", () => {
  for (const [setId, at1, at60] of [
    ["einstein-1905-brownian-printed", "0.7948", "6.1564"],
    ["modern-si-2019", "0.7935", "6.1467"],
  ] as const)
    test(`${setId}: ${at1} μm at 1 s and ${at60} μm at 60 s`, () => {
      const set = getConstantSet(setId);
      expect(lambdaMicrometres(set, 1)).toBe(at1);
      expect(lambdaMicrometres(set, 60)).toBe(at60);
      expect(letter).toContain(`${at1} μm`);
      expect(letter).toContain(`${at60} μm`);
      expect(letter).toContain(setId);
    });

  test("the explanation itself shows only the printed roundings, about 0.8 and about 6", () => {
    const text = explanationText(bridge("bridge-letter-for-quantity"));
    expect(text).toContain("about 0.8");
    expect(text).toContain("about 6");
    expect(text).not.toMatch(/0\.79|6\.15|6\.14/);
  });
});

describe("no bridge prints a bare 6.1 μm", () => {
  for (const slug of BRIDGES)
    test(slug, () => {
      expect(bareRoundings(allText(bridge(slug)))).toEqual([]);
    });

  test("the check finds one when it is there, and passes the full figures", () => {
    expect(bareRoundings("after a minute, about 6.1 μm")).toEqual(["6.1 μm"]);
    expect(bareRoundings("6.1 micrometres")).toEqual(["6.1 micrometres"]);
    expect(bareRoundings("6.1564 μm and 6.1467 μm")).toEqual([]);
  });
});

describe("the probability bridge keeps a probability, a frequency and a single trial apart", () => {
  const sentences = explanationText(bridge("bridge-probability-notation")).split(/(?<=\.)\s+/);
  test("1/4 is called a probability and 23/100 a frequency, in different sentences", () => {
    const quarter = sentences.filter((s) => s.includes("1/4") && /probability/.test(s));
    const count = sentences.filter((s) => s.includes("23/100") && /frequency/.test(s));
    expect(quarter.length).toBeGreaterThan(0);
    expect(count.length).toBeGreaterThan(0);
    expect(count.some((s) => /probability/.test(s))).toBe(false);
  });

  test("a single trial is said to either happen or not", () => {
    expect(sentences.some((s) => /single drop either/.test(s))).toBe(true);
  });
});
