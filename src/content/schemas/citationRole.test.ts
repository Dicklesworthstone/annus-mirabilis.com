/**
 * ONE CITATION ROLE, ONE SPELLING (am-wfuc).
 *
 * Two record types were called `Citation`. `source.ts`'s requires a role from
 * `primary | comparison-witness | secondary | technical` and was called by nothing but its own
 * tests; `reading.ts`'s has no role and is the one the reader path loads through
 * `src/reader/marginRecords.ts`. Measured 2026-10-09 at fa3c3aff over the 23 shipped records:
 * the strict validator passed 0 and failed 23, all `invalid-role`; the live one passed 23.
 *
 * This file holds the role's own tests through the whole migration, so they are not spread
 * across the two schemas they are reconciling:
 *
 *   now        the live validator ACCEPTS an optional role and refuses an unknown one, which is
 *              what lets the 23 records be backfilled as content rather than inside a validator
 *              commit;
 *   next       the role becomes required, and the enum is asserted to be the same list in both
 *              schemas so a third spelling cannot appear in one of them.
 *
 * The enum assertion is not a tautology. The two lists live in two files and nothing but this
 * test has ever compared them; AGENTS.md's entity table said "comparison" where both say
 * "comparison-witness", which is how the disagreement survived long enough to be filed.
 */
import { describe, expect, test } from "bun:test";
import { ContentError } from "../compiler/json.ts";
import { CITATION_ROLES, validateReadingRecord } from "./reading.ts";

const BASE = {
  schemaVersion: 1,
  id: "cit-role-fixture",
  kind: "citation",
  title: "A. Author, A title",
  locator: "A Journal 1, 1-2 (1900).",
  url: "https://doi.org/10.0000/fixture",
} as const;

describe("citation role (am-wfuc)", () => {
  test("the four roles are the ones AGENTS.md's entity table names, under one spelling", () => {
    expect([...CITATION_ROLES]).toEqual([
      "primary",
      "comparison-witness",
      "secondary",
      "technical",
    ]);
    // The losing spelling, which the entity table carried, must not be reachable as a value.
    expect(CITATION_ROLES as readonly string[]).not.toContain("comparison");
  });

  test("every role is accepted and survives validation, so the field is not silently dropped", () => {
    for (const role of CITATION_ROLES) {
      const accepted = validateReadingRecord({ ...BASE, role }, "fixture.json");
      expect(accepted.kind).toBe("citation");
      // `validateReadingRecord` returns its input, so a field it checks and discards would read
      // as present here anyway. The check that matters is the refusal below.
      expect((accepted as { role?: string }).role).toBe(role);
    }
  });

  test("a role outside the enum is refused, naming the field", () => {
    for (const bad of ["comparison", "PRIMARY", "witness", "", null, 3]) {
      let caught: unknown;
      try {
        validateReadingRecord({ ...BASE, role: bad }, "fixture.json");
      } catch (err) {
        caught = err;
      }
      // The field is named by the error's `path`, not its message: `error()` throws
      // ContentError(code, path, message) and every message here is a fixed sentence. Asserting
      // on the message would have passed on a refusal about some other field.
      expect(caught).toBeInstanceOf(ContentError);
      expect((caught as ContentError).path).toBe("fixture.json.role");
      expect((caught as ContentError).code).toBe("invalid-record");
    }
  });

  test("a record with no role is still accepted, which is what the 23 shipped records need", () => {
    const accepted = validateReadingRecord(BASE, "fixture.json");
    expect(accepted.id).toBe("cit-role-fixture");
    expect((accepted as { role?: string }).role).toBeUndefined();
  });

  test("an unknown field is still refused, so accepting a role did not open the record", () => {
    let caught: unknown;
    try {
      validateReadingRecord({ ...BASE, role: "primary", rolle: "primary" }, "fixture.json");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ContentError);
    expect((caught as ContentError).path).toBe("fixture.json.rolle");
  });
});
