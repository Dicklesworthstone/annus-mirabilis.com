/**
 * Source-vs-modern notation toggle and colorized LaTeX rendering tests (am-eq-latex-generation-hc3).
 *
 * Implements and enforces:
 * - Colorized LaTeX and notation toggle rendering directly from semantic expression trees.
 * - Toggle contract: re-renders every equation from its AST without string substitution.
 * - In colorized mode, term markers (\htmlData{term=<id>}{\htmlClass{am-role-<role>}{<glyph>}})
 *   and op markers (\htmlData{op=<id>}{<expr>}) are emitted across both printed and modern forms.
 * - In modern notation, group renames and monomial merges preserve bound term IDs in data-term,
 *   enabling seamless UI highlight/selection continuity across the notation toggle.
 * - Every generated string parses in KaTeX with throwOnError: true and katexMarkerTrust.
 */

import assert from "node:assert/strict";
import test from "node:test";
import katex from "katex";
import type { Expression } from "../ast.ts";
import type { AlternateForm } from "../alternateForms.ts";
import { parseAlternateFormId } from "../../content/ids.ts";
import { BROWNIAN_QUANTITIES, type QuantityRegistry } from "../quantities.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { ALLOWED_ROLE_CLASSES, katexMarkerTrust } from "./markers.ts";
import { renderEquationLatex } from "./render.ts";

const sym = (termId: string, quantityId: string = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const num = (value: string): Expression => ({ kind: "number", value });

const prod = (...args: Expression[]): Expression => ({ kind: "product", args });

const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });

const quot = (numerator: Expression, denominator: Expression, opId?: string): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
  ...(opId ? { opId } : {}),
});

const group = (argument: Expression): Expression => ({ kind: "group", argument });

const neg = (argument: Expression): Expression => ({ kind: "negate", argument });

const fn = (name: "exp" | "ln" | "sin" | "cos", argument: Expression, opId?: string): Expression => ({
  kind: "function",
  name,
  argument,
  ...(opId ? { opId } : {}),
});

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

const piConst: Expression = { kind: "constant", name: "pi" };

// Helper to verify KaTeX parsing with marker-only trust
function assertValidKatex(latex: string, isColorized: boolean): void {
  const html = katex.renderToString(latex, {
    throwOnError: true,
    strict: "ignore",
    trust: katexMarkerTrust,
    output: "htmlAndMathml",
  });
  assert.ok(html.includes("katex"), "KaTeX output must contain katex root element");
  if (isColorized) {
    assert.ok(html.includes("am-role-"), "Colorized output must contain am-role class");
  }
}

// Helper to verify marker grammar on rendered colorized LaTeX
function assertMarkerGrammar(
  latex: string,
  termSpans: readonly { readonly id: string; readonly start: number; readonly end: number }[],
  opSpans: readonly { readonly id: string; readonly start: number; readonly end: number }[],
): void {
  // 1. Verify every \htmlClass uses strictly allowed role classes
  const classMatches = Array.from(latex.matchAll(/\\htmlClass\{([^}]+)\}/g));
  assert.ok(classMatches.length > 0, "Colorized LaTeX must contain htmlClass tags");
  for (const match of classMatches) {
    const cls = match[1];
    assert.ok(cls, "Expected class match group");
    assert.ok(
      ALLOWED_ROLE_CLASSES.includes(cls),
      `Role class "${cls}" must be in ALLOWED_ROLE_CLASSES`,
    );
  }

  // 2. Verify every \htmlData matches the term/op grammar
  const dataMatches = Array.from(latex.matchAll(/\\htmlData\{([^=]+)=([^}]+)\}/g));
  assert.ok(dataMatches.length > 0, "Colorized LaTeX must contain htmlData tags");
  for (const match of dataMatches) {
    const key = match[1];
    const val = match[2];
    assert.ok(key === "term" || key === "op", `Key must be term or op, got: ${key}`);
    assert.ok(val, "Expected value match group");
    assert.ok(/^[a-zA-Z0-9_.-]+$/.test(val), `ID must be valid identifier, got: ${val}`);
  }

  // 3. Verify span offsets match exact slices in the LaTeX string
  for (const span of termSpans) {
    assert.ok(span.start >= 0 && span.end <= latex.length, "Span out of bounds");
    assert.ok(span.end > span.start, "Span end must be after start");
    const slice = latex.slice(span.start, span.end);
    assert.ok(
      slice.startsWith(`\\htmlData{term=${span.id}}`),
      `Span for ${span.id} must match slice start. Got: ${slice}`,
    );
  }

  for (const span of opSpans) {
    assert.ok(span.start >= 0 && span.end <= latex.length, "Span out of bounds");
    assert.ok(span.end > span.start, "Span end must be after start");
    const slice = latex.slice(span.start, span.end);
    assert.ok(
      slice.startsWith(`\\htmlData{op=${span.id}}`),
      `Op span for ${span.id} must match slice start. Got: ${slice}`,
    );
  }
}

test("toggle.test: Paper 2 diffusion toggle preserves term bindings across notation switch", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = rel(
    "=",
    sym("eq-bm.t.d", "diffusionCoefficient"),
    prod(
      quot(
        prod(sym("eq-bm.t.r", "molarGasConstant"), sym("eq-bm.t.t", "temperature")),
        sym("eq-bm.t.n", "avogadroConstant"),
        "eq-bm.op.quot.rtn",
      ),
      quot(
        num("1"),
        prod(num("6"), piConst, sym("eq-bm.t.k", "viscosity"), sym("eq-bm.t.p", "particleRadius")),
        "eq-bm.op.quot.stokes",
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

  // 1. Plain Mode Toggle
  const printedPlain = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });
  const modernPlain = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });

  assert.equal(printedPlain.formRelation, "printed");
  assert.equal(modernPlain.formRelation, "rename-only");
  assert.equal(printedPlain.latex, "D = \\frac{R\\,T}{N}\\,\\frac{1}{6\\,\\pi\\,k\\,P}");
  assert.equal(modernPlain.latex, "D = k_B\\,T\\,\\frac{1}{6\\,\\pi\\,\\eta\\,a}");
  assert.equal(printedPlain.termSpans.length, 0);
  assert.equal(modernPlain.termSpans.length, 0);

  // 2. Colorized Mode Toggle
  const printedColor = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "colorized",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });
  const modernColor = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
    registry: BROWNIAN_QUANTITIES,
  });

  // Verify marker grammar
  assertMarkerGrammar(printedColor.latex, printedColor.termSpans, printedColor.opSpans);
  assertMarkerGrammar(modernColor.latex, modernColor.termSpans, modernColor.opSpans);

  // Verify KaTeX parses both without error
  assertValidKatex(printedColor.latex, true);
  assertValidKatex(modernColor.latex, true);

  // Verify term binding continuity:
  // Printed has D, R, T, N, k, P
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.d}{\\htmlClass{am-role-result}{D}}"));
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.r}{\\htmlClass{am-role-input}{R}}"));
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.t}{\\htmlClass{am-role-input}{T}}"));
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.n}{\\htmlClass{am-role-input}{N}}"));
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.k}{\\htmlClass{am-role-input}{k}}"));
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-bm.t.p}{\\htmlClass{am-role-input}{P}}"));

  // Modern has D, k_B (with term=eq-bm.t.r preserved!), T, \eta (with term=eq-bm.t.k), a (with term=eq-bm.t.p)
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-bm.t.d}{\\htmlClass{am-role-result}{D}}"));
  assert.ok(
    modernColor.latex.includes("\\htmlData{term=eq-bm.t.r}{\\htmlClass{am-role-constant}{k_B}}"),
    "Modern Boltzmann constant must inherit the termId of the first removed numerator factor R",
  );
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-bm.t.t}{\\htmlClass{am-role-input}{T}}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-bm.t.k}{\\htmlClass{am-role-input}{\\eta}}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-bm.t.p}{\\htmlClass{am-role-input}{a}}"));

  // Verify op marker preservation
  assert.ok(printedColor.latex.includes("\\htmlData{op=eq-bm.op.rel}"));
  assert.ok(modernColor.latex.includes("\\htmlData{op=eq-bm.op.rel}"));

  // Applied operations report
  const opNames = modernColor.appliedOperations.map((o) => o.operation);
  assert.ok(opNames.includes("group-merge"), "Must record group-merge operation");
  assert.ok(opNames.includes("rename"), "Must record rename operation");
});

test("toggle.test: Paper 3 boost coordinate toggle preserves term bindings across notation switch", () => {
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
              quot(
                sym("eq-sr.t.v", "frameSpeed"),
                { kind: "power", base: sym("eq-sr.t.V", "speedOfLight"), exponent: { num: 2, den: 1 } },
              ),
              sym("eq-sr.t.x", "coordinatePositionStationary"),
            ),
          ),
        ),
      ),
    ),
    "eq-sr.op.boost",
  );

  const equation = {
    id: "eq-sr-s3-boost",
    paper: "special-relativity",
    sectionId: "sr-s3",
    tree,
  };

  // Plain toggle
  const printedPlain = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });
  const modernPlain = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });

  assert.equal(printedPlain.latex, "\\tau = \\beta\\,\\left(t - \\frac{v}{\\left(V\\right)^{2}}\\,x\\right)");
  assert.equal(modernPlain.latex, "t' = \\gamma\\,\\left(t - \\frac{v}{\\left(c\\right)^{2}}\\,x\\right)");

  // Colorized toggle
  const printedColor = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "colorized",
    concordance,
  });
  const modernColor = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
  });

  assertMarkerGrammar(printedColor.latex, printedColor.termSpans, printedColor.opSpans);
  assertMarkerGrammar(modernColor.latex, modernColor.termSpans, modernColor.opSpans);
  assertValidKatex(printedColor.latex, true);
  assertValidKatex(modernColor.latex, true);

  // Term ID mapping verification:
  // tau -> t' under eq-sr.t.tau
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-sr.t.tau}{\\htmlClass{am-role-input}{\\tau}}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-sr.t.tau}{\\htmlClass{am-role-input}{t'}}"));

  // beta -> \gamma under eq-sr.t.beta
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-sr.t.beta}{\\htmlClass{am-role-input}{\\beta}}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-sr.t.beta}{\\htmlClass{am-role-input}{\\gamma}}"));

  // V -> c under eq-sr.t.V
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-sr.t.V}{\\htmlClass{am-role-input}{V}}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-sr.t.V}{\\htmlClass{am-role-input}{c}}"));

  // Term spans count matches
  assert.equal(printedColor.termSpans.length, modernColor.termSpans.length);
  const printedIds = printedColor.termSpans.map((s) => s.id).sort();
  const modernIds = modernColor.termSpans.map((s) => s.id).sort();
  assert.deepEqual(printedIds, modernIds, "All term IDs must be preserved across notation toggle");
});

test("toggle.test: Paper 1 Wien exponential toggle preserves term bindings across notation switch", () => {
  const concordance = loadConcordanceForPaper("light-quanta");
  const tree: Expression = fn(
    "exp",
    neg(
      quot(
        prod(sym("eq-lq.t.beta", "wienConstantBeta"), sym("eq-lq.t.nu", "frequency")),
        sym("eq-lq.t.T", "temperature"),
        "eq-lq.op.quot",
      ),
    ),
    "eq-lq.op.exp",
  );

  const equation = {
    id: "eq-lq-s2-wien",
    paper: "light-quanta",
    sectionId: "lq-s2",
    tree,
  };

  // Plain toggle
  const printedPlain = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
  });
  const modernPlain = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });

  assert.equal(printedPlain.latex, "\\exp\\left(-\\left(\\frac{\\beta\\,\\nu}{T}\\right)\\right)");
  assert.equal(modernPlain.latex, "\\exp\\left(-\\left(\\frac{h\\,\\nu}{k_B\\,T}\\right)\\right)");

  // Colorized toggle
  const printedColor = renderEquationLatex({
    equation,
    form: { kind: "printed" },
    color: "colorized",
    concordance,
  });
  const modernColor = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
  });

  assertMarkerGrammar(printedColor.latex, printedColor.termSpans, printedColor.opSpans);
  assertMarkerGrammar(modernColor.latex, modernColor.termSpans, modernColor.opSpans);
  assertValidKatex(printedColor.latex, true);
  assertValidKatex(modernColor.latex, true);

  // In printed: \beta carries eq-lq.t.beta
  assert.ok(printedColor.latex.includes("\\htmlData{term=eq-lq.t.beta}{\\htmlClass{am-role-input}{\\beta}}"));

  // In modern: both h and k_B carry eq-lq.t.beta
  assert.ok(
    modernColor.latex.includes("\\htmlData{term=eq-lq.t.beta}{\\htmlClass{am-role-constant}{h}}"),
    "Modern h must carry eq-lq.t.beta term binding",
  );
  assert.ok(
    modernColor.latex.includes("\\htmlData{term=eq-lq.t.beta}{\\htmlClass{am-role-constant}{k_B}}"),
    "Modern k_B in denominator must carry eq-lq.t.beta term binding",
  );

  // Other terms preserve their bindings
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-lq.t.nu}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-lq.t.T}"));
});

test("toggle.test: Paper 1 Planck group removal (R*beta*nu/N -> h*nu) in colorized mode", () => {
  const concordance = loadConcordanceForPaper("light-quanta");
  const tree: Expression = quot(
    prod(
      sym("eq-lq.t.r", "molarGasConstant"),
      sym("eq-lq.t.beta", "wienConstantBeta"),
      sym("eq-lq.t.nu", "frequency"),
    ),
    sym("eq-lq.t.n", "avogadroConstant"),
    "eq-lq.op.planck.quot",
  );

  const equation = {
    id: "eq-lq-s2-planck",
    paper: "light-quanta",
    sectionId: "lq-s2",
    tree,
  };

  const modernColor = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
  });

  assertMarkerGrammar(modernColor.latex, modernColor.termSpans, modernColor.opSpans);
  assertValidKatex(modernColor.latex, true);

  // Modern symbol h must be marked with the first removed numerator factor's term ID (eq-lq.t.r)
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-lq.t.r}{\\htmlClass{am-role-constant}{h}}"));
  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-lq.t.nu}"));
});

test("toggle.test: Pure group removal (R/N -> k_B) in colorized mode", () => {
  const concordance = loadConcordanceForPaper("brownian-motion");
  const tree: Expression = quot(
    sym("eq-bm.t.r", "molarGasConstant"),
    sym("eq-bm.t.n", "avogadroConstant"),
    "eq-bm.op.rn",
  );

  const equation = {
    id: "eq-bm-s3-rn",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    tree,
  };

  const modernColor = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
  });

  assertMarkerGrammar(modernColor.latex, modernColor.termSpans, modernColor.opSpans);
  assertValidKatex(modernColor.latex, true);

  assert.ok(modernColor.latex.includes("\\htmlData{term=eq-bm.t.r}{\\htmlClass{am-role-constant}{k_B}}"));
});

test("toggle.test: Toggle contract guarantees unit conversion is NOT applied under modern toggle", () => {
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

  const siAltParsed = parseAlternateFormId("eq-s6-d3.alt.si");
  assert.ok(siAltParsed.ok);

  const siAlternateForm: AlternateForm = {
    id: siAltParsed.value,
    relation: "unit-conversion",
    label: "SI units (Tesla)",
    tree: rel(
      "=",
      sym("eq-s6.alt.t.yPrime", "electricFieldMoving"),
      prod(
        sym("eq-s6.alt.t.beta", "lorentzFactor"),
        group(
          sum(
            sym("eq-s6.alt.t.y", "electricFieldStationary"),
            neg(
              prod(sym("eq-s6.alt.t.v", "frameSpeed"), sym("eq-s6.alt.t.N", "magneticFieldStationary")),
            ),
          ),
        ),
      ),
    ),
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

  // Modern toggle on primary tree
  const modernRes = renderEquationLatex({
    equation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
  });

  // SI Alternate form
  const altRes = renderEquationLatex({
    equation,
    form: { kind: "alternate", id: siAltParsed.value },
    color: "plain",
    concordance,
  });

  // Toggle contract invariant: modern toggle MUST keep the Gaussian speed-of-light factor v/c
  assert.ok(modernRes.latex.includes("\\frac{v}{c}"));
  assert.equal(modernRes.formRelation, "rename-only");

  // Only the alternate form eliminates v/c
  assert.ok(!altRes.latex.includes("\\frac{v}{c}"));
  assert.equal(altRes.formRelation, "unit-conversion");
});

/**
 * Refusal pair for render.ts's alternate-form lookup (am-eq-latex-generation-hc3).
 *
 * The orchestrator's plant sweep of 2026-09-18 measured 19 throw sites and found eight dead.
 * Its unit was the typed error constructor (AuthoredLatexError, LatexTokenizerError,
 * NotationScopeError), so the two plain `throw new Error` sites in render.ts were never
 * counted. Planting the alternate-form lookup and running toggle, transform, render.golden
 * and determinism leaves every one of them green: no test notices the rule's removal.
 *
 * The rule matters because the spec is "render that alternate's own tree, never a
 * transformed primary tree". Without the guard, an unknown form id reaches `alt.tree` on
 * undefined and the reader gets a TypeError from the renderer's internals instead of a
 * message naming the form and the equation.
 */
test("toggle.test: an alternate form that the equation does not declare is refused by name (render.ts:363)", () => {
  const concordance = loadConcordanceForPaper("special-relativity");

  const declaredId = parseAlternateFormId("eq-s6-d7.alt.si");
  assert.ok(declaredId.ok);
  const undeclaredId = parseAlternateFormId("eq-s6-d7.alt.nosuch");
  assert.ok(undeclaredId.ok);

  const declaredAlternate: AlternateForm = {
    id: declaredId.value,
    relation: "unit-conversion",
    label: "SI units",
    tree: rel(
      "=",
      sym("eq-s6-d7.alt.t.e", "electricFieldMoving"),
      sym("eq-s6-d7.alt.t.b", "magneticFieldStationary"),
    ),
    unitSystem: { from: "gaussian-cgs", to: "si" },
    derivationChainId: "chain-sr-s6-si-conversion",
  };

  const equation = {
    id: "eq-s6-d7",
    paper: "special-relativity",
    sectionId: "sr-s6",
    tree: rel(
      "=",
      sym("eq-s6-d7.t.e", "electricFieldMoving"),
      sym("eq-s6-d7.t.b", "magneticFieldStationary"),
    ),
    alternateForms: [declaredAlternate],
  };

  // REJECT: an id the equation does not declare, naming both the form id and the equation.
  assert.throws(
    () =>
      renderEquationLatex({
        equation,
        form: { kind: "alternate", id: undeclaredId.value },
        color: "plain",
        concordance,
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /eq-s6-d7\.alt\.nosuch/);
      assert.match(err.message, /eq-s6-d7/);
      // Not the TypeError the unguarded path would raise from alt.tree on undefined.
      assert.doesNotMatch(err.message, /undefined/);
      return true;
    },
  );

  // ACCEPT: the declared id renders that alternate's own tree with its own relation.
  const accepted = renderEquationLatex({
    equation,
    form: { kind: "alternate", id: declaredId.value },
    color: "plain",
    concordance,
  });
  assert.equal(accepted.formRelation, "unit-conversion");
  assert.ok(accepted.latex.length > 0);

  // An equation that declares no alternate forms at all refuses the same way, not differently.
  assert.throws(
    () =>
      renderEquationLatex({
        equation: { ...equation, alternateForms: undefined },
        form: { kind: "alternate", id: declaredId.value },
        color: "plain",
        concordance,
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /eq-s6-d7\.alt\.si/);
      return true;
    },
  );
});
