/**
 * Schema and structural tests for equation spoken forms and term explorer definitions (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ALL_SPOKEN_FIXTURES } from "./fixtures.ts";
import { lintSpokenForm } from "./lintSpokenForm.ts";

describe("am-eq-spoken-forms-w4f: spokenForm.schema tests", () => {
  test("All fixtures have complete printed, modern, alternate, and shortName spoken forms", () => {
    assert.ok(ALL_SPOKEN_FIXTURES.length >= 5, "Expected at least 5 standard fixtures");

    for (const fix of ALL_SPOKEN_FIXTURES) {
      assert.ok(fix.id?.startsWith("eq-"), `${fix.id} must have valid eq- prefix`);
      assert.ok(fix.paper && fix.paper.length > 0, `${fix.id} must specify paper`);
      assert.ok(fix.title && fix.title.length > 0, `${fix.id} must have a title`);

      const forms = fix.spokenForms;
      assert.ok(
        forms.printed && forms.printed.trim().length > 10,
        `${fix.id} printed spoken form must be substantial`,
      );
      assert.ok(
        forms.modern && forms.modern.trim().length > 10,
        `${fix.id} modern spoken form must be substantial`,
      );
      assert.ok(
        forms.alternate && forms.alternate.trim().length > 10,
        `${fix.id} alternate spoken form must be substantial`,
      );
      assert.ok(
        forms.shortName && forms.shortName.trim().length > 0,
        `${fix.id} shortName must be present`,
      );
    }
  });

  test("All fixture spoken text passes the linter with 0 errors", () => {
    for (const fix of ALL_SPOKEN_FIXTURES) {
      const printedLint = lintSpokenForm(fix.spokenForms.printed, {
        boundTerms: fix.boundTerms,
        notationContext: fix.paper,
      });
      assert.equal(
        printedLint.errors.length,
        0,
        `${fix.id} printed form has lint errors: ${JSON.stringify(printedLint.errors)}`,
      );

      const modernLint = lintSpokenForm(fix.spokenForms.modern, {
        boundTerms: fix.boundTerms,
        notationContext: fix.paper,
      });
      assert.equal(
        modernLint.errors.length,
        0,
        `${fix.id} modern form has lint errors: ${JSON.stringify(modernLint.errors)}`,
      );

      if (fix.spokenForms.alternate) {
        const altLint = lintSpokenForm(fix.spokenForms.alternate, {
          notationContext: fix.paper,
        });
        assert.equal(
          altLint.errors.length,
          0,
          `${fix.id} alternate form has lint errors: ${JSON.stringify(altLint.errors)}`,
        );
      }
    }
  });

  test("All fixture terms have valid roles, names, and non-empty speech text", () => {
    for (const fix of ALL_SPOKEN_FIXTURES) {
      assert.ok(fix.terms.length >= 2, `${fix.id} must have at least 2 terms/operations`);

      for (const t of fix.terms) {
        assert.ok(t.nodeId && t.nodeId.trim().length > 0, "Term must have nodeId");
        assert.ok(t.name && t.name.trim().length > 0, `Term ${t.nodeId} must have name`);
        assert.ok(
          [
            "input",
            "constant",
            "model-result",
            "operation",
            "parameter",
            "coordinate",
            "field",
          ].includes(t.role),
          `Term ${t.nodeId} has invalid role ${t.role}`,
        );
        assert.ok(
          t.speechText && t.speechText.trim().length > 5,
          `Term ${t.nodeId} must have detailed speechText`,
        );

        const termLint = lintSpokenForm(t.speechText);
        assert.equal(
          termLint.errors.length,
          0,
          `Term ${t.nodeId} speechText has lint errors: ${JSON.stringify(termLint.errors)}`,
        );
      }
    }
  });

  test("Distinguishes 1905 printed and modern symbols in spoken forms", () => {
    const einstein = ALL_SPOKEN_FIXTURES.find((f) => f.id === "eq-bm-einstein-relation");
    assert.ok(einstein, "Missing eq-bm-einstein-relation fixture");
    // In printed form, mentions R and k (viscosity) and N
    assert.ok(
      einstein.spokenForms.printed.includes("viscosity k") ||
        einstein.spokenForms.printed.includes("gas constant R"),
    );
    // In modern form, mentions k sub B and dynamic viscosity eta
    assert.ok(einstein.spokenForms.modern.includes("Boltzmann's constant k sub B"));
    assert.ok(einstein.spokenForms.modern.includes("viscosity eta"));

    const lorentz = ALL_SPOKEN_FIXTURES.find((f) => f.id === "eq-sr-lorentz-factor");
    assert.ok(lorentz, "Missing eq-sr-lorentz-factor fixture");
    assert.ok(lorentz.spokenForms.printed.includes("beta"));
    assert.ok(lorentz.spokenForms.printed.includes("speed of light"));
    assert.ok(lorentz.spokenForms.modern.includes("gamma"));
  });
});
