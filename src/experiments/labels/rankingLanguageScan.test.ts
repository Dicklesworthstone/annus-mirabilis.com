/**
 * am-inst-execution-labels-5ywv: "no interface string produced by this bead describes a rung
 * as higher, lower, better, stronger, or partial." No parity-rung rendering exists here yet
 * (am-rt-determinism-fallbacks-8i4, which owns the rung and comparison-kind vocabulary, is
 * still open), so this scan currently guards the four label strings and any other literal
 * this bead does produce; it is a permanent regression guard, not evidence the full rung
 * system is built.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LABELS_DIR = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN = /\b(higher|lower|better|stronger|partial)\b/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [full] : [];
  });
}

function stringLiterals(source: string): string[] {
  const literals: string[] = [];
  const pattern = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  for (const match of source.matchAll(pattern)) {
    literals.push(match[1] ?? match[2] ?? "");
  }
  return literals;
}

describe("rankingLanguageScan: no interface string in src/experiments/labels/ ranks a rung", () => {
  test("no string literal under src/experiments/labels/ contains higher, lower, better, stronger, or partial", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(LABELS_DIR)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const source = readFileSync(file, "utf8");
      for (const literal of stringLiterals(source)) {
        if (FORBIDDEN.test(literal)) offenders.push(`${file}: "${literal}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the four public label texts themselves are clean", () => {
    const texts = [
      "Ideal model, computed with FrankenSim",
      "Ideal model, host calculation",
      "Static worked example",
      "This experiment is unavailable on this device",
    ];
    for (const text of texts) expect(FORBIDDEN.test(text)).toBe(false);
  });
});
