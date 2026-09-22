/**
 * Pinned golden LaTeX tests across the 4 papers (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 1:
 * - Printed, modern, and alternate outputs exist in plain and colorized modes for fixture equations.
 * - Golden files reviewed once and pinned.
 * - Updating goldens requires explicit AM_UPDATE_GOLDENS=1 flag.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseAlternateFormId } from "../../content/ids.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { AlternateForm } from "../alternateForms.ts";
import type { Expression } from "../ast.ts";
import { BROWNIAN_QUANTITIES } from "../quantities.ts";
import { renderEquationLatex } from "./render.ts";

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
const group = (argument: Expression): Expression => ({ kind: "group", argument });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const root2 = (radicand: Expression): Expression => ({
  kind: "root",
  radicand,
  degree: 2,
});
const rel = (
  operator: "=" | "approx",
  left: Expression,
  right: Expression,
  opId?: string,
): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
  ...(opId ? { opId } : {}),
});

// Pinned golden expectations:
const PINNED_GOLDENS = {
  paper2_diffusion: {
    printed_plain: "D = \\frac{R\\,T}{N}\\,\\frac{1}{6\\,\\pi\\,k\\,P}",
    modern_plain: "D = k_B\\,T\\,\\frac{1}{6\\,\\pi\\,\\eta\\,a}",
  },
  paper2_displacement: {
    printed_plain: "\\lambda_x = \\sqrt{2\\,D\\,t}",
    modern_plain: "\\sqrt{\\langle x^2 \\rangle} = \\sqrt{2\\,D\\,t}",
  },
  paper3_boost: {
    printed_plain: "\\tau = \\beta\\,\\left(t - \\frac{v}{V^{2}}\\,x\\right)",
    modern_plain: "t' = \\gamma\\,\\left(t - \\frac{v}{c^{2}}\\,x\\right)",
  },
  paper3_field_transform: {
    printed_plain: "Y' = \\beta\\,\\left(Y - \\frac{v}{V}\\,N\\right)",
    modern_plain: "E'_y = \\gamma\\,\\left(E_y - \\frac{v}{c}\\,B_z\\right)",
    alternate_si_plain: "E'_y = \\gamma\\,\\left(E_y - v\\,B_z\\right)",
  },
  paper1_wien: {
    printed_plain: "\\exp\\left(-\\left(\\frac{\\beta\\,\\nu}{T}\\right)\\right)",
    modern_plain: "\\exp\\left(-\\left(\\frac{h\\,\\nu}{k_B\\,T}\\right)\\right)",
  },
};

test("render.golden.test: Paper 2 diffusion relation matches pinned goldens", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = rel(
    "=",
    sym("eq-bm.t.d", "diffusionCoefficient"),
    prod(
      quot(
        prod(sym("eq-bm.t.r", "molarGasConstant"), sym("eq-bm.t.t", "temperature")),
        sym("eq-bm.t.n", "avogadroConstant"),
      ),
      quot(
        num("1"),
        prod(
          num("6"),
          { kind: "constant", name: "pi" },
          sym("eq-bm.t.k", "viscosity"),
          sym("eq-bm.t.p", "particleRadius"),
        ),
      ),
    ),
    "eq-bm.op.rel",
  );

  const equation = {
    id: "eq-bm-s3-d4",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    tree,
  };

  const printedPlain = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });
  assert.equal(printedPlain.latex, PINNED_GOLDENS.paper2_diffusion.printed_plain);

  const modernPlain = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });
  assert.equal(modernPlain.latex, PINNED_GOLDENS.paper2_diffusion.modern_plain);

  // Colorized check: must contain \htmlData and \htmlClass
  const printedColor = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "colorized",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.d}"));
  assert.ok(printedColor.latex.includes("\\htmlClass{am-role-result}{D}"));
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.k}"));
});

test("render.golden.test: Paper 2 RMS displacement matches pinned goldens", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = rel(
    "=",
    sym("eq-bm.t.lambda", "rmsDisplacement1d"),
    root2(
      prod(num("2"), sym("eq-bm.t.D", "diffusionCoefficient"), sym("eq-bm.t.t", "elapsedTime")),
    ),
    "eq-bm.op.rel",
  );

  const equation = {
    id: "eq-bm-s5-d1",
    paper: "brownian-motion",
    sectionId: "bm-s5",
    tree,
  };

  const printed = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });
  assert.equal(printed.latex, PINNED_GOLDENS.paper2_displacement.printed_plain);

  const modern = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });
  assert.equal(modern.latex, PINNED_GOLDENS.paper2_displacement.modern_plain);
});

test("render.golden.test: Paper 3 boost coordinate matches pinned goldens", () => {
  const concordance = loadConcordanceForPaper("special-relativity");
  const tree: Expression = rel(
    "=",
    sym("eq-sr.t.tau", "coordinateTimeMoving"),
    prod(
      sym("eq-sr.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-sr.t.t", "coordinateTimeStationary"),
          neg(
            prod(
              quot(sym("eq-sr.t.v", "frameSpeed"), {
                kind: "power",
                base: sym("eq-sr.t.V", "speedOfLight"),
                exponent: { num: 2, den: 1 },
              }),
              sym("eq-sr.t.x", "coordinatePositionStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-sr.op.rel",
  );

  const equation = {
    id: "eq-sr-s3-boost",
    paper: "special-relativity",
    sectionId: "sr-s3",
    tree,
  };

  const printed = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });
  assert.equal(printed.latex, PINNED_GOLDENS.paper3_boost.printed_plain);

  const modern = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });
  assert.equal(modern.latex, PINNED_GOLDENS.paper3_boost.modern_plain);
});

test("render.golden.test: Paper 3 §6 electromagnetic transformation matches pinned goldens", () => {
  const concordance = loadConcordanceForPaper("special-relativity");
  const primaryTree: Expression = rel(
    "=",
    sym("eq-s6.t.yPrime", "electricFieldMoving"),
    prod(
      sym("eq-s6.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-s6.t.y", "electricFieldStationary"),
          neg(
            prod(
              quot(sym("eq-s6.t.v", "frameSpeed"), sym("eq-s6.t.V", "speedOfLight")),
              sym("eq-s6.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-s6.op.rel",
  );

  const siTree: Expression = rel(
    "=",
    sym("eq-s6.alt.si.t.yPrime", "electricFieldMoving"),
    prod(
      sym("eq-s6.alt.si.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-s6.alt.si.t.y", "electricFieldStationary"),
          neg(
            prod(
              sym("eq-s6.alt.si.t.v", "frameSpeed"),
              sym("eq-s6.alt.si.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-s6.alt.si.op.rel",
  );

  const siAltParsed = parseAlternateFormId("eq-s6-d3.alt.si");
  assert.ok(siAltParsed.ok);

  const siAlternateForm: AlternateForm = {
    id: siAltParsed.value,
    relation: "unit-conversion",
    label: "SI units (Tesla)",
    tree: siTree,
    unitSystem: { from: "gaussian-cgs", to: "si" },
    derivationChainId: "chain-sr-s6-si-conversion",
  };

  const equation = {
    id: "eq-s6-d3",
    paper: "special-relativity",
    sectionId: "sr-s6",
    tree: primaryTree,
    alternateForms: [siAlternateForm],
  };

  const printed = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });
  assert.equal(printed.latex, PINNED_GOLDENS.paper3_field_transform.printed_plain);

  const modern = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });
  assert.equal(modern.latex, PINNED_GOLDENS.paper3_field_transform.modern_plain);

  const alternate = renderEquationLatex({
    equation,
    form: { kind: "alternate", id: siAltParsed.value },
    color: "plain",
    concordance,
  });
  assert.equal(alternate.latex, PINNED_GOLDENS.paper3_field_transform.alternate_si_plain);
  assert.equal(alternate.formRelation, "unit-conversion");
});

test("render.golden.test: Paper 1 Wien exponential matches pinned goldens", () => {
  const concordance = loadConcordanceForPaper("light-quanta");
  const tree: Expression = {
    kind: "function",
    name: "exp",
    argument: neg(
      quot(
        prod(sym("eq-lq.t.beta", "wienConstantBeta"), sym("eq-lq.t.nu", "frequency")),
        sym("eq-lq.t.T", "temperature"),
      ),
    ),
  };

  const equation = {
    id: "eq-lq-s2-wien",
    paper: "light-quanta",
    sectionId: "lq-s2",
    tree,
  };

  const printed = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });
  assert.equal(printed.latex, PINNED_GOLDENS.paper1_wien.printed_plain);

  const modern = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });
  assert.equal(modern.latex, PINNED_GOLDENS.paper1_wien.modern_plain);
});
