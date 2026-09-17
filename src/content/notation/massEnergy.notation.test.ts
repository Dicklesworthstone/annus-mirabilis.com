/**
 * Integration and unit tests for the Mass-Energy Equivalence notation concordance (ap-18-639).
 * Bead: am-not-entries-mass-energy-wq2
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TestLogger } from "../../testing/log/logger.ts";
import { getQuantityRegistry } from "../quantities/registry.ts";
import {
  buildSourceManifestIndex,
  clearConcordanceCache,
  firstUse,
  firstUseInSection,
  loadConcordanceForPaper,
  modernGroupsFor,
  modernSymbolFor,
  resolveGlyph,
} from "./index.ts";
import { checkConcordance } from "./validation.ts";

describe("am-not-entries-mass-energy-wq2: mass-energy notation concordance", () => {
  const logger = new TestLogger("notation-mass-energy");
  const paper = "mass-energy";
  const emptyManifestIndex = buildSourceManifestIndex([]);
  const beadId = "am-not-entries-mass-energy-wq2";

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

  test("Coverage: live mass-energy.yaml loads and validates with 0 errors", () => {
    clearConcordanceCache();
    const file = loadConcordanceForPaper(paper);
    assert.equal(file.paper, "mass-energy");
    assert.ok(
      file.entries.length >= 20,
      `Expected at least 20 entries, got ${file.entries.length}`,
    );

    const reg = getQuantityRegistry();
    const result = checkConcordance(file, { knownQuantityIds: reg.ids });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors, null, 2)}`);

    logPass(
      "coverage-load-validate",
      `Loaded ${file.entries.length} entries with 0 validation errors`,
      { entryCount: file.entries.length },
    );
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

  test("Bindings: L in mass-energy binds emittedEnergyRestFrame, never speedOfLight", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "me-s0", "L", emptyManifestIndex, file);
    assert.ok(res.ok, "L in me-s0 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "emittedEnergyRestFrame");
    assert.notEqual(res.entry.binding.quantityId, "speedOfLight");
    assert.equal(res.entry.collision?.severity, "caution");
    assert.ok(res.entry.collision?.collidesWith?.includes("speedOfLight"));
    assert.ok(res.entry.collision?.collidesWith?.includes("magneticFieldComponent"));
    assert.equal(res.entry.operation.kind, "rename");
    logPass("L-is-emitted-energy", "L binds emittedEnergyRestFrame, not speedOfLight");
  });

  test("Bindings: H0 and E0 bind different frame-tagged quantities", () => {
    const file = loadConcordanceForPaper(paper);
    const h0Res = resolveGlyph(paper, "me-s0", "H_0", emptyManifestIndex, file);
    const e0Res = resolveGlyph(paper, "me-s0", "E_0", emptyManifestIndex, file);
    assert.ok(h0Res.ok, "H_0 must resolve");
    assert.ok(e0Res.ok, "E_0 must resolve");

    assert.ok("quantityId" in h0Res.entry.binding);
    assert.ok("quantityId" in e0Res.entry.binding);
    assert.equal(h0Res.entry.binding.quantityId, "bodyEnergyMovingBefore");
    assert.equal(e0Res.entry.binding.quantityId, "bodyEnergyRestBefore");
    assert.equal(h0Res.entry.frameOrReference, "moving-system");
    assert.equal(e0Res.entry.frameOrReference, "stationary-system");
    assert.notEqual(h0Res.entry.binding.quantityId, e0Res.entry.binding.quantityId);
    logPass("H0-E0-frame-tagged", "H0 and E0 bind distinct frame-tagged quantities");
  });

  test("Bindings: H1 and E1 bind bodyEnergyMovingAfter and bodyEnergyRestAfter", () => {
    const file = loadConcordanceForPaper(paper);
    const h1Res = resolveGlyph(paper, "me-s0", "H_1", emptyManifestIndex, file);
    const e1Res = resolveGlyph(paper, "me-s0", "E_1", emptyManifestIndex, file);
    assert.ok(h1Res.ok, "H_1 must resolve");
    assert.ok(e1Res.ok, "E_1 must resolve");

    assert.ok("quantityId" in h1Res.entry.binding);
    assert.ok("quantityId" in e1Res.entry.binding);
    assert.equal(h1Res.entry.binding.quantityId, "bodyEnergyMovingAfter");
    assert.equal(e1Res.entry.binding.quantityId, "bodyEnergyRestAfter");
    assert.equal(h1Res.entry.frameOrReference, "moving-system");
    assert.equal(e1Res.entry.frameOrReference, "stationary-system");
    logPass("H1-E1-frame-tagged", "H1 and E1 bind distinct after-emission quantities");
  });

  test("Bindings: C binds additiveEnergyConstant and has energy dimensions", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "me-s0", "C", emptyManifestIndex, file);
    assert.ok(res.ok, "C must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "additiveEnergyConstant");

    const reg = getQuantityRegistry();
    const qty = reg.quantities.get("additiveEnergyConstant");
    assert.ok(qty && qty.dimension, "additiveEnergyConstant with dimension must be in registry");
    const dimValues = qty.dimension.map((d) => d.num / d.den);
    assert.deepEqual(
      dimValues,
      [2, 1, -2, 0, 0, 0],
      "C must have energy dimensions [2,1,-2,0,0,0]",
    );
    logPass("C-additive-energy-constant", "C binds additiveEnergyConstant with energy dimension");
  });

  test("Scopes: phi in citation binds propagationAngleStationary; in emission binds emissionAngle", () => {
    const file = loadConcordanceForPaper(paper);
    const citeRes = resolveGlyph(paper, "me-s0-p1", "\\varphi", emptyManifestIndex, file);
    const emitRes = resolveGlyph(paper, "me-s0-p2", "\\varphi", emptyManifestIndex, file);
    assert.ok(citeRes.ok, "phi in citation paragraph me-s0-p1 must resolve");
    assert.ok(emitRes.ok, "phi in emission paragraph me-s0-p2 must resolve");

    assert.ok("quantityId" in citeRes.entry.binding);
    assert.ok("quantityId" in emitRes.entry.binding);
    assert.equal(citeRes.entry.binding.quantityId, "propagationAngleStationary");
    assert.equal(emitRes.entry.binding.quantityId, "emissionAngle");
    assert.notEqual(citeRes.entry.id, emitRes.entry.id);
    logPass("phi-scoped-separate", "phi resolves separately between citation and emission scopes");
  });

  test("Lorentz factor: explicit root group returned by modernGroupsFor, notes state UNKNOWN pending facsimile", () => {
    const file = loadConcordanceForPaper(paper);
    const groups = modernGroupsFor(paper, "me-s0", file, emptyManifestIndex);
    const rootGroup = groups.find((g) => g.modernGroup === "\\gamma");
    assert.ok(rootGroup, "modernGroupsFor must return group rename to \\gamma");

    const entry = file.entries.find((e) => e.id === "me.root.lorentzFactor");
    assert.ok(entry, "me.root.lorentzFactor entry must exist");
    assert.ok(
      entry?.notes?.includes("UNKNOWN pending direct facsimile verification"),
      "Notes must explicitly state printed form is UNKNOWN pending facsimile",
    );
    logPass(
      "lorentz-factor-group-unknown-pending",
      "Lorentz factor group maps to \\gamma with pending honesty note",
    );
  });

  test("Unit conversion: 9e20 converts CGS ergs to grams with 0.14% note", () => {
    const file = loadConcordanceForPaper(paper);
    const entry = file.entries.find((e) => e.id === "me.9e20.cgsConversion");
    assert.ok(entry, "9e20 entry must exist");
    assert.equal(entry?.operation.kind, "unitConversion");
    if (entry?.operation.kind === "unitConversion") {
      assert.equal(entry.operation.fromSystem, "cgs");
      assert.equal(entry.operation.toSystem, "si");
      assert.ok(entry.operation.conversionDerivationRef?.includes("0.14%"));
    }
    assert.ok(entry?.notes?.includes("0.14 percent"));
    logPass("9e20-unit-conversion", "9e20 converts CGS ergs to grams with 0.14% note");
  });

  test("Bindings: K0, K1, and K0 - K1 bind kineticEnergyBefore, kineticEnergyAfter, kineticEnergyDifference", () => {
    const file = loadConcordanceForPaper(paper);
    const k0 = resolveGlyph(paper, "me-s0", "K_0", emptyManifestIndex, file);
    const k1 = resolveGlyph(paper, "me-s0", "K_1", emptyManifestIndex, file);
    const kDiff = resolveGlyph(paper, "me-s0", "K_0 - K_1", emptyManifestIndex, file);

    assert.ok(
      k0.ok &&
        "quantityId" in k0.entry.binding &&
        k0.entry.binding.quantityId === "kineticEnergyBefore",
    );
    assert.ok(
      k1.ok &&
        "quantityId" in k1.entry.binding &&
        k1.entry.binding.quantityId === "kineticEnergyAfter",
    );
    assert.ok(
      kDiff.ok &&
        "quantityId" in kDiff.entry.binding &&
        kDiff.entry.binding.quantityId === "kineticEnergyDifference",
    );
    logPass("kinetic-energies-bound", "K0, K1, and K0 - K1 bind correct kinetic energy quantities");
  });

  test("Bindings: V and v bind speedOfLight and frameSpeed", () => {
    const file = loadConcordanceForPaper(paper);
    const vCap = resolveGlyph(paper, "me-s0", "V", emptyManifestIndex, file);
    const vSmall = resolveGlyph(paper, "me-s0", "v", emptyManifestIndex, file);

    assert.ok(
      vCap.ok &&
        "quantityId" in vCap.entry.binding &&
        vCap.entry.binding.quantityId === "speedOfLight",
    );
    assert.ok(
      vSmall.ok &&
        "quantityId" in vSmall.entry.binding &&
        vSmall.entry.binding.quantityId === "frameSpeed",
    );
    assert.equal(modernSymbolFor(paper, "me-s0", "V", emptyManifestIndex, file), "c");
    assert.equal(modernSymbolFor(paper, "me-s0", "v", emptyManifestIndex, file), "v");
    logPass("V-and-v-bound", "V -> c and v -> v resolved correctly");
  });

  test("Bindings: L/V^2 binds inertialMassDecrease", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "me-s0", "L/V^2", emptyManifestIndex, file);
    assert.ok(res.ok, "L/V^2 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "inertialMassDecrease");
    assert.equal(
      modernSymbolFor(paper, "me-s0", "L/V^2", emptyManifestIndex, file),
      "\\frac{L}{c^2}",
    );
    logPass("L_over_V2-inertial-mass-decrease", "L/V^2 binds inertialMassDecrease");
  });

  test("ModernOnlySymbols: contains invariantMassSystem and massChangeSigned", () => {
    const file = loadConcordanceForPaper(paper);
    assert.ok(file.modernOnlySymbols && file.modernOnlySymbols.length >= 2);
    const invMass = file.modernOnlySymbols?.find(
      (s) => "quantityId" in s.binding && s.binding.quantityId === "invariantMassSystem",
    );
    const deltaM = file.modernOnlySymbols?.find(
      (s) => "quantityId" in s.binding && s.binding.quantityId === "massChangeSigned",
    );
    assert.ok(invMass, "invariantMassSystem modern-only symbol must be present");
    assert.ok(deltaM, "massChangeSigned modern-only symbol must be present");
    logPass("modern-only-symbols", "Modern-only symbols present with non-1905 labels");
  });

  test("Collisions: all collisions specify firstUseAnchor and non-empty targets", () => {
    const file = loadConcordanceForPaper(paper);
    for (const entry of file.entries) {
      if (entry.collision) {
        assert.ok(
          entry.collision.firstUseAnchor && entry.collision.firstUseAnchor.length > 0,
          `${entry.id} collision missing firstUseAnchor`,
        );
        assert.ok(
          entry.collision.firstUseBySection && entry.collision.firstUseBySection.length > 0,
          `${entry.id} collision missing firstUseBySection`,
        );
        assert.ok(
          entry.collision.collidesWith.length > 0 ||
            (entry.collision.collidesWithModern?.length ?? 0) > 0,
          `${entry.id} collision has empty collision targets`,
        );
      }
    }
    logPass("collisions-well-formed", "All collisions are well-formed");
  });
});
