import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { ADVERSARIAL_PAIRS, FUNCTION_COVERAGE } from "./__fixtures__/adversarialPairs.ts";
import { checkEquivalence } from "./equivalence.ts";
import { ALLOWED_FUNCTIONS, parse } from "./grammar.ts";

/**
 * The adversarial corpus as a gate (am-disc-exercise-checker-i4h2): every entry must reach its
 * required verdict, and every allowed function must be covered by an entry or a recorded reason.
 */

const tree = (text: string, names: readonly string[]) => {
  const parsed = parse(text, new Set(names));
  expect(parsed.ok, `${text} parses`).toBe(true);
  return parsed.ok ? parsed.expr : ({ kind: "number", value: Number.NaN } as const);
};

describe("every corpus entry reaches its required verdict", () => {
  test("the corpus holds the six required kinds of case, and more than none", () => {
    const verdicts = new Set(ADVERSARIAL_PAIRS.map((p) => p.verdict));
    expect(verdicts).toEqual(new Set(["equivalent", "not-equivalent", "could-not-compare"]));
    expect(ADVERSARIAL_PAIRS.length).toBeGreaterThanOrEqual(6);
  });

  for (const pair of ADVERSARIAL_PAIRS) {
    test(`${pair.id}: ${pair.verdict}`, () => {
      const outcome = checkEquivalence(
        tree(pair.reader, pair.names),
        tree(pair.reference, pair.names),
        pair.domains,
        pair.tolerance,
      );
      expect(outcome.status, pair.reason).toBe(pair.verdict);
    });
  }
});

describe("the grid attack is real, so the corpus is not vacuous", () => {
  test("sin(32πx) vanishes on the binary grid and is 1 at x = 0.328125", () => {
    for (let k = 0; k <= 32; k++) {
      expect(withinTolerance(Math.sin(32 * Math.PI * (k / 32)), 0, { absolute: 1e-13 }).ok).toBe(
        true,
      );
    }
    expect(withinTolerance(Math.sin(32 * Math.PI * 0.328125), 1, { absolute: 1e-12 }).ok).toBe(
      true,
    );
  });
});

describe("the allow-list is covered", () => {
  test("every allowed function has a corpus entry that exists, or a recorded reason", () => {
    const ids = new Set(ADVERSARIAL_PAIRS.map((p) => p.id));
    for (const name of ALLOWED_FUNCTIONS) {
      const coverage = FUNCTION_COVERAGE[name];
      expect(coverage, `${name} is covered`).toBeDefined();
      if ("entry" in coverage) expect(ids.has(coverage.entry), coverage.entry).toBe(true);
      else expect(coverage.reason.length).toBeGreaterThan(20);
    }
  });
});
