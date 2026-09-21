import { describe, expect, test } from "bun:test";
import { populationLine, summarize } from "./types.ts";

/**
 * am-1hst. An audit that judged nothing has not passed.
 *
 * `summarize()` computed `ok` from the findings alone: no records meant no findings, meant no
 * errors, meant ok. The prose was already honest - populationLine says "no records to judge."
 * - so the two halves of one report disagreed. A person reading the printed line saw the
 * truth; a script reading `ok` never saw that sentence at all.
 *
 * That split is what makes this worse than the earlier instances of the class, where the
 * prose and the verdict at least agreed with each other. So the prose is deliberately asserted
 * UNCHANGED below: the fix must not be paid for by making the honest sentence vaguer.
 */
describe("summarize consults the population it was given (am-1hst)", () => {
  test("a declared population of zero is NOT ok, and still says so in words", () => {
    const report = summarize("readings", [], { total: 0, judged: 0, notYetAuditable: 0 });

    // The boolean a script reads.
    expect(report.ok).toBe(false);
    // The sentence a person reads, unchanged and still honest.
    expect(populationLine(report)).toBe("readings audit: no records to judge.");
    // And it is not ok for the usual reason: there are no findings to object to.
    expect(report.errorCount).toBe(0);
    expect(report.findings).toEqual([]);
  });

  test("a real population with no errors is still ok, and its line is untouched", () => {
    // The other half. Without it the change could have been "always false", which would pass
    // the test above and break every audit in the tree.
    const report = summarize("readings", [], { total: 24, judged: 21, notYetAuditable: 3 });
    expect(report.ok).toBe(true);
    expect(populationLine(report)).toBe(
      "readings audit: 21 of 24 records judged against the full rule, 3 recorded as not yet auditable.",
    );

    // The instruments shape verify-content prints on the same run.
    const instruments = summarize("instruments", [], { total: 38, judged: 4, notYetAuditable: 34 });
    expect(instruments.ok).toBe(true);
    expect(populationLine(instruments)).toBe(
      "instruments audit: 4 of 38 records judged against the full rule, 34 recorded as not yet auditable.",
    );
  });

  test("a non-empty population with an error is not ok, so the old rule still applies", () => {
    const report = summarize(
      "readings",
      [{ check: "x", family: "audit", severity: "error", recordId: "r", message: "m" }],
      { total: 24, judged: 24, notYetAuditable: 0 },
    );
    expect(report.ok).toBe(false);
    expect(report.errorCount).toBe(1);
  });

  test("an audit that declares NO population keeps its previous behaviour", () => {
    // Deliberately unchanged, because it is a different proposition. Declaring no population
    // is making no claim about how much was looked at, and twelve of the fourteen callers do
    // exactly that. Declaring a population OF ZERO is a claim, and the claim is that nothing
    // was judged. Only the second is a failed audit.
    const clean = summarize("audit-shelf", []);
    expect(clean.ok).toBe(true);
    expect(populationLine(clean)).toBe(null);
    expect("population" in clean).toBe(false);

    const failing = summarize("audit-shelf", [
      { check: "x", family: "audit", severity: "error", recordId: "r", message: "m" },
    ]);
    expect(failing.ok).toBe(false);
  });

  test("a flag is not an error, with or without a population", () => {
    const flagged = summarize(
      "readings",
      [{ check: "x", family: "audit", severity: "flag", recordId: "r", message: "m" }],
      { total: 3, judged: 3, notYetAuditable: 0 },
    );
    expect(flagged.ok).toBe(true);
    expect(flagged.flagCount).toBe(1);
  });
});
