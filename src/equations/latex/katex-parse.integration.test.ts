/**
 * KaTeX integration tests verifying that every generated string parses cleanly
 * in the pinned KaTeX version with throwOnError: true and marker-only trust (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 5:
 * - Every generated string parses in KaTeX with throwOnError: true
 * - Marker-only trust callback allows \htmlClass and \htmlData
 * - Untrusted commands fail closed
 */

import assert from "node:assert/strict";
import test from "node:test";
import katex from "katex";
import type { Expression } from "../ast.ts";
import type { AlternateForm } from "../alternateForms.ts";
import { parseAlternateFormId } from "../../content/ids.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { katexMarkerTrust } from "./markers.ts";
import { renderEquationLatex } from "./render.ts";
import { convertAuthoredLatex } from "./authored.ts";

const sym = (termId: string, quantityId: string = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const prod = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const quot = (num: Expression, den: Expression): Expression => ({
  kind: "quotient",
  numerator: num,
  denominator: den,
});
const group = (argument: Expression): Expression => ({ kind: "group", argument });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const rel = (operator: "=" | "approx", left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
});

test("katex-parse.test: Paper 3 boost equation parses in KaTeX across all modes", () => {
  const concordance = loadConcordanceForPaper("special-relativity");
  const tree: Expression = rel(
    "=",
    sym("tau", "coordinateTimeMoving"),
    prod(
      sym("beta", "lorentzFactor"),
      rel(
        "=",
        sym("t", "coordinateTimeStationary"),
        quot(
          prod(sym("v", "relativeVelocity"), sym("x", "spatialCoordinateX")),
          { kind: "power", base: sym("V", "speedOfLight"), exponent: { num: 2, den: 1 } },
        ),
      ),
    ),
  );

  const forms: Array<{ kind: "printed" | "modern" }> = [
    { kind: "printed" },
    { kind: "modern" },
  ];
  const colorModes: Array<"plain" | "colorized"> = ["plain", "colorized"];

  for (const form of forms) {
    for (const color of colorModes) {
      const res = renderEquationLatex({
        equation: {
          id: "eq-sr-boost-parse",
          paper: "special-relativity",
          sectionId: "sr-s3",
          tree,
        },
        form,
        color,
        concordance,
      });

      assert.ok(res.latex.length > 0);

      // Must parse without error using katexMarkerTrust
      const html = katex.renderToString(res.latex, {
        throwOnError: true,
        strict: "ignore",
        trust: katexMarkerTrust,
        output: "htmlAndMathml",
      });

      assert.ok(html.includes("katex"));
      if (color === "colorized") {
        assert.ok(html.includes("am-role-"));
      }
    }
  }
});

test("katex-parse.test: Paper 2 Brownian diffusion coefficient parses in KaTeX", () => {
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

  for (const form of [{ kind: "printed" as const }, { kind: "modern" as const }]) {
    for (const color of ["plain" as const, "colorized" as const]) {
      const res = renderEquationLatex({
        equation: {
          id: "eq-bm-diffusion-parse",
          paper: "brownian-motion",
          sectionId: "bm-s3",
          tree,
        },
        form,
        color,
        concordance,
      });

      const html = katex.renderToString(res.latex, {
        throwOnError: true,
        strict: "ignore",
        trust: katexMarkerTrust,
        output: "htmlAndMathml",
      });
      assert.ok(html.includes("katex"));
    }
  }
});

test("katex-parse.test: Paper 3 §6 electromagnetic transformation and SI alternate parse in KaTeX", () => {
  const concordance = loadConcordanceForPaper("special-relativity");
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
              quot(
                sym("eq-s6-d3.t.v", "frameSpeed"),
                sym("eq-s6-d3.t.V", "speedOfLight"),
              ),
              sym("eq-s6-d3.t.N", "magneticFieldStationary"),
            ),
          ),
        ),
      ),
    ),
  );

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

  const resPrinted = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "colorized",
    concordance,
  });

  const resModern = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
  });

  const resAlternate = renderEquationLatex({
    equation,
    form: { kind: "alternate", id: "eq-s6-d3.alt.si" },
    color: "colorized",
    concordance,
  });

  for (const rendered of [resPrinted, resModern, resAlternate]) {
    const html = katex.renderToString(rendered.latex, {
      throwOnError: true,
      strict: "ignore",
      trust: katexMarkerTrust,
      output: "htmlAndMathml",
    });
    assert.ok(html.includes("katex"));
  }
});

test("katex-parse.test: converted authored exceptions parse in KaTeX", () => {
  const authored = "\\amterm{t_E}{\\lambda_x} = \\sqrt{2\\,\\amterm{t_D}{D}\\,\\amterm{t_t}{t}}";
  const converted = convertAuthoredLatex(authored, {
    rolesById: {
      t_E: "result",
      t_D: "constant",
      t_t: "input",
    },
  });

  const html = katex.renderToString(converted.latex, {
    throwOnError: true,
    strict: "ignore",
    trust: katexMarkerTrust,
    output: "htmlAndMathml",
  });
  assert.ok(html.includes("katex"));
  assert.ok(html.includes("am-role-result"));
});

test("katex-parse.test: untrusted malicious commands are rejected by trust function", () => {
  const malicious = "\\href{https://evil.com}{\\text{click here}}";
  // Without trust or with marker trust, \\href should fail or render without link
  const rendered = katex.renderToString(malicious, {
    throwOnError: false,
    trust: katexMarkerTrust,
  });
  // Must NOT generate an <a> tag
  assert.ok(!rendered.includes("<a "), "KaTeX must not render <a> tag for untrusted href");
});
