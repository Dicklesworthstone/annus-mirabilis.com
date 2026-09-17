import { describe, expect, it } from "bun:test";
import { allocateEquationIds } from "../content/ids.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

describe("Equation ID Allocation and Repeated Label Qualification", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  it("yields eq-s1-1, eq-2, and eq-s3-1 for labels (1), (2), (1) in different sections", () => {
    const fixtureEquations = [
      { section: "s1", printedLabel: "(1)" },
      { section: "s2", printedLabel: "(2)" },
      { section: "s3", printedLabel: "(1)" },
    ];

    const allocated = allocateEquationIds("sr", fixtureEquations);

    expect(allocated.length).toBe(3);
    expect(allocated[0]?.localId).toBe("eq-s1-1");
    expect(allocated[0]?.globalRecordId).toBe("eq-sr-s1-1");
    expect(allocated[0]?.pageAnchor).toBe("#eq-s1-1");

    expect(allocated[1]?.localId).toBe("eq-2");
    expect(allocated[1]?.globalRecordId).toBe("eq-sr-2");
    expect(allocated[1]?.pageAnchor).toBe("#eq-2");

    expect(allocated[2]?.localId).toBe("eq-s3-1");
    expect(allocated[2]?.globalRecordId).toBe("eq-sr-s3-1");
    expect(allocated[2]?.pageAnchor).toBe("#eq-s3-1");

    logger.log({
      testId: "repeated-printed-label-qualification",
      beadId: "am-cm-id-scheme-8bn",
      expected: ["eq-s1-1", "eq-2", "eq-s3-1"],
      actual: allocated.map((a) => a.localId),
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: { rule: "repeated-printed-label-forces-section-qualification" },
    });
  });

  it("falls back to the editorial eq-s<n>-d<j> form when a printed label repeats WITHIN one section (am-cm-id-scheme-8bn)", () => {
    // Two equations both printed "(1)" in section 3: section-qualification alone would give both
    // the same id (eq-s3-1), so each instead takes the editorial displayed-equation form.
    const fixtureEquations = [
      { section: "s3", printedLabel: "(1)" },
      { section: "s3", printedLabel: "(1)" },
      { section: "s3", displayIndex: 5 },
    ];

    const allocated = allocateEquationIds("sr", fixtureEquations);

    expect(allocated[0]?.localId).toBe("eq-s3-d1");
    expect(allocated[0]?.originalLabel).toBe("(1)");
    expect(allocated[1]?.localId).toBe("eq-s3-d2");
    expect(allocated[1]?.originalLabel).toBe("(1)");
    expect(new Set(allocated.map((a) => a.localId)).size).toBe(3);
    expect(allocated[2]?.localId).toBe("eq-s3-d5");

    logger.log({
      testId: "same-section-duplicate-label-editorial-fallback",
      beadId: "am-cm-id-scheme-8bn",
      expected: ["eq-s3-d1", "eq-s3-d2", "eq-s3-d5"],
      actual: allocated.map((a) => a.localId),
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: { rule: "same-section-duplicate-label-forces-editorial-form" },
    });
  });

  it("allocates unnumbered display equation IDs in section order", () => {
    const fixture = [
      { section: "s3", displayIndex: 1 },
      { section: "s3", displayIndex: 4 },
    ];

    const allocated = allocateEquationIds("bm", fixture);
    expect(allocated[0]?.localId).toBe("eq-s3-d1");
    expect(allocated[0]?.globalRecordId).toBe("eq-bm-s3-d1");
    expect(allocated[1]?.localId).toBe("eq-s3-d4");
    expect(allocated[1]?.globalRecordId).toBe("eq-bm-s3-d4");
  });
});
