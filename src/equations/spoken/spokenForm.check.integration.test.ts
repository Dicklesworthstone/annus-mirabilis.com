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

  test("Missing modern spoken form when modern latex differs fails with missing-accessibility-alternative", () => {
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
      (e) => e.rule === "missing-accessibility-alternative" && e.subKind === "missing-modern-spoken-form",
    );
    assert.ok(modernErr, "Must emit missing-accessibility-alternative for missing modern variant");
  });

  test("Missing alternate spoken form when required fails with missing-accessibility-alternative", () => {
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
      (e) => e.rule === "missing-accessibility-alternative" && e.subKind === "missing-alternate-spoken-form",
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
});
