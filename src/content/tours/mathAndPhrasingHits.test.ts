/**
 * The detail-0 detector itself, tested without reading a single tour record.
 *
 * WHY IT LIVES APART FROM THE TOUR TESTS. `lightQuantaTour.test.ts` and `relativityTour.test.ts`
 * exercise this function through the records it gates, so if every record were removed or renamed
 * their calls would disappear with them and nothing would report that the detector had stopped
 * working. This file reads no content, which is the lane-independent half: it is about the
 * predicate, and it holds whatever the corpus does.
 *
 * WHAT IT WAS WRITTEN FOR. The symbol list carried `L/`, one hard-coded fraction bar, so
 * `(v/V) squared` passed and `special-relativity/s4-p6` would have been shown at detail 0 to a
 * reader the tour promises no equations. The rule is now general, and the cases below prove it in
 * BOTH directions, because a detector that flagged everything would also have made that plant red.
 */
import { describe, expect, test } from "bun:test";
import { mathAndPhrasingHits } from "./tours.ts";

/** The forms the four papers' R0 lines actually use, each with the token it must name. */
const FRACTIONS: readonly [string, string][] = [
  ["about half of t times (v/V) squared seconds, where t is the time the journey took", "v/V"],
  ["the energy density divided by R/N, with the gas constant above", "R/N"],
  ["the quantity RT/N appears wherever the thermal energy per particle is meant", "RT/N"],
  ["the composition carries a vw/V term in its denominator", "vw/V"],
  ["the ratio n/N of the parts to the whole", "n/N"],
];

/**
 * Prose a tour may legitimately show. Every one of these is drawn from the shape of real tour text:
 * dates with slashes are absent by convention, and no letter stands for a quantity.
 */
const CLEAN: readonly string[] = [
  "A clock carried from one place to another lags behind the one that stayed behind.",
  "The platform measures fifteen seventeenths of light speed, still below it.",
  "A rod 10 light-seconds long rides past at 0.6 of light speed.",
  "The trailing clock reads 6 seconds ahead of the leading one.",
  "Two equal light waves meet at the center of a screen.",
  "It rises to 1.6 times, which is the medium answer when the observer moves.",
  "Whether the force counts as electric or magnetic depends on the observer's state of motion.",
  "Einstein offers this as a point of view, not a proof, and says so in the paper.",
];

describe("the detail-0 detector", () => {
  test("names the fraction bar it found, in each form the papers use", () => {
    expect(FRACTIONS.length).toBeGreaterThanOrEqual(5);
    for (const [text, token] of FRACTIONS) {
      const hits = mathAndPhrasingHits(text);
      expect(hits, `${token} must be refused`).toContain(token);
    }
  });

  test("leaves ordinary tour prose alone", () => {
    // The other direction, and the reason it matters: a detector that refused everything would
    // satisfy the test above while making every tour unwritable.
    expect(CLEAN.length).toBeGreaterThanOrEqual(8);
    for (const text of CLEAN) expect(mathAndPhrasingHits(text), text).toEqual([]);
  });

  test("the hard-coded entry the general rule grew out of still works", () => {
    // `L/` also catches a bar followed by a digit, which the letters-only rule does not, so it is
    // kept rather than replaced. Both halves are asserted so neither can be dropped silently.
    expect(mathAndPhrasingHits("the energy L/2 taken from the body")).toContain("L/");
    expect(mathAndPhrasingHits("the energy L/c taken from the body")).toContain("L/");
  });

  test("the symbols and phrasings the beads name are still refused", () => {
    // A guard on the rest of the predicate, so adding the fraction rule cannot have displaced one.
    const cases: readonly [string, string][] = [
      ["the factor β appears here", "β"],
      ["the spectral density φ of the radiation", "φ"],
      ["a quantity measured in c² units", "c²"],
      ["the square root √ of the interval", "√"],
      ["it is written \\gamma in the source", "math markup"],
    ];
    for (const [text, token] of cases) expect(mathAndPhrasingHits(text), text).toContain(token);
    expect(mathAndPhrasingHits("mass converts into energy").length).toBeGreaterThan(0);
    expect(mathAndPhrasingHits("E = mc squared").length).toBeGreaterThan(0);
  });
});
