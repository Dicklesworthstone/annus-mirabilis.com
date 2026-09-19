/**
 * Paper 4 (mass-energy) rendering across the source/modern split (am-eq-latex-generation-hc3).
 *
 * The module had no mass-energy coverage at all: light-quanta, brownian-motion and
 * special-relativity appear in its tests, paper 4 in none. Its concordance
 * (am-not-entries-mass-energy-wq2) is now closed and authored against the pinned facsimile,
 * so the renderer can be held to it.
 *
 * Paper 4 is where the scoped lookup matters most. Einstein prints L for the emitted energy
 * here and L for the speed of light in paper 1, so one printed glyph carries two quantities
 * across the edition and a global substitution would silently pick one. Every expectation
 * below is READ FROM THE CONCORDANCE ENTRY rather than typed in, so the test proves the
 * renderer applied the concordance rather than that someone copied its output once.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import type { Expression } from "../ast.ts";
import { MASS_ENERGY_QUANTITIES } from "../massEnergyQuantities.ts";
import { ALLOWED_ROLE_CLASSES } from "./markers.ts";
import { renderEquationLatex } from "./render.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const rel = (left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});

/** The rename entry a quantity is bound by, with the union narrowed rather than asserted away. */
function renameEntryFor(concordance: PaperConcordance, quantityId: string) {
  const entry = concordance.entries.find(
    (e) =>
      "quantityId" in e.binding &&
      e.binding.quantityId === quantityId &&
      e.operation.kind === "rename",
  );
  assert.ok(entry, `no rename entry for ${quantityId} in ${concordance.paper}`);
  assert.equal(entry.operation.kind, "rename");
  return entry;
}

function glyphText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "latex" in value) {
    const latex = (value as { latex?: unknown }).latex;
    if (typeof latex === "string") return latex;
  }
  throw new Error(`glyph is neither a string nor a Glyph with latex: ${JSON.stringify(value)}`);
}

/** The modern glyph the concordance itself declares for a quantity, so nothing is typed twice. */
function modernGlyphOf(concordance: PaperConcordance, quantityId: string): string {
  const entry = renameEntryFor(concordance, quantityId);
  const op = entry.operation;
  assert.ok(op.kind === "rename");
  return glyphText(op.target.modernGlyph);
}

/** The printed glyph the concordance itself declares, likewise. */
function printedGlyphOf(concordance: PaperConcordance, quantityId: string): string {
  return glyphText(renameEntryFor(concordance, quantityId).glyph);
}

/** L = E_emit on the left, V = c on the right: the two renames paper 4 turns on. */
const massEnergyEquation = {
  id: "eq-s0-d1",
  paper: "mass-energy",
  sectionId: "me-s0",
  tree: rel(
    sym("eq-s0-d1.t.emitted", "emittedEnergyRestFrame"),
    sym("eq-s0-d1.t.lightSpeed", "speedOfLight"),
  ),
};

test("mass-energy: the printed face keeps Einstein's own glyphs and leaks no modern one", () => {
  const concordance = loadConcordanceForPaper("mass-energy");
  const res = renderEquationLatex({
    equation: massEnergyEquation,
    form: { kind: "printed" },
    color: "plain",
    concordance,
    registry: MASS_ENERGY_QUANTITIES,
  });

  assert.equal(res.formRelation, "printed");
  for (const quantityId of ["emittedEnergyRestFrame", "speedOfLight"]) {
    assert.ok(
      res.latex.includes(printedGlyphOf(concordance, quantityId)),
      `printed face must show the printed glyph for ${quantityId}: ${res.latex}`,
    );
  }
  // The modern glyph for the speed of light is a bare "c"; it must not appear on the source face.
  assert.doesNotMatch(res.latex, /(^|[^a-zA-Z\\])c([^a-zA-Z]|$)/, res.latex);
});

test("mass-energy: the modern face is derived from the concordance, entry by entry", () => {
  const concordance = loadConcordanceForPaper("mass-energy");
  const res = renderEquationLatex({
    equation: massEnergyEquation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
    registry: MASS_ENERGY_QUANTITIES,
  });

  assert.equal(res.formRelation, "rename-only");
  for (const quantityId of ["emittedEnergyRestFrame", "speedOfLight"]) {
    const expected = modernGlyphOf(concordance, quantityId);
    assert.ok(
      res.latex.includes(expected),
      `modern face must show the concordance's glyph ${expected} for ${quantityId}: ${res.latex}`,
    );
  }
});

test("mass-energy: one printed L resolves differently in paper 4 and paper 1", () => {
  // The scoped-lookup property with real data on both sides: Einstein's L is the emitted
  // energy here and the speed of light in the light-quanta paper. A global substitution
  // would have to pick one and would be wrong in the other paper.
  const me = loadConcordanceForPaper("mass-energy");
  const lq = loadConcordanceForPaper("light-quanta");

  assert.equal(printedGlyphOf(me, "emittedEnergyRestFrame"), "L");
  assert.equal(printedGlyphOf(lq, "speedOfLight"), "L");

  const meModern = modernGlyphOf(me, "emittedEnergyRestFrame");
  const lqModern = modernGlyphOf(lq, "speedOfLight");
  assert.notEqual(
    meModern,
    lqModern,
    "the same printed glyph must not modernize to the same thing in two papers",
  );

  const rendered = renderEquationLatex({
    equation: massEnergyEquation,
    form: { kind: "modern" },
    color: "plain",
    concordance: me,
    registry: MASS_ENERGY_QUANTITIES,
  });
  assert.ok(rendered.latex.includes(meModern));
  // Paper 1's reading of L must not appear in paper 4's modern face.
  assert.ok(
    !rendered.latex.includes(`=${lqModern}`) && !rendered.latex.includes(` ${lqModern} `),
    `paper 1's modern glyph for L leaked into paper 4: ${rendered.latex}`,
  );
});

test("mass-energy: colour is never the only channel carrying a distinction", () => {
  const concordance = loadConcordanceForPaper("mass-energy");
  const colorized = renderEquationLatex({
    equation: massEnergyEquation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
    registry: MASS_ENERGY_QUANTITIES,
  });
  const plain = renderEquationLatex({
    equation: massEnergyEquation,
    form: { kind: "modern" },
    color: "plain",
    concordance,
    registry: MASS_ENERGY_QUANTITIES,
  });

  // 1. Every colorized term carries its identity in a non-colour channel (the term id),
  //    beside the role class that drives the colour.
  const termMarkers = [...colorized.latex.matchAll(/\\htmlData\{term=([^}]+)\}/g)].map((m) => m[1]);
  // The specific ids, not a count of them. "at least two markers" is satisfied by two
  // markers on the SAME term while the other symbol goes unmarked entirely - the count
  // matching while the property fails, which is the error pane30 found in the light-quanta
  // manifest (50 units, 50 printed starts, boundaries wrong in both directions).
  assert.deepEqual(
    [...termMarkers].sort(),
    ["eq-s0-d1.t.emitted", "eq-s0-d1.t.lightSpeed"],
    `both bound symbols must carry their own identity marker, got ${colorized.latex}`,
  );

  // 2. Two terms may share a role class, and therefore a colour. They must still be told
  //    apart without it, so the term ids are distinct even when the roles coincide.
  const roleClasses = [...colorized.latex.matchAll(/\\htmlClass\{am-role-([^}]+)\}/g)].map(
    (m) => m[1] as string,
  );
  for (const role of roleClasses) {
    assert.ok(
      (ALLOWED_ROLE_CLASSES as readonly string[]).includes(`am-role-${role}`) ||
        (ALLOWED_ROLE_CLASSES as readonly string[]).includes(role),
      `role class am-role-${role} is not enumerated`,
    );
  }
  assert.equal(new Set(termMarkers).size, termMarkers.length, "term ids must be distinct per term");

  // 3. The reading survives with no colour at all: plain mode carries no role class and
  //    still shows the same glyphs.
  assert.ok(!plain.latex.includes("am-role-"), "plain mode must emit no role classes");
  for (const quantityId of ["emittedEnergyRestFrame", "speedOfLight"]) {
    assert.ok(plain.latex.includes(modernGlyphOf(concordance, quantityId)));
  }
});

test("mass-energy: every rendered term is bound to a canonical quantity in the registry", () => {
  const concordance = loadConcordanceForPaper("mass-energy");
  const res = renderEquationLatex({
    equation: massEnergyEquation,
    form: { kind: "modern" },
    color: "colorized",
    concordance,
    registry: MASS_ENERGY_QUANTITIES,
  });

  // Again the ids, not the tally: a span emitted twice for one symbol would satisfy a count
  // of two while the other symbol had no span at all.
  assert.deepEqual(
    res.termSpans.map((span) => span.termId ?? span.id).sort(),
    ["eq-s0-d1.t.emitted", "eq-s0-d1.t.lightSpeed"],
    "each bound symbol must have exactly one term span, named",
  );
  const boundQuantities = ["emittedEnergyRestFrame", "speedOfLight"];
  for (const quantityId of boundQuantities) {
    assert.ok(
      MASS_ENERGY_QUANTITIES[quantityId],
      `${quantityId} must exist in the canonical registry`,
    );
    const entry = concordance.entries.find(
      (e) => "quantityId" in e.binding && e.binding.quantityId === quantityId,
    );
    assert.ok(entry, `${quantityId} must be bound by a concordance entry, not by glyph matching`);
  }
});
