/**
 * Monomial factor-set group merge tests for LaTeX generation (am-eq-latex-generation-hc3).
 *
 * Implements Acceptance Criterion 2 & Test Plan:
 * 1. Group removal: RT/N -> k_B T, R\beta\nu/N -> h\nu, R/N -> k_B
 * 2. Merge in an exponent: -\beta\nu/T -> -h\nu/(k_BT)
 * 3. Separation preservation: Two separate printed fractions are never combined
 * 4. Refusal: When a group's members are not factors of one monomial quotient
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { Expression } from "../ast.ts";
import { renderLatex } from "./render.ts";

const sym = (termId: string, quantityId: string = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const num = (value: string): Expression => ({ kind: "number", value });

const prod = (...args: Expression[]): Expression => ({ kind: "product", args });

const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });

const quot = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});

const fn = (name: "exp" | "ln" | "sin" | "cos", argument: Expression): Expression => ({
  kind: "function",
  name,
  argument,
});

const neg = (argument: Expression): Expression => ({ kind: "negate", argument });

const piConst: Expression = { kind: "constant", name: "pi" };

test("monomial.test: group removal RT/N -> k_B T", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = quot(
    prod(sym("R", "molarGasConstant"), sym("T", "temperature")),
    sym("N", "avogadroConstant"),
  );

  const modern = renderLatex(tree, {
    perspective: "modern",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance,
    equationId: "eq-test-rt-n",
  });

  assert.equal(modern, "k_B\\,T");

  const source = renderLatex(tree, {
    perspective: "source",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance,
  });
  assert.equal(source, "\\frac{R\\,T}{N}");
});

test("monomial.test: group removal R\\beta\\nu/N -> h\\nu", () => {
  const concordance = loadConcordanceForPaper("light-quanta");
  const tree: Expression = quot(
    prod(sym("R", "molarGasConstant"), sym("beta", "wienConstantBeta"), sym("nu", "frequency")),
    sym("N", "avogadroConstant"),
  );

  const modern = renderLatex(tree, {
    perspective: "modern",
    paper: "light-quanta",
    sectionId: "lq-s2",
    concordance,
    equationId: "eq-test-r-beta-nu-n",
  });

  assert.equal(modern, "h\\,\\nu");

  const source = renderLatex(tree, {
    perspective: "source",
    paper: "light-quanta",
    sectionId: "lq-s2",
    concordance,
  });
  assert.equal(source, "\\frac{R\\,\\beta\\,\\nu}{N}");
});

test("monomial.test: group removal R/N -> k_B", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = quot(sym("R", "molarGasConstant"), sym("N", "avogadroConstant"));

  const modern = renderLatex(tree, {
    perspective: "modern",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance,
    equationId: "eq-test-r-n",
  });

  assert.equal(modern, "k_B");

  const source = renderLatex(tree, {
    perspective: "source",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance,
  });
  assert.equal(source, "\\frac{R}{N}");
});

test("monomial.test: merge in an exponent -\\beta\\nu/T -> -h\\nu/(k_BT)", () => {
  const concordance = loadConcordanceForPaper("light-quanta");
  const tree: Expression = fn(
    "exp",
    quot(
      neg(prod(sym("beta", "wienConstantBeta"), sym("nu", "frequency"))),
      sym("T", "temperature"),
    ),
  );

  const modern = renderLatex(tree, {
    perspective: "modern",
    paper: "light-quanta",
    sectionId: "lq-s2",
    concordance,
    equationId: "eq-test-wien-exp-merge",
  });

  assert.equal(modern, "\\exp\\left(-\\frac{h\\,\\nu}{k_B\\,T}\\right)");

  const source = renderLatex(tree, {
    perspective: "source",
    paper: "light-quanta",
    sectionId: "lq-s2",
    concordance,
  });
  assert.equal(source, "\\exp\\left(-\\frac{\\beta\\,\\nu}{T}\\right)");
});

test("monomial.test: two separate printed fractions are never combined into one", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  // (RT/N) * (1 / (6*pi*k*P))
  const tree: Expression = prod(
    quot(prod(sym("R", "molarGasConstant"), sym("T", "temperature")), sym("N", "avogadroConstant")),
    quot(num("1"), prod(num("6"), piConst, sym("k", "viscosity"), sym("P", "particleRadius"))),
  );

  const modern = renderLatex(tree, {
    perspective: "modern",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance,
    equationId: "eq-test-separate-fractions",
  });

  // RT/N becomes k_B T, and 1/(6*pi*eta*a) remains its own separate fraction
  assert.equal(modern, "k_B\\,T\\,\\frac{1}{6\\,\\pi\\,\\eta\\,a}");
  // Must NOT combine into \frac{k_B T}{6\pi\eta a}
  assert.ok(
    !modern.startsWith("\\frac{k_B"),
    "Two separate fractions must not be merged into single fraction",
  );
  assert.ok(modern.includes("\\frac{1}{"), "The second fraction must remain 1/...");
});

test("monomial.test: refusal when group members are not factors of one monomial quotient", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  // Sum in numerator: (R + 1) / N
  // R is an additive term, NOT a factor of a single monomial quotient with N
  const nonMonomialTree: Expression = quot(
    sum(sym("R", "molarGasConstant"), num("1")),
    sym("N", "avogadroConstant"),
  );

  const modern = renderLatex(nonMonomialTree, {
    perspective: "modern",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance,
    equationId: "eq-test-refusal-additive",
  });

  // R and N are NOT merged into k_B because R is in a sum.
  // Instead, N is renamed to modern N_A individually per concordance.
  assert.equal(modern, "\\frac{R + 1}{N_A}");
  assert.ok(!modern.includes("k_B"), "Additive terms must refuse monomial group merge");
});
