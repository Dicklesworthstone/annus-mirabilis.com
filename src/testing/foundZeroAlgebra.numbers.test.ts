import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ConstantSet, getConstantSet } from "../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../physics/reference/diffusion.ts";
import { allText, BRIDGES, bridge, explanationText } from "./foundZeroAlgebra.shared.ts";

const ROOT = process.cwd();

/**
 * am-found-zero-algebra-rest-oipl: "Every displacement figure names its constant set; no bridge
 * text contains a bare '6.1 μm'", and the letter bridge's figures agree with the Brownian scenario:
 * the printed set gives 0.7948 μm at 1 s and 6.1564 μm at 60 s, and the modern Boltzmann constant
 * gives 0.7935 μm and 6.1467 μm (a = 0.5 μm, η = 1.35 × 10⁻³ Pa·s, T = 290.15 K).
 */

function lambdaMicrometres(set: ConstantSet, seconds: number): string {
  const D = stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, set).result;
  if (D.status !== "value" || typeof D.value !== "number") throw new TypeError(D.status);
  const lambda = rmsDisplacement(D.value, seconds).result;
  if (lambda.status !== "value" || typeof lambda.value !== "number")
    throw new TypeError(lambda.status);
  return (lambda.value * 1e6).toFixed(4);
}

/**
 * A 6.1 μm with no further digits: a rounding that hides which constant set produced it, since
 * the printed set gives 6.1564 and the modern one 6.1467 and both round to 6.1.
 *
 * THE ALTERNATION COVERS THE SPELLINGS THIS CORPUS ACTUALLY USES, which is not the same as the
 * spellings a rule is written in. Measured 2026-10-11 over 6,533 tracked files: `micron` appears
 * 187 times, and the earlier alternation of `μm|micrometres?` could not match it, so a bare
 * "6.1 micron" would have passed every run. The same held for the ASCII `um`, which
 * `src/content/results/printedChecks.ts` itself writes. This is the inflection half of the
 * anchoring rule in AGENTS.md: a pattern built from the rule's own wording fails toward whatever
 * the authors happen to write instead, and it fails SILENTLY, because a sweep that cannot match
 * prints the same zero as a corpus with nothing to find.
 */
export function bareRoundings(text: string): readonly string[] {
  return [...text.matchAll(/(?<![\d.])6\.1(?!\d)\s*(μm|um\b|micrometres?|microns?)/g)].map(
    (m) => m[0],
  );
}

/** Every reader-facing content record, with its repository-relative path. */
function contentRecords(): readonly Readonly<{ path: string; text: string }>[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(json|ya?ml)$/.test(entry.name))
        out.push({ path: full.slice(ROOT.length + 1), text: readFileSync(full, "utf8") });
    }
  };
  walk(join(ROOT, "content"));
  return out;
}

const letter = allText(bridge("bridge-letter-for-quantity"));

describe("the letter bridge's figures are the scenario's, each with its set named", () => {
  for (const [setId, at1, at60] of [
    ["einstein-1905-brownian-printed", "0.7948", "6.1564"],
    ["modern-si-2019", "0.7935", "6.1467"],
  ] as const)
    test(`${setId}: ${at1} μm at 1 s and ${at60} μm at 60 s`, () => {
      const set = getConstantSet(setId);
      expect(lambdaMicrometres(set, 1)).toBe(at1);
      expect(lambdaMicrometres(set, 60)).toBe(at60);
      expect(letter).toContain(`${at1} μm`);
      expect(letter).toContain(`${at60} μm`);
      expect(letter).toContain(setId);
    });

  test("the explanation itself shows only the printed roundings, about 0.8 and about 6", () => {
    const text = explanationText(bridge("bridge-letter-for-quantity"));
    expect(text).toContain("about 0.8");
    expect(text).toContain("about 6");
    expect(text).not.toMatch(/0\.79|6\.15|6\.14/);
  });
});

describe("no bridge prints a bare 6.1 μm", () => {
  for (const slug of BRIDGES)
    test(slug, () => {
      expect(bareRoundings(allText(bridge(slug)))).toEqual([]);
    });

  test("the check finds one when it is there, and passes the full figures", () => {
    expect(bareRoundings("after a minute, about 6.1 μm")).toEqual(["6.1 μm"]);
    expect(bareRoundings("6.1 micrometres")).toEqual(["6.1 micrometres"]);
    expect(bareRoundings("6.1564 μm and 6.1467 μm")).toEqual([]);
  });

  test("and in each spelling the corpus uses, not only the one the rule was written in", () => {
    expect(bareRoundings("about 6.1 micron")).toEqual(["6.1 micron"]);
    expect(bareRoundings("about 6.1 microns")).toEqual(["6.1 microns"]);
    expect(bareRoundings("about 6.1 um")).toEqual(["6.1 um"]);
    // Not a bare rounding: a longer number, or a different quantity that merely starts 6.1.
    expect(bareRoundings("6.1467 microns")).toEqual([]);
    expect(bareRoundings("N = 6.1705 \u00d7 10^23 per gram-molecule")).toEqual([]);
  });
});

/**
 * THE SAME QUESTION, ASKED OF EVERY READER-FACING RECORD RATHER THAN OF FOUR.
 *
 * The block above examines BRIDGES, which is four records. The defect it forbids -- a 60-second
 * displacement rounded to 6.1, where the printed and modern constant sets disagree in the third
 * decimal -- is an authoring defect available to EVERY record that quotes the figure, and
 * `docs/review/physics.md` states the obligation for all of them: "A 60 s displacement value is
 * always stated with its explicit constant set or as printed 'about 6'." Four of 45 foundations
 * were watching, and nothing under content/arguments, content/equation-explanations or
 * content/editorial was.
 *
 * It reads content/ AND NOT src/, deliberately. Run corpus-wide on 2026-10-11 the predicate
 * returned 16 hits and every one of them was inside a test or a checker -- prose DESCRIBING the
 * forbidden rounding, in the files whose job is to forbid it. A gate pointed at its own
 * explanation goes red on the documentation that makes it reviewable, which AGENTS.md records as
 * having happened three times here already. Reader-facing prose is the population; the gates'
 * commentary is not.
 *
 * The floor is why this cannot go quietly vacuous: content/ held 2,790 records when this landed,
 * and a run that examines a handful has lost its directory, not earned a pass.
 */
describe("no reader-facing record prints a bare 6.1 μm either", () => {
  const records = contentRecords();

  test(`[census] examined ${records.length} content records (minimum 2000)`, () => {
    expect(records.length).toBeGreaterThanOrEqual(2000);
  });

  test("none of them carries a bare rounding, in any spelling", () => {
    const found = records.flatMap(({ path, text }) =>
      bareRoundings(text).map((hit) => `${path}: ${hit}`),
    );
    expect(found).toEqual([]);
  });

  test("the sweep over that population can fail: a planted record is caught", () => {
    const planted = [
      ...records,
      { path: "content/planted.json", text: '{"r0":"after a minute, about 6.1 micron"}' },
    ];
    const found = planted.flatMap(({ path, text }) =>
      bareRoundings(text).map((hit) => `${path}: ${hit}`),
    );
    expect(found).toEqual(["content/planted.json: 6.1 micron"]);
  });
});

describe("the probability bridge keeps a probability, a frequency and a single trial apart", () => {
  const sentences = explanationText(bridge("bridge-probability-notation")).split(/(?<=\.)\s+/);
  test("1/4 is called a probability and 23/100 a frequency, in different sentences", () => {
    const quarter = sentences.filter((s) => s.includes("1/4") && /probability/.test(s));
    const count = sentences.filter((s) => s.includes("23/100") && /frequency/.test(s));
    expect(quarter.length).toBeGreaterThan(0);
    expect(count.length).toBeGreaterThan(0);
    expect(count.some((s) => /probability/.test(s))).toBe(false);
  });

  test("a single trial is said to either happen or not", () => {
    expect(sentences.some((s) => /single drop either/.test(s))).toBe(true);
  });
});
