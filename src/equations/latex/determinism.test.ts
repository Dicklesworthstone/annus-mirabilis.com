/**
 * Determinism and stability tests for LaTeX generation (am-eq-latex-generation-hc3).
 *
 * Implements requirement:
 * "two renders of the same input are byte-identical, and input object key order does not matter."
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { Expression } from "../ast.ts";
import { renderEquationLatex } from "./render.ts";

const sym = (termId: string, quantityId: string = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const prod = (...args: Expression[]): Expression => ({ kind: "product", args });
const quot = (num: Expression, den: Expression): Expression => ({
  kind: "quotient",
  numerator: num,
  denominator: den,
});
const rel = (operator: "=" | "approx", left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
});

test("determinism.test: two renders of identical inputs are byte-identical across multiple passes", () => {
  const concordance = loadConcordanceForPaper("special-relativity");
  const tree: Expression = rel(
    "=",
    sym("tau", "coordinateTimeMoving"),
    prod(
      sym("beta", "lorentzFactor"),
      rel(
        "=",
        sym("t", "coordinateTimeStationary"),
        quot(prod(sym("v", "relativeVelocity"), sym("x", "spatialCoordinateX")), {
          kind: "power",
          base: sym("V", "speedOfLight"),
          exponent: { num: 2, den: 1 },
        }),
      ),
    ),
  );

  const input1 = {
    equation: {
      id: "eq-sr-boost-det",
      paper: "special-relativity",
      sectionId: "sr-s3",
      tree,
    },
    form: { kind: "modern" as const },
    color: "colorized" as const,
    concordance,
  };

  const input2 = {
    concordance,
    color: "colorized" as const,
    form: { kind: "modern" as const },
    equation: {
      tree,
      sectionId: "sr-s3",
      paper: "special-relativity",
      id: "eq-sr-boost-det",
    },
  };

  const res1 = renderEquationLatex(input1);
  const res2 = renderEquationLatex(input2);

  // Byte-identical latex
  assert.equal(res1.latex, res2.latex);
  assert.equal(res1.formRelation, res2.formRelation);

  // Spans identical
  assert.deepEqual(res1.termSpans, res2.termSpans);
  assert.deepEqual(res1.opSpans, res2.opSpans);
  assert.deepEqual(res1.appliedOperations, res2.appliedOperations);
  assert.deepEqual(res1.warnings, res2.warnings);
});

test("determinism.test: plain mode is deterministic and leaves no markers", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = rel(
    "=",
    sym("D", "diffusionCoefficient"),
    prod(
      quot(
        prod(sym("R", "molarGasConstant"), sym("T", "temperature")),
        sym("N", "avogadroConstant"),
      ),
      quot(
        { kind: "number", value: "1" },
        prod(
          { kind: "number", value: "6" },
          { kind: "constant", name: "pi" },
          sym("k", "viscosity"),
          sym("P", "particleRadius"),
        ),
      ),
    ),
  );

  const resA = renderEquationLatex({
    equation: {
      id: "eq-bm-diffusion-det",
      paper: "brownian-motion",
      sectionId: "bm-s3",
      tree,
    },
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });

  const resB = renderEquationLatex({
    equation: {
      id: "eq-bm-diffusion-det",
      paper: "brownian-motion",
      sectionId: "bm-s3",
      tree,
    },
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });

  assert.equal(resA.latex, resB.latex);
  assert.equal(resA.latex.includes("\\htmlData"), false);
  assert.equal(resA.latex.includes("\\htmlClass"), false);
  assert.equal(resA.termSpans.length, 0);
  assert.equal(resA.opSpans.length, 0);
});
