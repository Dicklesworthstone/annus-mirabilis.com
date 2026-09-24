import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * am-found-transport-thermo-smv3: "Regime qualifications for Stokes drag and dilute osmotic
 * pressure appear in every relevant reading level." A lesson is read at four levels: the summary
 * (the overview), the explanation, the worked example, and the stopping point. The question is
 * exempt: it asks, and a qualification belongs to an answer.
 *
 * Until 2026-09-24 the osmotic lesson's summary stated the ideal-gas pressure without "dilute", and
 * its example ended "The pressure depends on the number of particles and the temperature, not on
 * their size or mass", an idealized law stated as if always true. "Ideal gas" names the analogy,
 * not the solution's regime, so it does not count here.
 */

const PARTS = ["summary", "explanation", "example", "stoppingPoint"] as const;

function partText(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "string") {
      if (key !== "latex") out.push(v);
    } else if (Array.isArray(v)) for (const x of v) walk(x, key);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(value);
  return out.join(" ");
}

/** The reading levels of `record` that carry none of `qualifiers`, each of which must match. */
export function partsLacking(
  record: Readonly<Record<string, unknown>>,
  qualifiers: readonly RegExp[],
): string[] {
  return PARTS.filter((part) => !qualifiers.every((q) => q.test(partText(record[part]))));
}

const lesson = (slug: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "content/foundations", `${slug}.json`), "utf8"));

/** Stokes drag holds for a sphere moving slowly (low Reynolds number) through the liquid. */
const STOKES = [/\b(slow|slowly|low reynolds|creeping)\b/i, /\b(sphere|spheres|spherical)\b/i];
/** The osmotic law is the dilute limit: particles few and far apart. */
const DILUTE = [/\b(dilute|few and far apart|far apart)\b/i];

describe("each reading level states the regime its law holds in", () => {
  test("Stokes drag: a slow sphere, in the summary, explanation, example and stopping point", () => {
    expect(partsLacking(lesson("viscosity-stokes-drag"), STOKES)).toEqual([]);
  });

  test("osmotic pressure: dilute, in the summary, explanation, example and stopping point", () => {
    expect(partsLacking(lesson("free-energy-osmotic-pressure"), DILUTE)).toEqual([]);
  });

  test("the check names the parts that lack a qualifier, and ignores the analogy", () => {
    const record = {
      summary: "Molecules push with the pressure an ideal gas would exert.",
      explanation: [{ kind: "paragraph", text: "In a dilute solution the law holds." }],
      example: [{ kind: "paragraph", text: "The pressure depends on the number of particles." }],
      stoppingPoint: "It holds while the solution is dilute.",
    };
    expect(partsLacking(record, DILUTE)).toEqual(["summary", "example"]);
    // A qualifier inside a formula is not read: the text around it must say so.
    expect(partsLacking({ ...record, summary: { latex: "\\text{dilute}" } }, DILUTE)).toContain(
      "summary",
    );
  });
});
