import { describe, expect, test } from "bun:test";
import { checkVoice } from "../content/checks/voice/index.ts";
import { allText, BRIDGES, bridge, explanationText } from "./foundZeroAlgebra.shared.ts";

/**
 * am-found-zero-algebra-rest-oipl: "No bridge uses vocabulary such as linear, differential,
 * distribution, or invariant in its explanation", and every bridge passes the voice lint. A bridge
 * is for a reader who has none of that vocabulary yet.
 */

const ABSTRACT = /\b(linear(ly)?|differentials?|distributions?|invariant|invariance)\b/gi;

export function abstractWords(text: string): readonly string[] {
  return [...text.matchAll(ABSTRACT)].map((m) => m[0]);
}

describe("no abstract vocabulary in a bridge's explanation", () => {
  for (const slug of BRIDGES)
    test(slug, () => {
      expect(abstractWords(explanationText(bridge(slug)))).toEqual([]);
    });

  test("the check finds the words when they are there", () => {
    expect(abstractWords("A linear map keeps the distribution invariant.")).toEqual([
      "linear",
      "distribution",
      "invariant",
    ]);
    expect(abstractWords("a line, a distance, a variant")).toEqual([]);
  });
});

describe("every bridge passes the voice lint as prose", () => {
  for (const slug of BRIDGES)
    test(slug, () => {
      const errors = checkVoice(allText(bridge(slug)), { context: "prose" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
    });
});
