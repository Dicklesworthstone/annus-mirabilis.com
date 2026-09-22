/**
 * Integration tests for the equation accessibility compiler check (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EINSTEIN_RELATION_FIXTURE, LORENTZ_FACTOR_FIXTURE } from "./fixtures.ts";
import { checkEquationAccessibility } from "./spokenFormCheck.ts";

describe("am-eq-spoken-forms-w4f: spokenForm.check.integration tests", () => {
  test("Clean valid fixture passes accessibility check with 0 errors", () => {
    const res = checkEquationAccessibility({
      id: EINSTEIN_RELATION_FIXTURE.id,
      paper: EINSTEIN_RELATION_FIXTURE.paper,
      title: EINSTEIN_RELATION_FIXTURE.title,
      spokenForms: EINSTEIN_RELATION_FIXTURE.spokenForms,
      plainLatexPrinted: EINSTEIN_RELATION_FIXTURE.plainLatexPrinted,
      plainLatexModern: EINSTEIN_RELATION_FIXTURE.plainLatexModern,
      boundTerms: EINSTEIN_RELATION_FIXTURE.boundTerms,
    });

    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  test("Missing primary spoken form fails with missing-spoken-form error", () => {
    const res = checkEquationAccessibility({
      id: "eq-test-missing-spoken",
      paper: "brownian-motion",
      title: "Test Missing Spoken",
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.rule === "missing-spoken-form"));
  });

  test("(spokenFormCheck.ts:76) Missing modern spoken form when modern latex differs fails with missing-accessibility-alternative", () => {
    const res = checkEquationAccessibility({
      id: LORENTZ_FACTOR_FIXTURE.id,
      paper: LORENTZ_FACTOR_FIXTURE.paper,
      title: LORENTZ_FACTOR_FIXTURE.title,
      spokenForms: {
        printed: LORENTZ_FACTOR_FIXTURE.spokenForms.printed,
        modern: "", // Missing modern variant!
      },
      plainLatexPrinted: LORENTZ_FACTOR_FIXTURE.plainLatexPrinted,
      plainLatexModern: LORENTZ_FACTOR_FIXTURE.plainLatexModern,
    });

    assert.equal(res.valid, false);
    const modernErr = res.errors.find(
      (e) =>
        e.rule === "missing-accessibility-alternative" &&
        e.subKind === "missing-modern-spoken-form",
    );
    assert.ok(modernErr, "Must emit missing-accessibility-alternative for missing modern variant");
  });

  test("(spokenFormCheck.ts:88) Missing alternate spoken form when required fails with missing-accessibility-alternative", () => {
    const res = checkEquationAccessibility(
      {
        id: "eq-test-missing-alt",
        paper: "brownian-motion",
        title: "Test Missing Alternate",
        spokenForms: {
          printed: "D equals k B T over 6 pi eta a",
          modern: "D equals k B T over 6 pi eta a",
        },
      },
      { requireAlternate: true },
    );

    assert.equal(res.valid, false);
    const altErr = res.errors.find(
      (e) =>
        e.rule === "missing-accessibility-alternative" &&
        e.subKind === "missing-alternate-spoken-form",
    );
    assert.ok(altErr, "Must emit missing-accessibility-alternative for missing alternate form");
  });

  test("Planted raw LaTeX in spoken text emits lint-error and invalidates payload", () => {
    const res = checkEquationAccessibility({
      id: "eq-test-planted-latex",
      paper: "brownian-motion",
      title: "Planted LaTeX Test",
      spokenForms: {
        printed: "The rate is \\sqrt{D} times t",
        modern: "The rate is \\sqrt{D} times t",
      },
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.rule === "lint-error"));
  });

  /**
   * am-r3qt. spokenFormCheck.ts:108 emits `lint-error` or `lint-warning` from ONE line,
   * chosen by `finding.severity`. The error arm was driven; the warning arm was not, so the
   * site counted as untested under a code no test produced.
   *
   * MEASURED FIRST: planting the warning arm reddened nothing across this file's five tests,
   * while planting :76 and :88 each reddened exactly one existing test - those two needed a
   * citation, not a case, and got one. This site needed a case because nothing reached it.
   *
   * The trigger is real rather than synthetic: lintSpokenForm's `no-x-prime-for-xi` rule
   * warns on the phrase "x prime", which in 1905 relativity is the auxiliary Galilean
   * coordinate of paper 3 section 3 and not the moving coordinate xi. The fixture says
   * "x prime" in a special-relativity context, which is exactly the confusion the rule
   * exists to flag.
   */
  test("(spokenFormCheck.ts:108) a warning-severity lint finding is reported as lint-warning, not lint-error", () => {
    const res = checkEquationAccessibility({
      id: "eq-r3qt-lint-warning",
      paper: "special-relativity",
      title: "A spoken form that says x prime",
      spokenForms: {
        printed: "x prime equals x minus v t, the auxiliary coordinate of section 3.",
        // Required by the type. Deliberately free of the flagged phrase, so the warning
        // below is attributable to the printed form alone.
        modern: "The auxiliary coordinate equals x minus v times t.",
      },
      plainLatexPrinted: "x' = x - vt",
    });

    const warned = res.warnings.filter((d) => d.rule === "lint-warning");
    assert.ok(
      warned.length > 0,
      `the warning arm of :108 must fire; got ${JSON.stringify(res.diagnostics.map((d) => d.rule))}`,
    );
    // The two arms of the same ternary: this input must take the warning one and not the error one.
    assert.equal(
      warned.every((d) => d.severity === "warning"),
      true,
      "a lint-warning diagnostic must carry warning severity",
    );
    assert.equal(
      res.diagnostics.some((d) => d.rule === "lint-error"),
      false,
      "this fixture must not also trip the error arm, or the case proves nothing about :108",
    );
  });
});
