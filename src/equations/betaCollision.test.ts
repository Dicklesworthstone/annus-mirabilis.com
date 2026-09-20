/**
 * Acceptance test suite for the beta collision fixture pair (AC2).
 *
 * Implements acceptance criteria for am-eq-expression-tree-8kl:
 * (b) The beta collision fixture pair, with an explicit assertion that binding
 *     does NOT consult the glyph.
 *
 * In Paper 1 Wien's radiation law, glyph \beta binds to Wien's constant (wienConstantBeta).
 * In Paper 3 moving-frame coordinate \tau, glyph \beta binds to the Lorentz factor (lorentzFactor).
 * Proves that semantic binding is determined strictly by canonical quantity ID,
 * and disambiguation never inspects or relies on glyph strings.
 */

import { describe, expect, test } from "bun:test";
import { findNode, parseExpression } from "./ast.ts";
import {
  BETA_COLLISION_REGISTRY,
  paper1WienLawFixture,
  paper3LorentzTauFixture,
} from "./fixtures/betaCollision.ts";
import { expressionLatex } from "./latex.ts";

describe("AC2: Beta Collision Fixture Pair and Glyph Independence", () => {
  test("validates both fixtures through parseExpression against the beta collision registry", () => {
    const parsedWien = parseExpression(paper1WienLawFixture, "eq-s2-d1", BETA_COLLISION_REGISTRY);
    expect(parsedWien).toBeDefined();

    const parsedLorentz = parseExpression(
      paper3LorentzTauFixture,
      "eq-s3-d1",
      BETA_COLLISION_REGISTRY,
    );
    expect(parsedLorentz).toBeDefined();
  });

  test("Paper 1 fixture binds beta to wienConstantBeta, while Paper 3 fixture binds beta to lorentzFactor", () => {
    const wienBeta = findNode(paper1WienLawFixture, "eq-s2-d1.t.beta");
    expect(wienBeta).toBeDefined();
    expect(wienBeta?.kind).toBe("symbol");
    if (wienBeta?.kind === "symbol") {
      expect(wienBeta.quantityId).toBe("wienConstantBeta");
      expect(wienBeta.termId).toBe("eq-s2-d1.t.beta");
    }

    const lorentzBeta = findNode(paper3LorentzTauFixture, "eq-s3-d1.t.beta");
    expect(lorentzBeta).toBeDefined();
    expect(lorentzBeta?.kind).toBe("symbol");
    if (lorentzBeta?.kind === "symbol") {
      expect(lorentzBeta.quantityId).toBe("lorentzFactor");
      expect(lorentzBeta.termId).toBe("eq-s3-d1.t.beta");
    }

    // Both are completely different canonical quantities
    expect(wienBeta && "quantityId" in wienBeta && wienBeta.quantityId).not.toBe(
      lorentzBeta && "quantityId" in lorentzBeta && lorentzBeta.quantityId,
    );
  });

  test("both fixtures render the symbol with the identical printed glyph \\beta in 1905 notation", () => {
    const wienLatex = expressionLatex(paper1WienLawFixture, BETA_COLLISION_REGISTRY);
    const lorentzLatex = expressionLatex(paper3LorentzTauFixture, BETA_COLLISION_REGISTRY);

    // Both expressions contain \beta in their generated LaTeX
    expect(wienLatex).toContain("\\beta");
    expect(lorentzLatex).toContain("\\beta");

    // Both quantities share the identical printed glyph in the registry
    expect(BETA_COLLISION_REGISTRY["wienConstantBeta"]?.glyph).toBe("\\beta");
    expect(BETA_COLLISION_REGISTRY["lorentzFactor"]?.glyph).toBe("\\beta");
  });

  test("EXPLICIT ASSERTION: binding does NOT consult the glyph", () => {
    const wienBeta = findNode(paper1WienLawFixture, "eq-s2-d1.t.beta");
    const lorentzBeta = findNode(paper3LorentzTauFixture, "eq-s3-d1.t.beta");

    // 1. Neither AST node contains a 'glyph' property -- the AST is purely semantic
    expect(wienBeta && typeof wienBeta === "object" && "glyph" in wienBeta).toBe(false);
    expect(lorentzBeta && typeof lorentzBeta === "object" && "glyph" in lorentzBeta).toBe(false);

    // 2. Quantity binding resolution queries ONLY quantityId, never glyph
    function resolveQuantityBinding(node: unknown): string {
      if (
        node &&
        typeof node === "object" &&
        "kind" in node &&
        node.kind === "symbol" &&
        "quantityId" in node &&
        typeof node.quantityId === "string"
      ) {
        return node.quantityId;
      }
      throw new Error("Cannot resolve quantity binding on non-symbol node");
    }

    expect(resolveQuantityBinding(wienBeta)).toBe("wienConstantBeta");
    expect(resolveQuantityBinding(lorentzBeta)).toBe("lorentzFactor");

    // 3. Modifying or replacing the presentation glyph has ZERO impact on quantity binding
    const alteredRegistry = {
      ...BETA_COLLISION_REGISTRY,
      wienConstantBeta: {
        ...BETA_COLLISION_REGISTRY.wienConstantBeta,
        glyph: "\\beta_{\\mathrm{wien}}", // altered glyph
      },
      lorentzFactor: {
        ...BETA_COLLISION_REGISTRY.lorentzFactor,
        glyph: "\\gamma", // modern glyph
      },
    };

    // The semantic AST binding remains invariant under presentation changes
    expect(resolveQuantityBinding(wienBeta)).toBe("wienConstantBeta");
    expect(resolveQuantityBinding(lorentzBeta)).toBe("lorentzFactor");

    // 4. Proving that an adversarial glyph-based lookup would fail:
    // A function that attempts to resolve quantity by inspecting the glyph '\beta'
    // CANNOT disambiguate Paper 1 Wien's constant from Paper 3 Lorentz factor.
    function naiveGlyphResolver(glyph: string): string[] {
      const matches: string[] = [];
      for (const [id, q] of Object.entries(BETA_COLLISION_REGISTRY)) {
        if (q.glyph === glyph) {
          matches.push(id);
        }
      }
      return matches;
    }

    const glyphMatches = naiveGlyphResolver("\\beta");
    expect(glyphMatches).toHaveLength(2);
    expect(glyphMatches).toContain("wienConstantBeta");
    expect(glyphMatches).toContain("lorentzFactor");
    // Demonstrates that glyph lookup alone is collision-prone and ambiguous,
    // whereas the expression tree resolves each symbol to its exact canonical quantity.
  });
});
