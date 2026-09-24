import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stripCommentsAndPreserveStrings } from "../../../scripts/rsc-client-boundary.ts";

/**
 * am-disc-exercise-checker-i4h2: "Feedback never displays a score or attempt count, nothing leaves
 * the browser (network assertion)". The checker and the discover components reach no network API:
 * checking an answer is computed where the reader is. This reads code, not text: comments are
 * stripped first, so a comment explaining the rule does not trip it, and the stripper is proven in
 * both directions below. Measured separately on the live site (2026-09-24, 73a76c37): checking nine
 * answers on the four discover pages made 28 requests after load, every one a same-origin GET of a
 * static asset with no body and no query, none carrying the answer typed.
 */

const ROOT = process.cwd();
const DIRS = ["src/discovery/exercises", "src/components/discover"];
const FILES = DIRS.flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(dir, f)),
);

/** A call or constructor that sends something off the page. */
const NETWORK =
  /\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b|\bWebSocket\b|\bEventSource\b|\bnew\s+Image\s*\(|\bimport\s*\(\s*["'`]https?:/g;

export function networkCalls(source: string): string[] {
  return [...stripCommentsAndPreserveStrings(source).matchAll(NETWORK)].map((m) => m[0]);
}

describe("no network API in the checker or the discover components", () => {
  test("the scan reaches the checker's modules and the components that show verdicts", () => {
    expect(FILES.length).toBeGreaterThan(10);
    for (const expected of [
      "src/discovery/exercises/grammar.ts",
      "src/discovery/exercises/answer.ts",
      "src/components/discover/ExercisePart.tsx",
      "src/components/discover/NumericPart.tsx",
    ])
      expect(FILES).toContain(expected);
  });

  for (const file of FILES)
    test(file, () => {
      expect(networkCalls(readFileSync(join(ROOT, file), "utf8"))).toEqual([]);
    });
});

describe("the scan reads code, not comments", () => {
  test("a network call in code is found; the same words in a comment are not", () => {
    expect(networkCalls("const r = fetch('/x');")).toEqual(["fetch("]);
    expect(networkCalls("navigator.sendBeacon(u, d);")).toEqual(["sendBeacon"]);
    expect(networkCalls("const s = new WebSocket(u);")).toEqual(["WebSocket"]);
    expect(networkCalls("// never fetch( here\nconst a = 1;")).toEqual([]);
    expect(networkCalls("/* no XMLHttpRequest */ const a = 1;")).toEqual([]);
  });

  test("a trailing comment keeps the code before it, and a block comment the code after it", () => {
    expect(networkCalls("fetch(u); // explained")).toEqual(["fetch("]);
    expect(networkCalls("/* a note */ fetch(u);")).toEqual(["fetch("]);
  });
});
