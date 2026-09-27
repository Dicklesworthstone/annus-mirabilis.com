/**
 * The printed-value records and their refusals (dispatch 302).
 *
 * Two halves, and the second is the one that matters. The first reads the live file and asserts what
 * it says about the five numbers. The second plants a bad record for every refusal code, because a
 * validator whose refusals are never exercised is a validator nobody knows still works: five of the
 * eight codes here are the ones a later author would actually hit.
 *
 * The live half asserts IDENTITY, not census. It names the five records by paper, anchor and latex,
 * which are permanent, rather than asserting that there are five: a sixth printed numeral found on a
 * plate tomorrow is correct work and must not turn this file red. What it does assert about the set
 * as a whole is the property the module exists for, that a value with a quantity never claims to be
 * that quantity, and that every record says something.
 */
import { describe, expect, test } from "bun:test";
import {
  InlineValuesError,
  inlineValuesByScope,
  loadInlineValues,
  parseInlineValues,
} from "./inlineValues.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const good = {
  paper: "light-quanta",
  anchor: "s9-p3",
  latex: "9{,}6 \\cdot 10^{12}",
  quantityId: "ionizationWorkPerGramEquivalent",
  note: "An upper limit on the ionization work per gram-equivalent, not a value of it.",
};

describe("the numbers the papers print in their prose", () => {
  const values = loadInlineValues(ROOT);

  test("the five bare numerals each carry a note, named by identity rather than counted", () => {
    const at = (paper: string, anchor: string, latex: string) =>
      values.find((v) => v.paper === paper && v.anchor === anchor && v.latex === latex);
    // Named one by one: these five are what the corpus measured as carrying nothing, and each is
    // permanent. Their number is not asserted, so a sixth may be added without a false red.
    expect(at("light-quanta", "s1-p3", "2/3")).toBeDefined();
    expect(at("light-quanta", "s2-p2", "= 1{,}62 \\cdot 10^{-24}")).toBeDefined();
    expect(at("light-quanta", "s9-p1", "1{,}9 \\cdot 10^{-5}")).toBeDefined();
    expect(at("light-quanta", "s9-p3", "9{,}6 \\cdot 10^{12}")).toBeDefined();
    expect(at("brownian-motion", "s5-p2", "6 \\cdot 10^{23}")).toBeDefined();
    expect(values.length).toBeGreaterThan(0);
  });

  test("the ratio is the one with no quantity, and it says why in its note", () => {
    const ratio = values.find((v) => v.latex === "2/3");
    // 2/3 is the ratio of two energies and the value of neither, so naming a quantity for it would
    // name one of the two and be wrong. This is the record that proves quantityId is optional on
    // purpose rather than by omission.
    expect(ratio?.quantityId).toBeUndefined();
    expect(ratio?.note.toLowerCase()).toContain("ratio");
  });

  test("a value that lights a quantity it does not equal says so", () => {
    // The mass of a hydrogen atom lights N and is the value of 1/N. A note that did not say so
    // would read as a value of N and be wrong by 47 orders of magnitude.
    const hydrogen = values.find((v) => v.latex === "= 1{,}62 \\cdot 10^{-24}");
    expect(hydrogen?.quantityId).toBe("avogadroConstant");
    expect(hydrogen?.note).toContain("1/N");
    // The bound on J is a bound and not a value, and its note carries the distinction.
    const bound = values.find((v) => v.latex === "9{,}6 \\cdot 10^{12}");
    expect(bound?.quantityId).toBe("ionizationWorkPerGramEquivalent");
    expect(bound?.note.toLowerCase()).toContain("limit");
  });

  test("every record says something, whatever else it carries", () => {
    for (const v of values) {
      expect(v.note.trim().length).toBeGreaterThanOrEqual(40);
      expect(v.anchor).not.toBe("");
    }
  });

  test("they are looked up by anchor and formula together", () => {
    const byScope = inlineValuesByScope(values, "brownian-motion");
    expect(byScope.get("s5-p2\u00006 \\cdot 10^{23}")?.quantityId).toBe("avogadroConstant");
    // A paper's map holds only that paper: light quanta's four do not leak into Brownian's.
    expect([...byScope.values()].every((v) => v.paper === "brownian-motion")).toBe(true);
    expect(byScope.get("s9-p3\u00009{,}6 \\cdot 10^{12}")).toBeUndefined();
  });
});

describe("each refusal fires on its own defect", () => {
  const code = (raw: unknown): string => {
    try {
      parseInlineValues(raw, "test");
      return "accepted";
    } catch (error) {
      return error instanceof InlineValuesError ? error.code : String(error);
    }
  };

  test("a good record is accepted, so the refusals below mean something", () => {
    // The positive control. Without it every assertion under here would pass on a parser that
    // refused everything.
    expect(code({ values: [good] })).toBe("accepted");
  });

  test("the file must hold a list", () => {
    expect(code({})).toBe("inline-values-not-a-list");
    expect(code({ values: "6 \\cdot 10^{23}" })).toBe("inline-values-not-a-list");
  });

  test("a record without its place is refused", () => {
    expect(code({ values: [{ ...good, paper: "" }] })).toBe("inline-values-no-paper");
    expect(code({ values: [{ ...good, anchor: undefined }] })).toBe("inline-values-no-anchor");
    expect(code({ values: [{ ...good, latex: "  " }] })).toBe("inline-values-no-latex");
  });

  test("a note is required, and a note that says nothing is refused", () => {
    expect(code({ values: [{ ...good, note: undefined }] })).toBe("inline-values-no-note");
    // "The value of J" names the quantity again and tells a reader nothing they did not have.
    expect(code({ values: [{ ...good, note: "The value of J." }] })).toBe(
      "inline-values-note-too-short",
    );
  });

  test("a quantity that is not an id is refused rather than passed to the registry", () => {
    expect(code({ values: [{ ...good, quantityId: "Avogadro constant" }] })).toBe(
      "inline-values-quantity-not-an-id",
    );
    expect(code({ values: [{ ...good, quantityId: "N" }] })).toBe(
      "inline-values-quantity-not-an-id",
    );
    // Absent is allowed: it is how a number with no quantity is recorded.
    expect(code({ values: [{ ...good, quantityId: undefined }] })).toBe("accepted");
  });

  test("one number cannot carry two notes", () => {
    // The second note is written past the floor on purpose: a shorter one is refused for its
    // length before the duplicate check is ever reached, which is how this fixture first failed.
    const other = {
      ...good,
      note: "A second note for the same number, written long enough to clear the floor.",
    };
    expect(code({ values: [good, other] })).toBe("inline-values-duplicate");
    // The same formula in another paragraph is a different number and is allowed.
    expect(code({ values: [good, { ...good, anchor: "s9-p1" }] })).toBe("accepted");
  });
});
