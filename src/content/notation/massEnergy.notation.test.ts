/**
 * Integration and unit tests for the Mass-Energy Equivalence notation concordance (ap-18-639).
 * Bead: am-not-entries-mass-energy-wq2
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { TestLogger } from "../../testing/log/logger.ts";
import { getQuantityRegistry } from "../quantities/registry.ts";
import {
  buildSourceManifestIndex,
  clearConcordanceCache,
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
  const FACSIMILE_SHA256 = "c4770702edca3047c324a92cc0a008e27355c236b3e5e0a87d75eea630ab5f19";
  const VERIFICATION_LOG = join(
    process.cwd(),
    "docs/editorial/mass-energy-notation-verification.md",
  );

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

  test("Honesty: every entry is verified against the pinned facsimile, none left pending", () => {
    const file = loadConcordanceForPaper(paper);
    for (const entry of file.entries) {
      const against = entry.verification.checkedAgainst;
      assert.ok(
        against.includes("ap-18-639") && against.includes(FACSIMILE_SHA256),
        `${entry.id} must cite the pinned facsimile and its digest, got: ${against}`,
      );
      assert.ok(
        !against.toLowerCase().includes("pending"),
        `${entry.id} still records a pending verification; the facsimile is pinned`,
      );
      assert.ok(entry.verification.date >= "2026-09-19", `${entry.id} verification date is stale`);
      assert.ok(
        entry.sources?.facsimilePage !== undefined &&
          [639, 640, 641].includes(Number(entry.sources.facsimilePage)),
        `${entry.id} must cite a printed page of ap-18-639 (639-641)`,
      );
    }
    logPass("honesty-verified-against-facsimile", "All entries verified against pinned ap-18-639");
  });

  test("Verification log exists and records every required result", () => {
    assert.ok(existsSync(VERIFICATION_LOG), `${VERIFICATION_LOG} must exist`);
    const log = readFileSync(VERIFICATION_LOG, "utf8");
    assert.ok(log.includes(FACSIMILE_SHA256), "log must cite the pinned digest");
    // The bead requires a recorded result for each of these.
    for (const item of ["beta", "l*", "Coordinate-system names"]) {
      assert.ok(log.includes(item), `verification log must record a result for ${item}`);
    }
    assert.ok(/`beta`[^|]*\|\s*\*\*not-found\*\*/.test(log), "log must record beta as not-found");
    assert.ok(
      /Explicit radical[^|]*\|\s*\*\*matches\*\*/.test(log),
      "log must record the explicit radical as matching",
    );
    logPass("verification-log-complete", "Verification log records beta, l*, and system names");
  });

  test("Planted negative: no beta entry and no K/k coordinate-system entry may exist", () => {
    const file = loadConcordanceForPaper(paper);
    // beta is not printed in this paper; an entry for it would be imported from paper 3.
    const beta = file.entries.find(
      (e) => e.glyph.unicode === "\u03b2" || e.glyph.latex === "\\beta",
    );
    assert.equal(beta, undefined, "beta is not printed in ap-18-639; it must have no entry");

    // K and k are never coordinate-system labels in this paper; K is kinetic energy only.
    for (const e of file.entries) {
      const isSystemLabel =
        "nonQuantityKind" in e.binding && e.binding.nonQuantityKind === "coordinate-system-label";
      if (isSystemLabel) {
        assert.ok(
          !["K", "k"].includes(e.glyph.unicode),
          `${e.id}: K/k are not coordinate-system labels in paper 4; the systems are named (x, y, z) and (xi, eta, zeta)`,
        );
      }
    }
    logPass("no-imported-paper3-glyphs", "No beta entry and no K/k system-label entry");
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
    assert.ok(qty?.dimension, "additiveEnergyConstant with dimension must be in registry");
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
    const citeRes = resolveGlyph(paper, "me-s0-p5", "\\varphi", emptyManifestIndex, file);
    const emitRes = resolveGlyph(paper, "me-s0-p7", "\\varphi", emptyManifestIndex, file);
    assert.ok(citeRes.ok, "phi in citation paragraph me-s0-p5 must resolve");
    assert.ok(emitRes.ok, "phi in emission paragraph me-s0-p7 must resolve");

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
      entry?.notes?.includes("explicit radical every time"),
      "Notes must record that the factor is printed as an explicit radical",
    );
    assert.ok(
      entry?.notes?.toLowerCase().includes("not printed"),
      "Notes must record that beta is not printed in this paper",
    );
    logPass(
      "lorentz-factor-group-explicit-radical",
      "Lorentz factor is the printed explicit radical, maps to \\gamma, beta absent",
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

  test("Bindings: generic K binds kineticEnergy; L renders as E_emit, not bare E", () => {
    const file = loadConcordanceForPaper(paper);
    const k = resolveGlyph(paper, "me-s0-p7", "K", emptyManifestIndex, file);
    assert.ok(
      k.ok,
      "generic K must resolve in the H - E = K + C paragraph (s0-p7 after the 2026-09-19 merges)",
    );
    assert.ok("quantityId" in k.entry.binding);
    assert.equal(k.entry.binding.quantityId, "kineticEnergy");

    // L must not render as bare E: the paper also prints a generic E, and two
    // entries rendering to E in one scope would be a modern-glyph-collision.
    const lModern = modernSymbolFor(paper, "me-s0", "L", emptyManifestIndex, file);
    assert.equal(lModern, "E_{\\text{emit}}");
    const eModern = modernSymbolFor(paper, "me-s0", "E", emptyManifestIndex, file);
    assert.notEqual(lModern, eModern, "L and E must not render to the same modern glyph");
    logPass(
      "K-generic-and-L-modern-glyph",
      "K binds kineticEnergy; L renders E_emit distinct from E",
    );
  });

  test("Bindings: L/V^2 binds inertialMassDecrease", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "me-s0", "L/V^2", emptyManifestIndex, file);
    assert.ok(res.ok, "L/V^2 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "inertialMassDecrease");
    // Filed as a modernization (dispatch 259): as a rename to L/c² it would draw the record of the
    // mass decrease as L/c² = L/c². So the modern notation has no symbol for it.
    assert.equal(res.entry.operation.kind, "modernization");
    assert.equal(modernSymbolFor(paper, "me-s0", "L/V^2", emptyManifestIndex, file), undefined);
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
