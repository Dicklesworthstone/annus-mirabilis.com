/**
 * Tests for Paper 3 §6 transformation and SI alternate form (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 3:
 * - The paper 3 §6 transformation renders as E'_y = \gamma(E_y - \frac{v}{c}B_z) in modern notation.
 * - The SI form appears only as its `unit-conversion` alternate, with formRelation = 'unit-conversion'.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseAlternateFormId } from "../../content/ids.ts";
import type { AlternateForm } from "../alternateForms.ts";
import type { Expression } from "../ast.ts";
import { renderEquationLatex } from "./render.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const prod = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const quot = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const group = (argument: Expression): Expression => ({ kind: "group", argument });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const rel = (
  operator: "=" | "approx" | "define",
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

test("transform.test: Paper 3 §6 transformation renders in printed and modern notation", () => {
  // Primary Gaussian tree as printed in 1905:
  // Y' = beta * (Y - (v / V) * N)
  const equationId = "eq-s6-d3";
  const primaryTree: Expression = rel(
    "=",
    sym("eq-s6-d3.t.yPrime", "electricFieldMoving"),
    prod(
      sym("eq-s6-d3.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-s6-d3.t.y", "electricFieldStationary"),
          neg(
            prod(
              quot(sym("eq-s6-d3.t.v", "frameSpeed"), sym("eq-s6-d3.t.V", "speedOfLight")),
              sym("eq-s6-d3.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-s6-d3.op.rel",
  );

  // SI unit-conversion alternate: E'_y = gamma * (E_y - v * B_z)
  // Factor of c (V) is eliminated in SI units
  const siAltParsed = parseAlternateFormId("eq-s6-d3.alt.si");
  assert.ok(siAltParsed.ok);
  const siAltId = siAltParsed.value;
  const siTree: Expression = rel(
    "=",
    sym("eq-s6-d3.alt.si.t.yPrime", "electricFieldMoving"),
    prod(
      sym("eq-s6-d3.alt.si.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-s6-d3.alt.si.t.y", "electricFieldStationary"),
          neg(
            prod(
              sym("eq-s6-d3.alt.si.t.v", "frameSpeed"),
              sym("eq-s6-d3.alt.si.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-s6-d3.alt.si.op.rel",
  );

  const siAlternateForm: AlternateForm = {
    id: siAltId,
    relation: "unit-conversion",
    label: "SI units (Tesla)",
    tree: siTree,
    unitSystem: { from: "gaussian-cgs", to: "si" },
    derivationChainId: "chain-sr-s6-si-conversion",
  };

  const equation = {
    id: equationId,
    paper: "special-relativity",
    sectionId: "sr-s6",
    tree: primaryTree,
    alternateForms: [siAlternateForm],
  };

  // 1. Printed form renders 1905 Gaussian notation
  const printedRes = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
  });
  assert.equal(printedRes.formRelation, "printed");
  assert.equal(printedRes.latex, "Y' = \\beta\\,\\left(Y - \\frac{v}{V}\\,N\\right)");

  // 2. Modern form renders modern renames: Y' -> E'_y, beta -> \gamma, Y -> E_y, N -> B_z, V -> c
  const modernRes = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
  });
  assert.equal(modernRes.formRelation, "rename-only");
  assert.equal(modernRes.latex, "E'_y = \\gamma\\,\\left(E_y - \\frac{v}{c}\\,B_z\\right)");

  // 3. SI unit-conversion alternate renders without the v/c factor and reports formRelation = 'unit-conversion'
  const altRes = renderEquationLatex({
    equation,
    form: { kind: "alternate", id: "eq-s6-d3.alt.si" },
    color: "plain",
  });
  assert.equal(altRes.formRelation, "unit-conversion");
  assert.equal(altRes.latex, "E'_y = \\gamma\\,\\left(E_y - v\\,B_z\\right)");

  // The SI form must not appear in the modern toggle output on the primary tree
  assert.notEqual(modernRes.latex, altRes.latex);
  assert.ok(modernRes.latex.includes("\\frac{v}{c}"));
  assert.ok(!altRes.latex.includes("\\frac{v}{c}"));
});

test("transform.test: Colorized modern and SI alternate outputs contain valid markers and spans", () => {
  const equationId = "eq-s6-d3";
  const primaryTree: Expression = rel(
    "=",
    sym("eq-s6-d3.t.yPrime", "electricFieldMoving"),
    prod(
      sym("eq-s6-d3.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-s6-d3.t.y", "electricFieldStationary"),
          neg(
            prod(
              quot(sym("eq-s6-d3.t.v", "frameSpeed"), sym("eq-s6-d3.t.V", "speedOfLight")),
              sym("eq-s6-d3.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-s6-d3.op.rel",
  );

  const siAltParsed = parseAlternateFormId("eq-s6-d3.alt.si");
  assert.ok(siAltParsed.ok);
  const siAltId = siAltParsed.value;
  const siTree: Expression = rel(
    "=",
    sym("eq-s6-d3.alt.si.t.yPrime", "electricFieldMoving"),
    prod(
      sym("eq-s6-d3.alt.si.t.beta", "lorentzFactor"),
      group(
        sum(
          sym("eq-s6-d3.alt.si.t.y", "electricFieldStationary"),
          neg(
            prod(
              sym("eq-s6-d3.alt.si.t.v", "frameSpeed"),
              sym("eq-s6-d3.alt.si.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-s6-d3.alt.si.op.rel",
  );

  const siAlternateForm: AlternateForm = {
    id: siAltId,
    relation: "unit-conversion",
    label: "SI units (Tesla)",
    tree: siTree,
    unitSystem: { from: "gaussian-cgs", to: "si" },
    derivationChainId: "chain-sr-s6-si-conversion",
  };

  const equation = {
    id: equationId,
    paper: "special-relativity",
    sectionId: "sr-s6",
    tree: primaryTree,
    alternateForms: [siAlternateForm],
  };

  const colorModern = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
  });
  assert.ok(colorModern.termSpans.length > 0);
  assert.ok(colorModern.opSpans.length > 0);
  assert.ok(colorModern.latex.includes("\\htmlData{term=eq-s6-d3.t.yPrime}"));
  assert.ok(colorModern.latex.includes("E'_y"));

  const colorSi = renderEquationLatex({
    equation,
    form: { kind: "alternate", id: "eq-s6-d3.alt.si" },
    color: "colorized",
  });
  assert.ok(colorSi.termSpans.length > 0);
  assert.ok(colorSi.opSpans.length > 0);
  assert.ok(colorSi.latex.includes("\\htmlData{term=eq-s6-d3.alt.si.t.yPrime}"));
  assert.equal(colorSi.formRelation, "unit-conversion");
});
