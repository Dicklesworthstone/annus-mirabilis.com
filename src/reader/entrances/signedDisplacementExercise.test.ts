import { describe, expect, test } from "bun:test";
import { withMode1904Guard } from "../../physics/reference/constants.ts";
import {
  DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT,
  doubleSignedDisplacements,
  evaluateSignedDisplacementDraft,
  evaluateSignedDisplacements,
  SIGNED_DISPLACEMENT_LIMIT,
} from "./signedDisplacementExercise.ts";

describe("the 1904 desk's accepted arithmetic examples", () => {
  test("the shared authored example preserves cancellation and both measures of magnitude", () => {
    const result = withMode1904Guard(() => evaluateSignedDisplacements([-3, -1, 1, 3]));
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.data).toEqual(DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT);
    expect(result.data.rows.map((row) => [row.displacement, row.absolute, row.square])).toEqual([
      [-3, 3, 9],
      [-1, 1, 1],
      [1, 1, 1],
      [3, 3, 9],
    ]);
    expect(result.data.totals.signedSum).toBe(0);
    expect(result.data.totals.meanSigned).toBe(0);
    expect(result.data.totals.meanAbsolute).toBe(2);
    expect(result.data.totals.meanSquare).toBe(5);
    expect(result.data.totals.rootMeanSquare).toBeCloseTo(2.2360679775, 10);
  });

  test("doubling any accepted displacements doubles the magnitude mean and quadruples the mean square", () => {
    const first = evaluateSignedDisplacements([-2, 0, 1, 5]);
    expect(first.kind).toBe("accepted");
    if (first.kind !== "accepted") return;
    expect(first.data.totals.meanSigned).toBe(1);
    expect(first.data.totals.meanAbsolute).toBe(2);
    expect(first.data.totals.meanSquare).toBe(7.5);
    const doubled = withMode1904Guard(() => doubleSignedDisplacements(first.data));
    expect(doubled.kind).toBe("accepted");
    if (doubled.kind !== "accepted") return;
    expect(doubled.data.entries).toEqual([-4, 0, 2, 10]);
    expect(doubled.data.totals.meanSigned).toBe(2);
    expect(doubled.data.totals.meanAbsolute).toBe(4);
    expect(doubled.data.totals.meanSquare).toBe(30);
    expect(first.data.entries).toEqual([-2, 0, 1, 5]);
  });

  test("all zero endpoints and oppositely directed endpoints are distinguished", () => {
    const result = evaluateSignedDisplacements([0, 0, 0, 0]);
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.data.totals.signedSum).toBe(
      DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT.totals.signedSum,
    );
    expect(result.data.totals.meanAbsolute).toBe(0);
    expect(result.data.totals.meanSquare).toBe(0);
    expect(DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT.totals.meanSquare).toBeGreaterThan(0);
  });

  test("accepted snapshots cannot change when the submitted array is changed", () => {
    const input = [-3, -1, 1, 3];
    const result = evaluateSignedDisplacements(input);
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    input[0] = 7;
    expect(result.data.entries[0]).toBe(-3);
    expect(Object.isFrozen(result.data)).toBe(true);
    expect(Object.isFrozen(result.data.entries)).toBe(true);
    expect(Object.isFrozen(result.data.rows)).toBe(true);
    expect(Object.isFrozen(result.data.rows[0])).toBe(true);
    expect(Object.isFrozen(result.data.totals)).toBe(true);
  });

  test("incomplete examples, nonfinite values, fractions and overflow are refused without rounding", () => {
    for (const input of [
      null,
      [],
      [1, 2, 3],
      [1, 2, 3, 4, 5],
      [1, 2, 3, Number.NaN],
      [1, 2, 3, Number.POSITIVE_INFINITY],
      [1, 2, 3, Number.NEGATIVE_INFINITY],
      [1, 2, 3, 0.5],
      [1, 2, 3, "4"],
      [1, 2, 3, SIGNED_DISPLACEMENT_LIMIT + 1],
      [1, 2, 3, -SIGNED_DISPLACEMENT_LIMIT - 1],
    ]) {
      const result = evaluateSignedDisplacements(input);
      expect(result.kind).toBe("refused");
      if (result.kind === "refused") expect(result.refusal.code).toBe("invalid-parameter");
    }
  });

  test("typed blanks and malformed/nonfinite numbers stay refusals instead of becoming zero", () => {
    for (const text of ["", "  ", "-", "1px", "NaN", "Infinity", "1e400", "0.5"]) {
      const result = evaluateSignedDisplacementDraft(["-3", "-1", "1", text]);
      expect(result.kind).toBe("refused");
      if (result.kind === "refused") expect(result.fieldIndex).toBe(3);
    }
    for (const malformed of [null, ["1", "2"], ["1", "2", "3", 4]]) {
      expect(evaluateSignedDisplacementDraft(malformed).kind).toBe("refused");
    }
    const accepted = evaluateSignedDisplacementDraft([" -3 ", "-1", "+1", "3.0"]);
    expect(accepted.kind).toBe("accepted");
    if (accepted.kind === "accepted")
      expect(accepted.data).toEqual(DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT);
  });

  test("the declared boundary keeps exact sums, and doubling past it is refused", () => {
    const result = evaluateSignedDisplacements([
      -SIGNED_DISPLACEMENT_LIMIT,
      -SIGNED_DISPLACEMENT_LIMIT,
      SIGNED_DISPLACEMENT_LIMIT,
      SIGNED_DISPLACEMENT_LIMIT,
    ]);
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.data.totals.signedSum).toBe(0);
    expect(result.data.totals.meanAbsolute).toBe(1_000_000);
    expect(result.data.totals.meanSquare).toBe(1_000_000_000_000);
    expect(doubleSignedDisplacements(result.data).kind).toBe("refused");
    expect(result.data.entries[0]).toBe(-1_000_000);
  });
});
