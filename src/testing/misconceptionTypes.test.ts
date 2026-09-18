import { describe, expect, test } from "bun:test";
import {
  MisconceptionShapeError,
  parseWhatIsTrue,
  textForDetail,
} from "../reader/misconceptions/types.ts";

/**
 * am-read-misconception-callouts-a3o: `whatIsTrue` is `unknown` at the schema layer; this is the
 * local shape validated once at the render boundary (r0/r1/r2 required, r3 optional and shown
 * only under the modern lens).
 */
describe("parseWhatIsTrue", () => {
  test("accepts a well-formed r0/r1/r2 object, with r3 omitted when absent", () => {
    const content = parseWhatIsTrue(
      {
        r0: "Halving D halves the spread.",
        r1: "Halving D shrinks the spread by 1/sqrt(2).",
        r2: "lambda_x(D/2) = lambda_x(D) / sqrt(2)",
      },
      "misc-halving-d",
    );
    expect(content.r0).toBe("Halving D halves the spread.");
    expect(content.r1).toBe("Halving D shrinks the spread by 1/sqrt(2).");
    expect(content.r2).toBe("lambda_x(D/2) = lambda_x(D) / sqrt(2)");
    expect(content.r3).toBeUndefined();
  });

  test("keeps a present, non-empty r3 margin", () => {
    const content = parseWhatIsTrue(
      { r0: "a", r1: "b", r2: "c", r3: "sigma^2 is linear in D, not lambda itself" },
      "misc-x",
    );
    expect(content.r3).toBe("sigma^2 is linear in D, not lambda itself");
  });

  test("throws misconception-what-is-true-malformed when whatIsTrue is not an object", () => {
    expect(() => parseWhatIsTrue("just a string", "misc-x")).toThrow(MisconceptionShapeError);
    try {
      parseWhatIsTrue(null, "misc-x");
      throw new Error("expected parseWhatIsTrue to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MisconceptionShapeError);
      expect((err as MisconceptionShapeError).rule).toBe("misconception-what-is-true-malformed");
      expect((err as MisconceptionShapeError).message).toContain("misc-x");
    }
  });

  test("throws misconception-what-is-true-malformed when r0, r1, or r2 is missing or blank (types.ts:37)", () => {
    try {
      parseWhatIsTrue({ r0: "a", r1: "b" }, "misc-x");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MisconceptionShapeError);
      expect((err as MisconceptionShapeError).rule).toBe("misconception-what-is-true-malformed");
    }
    expect(() => parseWhatIsTrue({ r0: "a", r1: "b", r2: "  " }, "misc-x")).toThrow(
      MisconceptionShapeError,
    );
  });

  test("empty-string r3 is treated as absent, not as a malformed margin", () => {
    const content = parseWhatIsTrue({ r0: "a", r1: "b", r2: "c", r3: "  " }, "misc-x");
    expect(content.r3).toBeUndefined();
  });
});

describe("textForDetail", () => {
  const content = parseWhatIsTrue(
    { r0: "R0 text", r1: "R1 text", r2: "R2 text", r3: "R3 margin" },
    "misc-x",
  );

  test("selects r0/r1/r2 by Detail regardless of lens", () => {
    expect(textForDetail(content, 0, false).text).toBe("R0 text");
    expect(textForDetail(content, 1, false).text).toBe("R1 text");
    expect(textForDetail(content, 2, false).text).toBe("R2 text");
  });

  test("the R3 margin appears only under the modern lens", () => {
    expect(textForDetail(content, 1, false).margin).toBeUndefined();
    expect(textForDetail(content, 1, true).margin).toBe("R3 margin");
  });

  test("no margin under the modern lens when r3 was never supplied", () => {
    const withoutR3 = parseWhatIsTrue({ r0: "a", r1: "b", r2: "c" }, "misc-x");
    expect(textForDetail(withoutR3, 1, true).margin).toBeUndefined();
  });
});
