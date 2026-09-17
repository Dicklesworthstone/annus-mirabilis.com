import { ContentError } from "../content/compiler/json.ts";
import { BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { type Expression, nodeId, parseExpression, record, walk } from "./ast.ts";
import { checkDimensions } from "./dimensions.ts";
import { BROWNIAN_QUANTITIES } from "./quantities.ts";
export type EquationNote = Readonly<{
  nodeId: string;
  title: string;
  explanation: string;
  foundation: string;
}>;
export type NumericalBinding = Readonly<{
  termId: string;
  quantityId: string;
  experimentId: "bm-01";
  outputId: string;
  instanceSlot: "primary";
}>;
export type EquationRecord = Readonly<{
  schemaVersion: 1;
  kind: "equation";
  id: string;
  paper: "brownian-motion";
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
  const o = record(input, path, [
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
  ]);
  if (
    o.schemaVersion !== 1 ||
    o.kind !== "equation" ||
    o.paper !== "brownian-motion" ||
    o.review !== "draft" ||
    o.notation !== "modern-pedagogical" ||
    o.unitSystem !== "si"
  )
    fail(path, "Only the labeled modern Brownian teaching slice is admitted.");
  for (const k of ["id", "argument", "title", "spoken", "explanation"]) text(o[k], path);
  if (
    !/^eq-model-[a-z0-9-]+$/.test(String(o.id)) ||
    !/^arg-bm-[a-z0-9-]+$/.test(String(o.argument))
  )
    fail(path, "Teaching equations must not invent printed source ids.");
  const tree = parseExpression(o.tree, String(o.id), BROWNIAN_QUANTITIES),
    nodes = walk(tree);
  const dimensions = checkDimensions(tree, BROWNIAN_QUANTITIES);
  if (dimensions.status !== "consistent") fail(path, dimensions.reason);
  if (tree.kind !== "relation") fail(path, "A displayed equation must be a relation.");
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
      v.experimentId !== "bm-01" ||
      v.instanceSlot !== "primary" ||
      bindings.has(String(v.termId))
    )
      fail(path, "Binding must resolve the exact term, quantity, output and instance slot.");
    const q = BROWNIAN_QUANTITIES[n.quantityId];
    if (!q) fail(path, "Binding must resolve the exact term, quantity, output and instance slot.");
    const c = BM01_OUTPUTS[String(v.outputId)];
    if (!c || c.unit !== q.unit || c.semanticKind !== q.semanticKind)
      fail(path, "The output contract does not have this quantity's units and meaning.");
    bindings.add(n.termId);
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
