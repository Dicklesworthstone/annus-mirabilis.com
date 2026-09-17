/**
 * Integration tests for the molecular-dimensions companion concordance (ap-19-289).
 * No br issue am-not-entries-molecular-dimensions exists; this suite covers the
 * companion file under the notation epic am-ep-notation-vrg.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TestLogger } from "../../testing/log/logger.ts";
import { getQuantityRegistry } from "../quantities/registry.ts";
import {
  buildSourceManifestIndex,
  clearConcordanceCache,
  firstUseInSection,
  loadConcordanceForPaper,
  modernSymbolFor,
  resolveGlyph,
} from "./index.ts";
import { checkConcordance } from "./validation.ts";

describe("molecular-dimensions notation concordance", () => {
  const logger = new TestLogger("notation-molecular-dimensions");
  const paper = "molecular-dimensions";
  const emptyManifestIndex = buildSourceManifestIndex([]);
  const beadId = "am-ep-notation-vrg";

  function logPass(testId: string, message: string, extra: Record<string, unknown> = {}): void {
    logger.log({
      testId,
      beadId,
      outcome: "passed",
      comparisonKind: "bitwise",
      message,
      extra: { paper, ...extra },
    });
  }

  test("Coverage: live molecular-dimensions.yaml loads and validates with 0 errors", () => {
    clearConcordanceCache();
    const file = loadConcordanceForPaper(paper);
    assert.equal(file.paper, "molecular-dimensions");
    assert.ok(file.entries.length >= 8, `Expected at least 8 entries, got ${file.entries.length}`);

    const result = checkConcordance(file, { knownQuantityIds: getQuantityRegistry().ids });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors, null, 2)}`);
    logPass("coverage-load-validate", `Loaded ${file.entries.length} entries with 0 errors`, {
      entryCount: file.entries.length,
    });
  });

  test("Honesty: every entry is pending facsimile verification", () => {
    const file = loadConcordanceForPaper(paper);
    for (const entry of file.entries) {
      assert.ok(
        entry.verification.checkedAgainst.toLowerCase().includes("pending"),
        `${entry.id} must record pending facsimile verification`,
      );
    }
    logPass("honesty-pending-verification", "All entries marked pending facsimile");
  });

  test("Bindings: k binds viscosity, is danger, and renames to eta — same collision as paper 2", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "md-s1", "k", emptyManifestIndex, file);
    assert.ok(res.ok, "k in the companion must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "viscosity");
    assert.notEqual(res.entry.binding.quantityId, "boltzmannConstant");
    assert.notEqual(res.entry.binding.quantityId, "suspensionViscosityCoefficient");
    assert.equal(res.entry.collision?.severity, "danger");
    assert.ok(res.entry.collision?.collidesWithModern?.includes("boltzmannConstant"));
    assert.equal(modernSymbolFor(paper, "md-s1", "k", emptyManifestIndex, file), "\\eta");
    assert.equal(firstUseInSection(paper, "md-s1", "k", file), "md-s1-p1");
    logPass("k-is-viscosity", "k binds viscosity and renames to eta");
  });

  test("Bindings: phi binds volumeFraction, not a transition kernel or an angle", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "md-s1", "\\varphi", emptyManifestIndex, file);
    assert.ok(res.ok, "phi must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "volumeFraction");
    assert.notEqual(res.entry.binding.quantityId, "transitionKernel");
    assert.notEqual(res.entry.binding.quantityId, "spectralEntropyDensity");
    assert.notEqual(res.entry.binding.quantityId, "propagationAngleStationary");
    logPass("phi-is-volume-fraction", "phi binds volumeFraction");
  });

  test("Edition: 1906 coefficient of phi is 1; 1911 coefficient is 5/2; neither is k", () => {
    const file = loadConcordanceForPaper(paper);
    const printed1906 = resolveGlyph(paper, "md-1906", "1", emptyManifestIndex, file);
    assert.ok(printed1906.ok, "1906 coefficient must resolve");
    assert.ok("quantityId" in printed1906.entry.binding);
    assert.equal(printed1906.entry.binding.quantityId, "suspensionViscosityCoefficient");
    assert.equal(printed1906.entry.operation.kind, "rename");
    assert.equal(modernSymbolFor(paper, "md-1906", "1", emptyManifestIndex, file), "1");

    const printed1911 = resolveGlyph(paper, "md-1911", "\\frac{5}{2}", emptyManifestIndex, file);
    assert.ok(printed1911.ok, "1911 coefficient must resolve");
    assert.ok("quantityId" in printed1911.entry.binding);
    assert.equal(printed1911.entry.binding.quantityId, "suspensionViscosityCoefficient");
    assert.equal(
      modernSymbolFor(paper, "md-1911", "\\frac{5}{2}", emptyManifestIndex, file),
      "\\frac{5}{2}",
    );

    assert.notEqual(printed1906.entry.id, printed1911.entry.id);
    assert.equal(
      file.entries.some(
        (e) =>
          "quantityId" in e.binding &&
          e.binding.quantityId === "suspensionViscosityCoefficient" &&
          (e.glyph.latex === "k" || e.glyph.unicode === "k"),
      ),
      false,
      "the coefficient of phi must never be entered as k",
    );

    const k1906 = resolveGlyph(paper, "md-1906", "k", emptyManifestIndex, file);
    assert.ok(k1906.ok);
    assert.ok("quantityId" in k1906.entry.binding);
    assert.equal(k1906.entry.binding.quantityId, "viscosity");

    const k1911 = resolveGlyph(paper, "md-1911", "k", emptyManifestIndex, file);
    assert.ok(k1911.ok);
    assert.ok("quantityId" in k1911.entry.binding);
    assert.equal(k1911.entry.binding.quantityId, "viscosity");
    logPass("edition-dependent-coefficient", "1906 prints 1, 1911 prints 5/2, k remains viscosity");
  });

  test("Modern-only [eta] is not substituted for the 1906 printed 1", () => {
    const file = loadConcordanceForPaper(paper);
    const intrinsic = file.modernOnlySymbols?.find((m) => m.glyph.latex === "[\\eta]");
    assert.ok(intrinsic, "modern [eta] must be declared as modern-only");
    assert.ok("quantityId" in intrinsic.binding);
    assert.equal(intrinsic.binding.quantityId, "suspensionViscosityCoefficient");
    assert.ok(intrinsic.scope.includes("md-1911"));
    assert.equal(intrinsic.scope.includes("md-1906"), false);
    assert.notEqual(modernSymbolFor(paper, "md-1906", "1", emptyManifestIndex, file), "[\\eta]");
    logPass("modern-eta-not-1906", "modern [eta] is not the 1906 coefficient");
  });

  test("First uses: every danger collision has a first-use anchor", () => {
    const file = loadConcordanceForPaper(paper);
    const danger = file.entries.filter((e) => e.collision?.severity === "danger");
    assert.ok(danger.length >= 1, "k-as-viscosity must be danger");
    for (const de of danger) {
      assert.ok(de.collision?.firstUseAnchor, `${de.id} missing firstUseAnchor`);
      assert.ok(
        (de.collision?.firstUseBySection?.length ?? 0) > 0,
        `${de.id} missing firstUseBySection`,
      );
    }
    logPass("danger-first-use", `${danger.length} danger collisions carry first-use anchors`);
  });
});
