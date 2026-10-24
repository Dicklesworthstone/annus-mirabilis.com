import { describe, expect, test } from "bun:test";
import { EQUATION_ROLE_CLASS_NAMES } from "../../equations/quantities.ts";
import { ROLE_CLASS_NAMES, roleClassName } from "./classNames";
import { COLOR_ROLES } from "./roles";

/**
 * TWO ROLE VOCABULARIES, AND THIS FILE'S JOB IS TO KEEP THEM APART.
 *
 * The describe block below read "the enumerated set the KaTeX trust callback admits" and its only
 * assertion was `ROLE_CLASS_NAMES.length === COLOR_ROLES.length`, which is a statement about
 * `Array.map`. It would have passed if the callback admitted none of these names, and that is
 * exactly the case: measured 2026-10-24, the live callback in src/equations/render.ts admits
 * am-role-input, am-role-result and am-role-constant, from `Quantity.role`, and the seven names
 * here are disjoint from those three.
 *
 * So the real property is disjointness, asserted against the live constant rather than a retyped
 * copy of it. The failure it prevents is specific: someone reconciling the old sentence by adding
 * these seven to the trust callback, which widens what a source record may put in a class
 * attribute through mathematics.
 */

describe("roleClassName: exactly am-role-<role>", () => {
  for (const role of COLOR_ROLES) {
    test(role, () => {
      expect(roleClassName(role)).toBe(`am-role-${role}`);
    });
  }
});

describe("ROLE_CLASS_NAMES: the meaning-role classes, which are not the renderer's", () => {
  test("one class per declared meaning role, named rather than counted", () => {
    // Identity, not census: the seven roles are a frozen vocabulary, so naming them states the
    // fact, and a count would have passed while mapping the wrong list.
    expect([...ROLE_CLASS_NAMES].sort()).toEqual(
      [
        "am-role-energy",
        "am-role-field",
        "am-role-material",
        "am-role-quanta",
        "am-role-space-geometry",
        "am-role-statistical",
        "am-role-time-rate",
      ].sort(),
    );
    expect(new Set(ROLE_CLASS_NAMES).size).toBe(COLOR_ROLES.length);
  });

  test("no meaning-role class is one the equation renderer admits", () => {
    // Non-vacuity first: two empty sets are disjoint, and that would read as a pass.
    expect(ROLE_CLASS_NAMES.length).toBeGreaterThan(0);
    expect(EQUATION_ROLE_CLASS_NAMES.length).toBeGreaterThan(0);
    const shared = ROLE_CLASS_NAMES.filter((c) => EQUATION_ROLE_CLASS_NAMES.includes(c));
    expect(shared).toEqual([]);
  });

  test("and no class the renderer admits can be produced by roleClassName", () => {
    // The other direction, which is what a merge of the two vocabularies would break first.
    const producible = new Set(COLOR_ROLES.map(roleClassName));
    expect(EQUATION_ROLE_CLASS_NAMES.filter((c) => producible.has(c))).toEqual([]);
  });
});
