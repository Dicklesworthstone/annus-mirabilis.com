import { ContentError } from "../content/compiler/json.ts";
import { type Expression, nodeId, parseExpression, record, walk } from "./ast.ts";
import { checkDimensions } from "./dimensions.ts";
import { type PrintedGlyphs, printedGlyphsProblem } from "./printedGlyphs.ts";
import { type EquationLayout, layoutProblem } from "./rowLayout.ts";
import {
  type TeachingExperiment,
  type TeachingPaper,
  teachingProfile,
} from "./teachingProfiles.ts";
export type EquationNote = Readonly<{
  nodeId: string;
  title: string;
  explanation: string;
  foundation: string;
}>;
export type NumericalBinding = Readonly<{
  termId: string;
  quantityId: string;
  experimentId: TeachingExperiment;
  outputId: string;
  instanceSlot: "primary";
}>;
export type EquationRecord = Readonly<{
  schemaVersion: 1;
  kind: "equation";
  id: string;
  paper: TeachingPaper;
  argument: string;
  title: string;
  spoken: string;
  explanation: string;
  review: "draft";
  notation: "modern-pedagogical";
  unitSystem: "si";
  tree: Expression;
  notes: readonly EquationNote[];
  bindings: readonly NumericalBinding[];
  sentence: readonly Readonly<{ text: string; nodeId?: string }>[];
  assumptions: readonly string[];
  /**
   * `false` declares a READING-ONLY equation: it explains a step of the argument and no laboratory
   * readout or snapshot value ever reaches it, so it has no live terms and the kernel-binding audit
   * (src/content/kernel/check.ts) does not ask an instrument's kernel to compute it. Absent means
   * live, and live records are audited as before: nothing is exempted by default. A reading-only
   * record may not bind an output (refused below), which is what keeps the flag from becoming an
   * escape hatch. Orchestrator ruling of 2026-09-23 (dispatch 91).
   */
  live?: false;
  /**
   * The letter this record prints for a quantity, where it differs from the table's: the lessons
   * print the density as f. Only the letter changes; the id, dimension, colour and legend name stay
   * canonical (src/equations/printedGlyphs.ts). Orchestrator ruling of 2026-09-23 (dispatch 100).
   */
  printedGlyphs?: PrintedGlyphs;
  /**
   * An authored layout (src/equations/rowLayout.ts): "rows" sets a relation chain on one aligned
   * row per relation sign; "break" sets a single relation's left side, then "= right side", on
   * two rows; "terms" gives each addend of a summed left side its own row. Absent, the formula is
   * one line. am-eq-static-katex-7da.
   */
  layout?: EquationLayout;
}>;
function fail(path: string, message: string): never {
  throw new ContentError("equation-invalid", path, message);
}
function text(x: unknown, path: string): asserts x is string {
  if (typeof x !== "string" || !x.trim() || x.length > 3000 || /<[!/?a-z]/i.test(x))
    fail(path, "Expected bounded plain text.");
}
function list(x: unknown, path: string): asserts x is unknown[] {
  if (!Array.isArray(x) || x.length > 64) fail(path, "Expected a bounded list.");
}
export function parseEquationRecord(input: unknown, path: string): EquationRecord {
  const o = record(
    input,
    path,
    [
      "schemaVersion",
      "kind",
      "id",
      "paper",
      "argument",
      "title",
      "spoken",
      "explanation",
      "review",
      "notation",
      "unitSystem",
      "tree",
      "notes",
      "bindings",
      "sentence",
      "assumptions",
    ],
    ["live", "printedGlyphs", "layout"],
  );
  const profile = teachingProfile(o.paper);
  if (
    o.schemaVersion !== 1 ||
    o.kind !== "equation" ||
    !profile ||
    o.review !== "draft" ||
    o.notation !== "modern-pedagogical" ||
    o.unitSystem !== "si"
  )
    fail(
      path,
      "Only registered modern teaching papers in SI are admitted; source or review status is not inferred.",
    );
  for (const k of ["id", "argument", "title", "spoken", "explanation"]) text(o[k], path);
  if (
    !/^eq-model-[a-z0-9-]+$/.test(String(o.id)) ||
    !new RegExp(`^${profile.argumentPrefix}[a-z0-9-]+$`).test(String(o.argument))
  )
    fail(path, "Teaching equations must not invent printed source ids.");
  const tree = parseExpression(o.tree, String(o.id), profile.quantities),
    nodes = walk(tree);
  const dimensions = checkDimensions(tree, profile.quantities);
  if (dimensions.status !== "consistent") fail(path, dimensions.reason);
  if (tree.kind !== "relation") fail(path, "A displayed equation must be a relation.");
  if (Object.hasOwn(o, "layout")) {
    const problem = layoutProblem(o.layout, tree);
    if (problem) fail(path, problem);
  }
  if (Object.hasOwn(o, "printedGlyphs")) {
    const problem = printedGlyphsProblem(o.printedGlyphs, tree, profile.quantities);
    if (problem) fail(path, problem);
  }
  const selectable = new Map(
    nodes.flatMap((n) => {
      const id = nodeId(n);
      return id ? ([[id, n]] as const) : [];
    }),
  );
  const notes = new Set<string>();
  const bindings = new Set<string>();
  list(o.notes, path);
  for (const n of o.notes) {
    const v = record(n, path, ["nodeId", "title", "explanation", "foundation"]);
    for (const x of Object.values(v)) text(x, path);
    if (!selectable.has(String(v.nodeId)) || notes.has(String(v.nodeId)))
      fail(path, "Unknown or duplicate note target.");
    notes.add(String(v.nodeId));
    if (!/^[a-z][a-z0-9-]+$/.test(String(v.foundation))) fail(path, "Invalid foundation id.");
  }
  if (notes.size !== selectable.size)
    fail(path, "Every selectable term and operation needs an explanation.");
  list(o.bindings, path);
  for (const b of o.bindings) {
    const v = record(b, path, ["termId", "quantityId", "experimentId", "outputId", "instanceSlot"]),
      n = selectable.get(String(v.termId));
    if (
      n?.kind !== "symbol" ||
      n.quantityId !== v.quantityId ||
      v.outputId !== v.quantityId ||
      typeof v.experimentId !== "string" ||
      !Object.hasOwn(profile.outputs, v.experimentId) ||
      v.instanceSlot !== "primary" ||
      bindings.has(String(v.termId))
    )
      fail(path, "Binding must resolve the exact term, quantity, output and instance slot.");
    const q = profile.quantities[n.quantityId];
    if (!q) fail(path, "Binding must resolve the exact term, quantity, output and instance slot.");
    const c = profile.outputs[v.experimentId as TeachingExperiment]?.[String(v.outputId)];
    if (!c || c.unit !== q.unit || c.semanticKind !== q.semanticKind)
      fail(path, "The output contract does not have this quantity's units and meaning.");
    bindings.add(n.termId);
  }
  // A lesson's formula explains a tool; no laboratory value ever reaches it, so it is reading-only
  // by declaration, never by default.
  if (o.paper === "foundations" && o.live !== false)
    fail(path, "A foundation lesson's equation is reading-only: declare live: false.");
  if (Object.hasOwn(o, "live")) {
    if (o.live !== false)
      fail(path, "Only `live: false` may be declared; a live equation omits the field.");
    if (bindings.size > 0)
      fail(
        path,
        "A reading-only equation (live: false) must not bind a laboratory output: the kernel-binding audit does not check it, so it may never feed a live readout.",
      );
  }
  list(o.sentence, path);
  if (o.sentence.length === 0) fail(path, "Explain the equation in a sentence.");
  for (const s of o.sentence) {
    const v = record(s, path, ["text"], ["nodeId"]);
    text(v.text, path);
    if (Object.hasOwn(v, "nodeId") && !selectable.has(String(v.nodeId)))
      fail(path, "Sentence refers to an absent expression node.");
  }
  list(o.assumptions, path);
  if (o.assumptions.length === 0) fail(path, "State the model assumptions.");
  for (const x of o.assumptions) {
    text(x, path);
  }
  return { ...(structuredClone(input) as EquationRecord), tree };
}
