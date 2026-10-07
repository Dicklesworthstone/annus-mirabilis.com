/**
 * Refusal coverage for the 1904-mode surface guard, `mode-1904-guard` (am-muyh, am-16nj).
 *
 * No test imported this module. Its refusal carries a typed code on the class,
 * `readonly code = "mode-1904-guard"`, and the bare-throw scanner cannot see a code declared that
 * way on a zero-literal constructor, so the site read as an untyped throw and no coverage was ever
 * asked for. These are its accept and reject halves, written before the scanner is taught to
 * resolve the class, so that the site arrives already covered rather than arriving as new debt.
 *
 * WHAT THE GUARD IS FOR. The 1904 shelf holds only results a careful reader had by the end of 1904.
 * A discovery step that reaches a modern surface - a rapidity, say, which is Minkowski's later
 * geometry - must refuse rather than quietly answer, because answering would smuggle a later result
 * into a route that claims not to use one.
 */
import { describe, expect, test } from "bun:test";
import { getConstantSet, withMode1904Guard as withConstantsGuard } from "../constants.ts";
import { isMode1904, Mode1904GuardError, refuseModernSurface } from "./mode1904.ts";

describe("refuseModernSurface refuses, and says which surface and with which code", () => {
  test("it throws Mode1904GuardError carrying the code and naming the surface", () => {
    expect(() => refuseModernSurface("rapidity")).toThrow(Mode1904GuardError);
    try {
      refuseModernSurface("rapidity");
      // See the note in discovery.refusals.test.ts: expect.unreachable does not typecheck here.
      throw new Error("refuseModernSurface must not return");
    } catch (error) {
      // The code is the thing a gate reads, so assert the field rather than a pattern over the
      // rendered message: the message usually contains the code and so matches for the wrong reason.
      expect(error).toBeInstanceOf(Mode1904GuardError);
      expect((error as Mode1904GuardError).code).toBe("mode-1904-guard");
      expect((error as Mode1904GuardError).name).toBe("Mode1904GuardError");
      // The surface is named, so a reader is told what was refused rather than that something was.
      expect((error as Error).message).toContain("rapidity");
    }
  });

  test("it is a TypeError, so a caller catching TypeError does not have to know this class", () => {
    expect(() => refuseModernSurface("four-momentum")).toThrow(TypeError);
    const first = new Mode1904GuardError("spacetime interval");
    const second = new Mode1904GuardError("rapidity");
    // Each instance names its own surface: a shared message would make two refusals indistinguishable.
    expect(first.message).not.toBe(second.message);
    expect(first.code).toBe(second.code);
  });
});

describe("isMode1904 answers from the constant set, and the accept half is a real negative", () => {
  test("outside any guard it is false, which is the half that makes the true below mean something", () => {
    expect(isMode1904()).toBe(false);
  });

  test("inside the constants guard it is true, and it is false again afterwards", () => {
    // This module's isMode1904 reads `depth > 0 || isConstants1904()`. Nothing in the repository
    // calls THIS module's withMode1904Guard - `rg withMode1904Guard` resolves every production
    // caller to constants.ts - so the local `depth` is always 0 and the constants half is what
    // answers. Recorded as a finding on am-16nj rather than repaired here: a second depth counter
    // that nothing increments is dead, but the guard still refuses correctly through the
    // delegation, so this is duplication rather than a hole, and removing an export is not a
    // refusal-coverage change.
    const inside = withConstantsGuard(() => {
      // Planck's 1900-1901 printed constants, which is the set a 1904 route legitimately holds.
      // Measured rather than assumed: MODE_1904_FORBIDDEN_SET_IDS names five sets, and all three
      // of Einstein's own 1905 printed sets are among them, so reaching for
      // `einstein-1905-brownian-printed` here refused -- correctly, since the Brownian paper is
      // 1905 and is not on the 1904 shelf. That refusal is the guard being right and my first
      // draft being wrong about which set the shelf holds.
      expect(getConstantSet("planck-1900-1901-printed")).toBeDefined();
      return isMode1904();
    });
    expect(inside).toBe(true);
    expect(isMode1904()).toBe(false);
  });

  test("the constants guard refuses a modern set from inside a 1904 route, and restores after", () => {
    // The sibling half of the same rule, included because it is what makes the guard load-bearing:
    // being in 1904 mode has to COST something, or `isMode1904` is a flag nobody acts on.
    expect(() => withConstantsGuard(() => getConstantSet("modern-si-2019"))).toThrow();
    // And Einstein's own 1905 values are refused too, which is the sharper half of the rule: the
    // 1904 shelf is a date boundary, not a modern-versus-historical one.
    expect(() =>
      withConstantsGuard(() => getConstantSet("einstein-1905-brownian-printed")),
    ).toThrow();
    // And the depth is unwound by the throw rather than left raised, which a `finally` promises and
    // only a test establishes: a leaked depth would refuse every later modern lookup in the process.
    expect(getConstantSet("modern-si-2019")).toBeDefined();
    expect(isMode1904()).toBe(false);
  });
});
