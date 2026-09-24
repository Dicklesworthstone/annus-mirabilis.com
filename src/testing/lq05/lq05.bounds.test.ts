import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { LQ05_DEFAULTS } from "../../experiments/lq05/definition.ts";
import {
  LQ05_MAX_POINTS,
  LQ05_MAX_TRIALS,
  validateLq05Parameters,
} from "../../experiments/lq05/parameters.ts";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";

/**
 * The manifest declares n in [1, 60] and trials in [1, 1 000 000]. The validator used to enforce
 * only the lower ends, so a permalink with n = 1 000 000 reached the exact count's BigInt
 * arithmetic and threw out of memory. These bounds are the only guard a link cannot bypass.
 */
const check = (over: Record<string, unknown>) =>
  validateLq05Parameters({ ...LQ05_DEFAULTS, ...over });

describe("lq-05 enforces its declared domain", () => {
  test("the bounds are the manifest's model-domain maxima, read from lq-05.yaml", () => {
    const manifest = strictParse(
      readFileSync(
        fileURLToPath(new URL("../../../content/experiments/lq-05.yaml", import.meta.url)),
        "utf8",
      ),
      "yaml",
    ) as { parameters: { id: string; modelDomain?: { max?: number } }[] };
    const max = (id: string) => manifest.parameters.find((p) => p.id === id)?.modelDomain?.max;
    expect(LQ05_MAX_POINTS).toBe(max("n") as number);
    expect(LQ05_MAX_TRIALS).toBe(max("trials") as number);
  });

  test("n = 60 and trials = 1 000 000 are admitted", () => {
    expect(check({ n: 60 }).kind).toBe("accepted");
    expect(check({ trials: 1_000_000 }).kind).toBe("accepted");
  });

  for (const n of [61, 1000, 1_000_000, 0, 2.5, Number.NaN]) {
    test(`n = ${n} is refused with a sentence that says what to enter`, () => {
      const r = check({ n });
      expect(r.kind).toBe("refused");
      if (r.kind !== "refused") return;
      expect(refusalSentence(r.refusal)).toBe("Enter a whole number of points from 1 to 60.");
    });
  }

  test("trials above 1 000 000 are refused", () => {
    const r = check({ trials: 1_000_001 });
    expect(r.kind).toBe("refused");
    if (r.kind !== "refused") return;
    expect(refusalSentence(r.refusal)).toBe("Enter a whole number of trials from 1 to 1 000 000.");
  });
});
