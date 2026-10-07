/**
 * Refusal coverage for `unknown-quantity` (am-muyh, am-16nj).
 *
 * `getQuantity` refuses anything that is not a registered id, and its docblock says what the
 * refusal is FOR: "never a label, a prefix, or a case-insensitive match". That rule is the whole
 * reason the project forbids binding a live term by human label, so it is worth a test that drives
 * each of the three near-misses rather than one that drives a nonsense string.
 *
 * It had none. The code is declared as a class property, `readonly code = "unknown-quantity"`, so
 * the scanner read the site as an untyped throw and no coverage was asked for (am-16nj).
 *
 * A measurement trap recorded because I fell into it while checking whether a test already existed:
 * `git grep unknown-quantity -- '*.test.ts'` returns three files, and NONE of them names this code.
 * They name `unknown-quantity-id` (a notation diagnostic) and `reader-description-unknown-quantity`.
 * A substring search for a kebab code matches every longer code containing it, which is the same
 * error this repository has recorded four times in other forms.
 */
import { describe, expect, test } from "bun:test";
import { getQuantity, isRegisteredQuantityId, UnknownQuantityError } from "./registry.ts";

/** A quantity id the registry really holds, read back from the registry rather than assumed. */
const KNOWN = "speedOfLight";

describe("unknown-quantity (registry.ts:174): exact lookup, and nothing else", () => {
  test("the accept half: a registered id resolves, which is what makes the refusals below mean something", () => {
    expect(isRegisteredQuantityId(KNOWN)).toBe(true);
    const quantity = getQuantity(KNOWN);
    expect(quantity.id).toBe(KNOWN);
    // Without this, a lookup that threw for EVERY id would pass every refusal test here.
    expect(getQuantity("avogadroConstant").id).toBe("avogadroConstant");
  });

  test("an unregistered id is refused with the code on the field", () => {
    expect(() => getQuantity("thisQuantityIsNotRegistered")).toThrow(UnknownQuantityError);
    try {
      getQuantity("thisQuantityIsNotRegistered");
      throw new Error("getQuantity must not return for an unregistered id");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownQuantityError);
      expect((error as UnknownQuantityError).code).toBe("unknown-quantity");
      // The message names the id and points at where ids live, so the refusal is actionable.
      expect((error as Error).message).toContain("thisQuantityIsNotRegistered");
      expect((error as Error).message).toContain("docs/QUANTITY_IDS.md");
    }
  });

  test("the three near-misses the docblock forbids are each refused, not resolved", () => {
    // These are the cases the rule exists for. A lookup that tolerated any of them would let a
    // record bind a live term by something other than its canonical id, which is the defect
    // AGENTS.md names: "a similar glyph is never a binding key".
    const nearMisses: Readonly<Record<string, string>> = {
      "a case-insensitive match": KNOWN.toLowerCase(),
      "an upper-cased first letter": `${KNOWN[0]?.toUpperCase()}${KNOWN.slice(1)}`,
      "a prefix of a real id": KNOWN.slice(0, 5),
      "a human label": "speed of light",
      "a kebab spelling": "speed-of-light",
    };
    for (const [what, candidate] of Object.entries(nearMisses)) {
      expect(isRegisteredQuantityId(candidate), what).toBe(false);
      expect(() => getQuantity(candidate), what).toThrow(UnknownQuantityError);
    }
    // And the near-misses really are near: each differs from a registered id, so this is a test
    // about lookup strictness rather than about five unrelated strings.
    expect(isRegisteredQuantityId(KNOWN)).toBe(true);
  });

  test("the empty string is refused like any other unregistered id, with the same code", () => {
    expect(() => getQuantity("")).toThrow(UnknownQuantityError);
    try {
      getQuantity("");
      throw new Error("getQuantity must not return for an empty id");
    } catch (error) {
      expect((error as UnknownQuantityError).code).toBe("unknown-quantity");
    }
  });
});
