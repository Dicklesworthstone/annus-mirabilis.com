import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The numbers the linear-geometry lessons print (am-found-linear-geometry-7w15), recomputed here and
 * required in each lesson's text at the precision it prints them, and the bead's glyph rule: no
 * record of this cluster writes β for v/c, because Einstein's β is the modern γ in the relativity
 * and mass-energy papers and Wien's constant in the light paper.
 */

const CLUSTER = [
  "vectors-components",
  "matrices-linear-maps",
  "dot-cross-products",
  "hyperbolic-functions-rapidity",
  "conservation-symmetry",
] as const;

const path = (id: string) => new URL(`../../content/foundations/${id}.json`, import.meta.url);

/** Every string a lesson shows, joined with spaces, with the \( \) inline-math delimiters removed. */
const lessonText = (id: string): string => {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(JSON.parse(readFileSync(path(id), "utf8")));
  return strings.join(" ").replace(/\\[()]/g, "");
};

const close = (actual: number, reference: number, relative = 1e-12) =>
  expect(withinTolerance(actual, reference, { relative }).ok).toBe(true);

describe("vectors and components", () => {
  const text = lessonText("vectors-components");
  const cos = 0.8;
  const sin = 0.6;

  test("0.6c along x, seen from axes turned so cos θ = 0.8, has components 0.48c and −0.36c", () => {
    const along = 0.6 * cos;
    const across = -0.6 * sin;
    expect(text).toContain(`= ${along.toFixed(2)}c along the new x axis`);
    expect(text).toContain(`= ${across.toFixed(2)}c along the new y axis`);
    // The axes are a real rotation: cos² + sin² = 1.
    close(cos ** 2 + sin ** 2, 1);
  });

  test("the arrow's length is 0.6 in both descriptions", () => {
    const length = Math.sqrt((0.6 * cos) ** 2 + (0.6 * sin) ** 2);
    close(length, 0.6);
    expect(text).toContain(`= ${length.toFixed(1)}, so the speed is 0.6c in both descriptions`);
  });

  test("the field of 5 units splits into 3 along the boost and 4 across it", () => {
    close(Math.hypot(3, 4), 5);
    expect(text).toContain("a parallel component of 3 and a perpendicular part of 4");
  });
});

describe("the β rule, over every lesson of the cluster that exists", () => {
  const present = CLUSTER.filter((id) => existsSync(path(id)));

  test("at least one lesson of the cluster exists, so the rule is not checked over nothing", () => {
    expect(present.length).toBeGreaterThan(0);
  });

  test("no lesson writes β for v/c, in words, symbols or LaTeX", () => {
    for (const id of present) {
      const text = lessonText(id);
      expect(text, id).not.toMatch(/(β|\\beta)\s*=\s*v\s*\/\s*c/);
      expect(text, id).not.toMatch(/v\s*\/\s*c\s*=\s*(β|\\beta)/);
    }
  });
});
