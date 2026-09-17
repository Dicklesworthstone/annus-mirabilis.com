/**
 * Integration and unit tests for the Brownian motion notation concordance (ap-17-549).
 * Bead: am-not-entries-brownian-1rq
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { TestLogger } from "../../testing/log/logger.ts";
import { getQuantityRegistry } from "../quantities/registry.ts";
import type { PaperConcordance } from "../schemas/concordance.ts";
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

describe("am-not-entries-brownian-1rq: Brownian notation concordance", () => {
  const logger = new TestLogger("notation-brownian-motion");
  const paper = "brownian-motion";
  const emptyManifestIndex = buildSourceManifestIndex([]);

  test("Coverage: live brownian-motion.yaml loads and validates with 0 errors", () => {
    clearConcordanceCache();
    const file = loadConcordanceForPaper(paper);
    assert.equal(file.paper, "brownian-motion");
    assert.ok(
      file.entries.length >= 30,
      `Expected at least 30 entries, got ${file.entries.length}`,
    );

    const reg = getQuantityRegistry();
    const knownQuantityIds = reg.ids;
    const result = checkConcordance(file, { knownQuantityIds });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors, null, 2)}`);

    logger.log({
      testId: "coverage-load-validate",
      outcome: "passed",
      message: `Loaded ${file.entries.length} entries with 0 validation errors`,
      extra: { entryCount: file.entries.length },
    });
  });

  test("Bindings: k in §3 binds viscosity (danger collision) and renames to \\eta", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "bm-s3", "k", emptyManifestIndex, file);
    assert.ok(res.ok, "k in §3 must resolve");
    const entry = res.entry;
    assert.ok("quantityId" in entry.binding);
    assert.equal(entry.binding.quantityId, "viscosity");
    assert.equal(entry.collision?.severity, "danger");
    assert.ok(entry.collision?.collidesWithModern?.includes("boltzmannConstant"));

    const modern = modernSymbolFor(paper, "bm-s3", "k", emptyManifestIndex, file);
    assert.equal(modern, "\\eta");

    // Danger collision first uses
    const firstUseAnchor = firstUseInSection(paper, "bm-s3", "k", file);
    assert.equal(firstUseAnchor, "bm-s3-p2");
  });

  test("Bindings: \\nu in §1 binds numberDensity, never frequency", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "bm-s1", "\\nu", emptyManifestIndex, file);
    assert.ok(res.ok, "\\nu in §1 must resolve");
    const entry = res.entry;
    assert.ok("quantityId" in entry.binding);
    assert.equal(entry.binding.quantityId, "numberDensity");
    assert.notEqual(entry.binding.quantityId, "frequency");
    assert.equal(entry.collision?.severity, "caution");
    assert.ok(entry.collision?.collidesWithModern?.includes("frequency"));

    const modern = modernSymbolFor(paper, "bm-s1", "\\nu", emptyManifestIndex, file);
    assert.equal(modern, "n");
  });

  test("Bindings: f in §4 binds numberDensity, and modern glyph is not p", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "bm-s4", "f", emptyManifestIndex, file);
    assert.ok(res.ok, "f in §4 must resolve");
    const entry = res.entry;
    assert.ok("quantityId" in entry.binding);
    assert.equal(entry.binding.quantityId, "numberDensity");

    const modern = modernSymbolFor(paper, "bm-s4", "f", emptyManifestIndex, file);
    assert.notEqual(
      modern,
      "p",
      "f in §4 must not rename to probability density p without modernization",
    );
    assert.equal(modern, "n");
  });

  test("Bindings: \\varphi(\\Delta) binds transitionKernel with L^-1 dimension", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "bm-s4", "\\varphi(\\Delta)", emptyManifestIndex, file);
    assert.ok(res.ok, "\\varphi(\\Delta) in §4 must resolve");
    const entry = res.entry;
    assert.ok("quantityId" in entry.binding);
    assert.equal(entry.binding.quantityId, "transitionKernel");

    const reg = getQuantityRegistry();
    const qty = reg.quantities.get("transitionKernel");
    assert.ok(qty, "transitionKernel must be in quantity registry");
    assert.ok(qty.dimension, "transitionKernel must have dimension");
    assert.deepEqual(
      qty.dimension.map((d) => d.num / d.den),
      [-1, 0, 0, 0, 0, 0],
      "Dimension of transition kernel must be L^-1",
    );
  });

  test("Bindings: R binds molarGasConstant and N binds avogadroConstant", () => {
    const file = loadConcordanceForPaper(paper);
    const rRes = resolveGlyph(paper, "bm-s1", "R", emptyManifestIndex, file);
    assert.ok(rRes.ok, "R must resolve");
    assert.ok("quantityId" in rRes.entry.binding);
    assert.equal(rRes.entry.binding.quantityId, "molarGasConstant");

    const nRes = resolveGlyph(paper, "bm-s1", "N", emptyManifestIndex, file);
    assert.ok(nRes.ok, "N must resolve");
    assert.ok("quantityId" in nRes.entry.binding);
    assert.equal(nRes.entry.binding.quantityId, "avogadroConstant");
    assert.equal(modernSymbolFor(paper, "bm-s1", "N", emptyManifestIndex, file), "N_A");
  });

  test("Bindings: \\kappa at §2 resolves to scaled boltzmannConstant with scale 1/2, and modernGroupsFor returns 2\\kappa -> k_B", () => {
    const file = loadConcordanceForPaper(paper);
    const kappaRes = resolveGlyph(paper, "bm-s2", "\\kappa", emptyManifestIndex, file);
    assert.ok(kappaRes.ok, "\\kappa in §2 must resolve");
    const entry = kappaRes.entry;
    assert.ok("quantityId" in entry.binding);
    assert.equal(entry.binding.quantityId, "boltzmannConstant");
    assert.deepEqual(entry.binding.scale, { num: 1, den: 2 });
    assert.equal(entry.collision?.severity, "caution");

    const groups = modernGroupsFor(paper, "bm-s2", file);
    assert.ok(groups.some((g) => g.printedGroup === "2\\kappa" && g.modernGroup === "k_B"));
  });

  test("Bindings: lg at §2 resolves to operator rename \\ln and carries ISO note", () => {
    const file = loadConcordanceForPaper(paper);
    const lgRes = resolveGlyph(paper, "bm-s2", "\\lg", emptyManifestIndex, file);
    assert.ok(lgRes.ok, "\\lg in §2 must resolve");
    assert.ok("nonQuantityKind" in lgRes.entry.binding);
    assert.equal(lgRes.entry.binding.nonQuantityKind, "operator");
    assert.equal(modernSymbolFor(paper, "bm-s2", "\\lg", emptyManifestIndex, file), "\\ln");
    assert.ok(lgRes.entry.notes?.includes("ISO 80000-2"), "Must cite ISO 80000-2 / DIN 1302");
  });

  test("Bindings: p_\\nu binds stateVariable while p at §2 binds osmoticPressure, and index \\nu does not resolve to numberDensity", () => {
    const file = loadConcordanceForPaper(paper);
    const pNuRes = resolveGlyph(paper, "bm-s2", "p_\\nu", emptyManifestIndex, file);
    assert.ok(pNuRes.ok, "p_\\nu must resolve");
    assert.ok("quantityId" in pNuRes.entry.binding);
    assert.equal(pNuRes.entry.binding.quantityId, "stateVariable");

    const pRes = resolveGlyph(paper, "bm-s1", "p", emptyManifestIndex, file);
    assert.ok(pRes.ok, "p in §1 must resolve");
    assert.ok("quantityId" in pRes.entry.binding);
    assert.equal(pRes.entry.binding.quantityId, "osmoticPressure");

    const nuIndexRes = resolveGlyph(paper, "bm-s2", "\\nu", emptyManifestIndex, file);
    assert.ok(nuIndexRes.ok, "\\nu in §2 must resolve");
    assert.ok("nonQuantityKind" in nuIndexRes.entry.binding);
    assert.equal(nuIndexRes.entry.binding.nonQuantityKind, "index");
  });

  test("Bindings: §3's \\mu binds particleMass, never mobility, and §3's l binds columnLength", () => {
    const file = loadConcordanceForPaper(paper);
    const muRes = resolveGlyph(paper, "bm-s3", "\\mu", emptyManifestIndex, file);
    assert.ok(muRes.ok, "\\mu in §3 must resolve");
    assert.ok("quantityId" in muRes.entry.binding);
    assert.equal(muRes.entry.binding.quantityId, "particleMass");
    assert.notEqual(muRes.entry.binding.quantityId, "mobility");
    assert.equal(muRes.entry.collision?.severity, "caution");
    assert.ok(muRes.entry.collision?.collidesWithModern?.includes("mobility"));

    const lRes = resolveGlyph(paper, "bm-s3", "l", emptyManifestIndex, file);
    assert.ok(lRes.ok, "l in §3 must resolve");
    assert.ok("quantityId" in lRes.entry.binding);
    assert.equal(lRes.entry.binding.quantityId, "columnLength");
  });

  test("Bindings: B and J bind state-dependent quantities", () => {
    const file = loadConcordanceForPaper(paper);
    const bRes = resolveGlyph(paper, "bm-s2", "B", emptyManifestIndex, file);
    assert.ok(bRes.ok, "B in §2 must resolve");
    assert.ok("quantityId" in bRes.entry.binding);
    assert.equal(bRes.entry.binding.quantityId, "configurationIntegral");
    assert.equal(bRes.entry.binding.dimensionStatus, "state-dependent");

    const jRes = resolveGlyph(paper, "bm-s2", "J", emptyManifestIndex, file);
    assert.ok(jRes.ok, "J in §2 must resolve");
    assert.ok("quantityId" in jRes.entry.binding);
    assert.equal(jRes.entry.binding.quantityId, "configurationIntegralFactor");
    assert.equal(jRes.entry.binding.dimensionStatus, "state-dependent");
  });

  test("Unit conversion: 1.35 * 10^-2 poise converts to 1.35 * 10^-3 Pa*s in §5", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "bm-s5", "1.35 \\times 10^{-2}", emptyManifestIndex, file);
    assert.ok(res.ok, "Viscosity numerical constant in §5 must resolve");
    const entry = res.entry;
    assert.equal(entry.operation.kind, "unitConversion");
    const uc = entry.operation;
    assert.equal(uc.fromSystem, "cgs");
    assert.equal(uc.toSystem, "si");
    assert.equal(uc.factor, 0.1);

    // modernSymbolFor never returns unit conversion
    assert.equal(
      modernSymbolFor(paper, "bm-s5", "1.35 \\times 10^{-2}", emptyManifestIndex, file),
      undefined,
    );
  });

  test("Group rename: modernGroupsFor at §3 anchor returns R/N -> k_B", () => {
    const file = loadConcordanceForPaper(paper);
    const groups = modernGroupsFor(paper, "bm-s3", file);
    assert.ok(groups.some((g) => g.printedGroup === "R/N" && g.modernGroup === "k_B"));
  });

  test("Injectivity: broken file with f -> p and p -> p in §4 fails modern-glyph-collision", () => {
    const validFile = loadConcordanceForPaper(paper);
    const brokenFile: PaperConcordance = {
      ...validFile,
      entries: [
        ...validFile.entries.filter(
          (e) => !e.scope.includes("bm-s4") || (e.glyph.latex !== "f" && e.glyph.latex !== "p"),
        ),
        {
          id: "bm.f.brokenP",
          paper: "brownian-motion",
          scope: ["bm-s4"],
          glyph: { unicode: "f", latex: "f", variant: "plain" },
          meaning: "Number density",
          binding: { quantityId: "numberDensity" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "p" } },
          sources: { anchor: "bm-s4-p1" },
          verification: { printed: true, checkedAgainst: "test", by: "test", date: "2026-09-17" },
        },
        {
          id: "bm.p.brokenP",
          paper: "brownian-motion",
          scope: ["bm-s4"],
          glyph: { unicode: "p", latex: "p", variant: "plain" },
          meaning: "Pressure",
          binding: { quantityId: "osmoticPressure" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "p" } },
          sources: { anchor: "bm-s4-p1" },
          verification: { printed: true, checkedAgainst: "test", by: "test", date: "2026-09-17" },
        },
      ],
    };

    const result = checkConcordance(brokenFile);
    assert.ok(
      result.diagnostics.some((d) => d.rule === "modern-glyph-collision"),
      "Must fail modern-glyph-collision when two distinct glyphs map to 'p' in same scope",
    );
  });

  test("First uses: every danger collision entry has a first-use anchor", () => {
    const file = loadConcordanceForPaper(paper);
    const dangerEntries = file.entries.filter((e) => e.collision?.severity === "danger");
    assert.ok(dangerEntries.length > 0, "Must have at least one danger collision (k viscosity)");
    for (const de of dangerEntries) {
      assert.ok(de.collision?.firstUseAnchor, `Danger entry ${de.id} must have firstUseAnchor`);
      assert.ok(
        de.collision?.firstUseBySection && de.collision.firstUseBySection.length > 0,
        `Danger entry ${de.id} must have firstUseBySection`,
      );
    }
  });
});
