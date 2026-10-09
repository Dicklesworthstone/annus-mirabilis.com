/**
 * HOW MANY CONTROLS HAVE A DOMAIN `validateDomain` CANNOT ENFORCE, as a ceiling that must come
 * down rather than an assertion that the debt exists.
 *
 * AGENTS.md asks that one schema generate "the controls, URL-state validation, unit formatting,
 * and test cases", and that out-of-domain inputs "are never silently clamped while the label shows
 * the requested value". Measured over the 270 declared parameters, 42 of them cannot get that from
 * their declaration, and the two kinds fail in OPPOSITE directions:
 *
 *   enumerated: []        27 controls. domain.ts guards on `enumerated.length > 0`, so an empty
 *                         list falls through to the min/max branch, and where those are absent
 *                         too the control admits everything. bm-08's `noiseMethod` has the real
 *                         domain "known or stationary" written in its `reason` and validates 999
 *                         and -42 as `inside`.
 *   enumerated: [strings] 15 controls. `validateDomain(spec, value: number)` compares members with
 *                         a numeric tolerance, so a string member matches no number and EVERY
 *                         value is refused. me-01's `notation`, whose own declared values are
 *                         "printed" and "modern", rejects 0, 1 and 7 alike.
 *
 * So one class checks nothing and the other refuses everything, and both read as a declared
 * domain. am-hr4z proposes a schema decision for the categorical case; this file does not take it.
 * It pins the size of the problem so the decision has a denominator and so neither class can grow
 * quietly while the question is open.
 *
 * THE COUNTS ARE CEILINGS, NOT EQUALITIES. A test that asserted 27 would go red the day somebody
 * fixed one, which is the brittleness this repository keeps paying for. These only fail upward.
 * The type is also wrong in a way worth recording: `NumericalDomain.enumerated` is declared
 * `readonly number[]` (schemas/experiment.ts:54) while 15 entries hold strings, so the type does
 * not describe the data and nothing rejected them.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { validateDomain } from "./domain.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

type Spec = {
  id?: unknown;
  modelDomain?: { enumerated?: unknown; min?: unknown; max?: unknown; reason?: unknown };
  visualRange?: { min?: number; max?: number };
};

type Class =
  | "enumerated-empty"
  | "enumerated-string"
  | "enumerated-number"
  | "bounded"
  | "unbounded";

function classify(spec: Spec): Class {
  const e = spec.modelDomain?.enumerated;
  if (Array.isArray(e) && e.length === 0) return "enumerated-empty";
  if (Array.isArray(e) && e.some((v) => typeof v === "string")) return "enumerated-string";
  if (Array.isArray(e)) return "enumerated-number";
  if (spec.modelDomain?.min !== undefined || spec.modelDomain?.max !== undefined) return "bounded";
  return "unbounded";
}

function parameters(): { lab: string; spec: Spec }[] {
  const dir = join(ROOT, "content/experiments");
  const out: { lab: string; spec: Spec }[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const manifest = loadYaml(readFileSync(join(dir, file), "utf8")) as { parameters?: Spec[] };
    for (const spec of manifest.parameters ?? [])
      out.push({ lab: file.replace(/\.yaml$/, ""), spec });
  }
  return out;
}

describe("how many declared domains validateDomain can actually enforce", () => {
  const all = parameters();
  const counts = new Map<Class, string[]>();
  for (const { lab, spec } of all) {
    const c = classify(spec);
    counts.set(c, [...(counts.get(c) ?? []), `${lab}/${String(spec.id)}`]);
  }
  const n = (c: Class) => (counts.get(c) ?? []).length;

  test("the census, with its denominator", () => {
    console.log(
      `[census] parameter-domains examined ${all.length} declared parameters (minimum 250): ` +
        `${n("bounded")} bounded, ${n("enumerated-number")} enumerated by number, ` +
        `${n("enumerated-string")} enumerated by string, ${n("enumerated-empty")} enumerated-empty, ` +
        `${n("unbounded")} unbounded`,
    );
    expect(all.length).toBeGreaterThanOrEqual(250);
    // Non-vacuity: the enforceable majority must exist, or a corpus of nothing but broken domains
    // would satisfy the ceilings below.
    expect(n("bounded")).toBeGreaterThan(100);
  });

  test("CEILING: controls whose domain cannot be enforced only ever goes down", () => {
    const unenforceable = n("enumerated-empty") + n("enumerated-string");
    console.log(`[census] ${unenforceable} of ${all.length} declared domains are unenforceable`);
    // 42 at 2026-10-09. Lower it when the count drops; never raise it. am-hr4z owns the schema
    // decision that would let the 15 string domains be declared and checked properly.
    expect(unenforceable).toBeLessThanOrEqual(42);
    expect(n("enumerated-empty")).toBeLessThanOrEqual(27);
    expect(n("enumerated-string")).toBeLessThanOrEqual(15);
  });

  test("an empty enumerated list admits values its own reason excludes", () => {
    // Documented against the live spec, so the day it is repaired this test says so by failing.
    const noiseMethod = all.find((p) => p.lab === "bm-08" && p.spec.id === "noiseMethod")?.spec;
    expect(noiseMethod).toBeDefined();
    expect(noiseMethod?.modelDomain?.enumerated).toEqual([]);
    expect(String(noiseMethod?.modelDomain?.reason)).toBe("known or stationary");
    // Two admissible methods, and the validator says -42 is inside.
    const verdict = validateDomain(noiseMethod as never, -42);
    expect(verdict.valid).toBe(true);
    expect(verdict.status).toBe("inside");
  });

  test("a string enumerated list refuses every value, including its own", () => {
    const notation = all.find((p) => p.lab === "me-01" && p.spec.id === "notation")?.spec;
    expect(notation).toBeDefined();
    expect(notation?.modelDomain?.enumerated).toEqual(["printed", "modern"]);
    // validateDomain takes a number; no number is "printed", so the control's whole domain is out.
    for (const value of [0, 1, 7])
      expect(validateDomain(notation as never, value).valid).toBe(false);
  });
});
