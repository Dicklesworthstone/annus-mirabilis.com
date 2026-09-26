/**
 * Integration tests for the special-relativity notation concordance (ap-17-891).
 * Bead: am-not-entries-relativity-f6e
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TestLogger } from "../../testing/log/logger.ts";
import { getQuantityRegistry } from "../quantities/registry.ts";
import type { PaperConcordance } from "../schemas/concordance.ts";
import {
  buildSourceManifestIndex,
  clearConcordanceCache,
  firstUseInSection,
  loadConcordanceForPaper,
  modernSymbolFor,
  resolveGlyph,
} from "./index.ts";
import { checkConcordance } from "./validation.ts";

describe("am-not-entries-relativity-f6e: special-relativity notation concordance", () => {
  const logger = new TestLogger("notation-special-relativity");
  const paper = "special-relativity";
  const emptyManifestIndex = buildSourceManifestIndex([]);
  const beadId = "am-not-entries-relativity-f6e";

  function logPass(testId: string, message: string, extra: Record<string, unknown> = {}): void {
    logger.log({
      testId,
      beadId,
      outcome: "passed",
      message,
      extra: { paper, ...extra },
    });
  }

  test("Coverage: live special-relativity.yaml loads and validates with 0 errors", () => {
    clearConcordanceCache();
    const file = loadConcordanceForPaper(paper);
    assert.equal(file.paper, "special-relativity");
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
      {
        entryCount: file.entries.length,
      },
    );
  });

  test("Honesty: no entry claims a human review; each is pending or an agent check that says so", () => {
    // Until 2026-09-24 every entry was pending and this required it. The glyphs have since been
    // read by an agent from the plate images (am-concordance-glyphs-verified-against-plates-13lx),
    // so the property worth holding is that none is presented as reviewed by a person. "Pending"
    // is the controlled wording the notation page reads (PENDING_SCAN in notationData.ts).
    const pendingScan = /^Pending facsimile scan\b/;
    const honest = (v: { checkedAgainst: string; by: string }) =>
      pendingScan.test(v.checkedAgainst) ||
      (v.by.startsWith("agent:") && v.checkedAgainst.includes("not a human review"));

    // Negatives: a named reviewer, and an agent record that does not say it is not a review.
    assert.equal(
      honest({ by: "A. Reviewer", checkedAgainst: "Plate of printed page 900." }),
      false,
    );
    assert.equal(honest({ by: "agent:X", checkedAgainst: "Plate of printed page 900." }), false);

    const file = loadConcordanceForPaper(paper);
    let agentChecked = 0;
    for (const entry of file.entries) {
      const { checkedAgainst, by } = entry.verification;
      assert.ok(
        honest(entry.verification),
        `${entry.id} must be pending, or an agent check that says it is not a human review`,
      );
      if (!pendingScan.test(checkedAgainst) && by.startsWith("agent:")) agentChecked += 1;
    }
    assert.ok(agentChecked > 0, "the population of agent checks is not empty");
    logPass("honesty-no-human-review-claimed", `${agentChecked} agent checks, none a review`);
  });

  test("Bindings: beta at a §3 anchor binds lorentzFactor, is danger, and renames to gamma", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s3", "\\beta", emptyManifestIndex, file);
    assert.ok(res.ok, "beta in §3 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "lorentzFactor");
    assert.notEqual(res.entry.binding.quantityId, "speedRatio");
    assert.equal(res.entry.collision?.severity, "danger");
    assert.ok(res.entry.collision?.collidesWithModern?.includes("speedRatio"));
    assert.equal(res.entry.operation.kind, "rename");
    assert.equal(modernSymbolFor(paper, "sr-s3", "\\beta", emptyManifestIndex, file), "\\gamma");
    // β is first printed on p. 900, in s3-p14, the paragraph that holds the transformation
    // equations and β's definition (eq-s3-d15, eq-s3-d16). s3-p1, on p. 897, prints no β.
    assert.equal(firstUseInSection(paper, "sr-s3", "\\beta", file), "sr-s3-p14");
    logPass("beta-is-gamma", "beta binds lorentzFactor and renames to gamma", {
      glyph: "\\beta",
      entryId: res.entry.id,
    });
  });

  test("Bindings: tau binds coordinateTimeMoving, never properTimeElapsed", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s3", "\\tau", emptyManifestIndex, file);
    assert.ok(res.ok, "tau in §3 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "coordinateTimeMoving");
    assert.notEqual(res.entry.binding.quantityId, "properTimeElapsed");
    logPass("tau-not-proper-time", "tau binds coordinateTimeMoving");
  });

  test("Bindings: phi at §3 is scaleFactorUnknown and at §7 is propagationAngleStationary", () => {
    const file = loadConcordanceForPaper(paper);
    const s3 = resolveGlyph(paper, "sr-s3", "\\varphi", emptyManifestIndex, file);
    assert.ok(s3.ok, "phi in §3 must resolve");
    assert.ok("quantityId" in s3.entry.binding);
    assert.equal(s3.entry.binding.quantityId, "scaleFactorUnknown");

    const s7 = resolveGlyph(paper, "sr-s7", "\\varphi", emptyManifestIndex, file);
    assert.ok(s7.ok, "phi in §7 must resolve");
    assert.ok("quantityId" in s7.entry.binding);
    assert.equal(s7.entry.binding.quantityId, "propagationAngleStationary");
    logPass("phi-scoped", "phi is scale in §3 and angle in §7");
  });

  test("Bindings: l at §3 is lengthProper; the §7 direction cosines are printed a, b, c", () => {
    // The plates of pp. 910 and 913 print the direction cosines of the wave normal as a, b, c
    // ("a, b, c die Richtungskosinus der Wellennormalen"), and no l, m or n is printed as one.
    const file = loadConcordanceForPaper(paper);
    const s3 = resolveGlyph(paper, "sr-s3", "l", emptyManifestIndex, file);
    assert.ok(s3.ok, "l in §3 must resolve");
    assert.ok("quantityId" in s3.entry.binding);
    assert.equal(s3.entry.binding.quantityId, "lengthProper");

    for (const letter of ["a", "b", "c"]) {
      const s7 = resolveGlyph(paper, "sr-s7", letter, emptyManifestIndex, file);
      assert.ok(s7.ok, `${letter} in §7 must resolve`);
      assert.ok("quantityId" in s7.entry.binding);
      assert.equal(s7.entry.binding.quantityId, "directionCosineStationary");
    }

    // The letter a is also printed in §3, where it is the transformation's undetermined
    // coefficient, not a direction cosine.
    const a3 = resolveGlyph(paper, "sr-s3", "a", emptyManifestIndex, file);
    assert.ok(a3.ok, "a in §3 must resolve");
    assert.ok("quantityId" in a3.entry.binding);
    assert.equal(a3.entry.binding.quantityId, "transformationCoefficientA");

    // Negative: a concordance that still recorded l, m, n in §7 would resolve them there.
    for (const letter of ["l", "m", "n"]) {
      assert.equal(
        resolveGlyph(paper, "sr-s7", letter, emptyManifestIndex, file).ok,
        false,
        `${letter} is not printed as a direction cosine in §7`,
      );
    }
    logPass("ell-scoped", "l is the rod length in §3; the direction cosines in §7 are a, b, c");
  });

  test("Bindings: L at §6 is magneticFieldStationary, not speed of light", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s6", "L", emptyManifestIndex, file);
    assert.ok(res.ok, "L in §6 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "magneticFieldStationary");
    assert.notEqual(res.entry.binding.quantityId, "speedOfLight");
    assert.equal(res.entry.collision?.severity, "danger");
    logPass("L-is-magnetic", "L in §6 binds magneticFieldStationary");
  });

  test("Bindings: N at §6 is magnetic, not Avogadro", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s6", "N", emptyManifestIndex, file);
    assert.ok(res.ok, "N in §6 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "magneticFieldStationary");
    assert.notEqual(res.entry.binding.quantityId, "avogadroConstant");
    logPass("N-is-magnetic", "N in §6 binds magneticFieldStationary");
  });

  test("Bindings: kappa at §5 binds speedDeficitFromLight", () => {
    const file = loadConcordanceForPaper(paper);
    // The plate of p. 906 prints the curled kappa (U+03F0), which the edition and the display
    // eq-s5-d7 write \varkappa: the entry is found by the letter the paper prints.
    const res = resolveGlyph(paper, "sr-s5", "\\varkappa", emptyManifestIndex, file);
    assert.ok(res.ok, "kappa in §5 must resolve");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "speedDeficitFromLight");
    const qty = getQuantityRegistry().quantities.get("speedDeficitFromLight");
    assert.ok(qty?.dimension);
    assert.deepEqual(
      qty.dimension.map((d) => d.num / d.den),
      [1, 0, -1, 0, 0, 0],
    );
    logPass("kappa-is-speed", "kappa binds speedDeficitFromLight");
  });

  test("Modern-notation: printed x' in §3 is the Galilean auxiliary, xi is the moving-frame x'", () => {
    const file = loadConcordanceForPaper(paper);
    const aux = resolveGlyph(paper, "sr-s3", "x'", emptyManifestIndex, file);
    assert.ok(aux.ok, "printed x' in §3 must resolve");
    assert.ok("quantityId" in aux.entry.binding);
    assert.equal(aux.entry.binding.quantityId, "auxiliaryGalileanCoordinate");
    const auxModern = modernSymbolFor(paper, "sr-s3", "x'", emptyManifestIndex, file);
    assert.equal(auxModern, "\\tilde{x}");

    const xi = resolveGlyph(paper, "sr-s3", "\\xi", emptyManifestIndex, file);
    assert.ok(xi.ok, "xi in §3 must resolve");
    assert.ok("quantityId" in xi.entry.binding);
    assert.equal(xi.entry.binding.quantityId, "coordinatePositionMoving");
    const xiModern = modernSymbolFor(paper, "sr-s3", "\\xi", emptyManifestIndex, file);
    assert.equal(xiModern, "x'");
    assert.notEqual(auxModern, xiModern);
    logPass("galilean-auxiliary", "§3 x' and xi take distinct modern glyphs");
  });

  test("Modern-notation: printed t'_A does not become bare t'", () => {
    const file = loadConcordanceForPaper(paper);
    const modern = modernSymbolFor(paper, "sr-s1", "t'_A", emptyManifestIndex, file);
    assert.ok(modern, "t'_A must have a modern form");
    assert.notEqual(modern, "t'");
    assert.ok(modern.includes("t_A"), `expected a t_A-based glyph, got ${modern}`);
    logPass("tAret-not-tprime", "t'_A modern form is not bare t'");
  });

  test("Toggle contract: Y' in §6 is a rename; Gaussian-to-SI is recorded and not applied", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s6", "Y'", emptyManifestIndex, file);
    assert.ok(res.ok, "Y' in §6 must resolve");
    assert.equal(res.entry.operation.kind, "rename");
    // The note is reader-facing, so it names the unit systems as a reader does. The structured
    // record of the conversion is asserted below. includes("si") passed on "since" and "side".
    assert.ok(res.entry.notes?.includes("Gaussian"));
    assert.ok(/\bSI\b/.test(res.entry.notes ?? ""));
    assert.equal(modernSymbolFor(paper, "sr-s6", "Y'", emptyManifestIndex, file), "E'_y");

    const conv = resolveGlyph(paper, "sr-s6", "E_{\\mathrm{G}}", emptyManifestIndex, file);
    assert.ok(conv.ok, "Gaussian unit-conversion record must resolve");
    assert.equal(conv.entry.operation.kind, "unitConversion");
    if (conv.entry.operation.kind === "unitConversion") {
      assert.equal(conv.entry.operation.fromSystem, "gaussian-cgs");
      assert.equal(conv.entry.operation.toSystem, "si");
    }
    assert.equal(
      modernSymbolFor(paper, "sr-s6", "E_{\\mathrm{G}}", emptyManifestIndex, file),
      undefined,
    );
    logPass("Yprime-rename-not-conversion", "toggle applies rename only");
  });

  test("Toggle contract: §10 transverse mass is a modernization the toggle never applies", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s10", "\\mu\\beta^{2}", emptyManifestIndex, file);
    assert.ok(res.ok, "printed transverse-mass coefficient must resolve");
    assert.equal(res.entry.operation.kind, "modernization");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "transverseMassComoving");
    assert.equal(
      modernSymbolFor(paper, "sr-s10", "\\mu\\beta^{2}", emptyManifestIndex, file),
      undefined,
    );
    logPass("transverse-mass-modernization", "toggle does not apply modernization");
  });

  test("V renames to c; that is a rename, not a modernization", () => {
    const file = loadConcordanceForPaper(paper);
    const res = resolveGlyph(paper, "sr-s3", "V", emptyManifestIndex, file);
    assert.ok(res.ok);
    assert.equal(res.entry.operation.kind, "rename");
    assert.ok("quantityId" in res.entry.binding);
    assert.equal(res.entry.binding.quantityId, "speedOfLight");
    assert.equal(modernSymbolFor(paper, "sr-s3", "V", emptyManifestIndex, file), "c");
    logPass("V-to-c-rename", "V -> c is a rename");
  });

  test("Modern-only rapidity glyph is chi and is not a printed entry", () => {
    const file = loadConcordanceForPaper(paper);
    const rapidity = file.modernOnlySymbols?.find((m) => {
      return "quantityId" in m.binding && m.binding.quantityId === "rapidity";
    });
    assert.ok(rapidity, "rapidity must be declared in modernOnlySymbols");
    assert.equal(rapidity.glyph.latex, "\\chi");
    assert.equal(
      file.entries.some((e) => e.glyph.latex === "\\chi" || e.glyph.unicode === "χ"),
      false,
    );
    const transverse = file.modernOnlySymbols?.find((m) => {
      return "quantityId" in m.binding && m.binding.quantityId === "ansatzTransverseScale";
    });
    assert.ok(transverse);
    assert.notEqual(transverse.glyph.latex, "k");
    assert.notEqual(transverse.glyph.unicode, "k");
    logPass("rapidity-chi", "rapidity is chi; ansatz transverse is not k");
  });

  test("First uses: every danger collision has a first-use anchor", () => {
    const file = loadConcordanceForPaper(paper);
    const danger = file.entries.filter((e) => e.collision?.severity === "danger");
    assert.ok(danger.length >= 3, "beta, tau, x', t'_A, L, N should be danger");
    for (const de of danger) {
      assert.ok(de.collision?.firstUseAnchor, `${de.id} missing firstUseAnchor`);
      assert.ok(
        de.collision?.firstUseBySection && de.collision.firstUseBySection.length > 0,
        `${de.id} missing firstUseBySection`,
      );
    }
    logPass("danger-first-use", `${danger.length} danger collisions carry first-use anchors`);
  });

  test("Planted negative: mapping both xi and printed x' to modern x' in §3 fails modern-glyph-collision", () => {
    const valid = loadConcordanceForPaper(paper);
    const broken: PaperConcordance = {
      ...valid,
      entries: valid.entries.map((e) => {
        if (e.id === "sr.xprime.auxiliaryGalileanCoordinate") {
          return {
            id: e.id,
            paper: e.paper,
            scope: e.scope,
            glyph: e.glyph,
            meaning: e.meaning,
            binding: e.binding,
            operation: {
              kind: "rename" as const,
              target: { form: "symbol" as const, modernGlyph: "x'" },
            },
            sources: e.sources,
            verification: e.verification,
          };
        }
        if (e.id === "sr.xi.coordinatePositionMoving") {
          return {
            id: e.id,
            paper: e.paper,
            scope: e.scope,
            glyph: e.glyph,
            meaning: e.meaning,
            binding: e.binding,
            operation: e.operation,
            sources: e.sources,
            verification: e.verification,
          };
        }
        return e;
      }),
    };
    const result = checkConcordance(broken);
    assert.ok(
      result.diagnostics.some((d) => d.rule === "modern-glyph-collision"),
      "Must fail when auxiliary x' and moving-frame xi share modern x' in §3",
    );
    logPass("planted-xprime-collision", "shared modern x' in §3 is refused");
  });
});
