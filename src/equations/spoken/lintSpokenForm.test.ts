/**
 * Tests for the spoken mathematics linter (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lintSpokenForm } from "./lintSpokenForm.ts";

describe("am-eq-spoken-forms-w4f: lintSpokenForm tests", () => {
  test("fails on \\frac or raw LaTeX commands in spoken text", () => {
    const res = lintSpokenForm("D equals \\frac{k_B T}{6 \\pi \\eta a}");
    assert.equal(res.valid, false);
    assert.ok(res.errors.length >= 1);
    const fracErr = res.errors.find((e) => e.rule === "no-raw-latex" && e.match === "\\frac");
    assert.ok(fracErr, "Must catch \\frac as a no-raw-latex error");
  });

  test("fails on dollar signs or math delimiters", () => {
    const res = lintSpokenForm("The energy $E$ equals $m c^2$");
    assert.equal(res.valid, false);
    assert.ok(res.errors.length >= 2);
    assert.ok(res.errors.some((e) => e.rule === "no-dollar-delimiters"));
  });

  test("fails on raw HTML tags", () => {
    const res = lintSpokenForm("D equals <span>k_B T</span> over 6 pi eta a");
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.rule === "no-html-tags"));
  });

  test("warns on 'x prime' for moving-frame coordinate in relativity context", () => {
    const res = lintSpokenForm(
      "The moving coordinate x prime transforms as gamma times x minus v t",
      {
        notationContext: "special-relativity",
      },
    );
    assert.equal(res.valid, true); // warning does not invalidate
    assert.ok(res.warnings.some((w) => w.rule === "no-x-prime-for-xi"));
  });

  test("warns on integral with unstated integration variable", () => {
    const res = lintSpokenForm("The total energy equals the integral of radiation intensity");
    assert.equal(res.valid, true);
    assert.ok(res.warnings.some((w) => w.rule === "unstated-integral-variable"));
  });

  test("passes on integral with explicit integration variable", () => {
    const res = lintSpokenForm(
      "The total energy equals the integral of radiation intensity with respect to frequency from zero to infinity",
    );
    assert.equal(res.valid, true);
    assert.equal(res.warnings.filter((w) => w.rule === "unstated-integral-variable").length, 0);
  });

  test("warns on 'd over d t' fraction voicing for derivatives", () => {
    const res = lintSpokenForm("The rate of change is d over dt of the momentum");
    assert.equal(res.valid, true);
    assert.ok(res.warnings.some((w) => w.rule === "no-d-over-dt"));
  });

  test("warns on unmentioned bound terms when requested", () => {
    const res = lintSpokenForm("D equals temperature divided by drag", {
      boundTerms: ["temperature", "viscosity", "radius"],
    });
    assert.equal(res.valid, true);
    assert.ok(
      res.warnings.some((w) => w.rule === "unmentioned-bound-term" && w.match === "viscosity"),
    );
    assert.ok(
      res.warnings.some((w) => w.rule === "unmentioned-bound-term" && w.match === "radius"),
    );
  });

  test("clean spoken text passes with 0 errors and 0 warnings", () => {
    const cleanText =
      "D, the diffusion coefficient, equals Boltzmann's constant k sub B times absolute temperature T, divided by the quantity 6 times pi times dynamic viscosity eta times particle radius a.";
    const res = lintSpokenForm(cleanText, {
      boundTerms: ["diffusion coefficient", "temperature", "viscosity", "radius"],
    });
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.warnings.length, 0);
  });
});
