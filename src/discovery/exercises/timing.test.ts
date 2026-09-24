import { describe, expect, test } from "bun:test";
import { parse } from "./grammar.ts";
import { normalize } from "./normalize.ts";

/**
 * am-disc-exercise-checker-i4h2: "Hostile inputs are rejected safely: median time at most 5 ms per
 * input over 100 runs, and no single run above 50 ms." Each input goes through the path a reader's
 * text takes before any evaluation, normalize then parse.
 *
 * Headroom measured on 2026-09-24 on this machine under a loaded swarm: medians near 0.01 ms and
 * worst runs under 1 ms, so the limits sit hundreds of times above the measurement and do not make
 * the test sensitive to load.
 */

const NAMES = new Set(["x", "D", "t"]);

/** Each hostile or oversized input, and whether the checker must refuse it. */
const HOSTILE: readonly (readonly [string, string, boolean])[] = [
  ["parentheses 40 deep", `${"(".repeat(40)}1${")".repeat(40)}`, true],
  ["square roots 31 deep", `${"sqrt(".repeat(31)}x${")".repeat(31)}`, true],
  ["a power tower", `${"x^".repeat(60)}2`, true],
  // Large but lawful: within the node and length limits, so accepted, and still fast.
  ["one hundred terms", `${"1+".repeat(99)}1`, false],
  ["a 199-digit number", "9".repeat(199), false],
  ["a 201-character input", `x${"+x".repeat(100)}`, true],
  ["right-to-left override characters", `${"\u202e".repeat(50)}x`, true],
  ["a prototype name", "constructor", true],
  ["an ordinary answer, for contrast", "2*sqrt(D*t)", false],
];

const RUNS = 100;

function timings(text: string): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const normalized = normalize(text);
    if (normalized.ok) parse(normalized.text, NAMES);
    out.push(performance.now() - start);
  }
  return out.sort((a, b) => a - b);
}

function refused(text: string): boolean {
  const normalized = normalize(text);
  return !normalized.ok || !parse(normalized.text, NAMES).ok;
}

describe("hostile inputs are refused quickly", () => {
  for (const [name, text, mustRefuse] of HOSTILE) {
    test(`${name}: median at most 5 ms and every run under 50 ms over ${RUNS} runs`, () => {
      const t = timings(text);
      expect(t.length).toBe(RUNS);
      const median = t[Math.floor(RUNS / 2)] ?? Number.POSITIVE_INFINITY;
      const worst = t[RUNS - 1] ?? Number.POSITIVE_INFINITY;
      expect(median).toBeLessThanOrEqual(5);
      expect(worst).toBeLessThan(50);
      expect(refused(text)).toBe(mustRefuse);
    });
  }
});
