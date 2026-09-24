import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { stripCommentsAndPreserveStrings } from "../../../scripts/rsc-client-boundary.ts";

/**
 * am-disc-exercise-checker-i4h2: "No code path in the module uses eval, Function, with, or string
 * timers (enforced by a static scan test), and no Math.random appears in the module or its
 * callers." security.test.ts scans for eval, Function and with. This file holds the rest: a timer
 * given a string of code, anywhere in the module, and Math.random in the module or in any file that
 * imports it. Callers are found from the import specifiers, resolved, not from a hand-kept list.
 * Comments are stripped first, so text explaining the rule never trips it.
 */

const ROOT = process.cwd();
const MODULE = "src/discovery/exercises";

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory())
      return name === "node_modules" || name.startsWith(".") || name === "generated"
        ? []
        : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Files whose relative import specifiers resolve into the module. */
function callers(): string[] {
  return sourceFiles("src").filter((file) => {
    if (file.startsWith(`${MODULE}/`)) return false;
    const code = stripCommentsAndPreserveStrings(readFileSync(join(ROOT, file), "utf8"));
    return [...code.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].some((m) => {
      const target = normalize(join(dirname(file), m[1] as string));
      return target === MODULE || target.startsWith(`${MODULE}/`);
    });
  });
}

const STRING_TIMER = /\b(?:setTimeout|setInterval)\s*\(\s*["'`]/g;
const RANDOM = /\bMath\s*\.\s*random\b/g;

export function stringTimers(source: string): string[] {
  return [...stripCommentsAndPreserveStrings(source).matchAll(STRING_TIMER)].map((m) => m[0]);
}
export function randomCalls(source: string): string[] {
  return [...stripCommentsAndPreserveStrings(source).matchAll(RANDOM)].map((m) => m[0]);
}

const moduleFiles = sourceFiles(MODULE);
const callerFiles = callers();

describe("the scan reaches the module and the files that call it", () => {
  test("module files and callers, found by resolving imports", () => {
    expect(moduleFiles.length).toBeGreaterThan(10);
    const found = callerFiles.map((f) => relative(ROOT, join(ROOT, f)));
    for (const expected of [
      "src/components/discover/ExercisePart.tsx",
      "src/components/discover/NumericPart.tsx",
      "src/discovery/brownian/numericExercises.ts",
    ])
      expect(found).toContain(expected);
  });
});

describe("no timer is given a string of code in the module", () => {
  for (const file of moduleFiles)
    test(file, () => {
      expect(stringTimers(readFileSync(join(ROOT, file), "utf8"))).toEqual([]);
    });
});

describe("no Math.random in the module or its callers", () => {
  for (const file of [...moduleFiles, ...callerFiles])
    test(file, () => {
      expect(randomCalls(readFileSync(join(ROOT, file), "utf8"))).toEqual([]);
    });
});

describe("the scans read code, not comments", () => {
  test("a string timer and Math.random in code are found; in comments they are not", () => {
    expect(stringTimers('setTimeout("run()", 10);')).toEqual(['setTimeout("']);
    expect(stringTimers("setInterval(`tick()`, 5);")).toEqual(["setInterval(`"]);
    expect(stringTimers("setTimeout(() => run(), 10);")).toEqual([]);
    expect(randomCalls("const r = Math.random();")).toEqual(["Math.random"]);
    expect(randomCalls("// never Math.random here\nconst a = 1;")).toEqual([]);
    expect(randomCalls("/* Math.random */ const a = 1;")).toEqual([]);
  });

  test("a trailing comment keeps the code before it, and a block comment the code after it", () => {
    expect(randomCalls("Math.random(); // explained")).toEqual(["Math.random"]);
    expect(randomCalls("/* a note */ Math.random();")).toEqual(["Math.random"]);
  });
});
