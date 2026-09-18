/**
 * Glyph collision tests (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 4:
 * 1. The §3 fixture with and without the distinct auxiliary glyph.
 * 2. Modern-form collision between two quantities in one equation (error).
 * 3. The same collision in printed form (warning, not error).
 * 4. A modernOnlySymbols glyph that collides with a renamed symbol (error).
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import { checkEquationGlyphCollisions } from "./collisions.ts";
import { renderEquationLatex } from "./render.ts";
import { NotationScopeError } from "./types.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const rel = (
  operator: "=" | "approx" | "define",
  left: Expression,
  right: Expression,
): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
});

test("collisions.test: Paper 3 §3 auxiliary coordinate x' vs xi", () => {
  const realConcordance = loadConcordanceForPaper("special-relativity");

  // An equation in §3 relating the Galilean auxiliary coordinate to the moving coordinate:
  // e.g. x_aux = xi / beta
  const section3Tree: Expression = rel(
    "=",
    sym("x_prime", "auxiliaryGalileanCoordinate"),
    sym("xi", "coordinatePositionMoving"),
  );

  // 1. With standard concordance: auxiliary coordinate modernizes to \tilde{x}, xi modernizes to x'
  // Distinct glyphs -> PASSES
  const resultPass = checkEquationGlyphCollisions(section3Tree, {
    perspective: "modern",
    paper: "special-relativity",
    sectionId: "sr-s3",
    concordance: realConcordance,
    equationId: "eq-sr-s3-aux-check",
  });

  assert.equal(resultPass.ok, true, "Distinct modern glyphs must pass collision check");
  assert.equal(resultPass.diagnostics.length, 0);

  // 2. Without distinct auxiliary glyph (both map to x')
  // We simulate a mutated concordance where auxiliaryGalileanCoordinate also modernizes to x'
  const collidingConcordance: PaperConcordance = {
    ...realConcordance,
    entries: realConcordance.entries.map((entry) => {
      if (entry.id === "sr.xprime.auxiliaryGalileanCoordinate") {
        return {
          ...entry,
          operation: {
            kind: "rename" as const,
            target: {
              form: "symbol" as const,
              modernGlyph: "x'", // Collides with xi!
            },
          },
        };
      }
      return entry;
    }),
  };

  const resultFail = checkEquationGlyphCollisions(section3Tree, {
    perspective: "modern",
    paper: "special-relativity",
    sectionId: "sr-s3",
    concordance: collidingConcordance,
    equationId: "eq-sr-s3-aux-colliding",
  });

  assert.equal(resultFail.ok, false, "Collision between auxiliary x' and xi must fail");
  assert.ok(resultFail.diagnostics.some((d) => d.kind === "error" && d.rule === "modern-glyph-collision"));
  assert.ok(resultFail.diagnostics[0]?.quantityIds.includes("auxiliaryGalileanCoordinate"));
  assert.ok(resultFail.diagnostics[0]?.quantityIds.includes("coordinatePositionMoving"));
});

test("collisions.test: modern-form collision is ERROR, printed-form collision is WARNING", () => {
  // Two distinct quantities: Wien beta and Lorentz beta
  const betaTree: Expression = rel(
    "=",
    sym("beta_1", "wienConstantBeta"),
    sym("beta_2", "lorentzFactor"),
  );

  // In printed perspective: both printed as \beta
  const printedResult = checkEquationGlyphCollisions(betaTree, {
    perspective: "source",
    registry: {
      wienConstantBeta: {
        id: "wienConstantBeta",
        name: "Wien beta",
        glyph: "\\beta",
        dimension: [],
        unit: "K s",
        displayUnit: "K s",
        displayPower: 0,
        semanticKind: "constant",
        role: "constant",
        definition: "",
      },
      lorentzFactor: {
        id: "lorentzFactor",
        name: "Lorentz factor",
        glyph: "\\beta",
        dimension: [],
        unit: "1",
        displayUnit: "1",
        displayPower: 0,
        semanticKind: "variable",
        role: "result",
        definition: "",
      },
    },
    equationId: "eq-beta-pair",
  });

  // Printed collision is a review WARNING, not an error -> ok is true
  assert.equal(printedResult.ok, true, "Printed collision must be accepted as warning");
  assert.equal(printedResult.diagnostics.length, 1);
  assert.equal(printedResult.diagnostics[0]?.kind, "warning");
  assert.equal(printedResult.diagnostics[0]?.rule, "printed-glyph-collision");

  // In modern perspective with mock registry mapping both to \gamma -> ERROR
  const modernCollidingResult = checkEquationGlyphCollisions(betaTree, {
    perspective: "modern",
    registry: {
      wienConstantBeta: {
        id: "wienConstantBeta",
        name: "Wien beta",
        glyph: "\\gamma",
        dimension: [],
        unit: "K s",
        displayUnit: "K s",
        displayPower: 0,
        semanticKind: "constant",
        role: "constant",
        definition: "",
      },
      lorentzFactor: {
        id: "lorentzFactor",
        name: "Lorentz factor",
        glyph: "\\gamma",
        dimension: [],
        unit: "1",
        displayUnit: "1",
        displayPower: 0,
        semanticKind: "variable",
        role: "result",
        definition: "",
      },
    },
    equationId: "eq-modern-collision",
    strictConcordance: false,
  });

  assert.equal(modernCollidingResult.ok, false, "Modern collision must be an error");
  assert.equal(modernCollidingResult.diagnostics[0]?.kind, "error");
  assert.equal(modernCollidingResult.diagnostics[0]?.rule, "modern-glyph-collision");
});

test("collisions.test: collision with modernOnlySymbols is an ERROR", () => {
  const cSR = loadConcordanceForPaper("special-relativity");

  // Suppose an equation in special-relativity has a symbol that happens to match
  // a modernOnlySymbol registered in the concordance
  const concordanceWithModernOnly: PaperConcordance = {
    ...cSR,
    modernOnlySymbols: [
      {
        id: "sr.mos.gamma",
        glyph: { unicode: "γ", latex: "\\gamma", variant: "plain" },
        binding: { quantityId: "lorentzFactorModernOnly" },
        scope: ["sr-s3"],
        introducedBy: "Modern convention",
        label: "Lorentz factor modern symbol",
      },
    ],
  };

  const tree: Expression = sym("beta", "lorentzFactor");

  const result = checkEquationGlyphCollisions(tree, {
    perspective: "modern",
    paper: "special-relativity",
    sectionId: "sr-s3",
    concordance: concordanceWithModernOnly,
    equationId: "eq-test-mos",
  });

  assert.equal(result.ok, false, "Collision with modernOnlySymbol must fail");
  assert.ok(result.diagnostics.some((d) => d.rule === "modern-only-symbol-collision"));
});

test("collisions.test: renderEquationLatex throws NotationScopeError on modern glyph collision (render.ts:391)", () => {
  const realConcordance = loadConcordanceForPaper("special-relativity");

  // Mutated concordance where auxiliaryGalileanCoordinate also modernizes to x'
  const collidingConcordance: PaperConcordance = {
    ...realConcordance,
    entries: realConcordance.entries.map((e) => {
      if (e.id === "sr.xprime.auxiliaryGalileanCoordinate") {
        return {
          ...e,
          operation: {
            ...e.operation,
            target: {
              form: "symbol" as const,
              modernGlyph: "x'",
            },
          },
        };
      }
      return e;
    }),
  };

  const collidingTree: Expression = rel(
    "=",
    sym("x_prime", "auxiliaryGalileanCoordinate"),
    sym("xi", "coordinatePositionMoving"),
  );

  // REJECTION: renderEquationLatex must throw NotationScopeError with kind: "glyph-collision"
  assert.throws(
    () => {
      renderEquationLatex({
        equation: {
          id: "eq-sr-collision-throw-test",
          paper: "special-relativity",
          sectionId: "sr-s3",
          tree: collidingTree,
        },
        form: { kind: "modern" },
        color: "plain",
        concordance: collidingConcordance,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotationScopeError);
      assert.equal(err.kind, "glyph-collision");
      assert.equal(err.equationId, "eq-sr-collision-throw-test");
      assert.match(err.message, /eq-sr-collision-throw-test/);
      return true;
    },
  );

  // ACCEPTANCE COUNTERPART: with non-colliding concordance (auxiliary -> \tilde{x}), renders cleanly
  const nonCollidingRes = renderEquationLatex({
    equation: {
      id: "eq-sr-collision-pass-test",
      paper: "special-relativity",
      sectionId: "sr-s3",
      tree: collidingTree,
    },
    form: { kind: "modern" },
    color: "plain",
    concordance: realConcordance,
  });
  assert.ok(nonCollidingRes.latex.length > 0);
  assert.equal(nonCollidingRes.formRelation, "rename-only");
});
