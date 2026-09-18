/**
 * Unit and integration tests for scoped notation and concordance renames (am-eq-latex-generation-hc3).
 *
 * Enforces:
 * - Criterion 2: Modern notation derived strictly from concordance renames and monomial merges,
 *   asserted by comparing modern LaTeX against source LaTeX with concordance renames applied
 *   (derived both ways, NOT compared to a hardcoded string).
 * - Criterion 9: Loud failure naming equationId and symbol when notation scope or concordance
 *   entry is missing (with acceptance counterpart).
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import {
  buildSourceManifestIndex,
  modernGroupsFor,
  modernSymbolFor,
} from "../../content/notation/resolve.ts";
import { renderLatex } from "./render.ts";
import { NotationScopeError } from "./types.ts";

const sym = (termId: string, quantityId: string = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const num = (value: string): Expression => ({ kind: "number", value });

const prod = (...args: Expression[]): Expression => ({ kind: "product", args });

const quot = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
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

const fn = (name: "exp" | "ln" | "sin" | "cos", argument: Expression): Expression => ({
  kind: "function",
  name,
  argument,
});

const neg = (argument: Expression): Expression => ({ kind: "negate", argument });

const piConst: Expression = { kind: "constant", name: "pi" };

test("Criterion 2: Paper 3 beta renders as gamma and V as c in modern notation, derived from concordance", () => {
  const paper = "special-relativity";
  const sectionId = "sr-s3";
  const concordance = loadConcordanceForPaper(paper);
  const manifestIndex = buildSourceManifestIndex([]);

  // Paper 3 §3 Boost coordinate transformation: tau = beta * (t = (v * x) / V^2)
  const sourceBoostTree: Expression = rel(
    "=",
    sym("tau", "coordinateTimeMoving"),
    prod(
      sym("beta", "lorentzFactor"),
      rel(
        "=", // inner grouping or relation
        sym("t", "coordinateTimeStationary"),
        quot(
          prod(sym("v", "relativeVelocity"), sym("x", "spatialCoordinateX")),
          { kind: "power", base: sym("V", "speedOfLight"), exponent: { num: 2, den: 1 } },
        ),
      ),
    ),
  );

  // Method 1: Modern perspective rendering
  const modernRendered = renderLatex(sourceBoostTree, {
    perspective: "modern",
    paper,
    sectionId,
    concordance,
    equationId: "eq-sr-03-boost",
  });

  // Method 2: Concordance derivation
  // Look up exact modern glyphs from concordance in scope for each symbol in the tree
  const modernTau = modernSymbolFor(paper, sectionId, "\\tau", manifestIndex, concordance);
  const modernBeta = modernSymbolFor(paper, sectionId, "\\beta", manifestIndex, concordance);
  const modernT = modernSymbolFor(paper, sectionId, "t", manifestIndex, concordance);
  const modernV = modernSymbolFor(paper, sectionId, "V", manifestIndex, concordance);
  const modernVel = modernSymbolFor(paper, sectionId, "v", manifestIndex, concordance);
  const modernX = modernSymbolFor(paper, sectionId, "x", manifestIndex, concordance);

  assert.ok(modernTau, "Concordance must provide modern rename for tau in Paper 3");
  assert.ok(modernBeta, "Concordance must provide modern rename for beta in Paper 3");
  assert.ok(modernV, "Concordance must provide modern rename for V in Paper 3");
  assert.equal(modernBeta, "\\gamma", "Paper 3 beta must modernize to gamma");
  assert.equal(modernV, "c", "Paper 3 V must modernize to c");
  assert.ok(modernTau, "modernTau must be defined");
  assert.ok(modernBeta, "modernBeta must be defined");
  assert.ok(modernV, "modernV must be defined");

  // Construct expected tree with concordance renames applied directly to node glyphs
  const concordanceRenamedTree: Expression = rel(
    "=",
    sym(modernTau, "tau_renamed"),
    prod(
      sym(modernBeta, "beta_renamed"),
      rel(
        "=",
        sym(modernT ?? "t", "t_renamed"),
        quot(
          prod(sym(modernVel ?? "v", "v_renamed"), sym(modernX ?? "x", "x_renamed")),
          { kind: "power", base: sym(modernV, "V_renamed"), exponent: { num: 2, den: 1 } },
        ),
      ),
    ),
  );

  const sourceDerivedWithRenames = renderLatex(concordanceRenamedTree, {
    perspective: "source",
  });

  // Verify: modern LaTeX equals source LaTeX with exactly the concordance renames applied
  assert.equal(
    modernRendered,
    sourceDerivedWithRenames,
    "Modern LaTeX must equal source LaTeX with exactly the concordance renames applied",
  );
  assert.ok(modernRendered.includes(modernBeta), `Modern LaTeX must contain concordance glyph ${modernBeta}`);
  assert.ok(modernRendered.includes(modernV), `Modern LaTeX must contain concordance glyph ${modernV}`);

  // And in source perspective, original glyphs are preserved unchanged
  const sourceRendered = renderLatex(sourceBoostTree, {
    perspective: "source",
    paper,
    sectionId,
    concordance,
  });
  assert.ok(sourceRendered.includes("\\beta"), "Source LaTeX must preserve printed beta");
  assert.ok(sourceRendered.includes("V"), "Source LaTeX must preserve printed V");
  assert.ok(!sourceRendered.includes(modernBeta), "Source LaTeX must NOT contain modern gamma");
});

test("Criterion 2: Paper 1 beta renders as h/k_B with exp(-beta*nu/T) -> exp(-h*nu/(k_B*T))", () => {
  const paper = "light-quanta";
  const sectionId = "lq-s2";
  const concordance = loadConcordanceForPaper(paper);
  const manifestIndex = buildSourceManifestIndex([]);

  // Paper 1 §2 Wien exponential term: exp(- (beta * nu) / T)
  const sourceWienExp: Expression = fn(
    "exp",
    quot(
      neg(prod(sym("beta", "wienConstantBeta"), sym("nu", "frequency"))),
      sym("T", "temperature"),
    ),
  );

  // Method 1: Modern perspective rendering
  const modernRendered = renderLatex(sourceWienExp, {
    perspective: "modern",
    paper,
    sectionId,
    concordance,
    equationId: "eq-lq-02-wien-exp",
  });

  // Method 2: Concordance derivation
  const modernBeta = modernSymbolFor(paper, sectionId, "\\beta", manifestIndex, concordance);
  assert.equal(modernBeta, "h/k_B", "Concordance must rename Wien beta to h/k_B");

  const modernNu = modernSymbolFor(paper, sectionId, "\\nu", manifestIndex, concordance) ?? "\\nu";
  const modernTemp = modernSymbolFor(paper, sectionId, "T", manifestIndex, concordance) ?? "T";

  // In the exponent quotient, beta = h/k_B places h in numerator and k_B in denominator
  const expectedRenamedExp: Expression = fn(
    "exp",
    quot(
      neg(prod(sym("h", "h_renamed"), sym(modernNu, "nu_renamed"))),
      prod(sym("k_B", "kB_renamed"), sym(modernTemp, "T_renamed")),
    ),
  );

  const sourceDerivedWithRenames = renderLatex(expectedRenamedExp, {
    perspective: "source",
  });

  assert.equal(
    modernRendered,
    sourceDerivedWithRenames,
    "Modern Wien exponent must match concordance substitution -h*nu/(k_B*T)",
  );
  assert.ok(modernRendered.includes("h"), "Modern exponent must contain h");
  assert.ok(modernRendered.includes("k_B"), "Modern exponent must contain k_B");

  // In source perspective, beta is preserved unchanged
  const sourceRendered = renderLatex(sourceWienExp, {
    perspective: "source",
    paper,
    sectionId,
    concordance,
  });
  assert.ok(sourceRendered.includes("\\beta"), "Source LaTeX must preserve printed beta");
  assert.ok(!sourceRendered.includes("k_B"), "Source LaTeX must NOT contain k_B");
});

test("Criterion 2: Paper 2 k -> eta, P -> a, and (RT/N)*(1/(6*pi*k*P)) -> k_BT*(1/(6*pi*eta*a))", () => {
  const paper = "brownian-motion";
  const sectionId = "bm-s3";
  const concordance = loadConcordanceForPaper(paper);
  const manifestIndex = buildSourceManifestIndex([]);

  // Printed expression: (RT/N) * (1 / (6 * pi * k * P))
  const sourceDiffusivityTree: Expression = prod(
    quot(
      prod(sym("R", "molarGasConstant"), sym("T", "temperature")),
      sym("N", "avogadroConstant"),
    ),
    quot(
      num("1"),
      prod(num("6"), piConst, sym("k", "viscosity"), sym("P", "particleRadius")),
    ),
  );

  // Method 1: Modern perspective rendering
  const modernRendered = renderLatex(sourceDiffusivityTree, {
    perspective: "modern",
    paper,
    sectionId,
    concordance,
    equationId: "eq-bm-03-diffusivity",
  });

  // Method 2: Concordance derivation
  const groups = modernGroupsFor(paper, sectionId, concordance, manifestIndex);
  const rnGroup = groups.find((g) => g.printedGroup.includes("R/N") || g.modernGroup === "k_B");
  assert.ok(rnGroup, "Concordance must provide R/N -> k_B group rename in bm-s3");
  const modernK = modernSymbolFor(paper, sectionId, "k", manifestIndex, concordance);
  const modernP = modernSymbolFor(paper, sectionId, "P", manifestIndex, concordance);
  const modernT = modernSymbolFor(paper, sectionId, "T", manifestIndex, concordance) ?? "T";
  assert.equal(modernK, "\\eta", "k must modernize to \\eta");
  assert.equal(modernP, "a", "P must modernize to a");

  assert.ok(modernK, "modernK must be defined");
  assert.ok(modernP, "modernP must be defined");

  // Expected renamed tree:
  // First factor: RT/N with R/N replaced by k_B -> k_B * T (two numerator factors)
  // Second factor: 1 / (6 * pi * eta * a)
  const concordanceRenamedTree: Expression = prod(
    prod(sym(rnGroup.modernGroup, "kB_renamed"), sym(modernT, "T_renamed")),
    quot(
      num("1"),
      prod(num("6"), piConst, sym(modernK, "eta_renamed"), sym(modernP, "a_renamed")),
    ),
  );

  const sourceDerivedWithRenames = renderLatex(concordanceRenamedTree, {
    perspective: "source",
  });

  assert.equal(
    modernRendered,
    sourceDerivedWithRenames,
    "Modern diffusivity must equal source LaTeX with concordance group and symbol renames applied",
  );

  // Assert separation of fractions is preserved (NOT combined into single fraction)
  assert.ok(
    modernRendered.includes("\\frac{1}{"),
    "The second fraction 1/(6*pi*eta*a) must remain a separate fraction",
  );

  // In source perspective, original symbols are preserved unchanged
  const sourceRendered = renderLatex(sourceDiffusivityTree, {
    perspective: "source",
    paper,
    sectionId,
    concordance,
  });
  assert.ok(sourceRendered.includes("\\frac{R\\,T}{N}"), "Source LaTeX must preserve R*T/N");
  assert.ok(sourceRendered.includes("k"), "Source LaTeX must preserve printed k");
  assert.ok(sourceRendered.includes("P"), "Source LaTeX must preserve printed P");
});

test("Criterion 9 (Refusal Pair): missing notation entry fails loudly naming equationId and symbol", () => {
  const paper = "brownian-motion";
  const sectionId = "bm-s3";

  // Equation tree with an unmapped symbol
  const unmappedTree: Expression = rel(
    "=",
    sym("x", "spatialCoordinateX"),
    sym("bogus_sym", "unknownQuantityNonexistent"),
  );

  // Refusal: must throw NotationScopeError naming equationId and the offending symbol
  assert.throws(
    () => {
      renderLatex(unmappedTree, {
        perspective: "modern",
        paper,
        sectionId,
        equationId: "eq-refusal-planted-test",
        strictConcordance: true,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotationScopeError);
      assert.equal(err.equationId, "eq-refusal-planted-test");
      assert.match(err.message, /eq-refusal-planted-test/);
      assert.match(err.message, /bogus_sym|unknownQuantityNonexistent/);
      assert.equal(err.kind, "missing-entry");
      return true;
    },
  );

  // Acceptance counterpart: when all symbols are in scope, rendering succeeds
  const validTree: Expression = rel(
    "=",
    sym("x", "displacement"),
    sym("t", "time"),
  );

  const output = renderLatex(validTree, {
    perspective: "modern",
    paper,
    sectionId,
    equationId: "eq-accepted-counterpart",
    strictConcordance: true,
  });

  assert.ok(output.length > 0, "Valid equation must render successfully");
});

test("Criterion 9 (Refusal Pair): missing notation scope fails loudly naming equationId", () => {
  const validTree: Expression = sym("x", "displacement");

  // Refusal: missing scope (neither sectionId nor anchor provided)
  assert.throws(
    () => {
      renderLatex(validTree, {
        perspective: "modern",
        paper: "brownian-motion",
        equationId: "eq-scope-missing-test",
        strictConcordance: true,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotationScopeError);
      assert.equal(err.equationId, "eq-scope-missing-test");
      assert.match(err.message, /eq-scope-missing-test/);
      assert.equal(err.kind, "missing-scope");
      return true;
    },
  );

  // Acceptance counterpart: scope provided renders cleanly
  const output = renderLatex(validTree, {
    perspective: "modern",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    equationId: "eq-scope-present-test",
    strictConcordance: true,
  });
  assert.ok(output.length > 0);
});

test("Scope Isolation: Paper 2 viscosity k does not modernize in Paper 3, and Paper 3 beta does not modernize to Paper 1 wien beta", () => {
  const manifestIndex = buildSourceManifestIndex([]);

  // In Paper 2 bm-s3, k modernizes to \eta
  const cBM = loadConcordanceForPaper("brownian-motion");
  const modernK_BM = modernSymbolFor("brownian-motion", "bm-s3", "k", manifestIndex, cBM);
  assert.equal(modernK_BM, "\\eta");

  // In Paper 3, k does NOT modernize to \eta
  const cSR = loadConcordanceForPaper("special-relativity");
  const modernK_SR = modernSymbolFor("special-relativity", "sr-s3", "k", manifestIndex, cSR);
  assert.notEqual(modernK_SR, "\\eta");

  // In Paper 3 sr-s3, beta modernizes to \gamma
  const modernBeta_SR = modernSymbolFor("special-relativity", "sr-s3", "\\beta", manifestIndex, cSR);
  assert.equal(modernBeta_SR, "\\gamma");

  // In Paper 1 lq-s2, beta modernizes to h/k_B, NEVER \gamma
  const cLQ = loadConcordanceForPaper("light-quanta");
  const modernBeta_LQ = modernSymbolFor("light-quanta", "lq-s2", "\\beta", manifestIndex, cLQ);
  assert.equal(modernBeta_LQ, "h/k_B");
  assert.notEqual(modernBeta_LQ, "\\gamma");
});
