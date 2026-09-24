import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOUNDATION_QUANTITIES } from "../equations/foundationQuantities.ts";

/**
 * am-found-linear-geometry-7w15: "a check fails if any of these records binds β to speedRatio or
 * writes 'β = v/c', and asserts the collision note is present at first use of γ." Einstein prints
 * the factor 1/√(1 − v²/c²) as β in the relativity and mass-energy papers, so a lesson that writes
 * γ must say so where γ first appears, or a reader arriving from the paper reads β as v/c.
 */

const CLUSTER = [
  "vectors-components",
  "matrices-linear-maps",
  "hyperbolic-functions-rapidity",
  "dot-cross-products",
  "conservation-symmetry",
] as const;
const ROOT = process.cwd();

/** A lesson's reader-facing text in reading order: question, summary, explanation, example, stop. */
function readingOrder(id: string): string {
  const record = JSON.parse(readFileSync(join(ROOT, "content/foundations", `${id}.json`), "utf8"));
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  for (const key of [
    "question",
    "summary",
    "explanation",
    "exampleTitle",
    "example",
    "stoppingPoint",
  ])
    walk(record[key]);
  return out.join(" ");
}

/**
 * Where γ first appears, whether a note that the paper prints it as β follows within 300
 * characters. Null when the text never uses γ.
 */
export function firstGammaNoted(text: string): boolean | null {
  const first = text.search(/γ|\\gamma\b/);
  if (first < 0) return null;
  return /prints?[^.]{0,80}\bas β|prints? γ as β|β[^.]{0,40}\bis (today's|the modern) γ/.test(
    text.slice(first, first + 300),
  );
}

describe("the collision note stands at the first γ of every lesson that uses γ", () => {
  for (const id of CLUSTER)
    test(id, () => {
      const noted = firstGammaNoted(readingOrder(id));
      if (noted !== null) expect(noted).toBe(true);
    });

  test("at least three of the five use γ, so the rule is not checked over nothing", () => {
    expect(
      CLUSTER.filter((id) => firstGammaNoted(readingOrder(id)) !== null).length,
    ).toBeGreaterThanOrEqual(3);
  });

  test("the check fails a γ with no note, and passes the lessons' own wording", () => {
    expect(firstGammaNoted("At 0.6c, γ = 1.25, so the clock runs slow.")).toBe(false);
    expect(firstGammaNoted("γ = 1.25 (the factor the relativity paper prints as β).")).toBe(true);
    expect(firstGammaNoted("No factor appears here.")).toBeNull();
  });
});

describe("β is never bound to v/c", () => {
  test("no equation record of the cluster binds speedRatio, which carries the glyph β", () => {
    const dir = join(ROOT, "content/equations/foundations");
    const bound = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
      .filter((r) => (CLUSTER as readonly string[]).includes(r.argument))
      .filter((r) => JSON.stringify(r.tree).includes('"quantityId":"speedRatio"'))
      .map((r) => r.id);
    expect(bound).toEqual([]);
  });

  test("the foundations registry gives β only to Wien's constant, paper 1's own β", () => {
    // The notation concordance: in paper 1, β is Wien's constant h/k_B, which the radiation lesson
    // uses. No speed ratio may take the glyph.
    const betas = Object.values(FOUNDATION_QUANTITIES).filter((q) => /^\\?beta$|^β$/.test(q.glyph));
    expect(betas.map((q) => q.id)).toEqual(["wienConstantBeta"]);
  });

  test("no lesson of the cluster writes β = v/c", () => {
    for (const id of CLUSTER) expect(readingOrder(id), id).not.toMatch(/β\s*=\s*v\s*\/\s*c/);
  });
});
