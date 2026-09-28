/**
 * EVERY INSTRUMENT CAPTION'S NUMBERS, AGAINST ITS OWN WORKED EXAMPLE (am-83lc).
 *
 * am-83lc measured 1,068 numbers across 35 captions and no test that recomputed one of them: the
 * caption tests that exist assert substring presence, so a caption could quote every number wrong
 * and stay green. This is the first check that reads the numbers.
 *
 * WHICH HALF OF THE QUESTION IT ANSWERS is written at the top of captionNumbers.ts, along with the
 * three rules that decide the population. The short form: it asks whether a printed number occurs
 * among its instrument's example values at the caption's own precision. It does not ask whether the
 * number belongs in the sentence.
 *
 * THE FLOORS ARE COVERAGE, NOT AN ALLOWLIST. Each lab's floor is the number of its caption numbers
 * judged when this check was written. Nothing is exempted by them: a number that stops matching
 * takes the count below its floor and names the lab. They can only be raised by binding more of a
 * caption to its example, and lowering one is a visible edit to this file.
 *
 * THE NUMBERS ARE READ FROM THE CAPTION RECORDS, by importing each definition module, rather than
 * from rendered text. textContent joins without spaces, so a DOM extraction produces things like
 * "constant1.3806e-23" and a digit-anchored pattern reads them wrong.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type CaptionVerdict,
  judgeCaptionNumbers,
  significandOf,
  significantDigits,
  summarizeCaptionVerdict,
} from "./captionNumbers.ts";

const root = process.cwd();

/**
 * The instruments that have BOTH a caption and a generated worked example. The other captions are
 * outside this check's reach for a stated reason: with no example there is nothing to judge
 * against, and saying so is the point of reporting the denominator.
 */
const LABS = [
  "bm01",
  "bm04",
  "bm05",
  "bm06",
  "bm07",
  "bm08",
  "lq01",
  "lq04",
  "lq06",
  "lq08",
  "lq09",
  "me02",
  "sr02",
  "sr03",
  "sr05",
  "sr08",
  "sr09",
  "sr10",
  "sr11",
  "sr12",
  "sr13",
] as const;

/**
 * Judged when this check was written, per lab, measured on 2026-09-28 by this file's own first test
 * over 21 instruments: 707 numbers, 306 excluded as too coarse by rule, 242 judged, 159 unjudged.
 * The command is `bun test src/testing/captions/ --isolate --timeout 60000`, and it prints every
 * count beside its denominator on each run.
 *
 * bm01 and lq04 sit at zero honestly. bm01's caption carries five numbers and all five are below
 * three significant digits; lq04's six are all absent from its example. A floor of zero protects
 * nothing there and says so, rather than being written as a small positive number to look like
 * coverage.
 */
const JUDGED_FLOOR: Readonly<Record<string, number>> = {
  bm01: 0,
  bm04: 13,
  bm05: 8,
  bm06: 22,
  bm07: 17,
  bm08: 18,
  lq01: 6,
  lq04: 0,
  lq06: 29,
  lq08: 18,
  lq09: 16,
  me02: 2,
  sr02: 2,
  sr03: 6,
  sr05: 4,
  sr08: 14,
  sr09: 10,
  sr10: 9,
  sr11: 7,
  sr12: 14,
  sr13: 27,
};

/** Every string in a caption record, whatever readings it carries. */
function captionText(record: unknown): string {
  if (typeof record === "string") return record;
  if (Array.isArray(record)) return record.map(captionText).join(" \n ");
  if (record && typeof record === "object")
    return Object.values(record as Record<string, unknown>)
      .map(captionText)
      .join(" \n ");
  return "";
}

/** The example's declared parameters and its scalar results. Array results contribute nothing. */
function exampleScalars(lab: string): number[] {
  const example = JSON.parse(
    readFileSync(resolve(root, `src/generated/${lab}-example.json`), "utf8"),
  ) as { parameters?: Record<string, unknown>; results?: unknown[] };
  const scalars: number[] = [];
  for (const value of Object.values(example.parameters ?? {}))
    if (typeof value === "number") scalars.push(value);
  for (const entry of example.results ?? []) {
    const parsed = (typeof entry === "string" ? JSON.parse(entry) : entry) as { value?: unknown };
    const value =
      typeof parsed.value === "number"
        ? parsed.value
        : typeof parsed.value === "string"
          ? Number(parsed.value)
          : Number.NaN;
    if (Number.isFinite(value)) scalars.push(value);
  }
  return scalars;
}

const verdicts = new Map<string, CaptionVerdict>();
for (const lab of LABS) {
  const module = (await import(`../../experiments/${lab}/definition.ts`)) as Record<
    string,
    unknown
  >;
  const captions = Object.entries(module)
    .filter(([name]) => name.endsWith("_CAPTION"))
    .map(([, value]) => captionText(value));
  verdicts.set(lab, judgeCaptionNumbers(captions.join(" \n "), exampleScalars(lab)));
}

describe("instrument caption numbers against their worked examples (am-83lc)", () => {
  test("the counts are reported with their denominator, and the population is not empty", () => {
    let population = 0;
    let tooCoarse = 0;
    let judged = 0;
    let unjudged = 0;
    for (const lab of LABS) {
      const verdict = verdicts.get(lab);
      if (verdict === undefined) throw new Error(`no verdict for ${lab}`);
      console.log(`[caption numbers] ${summarizeCaptionVerdict(lab, verdict)}`);
      population += verdict.population;
      tooCoarse += verdict.tooCoarse.length;
      judged += verdict.judged.length;
      unjudged += verdict.unjudged.length;
    }
    console.log(
      `[caption numbers] ${LABS.length} instruments with an example: ${population} numbers, ` +
        `${tooCoarse} excluded as too coarse by rule, ${judged} judged against the example, ` +
        `${unjudged} unjudged because no example scalar carries them`,
    );
    // Non-vacuity, on purpose: a run that read no caption would report zero of everything and be
    // indistinguishable from a clean one.
    expect(population).toBeGreaterThan(0);
    expect(judged).toBeGreaterThan(0);
    expect(population).toBe(tooCoarse + judged + unjudged);
  });

  test("no instrument judges fewer numbers than it did when this check was written", () => {
    const fallen: string[] = [];
    for (const lab of LABS) {
      const verdict = verdicts.get(lab);
      if (verdict === undefined) throw new Error(`no verdict for ${lab}`);
      const floor = JUDGED_FLOOR[lab] ?? 0;
      if (verdict.judged.length < floor)
        fallen.push(
          `${lab}: ${verdict.judged.length} judged, floor ${floor}. Its unjudged numbers are ` +
            `[${verdict.unjudged.join(", ")}] - one of them is the number that stopped matching.`,
        );
    }
    expect(fallen).toEqual([]);
  });
});

describe("the rules that decide the population", () => {
  test("significantDigits counts printed digits, leading zeros excluded", () => {
    expect(significantDigits("0.0625")).toBe(3);
    expect(significantDigits("1.250")).toBe(4);
    expect(significantDigits("9.865e-13")).toBe(4);
    expect(significantDigits("0.6")).toBe(1);
  });

  test("significandOf strips the decimal exponent, so a unit change is not a mismatch", () => {
    expect(significandOf(9.865e-13)).toBeCloseTo(9.865, 10);
    expect(significandOf(0.9865)).toBeCloseTo(9.865, 10);
    expect(significandOf(0)).toBe(0);
  });

  test("a number matches at the caption's precision, and not at more than it prints", () => {
    // 9.865 printed to four digits accepts a value that rounds to it and refuses one that does not.
    expect(judgeCaptionNumbers("0.9865", [9.8653e-13]).judged).toEqual(["0.9865"]);
    expect(judgeCaptionNumbers("0.9865", [9.8659e-13]).unjudged).toEqual(["0.9865"]);
    // The same digits at a coarser printing accept more, which is what fewer printed digits mean.
    expect(judgeCaptionNumbers("0.986", [9.8592e-13]).judged).toEqual(["0.986"]);
  });

  test("the three exclusion rules are rules, and each is shown excluding and admitting", () => {
    // Rule 1: no decimal point and no exponent, so a year, a count and a section number are not
    // in the population at all; the same digits with a point are.
    expect(judgeCaptionNumbers("in 1905 across 2000 walkers in section 4", []).population).toBe(0);
    expect(judgeCaptionNumbers("1905.0", []).population).toBe(1);
    // Rule 2: below three significant digits, excluded as too coarse rather than judged.
    expect(judgeCaptionNumbers("0.6", [6e-1]).tooCoarse).toEqual(["0.6"]);
    expect(judgeCaptionNumbers("0.600", [6e-1]).judged).toEqual(["0.600"]);
    // Rule 3 is enforced by the caller, which passes scalars only; with no scalars to match, a
    // number in the population is unjudged and never silently passed.
    expect(judgeCaptionNumbers("1.25", []).unjudged).toEqual(["1.25"]);
  });
});
