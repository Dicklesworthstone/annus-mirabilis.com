/**
 * THE REVIEWER-DIVERSITY CENSUS (am-rc1001-bridge-plan-pcjk.17).
 *
 * D-2026-09-25-agent-reviewed-translations makes a unit final after two rounds by "agents other
 * than its translator", and `validateAgentReview` enforces exactly that: a different reviewer ID.
 * Measured over the committed corpus, every reviewer ID differs and every reviewer MODEL does
 * not. This counts that, and refuses nothing: whether English units must carry a cross-family
 * round is decision D-B, which is the owner's, and enforcing it unasked would turn 821 final
 * units non-final in one commit.
 *
 * The census is asserted against the real corpus AND the arithmetic is asserted as a partition,
 * because a count that does not add up to its denominator is a count of something else.
 */
import { describe, expect, test } from "bun:test";
import { formatReviewerDiversity, measureReviewerDiversity } from "./reviewerDiversity.ts";

const ROOT = process.cwd();

describe("reviewer model diversity across the translation corpus", () => {
  test("the census over the real corpus, and it is a partition", () => {
    const census = measureReviewerDiversity(ROOT);
    console.log(formatReviewerDiversity(census));

    // Non-vacuity first: a census over an empty directory would report 0 cross-family and read
    // exactly like a corpus with no diversity.
    expect(census.units).toBeGreaterThanOrEqual(821);
    expect(census.rounds).toBeGreaterThanOrEqual(census.units * 2);

    // Every unit lands in exactly one bucket. A property, not a number, so it holds at any size.
    expect(census.crossFamily + census.sameFamilyOnly + census.undeclaredModel).toBe(census.units);

    // The state as measured 2026-10-10, which is what D-B is a decision about. This is an
    // equality on purpose and it is the one number here that SHOULD break on change: a unit
    // acquiring a cross-family round is exactly the event the owner's decision turns on, and it
    // must not land silently.
    expect(census.crossFamily).toBe(0);
    expect(census.undeclaredModel).toBe(0);
    expect([...census.modelIds.keys()]).toEqual(["claude-opus-5-5"]);
  });

  test("a cross-family reviewer is counted as one, so the census can report diversity", () => {
    // The positive control. Without it, a measure that returned 0 unconditionally would satisfy
    // the corpus assertion above for ever.
    const census = measureReviewerDiversity(`${ROOT}/src/content/checks/review/__fixtures__/mixed`);
    expect(census.units).toBe(3);
    expect(census.crossFamily).toBe(1);
    expect(census.sameFamilyOnly).toBe(1);
    expect(census.undeclaredModel).toBe(1);
  });

  test("an undeclared model id is its own bucket, never diversity", () => {
    // The trap `modelFamily.ts` exists to prevent: an id the table does not know could belong to
    // the translator's own family, so reading it as a different one would be the vacuous pass.
    const census = measureReviewerDiversity(`${ROOT}/src/content/checks/review/__fixtures__/mixed`);
    expect(census.crossFamily).toBe(1);
    expect(census.undeclaredModel).toBe(1);
  });

  test("the printed line names the population and says it is report only", () => {
    const line = formatReviewerDiversity(measureReviewerDiversity(ROOT));
    expect(line).toContain("examined 821 units");
    expect(line).toContain("with a different-family reviewer");
    expect(line).toContain("same-family only");
    // The sentence that keeps a reader from mistaking a report for a verdict.
    expect(line).toContain("Report only; decision D-B is the owner's");
  });
});
