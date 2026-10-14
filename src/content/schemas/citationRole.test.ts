/**
 * ONE CITATION ROLE, ONE SPELLING (am-wfuc).
 *
 * Two record types were called `Citation`, which is why one of them is now `BibEntry`. The
 * `source.ts` one requires a role from `primary | comparison-witness | secondary | technical`
 * and was called by nothing but its own tests; the `reading.ts` one had no role and is the one
 * the reader path loads, through `src/reader/marginRecords.ts`. Measured 2026-10-09 at fa3c3aff
 * over the 23 shipped records: the strict validator passed 0 and failed 23, every one
 * `invalid-role`; the live one passed 23. Two fixtures had been written to the wrong one of the
 * two shapes, which is the concrete cost of the shared name and the reason for the rename.
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
import { validateBibEntry } from "./source.ts";

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

  /**
   * THE TWO VALIDATORS AGREE ON THE ENUM, ASSERTED BY DRIVING BOTH RATHER THAN BY COMPARING TWO
   * LITERALS.
   *
   * `source.ts` writes the four names out as a literal union and `reading.ts` exports them as a
   * list, and nothing had ever checked that the two say the same thing. Importing one into the
   * other would have been tidier and was tried: a single import line shifted 98 of that file's
   * refusal-site citations by one line each, which is a 98-item remap to repay a one-line
   * convenience. So the duplication stays and this test is what stops it drifting -- a new name
   * in one list and not the other turns this red from whichever side added it.
   */
  test("the strict validator in source.ts accepts exactly the same four roles", () => {
    for (const role of CITATION_ROLES) {
      const accepted = validateBibEntry({
        id: "cit-role-fixture",
        title: "A title",
        role,
      });
      expect(accepted.role).toBe(role);
    }
    for (const bad of ["comparison", "witness", "Primary", ""]) {
      let caught: unknown;
      try {
        validateBibEntry({ id: "cit-role-fixture", title: "A title", role: bad });
      } catch (err) {
        caught = err;
      }
      expect((caught as { code?: string } | undefined)?.code).toBe("invalid-role");
    }
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

  /**
   * This asserted the opposite for one commit, on purpose. The role had to be ACCEPTED before
   * the 23 shipped records could be backfilled, because `keys()` refuses an unlisted field, and
   * it had to be REQUIRED afterwards or it would be one more field nothing enforced. Both
   * halves are recorded rather than only the surviving one, so the sequence is legible to anyone
   * reading the history and so the window cannot quietly reopen.
   */
  test("a record with no role is refused, which is what makes the field worth having", () => {
    let caught: unknown;
    try {
      validateReadingRecord(BASE, "fixture.json");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ContentError);
    expect((caught as ContentError).path).toBe("fixture.json.role");
    expect((caught as ContentError).message).toBe("Missing field.");
  });

  /**
   * THE VERIFICATION FIELD, WHICH IS ABOUT WHO CHECKED A RECORD AND NOT ABOUT WHAT IT SAYS
   * (am-margin-citations-7jet).
   *
   * Its two refusals are asymmetric on purpose, and the asymmetry is the whole point: a `human`
   * or `agent` verification with no verifier and no date is the thing the field exists to stop,
   * and an `unverified` one carrying a name is a contradiction that arrives by copying a
   * filled-in record. Both directions are driven here, and so is the state list, because a
   * fourth state added without a rule would otherwise pass.
   */
  test("a verification must name who and when, unless it says nobody has checked it", () => {
    const base = { ...BASE, role: "primary" as const };

    const verified = validateReadingRecord(
      {
        ...base,
        verification: {
          state: "agent",
          by: "agent:fixture",
          date: "2026-10-14",
          note: "Crossref registered metadata for the DOI.",
        },
      },
      "fixture.json",
    );
    expect((verified as { verification?: { state: string } }).verification?.state).toBe("agent");

    const unverified = validateReadingRecord(
      { ...base, verification: { state: "unverified", note: "Nobody has checked this record." } },
      "fixture.json",
    );
    expect((unverified as { verification?: { state: string } }).verification?.state).toBe(
      "unverified",
    );

    // A verification with no verifier.
    expect(refusalPath({ ...base, verification: { state: "agent", note: "checked" } })).toBe(
      "fixture.json.verification.by",
    );
    // A verifier with no date.
    expect(
      refusalPath({ ...base, verification: { state: "human", by: "someone", note: "read it" } }),
    ).toBe("fixture.json.verification.date");
    // A date that is not one.
    expect(
      refusalPath({
        ...base,
        verification: { state: "agent", by: "a", date: "last Tuesday", note: "n" },
      }),
    ).toBe("fixture.json.verification.date");
    // Nobody checked it, and yet somebody is named.
    expect(
      refusalPath({
        ...base,
        verification: { state: "unverified", by: "someone", note: "nobody has" },
      }),
    ).toBe("fixture.json.verification.by");
    // A state outside the three.
    expect(refusalPath({ ...base, verification: { state: "reviewed", note: "n" } })).toBe(
      "fixture.json.verification.state",
    );
    // A verification that says nothing.
    expect(refusalPath({ ...base, verification: { state: "unverified", note: "  " } })).toBe(
      "fixture.json.verification.note",
    );
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
function refusalPath(record: unknown): string {
  try {
    validateReadingRecord(record, "fixture.json");
  } catch (err) {
    if (err instanceof ContentError) return err.path;
    throw err;
  }
  throw new Error("accepted a record that should have been refused");
}
