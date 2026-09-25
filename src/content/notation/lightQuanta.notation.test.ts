/**
 * Integration tests for the light-quanta notation concordance (ap-17-132).
 * Bead: am-not-entries-light-quanta-9cb
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
  modernGroupsFor,
  modernSymbolFor,
  resolveGlyph,
} from "./index.ts";
import { checkConcordance } from "./validation.ts";

describe("am-not-entries-light-quanta-9cb: light-quanta notation concordance", () => {
  const logger = new TestLogger("notation-light-quanta");
  const paper = "light-quanta";
  const emptyManifestIndex = buildSourceManifestIndex([]);
  const beadId = "am-not-entries-light-quanta-9cb";

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

  test("Coverage: live light-quanta.yaml loads and validates with 0 errors", () => {
    clearConcordanceCache();
    const file = loadConcordanceForPaper(paper);
    assert.equal(file.paper, "light-quanta");
    assert.ok(
      file.entries.length >= 40,
      `Expected at least 40 entries, got ${file.entries.length}`,
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

  test("Honesty: no entry claims a human review; each is pending or an agent check that says so", () => {
    // Until 2026-09-24 every entry was pending and this required it. The glyphs have since been
    // read by an agent from the plate images (am-concordance-glyphs-verified-against-plates-13lx),
    // so the property worth holding is that none is presented as reviewed by a person.
    const file = loadConcordanceForPaper(paper);
    let agentChecked = 0;
    for (const entry of file.entries) {
      const { checkedAgainst, by } = entry.verification;
      const pending = checkedAgainst.toLowerCase().includes("pending");
      const agentCheck = by.startsWith("agent:") && checkedAgainst.includes("not a human review");
      if (agentCheck) agentChecked += 1;
      assert.ok(
        pending || agentCheck,
        `${entry.id} must be pending, or an agent check that says it is not a human review`,
      );
    }
    assert.ok(agentChecked > 0, "the population of agent checks is not empty");
    logPass("honesty-no-human-review-claimed", `${agentChecked} agent checks, none a review`);
  });

  test("Bindings: beta at a §2 anchor binds wienConstantBeta, is danger, and is not the Lorentz factor", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "lq-s2", "\\beta", emptyManifestIndex, file);
    assert.ok(res.ok, "beta in §2 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "wienConstantBeta");
    assert.notEqual(res.entry.binding.quantityId, "lorentzFactor");
    assert.notEqual(res.entry.binding.quantityId, "speedRatio");
    assert.equal(res.entry.collision?.severity, "danger");
    assert.ok(res.entry.collision?.collidesWith?.includes("lorentzFactor"));
    assert.ok(res.entry.collision?.collidesWith?.includes("speedRatio"));
    assert.equal(res.entry.operation.kind, "rename");
    if (res.entry.operation.kind === "rename") {
      assert.equal(res.entry.operation.target.form, "expression");
    }
    assert.equal(modernSymbolFor(paper, "lq-s2", "\\beta", emptyManifestIndex, file), "h/k_B");
    // Page 136: s2-p1 prints no symbol; beta is first printed in s2-p2, in Planck's formula.
    assert.equal(firstUseInSection(paper, "lq-s2", "\\beta", file), "lq-s2-p2");
    logPass("beta-is-wien-constant", "beta binds wienConstantBeta, not lorentzFactor", {
      glyph: "\\beta",
      entryId: res.entry.id,
      check: "wienConstantBeta",
    });
  });

  test("Bindings: rho_nu binds frequencyEnergyDensity, never wavelengthEnergyDensity", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "lq-s1", "\\rho_\\nu", emptyManifestIndex, file);
    assert.ok(res.ok, "rho_nu must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "frequencyEnergyDensity");
    assert.notEqual(res.entry.binding.quantityId, "wavelengthEnergyDensity");
    logPass("rho-nu-frequency-density", "rho_nu binds frequencyEnergyDensity");
  });

  test("Bindings: S at §4 binds radiationEntropy, and at §5 binds entropy", () => {
    const file = loadConcordanceForPaper(paper);
    const s4 = resolveGlyph(paper, "lq-s4", "S", emptyManifestIndex, file);
    assert.ok(s4.ok, "S in §4 must resolve");
    assert.ok("quantityId" in s4.entry.binding);
    assert.equal(s4.entry.binding.quantityId, "radiationEntropy");

    const s5 = resolveGlyph(paper, "lq-s5", "S", emptyManifestIndex, file);
    assert.ok(s5.ok, "S in §5 must resolve");
    assert.ok("quantityId" in s5.entry.binding);
    assert.equal(s5.entry.binding.quantityId, "entropy");
    logPass("S-scoped", "S is radiationEntropy in §4 and entropy in §5");
  });

  test("Bindings: E at §8 binds gramEquivalentCharge, never radiationEnergy; at §5 footnote binds systemEnergy", () => {
    const file = loadConcordanceForPaper(paper);
    const s8 = resolveGlyph(paper, "lq-s8", "E", emptyManifestIndex, file);
    assert.ok(s8.ok, "E in §8 must resolve");
    assert.ok("quantityId" in s8.entry.binding);
    assert.equal(s8.entry.binding.quantityId, "gramEquivalentCharge");
    assert.notEqual(s8.entry.binding.quantityId, "radiationEnergy");

    const s5fn = resolveGlyph(paper, "lq-s5-fn1", "E", emptyManifestIndex, file);
    assert.ok(s5fn.ok, "E in §5 footnote must resolve");
    assert.ok("quantityId" in s5fn.entry.binding);
    assert.equal(s5fn.entry.binding.quantityId, "systemEnergy");
    logPass("E-three-meanings", "E is charge in §8 and system energy in the §5 footnote");
  });

  test("Bindings: L at §9 binds absorbedLightEnergy, never speedOfLight", () => {
    const file = loadConcordanceForPaper(paper);
    const s9 = resolveGlyph(paper, "lq-s9", "L", emptyManifestIndex, file);
    assert.ok(s9.ok, "L in §9 must resolve");
    assert.ok("quantityId" in s9.entry.binding);
    assert.equal(s9.entry.binding.quantityId, "absorbedLightEnergy");
    assert.notEqual(s9.entry.binding.quantityId, "speedOfLight");

    const s1 = resolveGlyph(paper, "lq-s1", "L", emptyManifestIndex, file);
    assert.ok(s1.ok, "L in §1 must resolve");
    assert.ok("quantityId" in s1.entry.binding);
    assert.equal(s1.entry.binding.quantityId, "speedOfLight");
    logPass("L-scoped", "L is c in §§1–2 and absorbed light energy in §9");
  });

  test("Bindings: T in the §1 footnote binds longAveragingInterval, never temperature; alpha_nu binds fourierPhase", () => {
    const file = loadConcordanceForPaper(paper);
    const tFn = resolveGlyph(paper, "lq-s1-fn3", "T", emptyManifestIndex, file);
    assert.ok(tFn.ok, "T in §1 footnote must resolve");
    assert.ok("quantityId" in tFn.entry.binding);
    assert.equal(tFn.entry.binding.quantityId, "longAveragingInterval");
    assert.notEqual(tFn.entry.binding.quantityId, "temperature");

    const alphaNu = resolveGlyph(paper, "lq-s1-fn3", "\\alpha_\\nu", emptyManifestIndex, file);
    assert.ok(alphaNu.ok, "alpha_nu must resolve");
    assert.ok("quantityId" in alphaNu.entry.binding);
    assert.equal(alphaNu.entry.binding.quantityId, "fourierPhase");
    assert.notEqual(alphaNu.entry.binding.quantityId, "wienConstantAlpha");
    logPass("footnote-T-and-alpha-nu", "footnote T is a time interval; alpha_nu is a phase");
  });

  test("Bindings: lambda at §3 binds lagrangeMultiplier", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "lq-s3", "\\lambda", emptyManifestIndex, file);
    assert.ok(res.ok, "lambda in §3 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "lagrangeMultiplier");
    logPass("lambda-lagrange", "lambda in §3 is the Lagrange multiplier");
  });

  test("Bindings: phi at §5 binds entropy, and C binds universalEntropyConstant", () => {
    const file = loadConcordanceForPaper(paper);
    const phi = resolveGlyph(paper, "lq-s5", "\\varphi", emptyManifestIndex, file);
    assert.ok(phi.ok, "phi in §5 must resolve");
    assert.ok("quantityId" in phi.entry.binding);
    assert.equal(phi.entry.binding.quantityId, "entropy");

    const c = resolveGlyph(paper, "lq-s5", "C", emptyManifestIndex, file);
    assert.ok(c.ok, "C in §5 must resolve");
    assert.ok("quantityId" in c.entry.binding);
    assert.equal(c.entry.binding.quantityId, "universalEntropyConstant");
    logPass("phi-and-C-in-s5", "phi(W) is entropy; C is the universal entropy constant");
  });

  test("Bindings: R binds molarGasConstant and N binds avogadroConstant", () => {
    const file = loadConcordanceForPaper(paper);
    const r = resolveGlyph(paper, "lq-s2", "R", emptyManifestIndex, file);
    assert.ok(r.ok, "R must resolve");
    assert.ok("quantityId" in r.entry.binding);
    assert.equal(r.entry.binding.quantityId, "molarGasConstant");

    const n = resolveGlyph(paper, "lq-s2", "N", emptyManifestIndex, file);
    assert.ok(n.ok, "N must resolve");
    assert.ok("quantityId" in n.entry.binding);
    assert.equal(n.entry.binding.quantityId, "avogadroConstant");
    assert.equal(modernSymbolFor(paper, "lq-s2", "N", emptyManifestIndex, file), "N_A");
    logPass("R-and-N", "R is molarGasConstant; N is avogadroConstant");
  });

  test("Bindings: lg renders as ln and carries the ISO first-use note", () => {
    const file = loadConcordanceForPaper(paper);
    const lg = resolveGlyph(paper, "lq-s2", "\\lg", emptyManifestIndex, file);
    assert.ok(lg.ok, "lg must resolve");
    assert.ok("nonQuantityKind" in lg.entry.binding);
    assert.equal(lg.entry.binding.nonQuantityKind, "operator");
    assert.equal(modernSymbolFor(paper, "lq-s2", "\\lg", emptyManifestIndex, file), "\\ln");
    assert.ok(lg.entry.notes?.includes("ISO 80000-2"));
    logPass("lg-is-ln", "lg is the natural logarithm, with an ISO note");
  });

  test("Group and expression renames: modernGroupsFor at §6 returns R beta / N -> h, and at §1 returns R/N -> k_B", () => {
    const file = loadConcordanceForPaper(paper);
    const s6 = modernGroupsFor(paper, "lq-s6", file);
    assert.ok(s6.some((g) => g.printedGroup === "R\\beta/N" && g.modernGroup === "h"));
    const s1 = modernGroupsFor(paper, "lq-s1", file);
    assert.ok(s1.some((g) => g.printedGroup === "R/N" && g.modernGroup === "k_B"));
    logPass("group-renames", "R/N -> k_B and R beta / N -> h");
  });

  test("Unit conversion: §8 abvolt and abcoulomb are emu-cgs to si with conventional exactness", () => {
    const file = loadConcordanceForPaper(paper);
    const abV = resolveGlyph(paper, "lq-s8", "\\mathrm{abV}", emptyManifestIndex, file);
    assert.ok(abV.ok, "abvolt must resolve");
    assert.equal(abV.entry.operation.kind, "unitConversion");
    if (abV.entry.operation.kind === "unitConversion") {
      assert.equal(abV.entry.operation.fromSystem, "emu-cgs");
      assert.equal(abV.entry.operation.toSystem, "si");
      assert.equal(abV.entry.operation.factor, 1e-8);
      assert.equal(abV.entry.operation.exact, false);
    }
    assert.equal(
      modernSymbolFor(paper, "lq-s8", "\\mathrm{abV}", emptyManifestIndex, file),
      undefined,
    );

    const abC = resolveGlyph(paper, "lq-s8", "\\mathrm{abC}", emptyManifestIndex, file);
    assert.ok(abC.ok, "abcoulomb must resolve");
    assert.equal(abC.entry.operation.kind, "unitConversion");
    if (abC.entry.operation.kind === "unitConversion") {
      assert.equal(abC.entry.operation.fromSystem, "emu-cgs");
      assert.equal(abC.entry.operation.toSystem, "si");
      assert.equal(abC.entry.operation.factor, 10);
      assert.equal(abC.entry.operation.exact, false);
    }

    const e = resolveGlyph(paper, "lq-s8", "E", emptyManifestIndex, file);
    assert.ok(e.ok);
    // The conversion to 9.6 · 10⁴ C/mol, written as a reader reads it rather than as 9.6e4.
    assert.ok(e.entry.notes?.includes("9.6 · 10⁴"));

    const statV = resolveGlyph(paper, "lq-s8", "\\mathrm{statV}", emptyManifestIndex, file);
    assert.ok(statV.ok, "statvolt must resolve");
    assert.equal(statV.entry.operation.kind, "unitConversion");
    if (statV.entry.operation.kind === "unitConversion") {
      assert.equal(statV.entry.operation.fromSystem, "gaussian-cgs");
      assert.equal(statV.entry.operation.factor, 299.792458);
      assert.equal(statV.entry.operation.exact, false);
    }
    assert.ok(statV.entry.notes?.toLowerCase().includes("modern restatement"));
    logPass(
      "unit-conversion-emu-cgs",
      "abvolt and abcoulomb are conventional emu-cgs conversions",
      {
        unitSystem: "emu-cgs",
      },
    );
  });

  test("First uses: every danger collision entry has a first-use anchor", () => {
    const file = loadConcordanceForPaper(paper);
    const dangerEntries = file.entries.filter((e) => e.collision?.severity === "danger");
    assert.ok(dangerEntries.length > 0, "Must have at least one danger collision (Wien beta)");
    for (const de of dangerEntries) {
      assert.ok(de.collision?.firstUseAnchor, `Danger entry ${de.id} must have firstUseAnchor`);
      assert.ok(
        de.collision?.firstUseBySection && de.collision.firstUseBySection.length > 0,
        `Danger entry ${de.id} must have firstUseBySection`,
      );
    }
    logPass("danger-first-uses", "Danger collisions carry first-use anchors");
  });

  test("Section 9 is present: J, j, and absorbed L all resolve", () => {
    const file = loadConcordanceForPaper(paper);
    const J = resolveGlyph(paper, "lq-s9", "J", emptyManifestIndex, file);
    const j = resolveGlyph(paper, "lq-s9", "j", emptyManifestIndex, file);
    const L = resolveGlyph(paper, "lq-s9", "L", emptyManifestIndex, file);
    assert.ok(J.ok && j.ok && L.ok, "§9 ionization glyphs must all resolve");
    assert.ok("quantityId" in J.entry.binding);
    assert.equal(J.entry.binding.quantityId, "ionizationWorkPerGramEquivalent");
    assert.ok("quantityId" in j.entry.binding);
    assert.equal(j.entry.binding.quantityId, "ionizedGramMolecules");
    logPass("section-9-present", "§9 ionization symbols are in the concordance");
  });
});
