/**
 * An authored layout hint for a displayed equation (am-eq-static-katex-7da: "an equation record
 * carrying layout hints renders as aligned rows with the same term and operation ids as its
 * single-line form, and no renderer-invented break appears anywhere in the output").
 *
 * "rows" sets a relation chain a = b = c on one row per relation sign, aligned at the signs.
 * Paper 2's second-moment chain runs four members wide and scrolled sideways on a 320px phone as
 * one line. Only a record that says "rows" is broken; the renderer never decides to break a line.
 */
import type { Expression } from "./ast.ts";
import { wrapHtmlData } from "./latex/markers.ts";

export type EquationLayout = "rows";
export const EQUATION_LAYOUTS: readonly EquationLayout[] = ["rows"];

type Relation = Extract<Expression, { kind: "relation" }>;

/**
 * A relation chain as its members and the relation signs between them, in reading order. A chain
 * is nested to the left, relation(relation(a, b), c), which is how every chained record is
 * written. Anything else, a single relation or a relation on the right, is a problem string.
 */
export function relationChain(
  tree: Expression,
): Readonly<{ members: readonly Expression[]; signs: readonly Relation[] }> | string {
  const members: Expression[] = [];
  const signs: Relation[] = [];
  let n = tree;
  while (n.kind === "relation") {
    if (n.right.kind === "relation")
      return "A row layout needs a chain nested to the left: a relation may not sit on the right.";
    members.unshift(n.right);
    signs.unshift(n);
    n = n.left;
  }
  members.unshift(n);
  if (signs.length < 2)
    return "A row layout needs a chain with at least two relation signs; one relation stays on one line.";
  return { members, signs };
}

/** Why a record's layout hint cannot apply, or undefined when it can. */
export function layoutProblem(layout: unknown, tree: Expression): string | undefined {
  if (!EQUATION_LAYOUTS.includes(layout as EquationLayout))
    return `Unsupported layout ${JSON.stringify(layout)}; the only layout is "rows".`;
  const chain = relationChain(tree);
  return typeof chain === "string" ? chain : undefined;
}

type Chain = Exclude<ReturnType<typeof relationChain>, string>;

/** The printed sign of each relation, as the single-line renderer prints it (checked by test). */
const SIGN: Readonly<Record<Relation["operator"], string>> = {
  "=": "=",
  approx: "\\approx",
  define: ":=",
  le: "\\le",
  ge: "\\ge",
};

/**
 * A chain as aligned rows, one per relation sign. `part` renders each member exactly as it renders
 * on one line. A marker cannot span rows, so each relation's operation marker wraps its sign,
 * kept a relation by \mathrel so the spacing does not change.
 */
export function rowsLatex(chain: Chain, part: (e: Expression) => string, marked: boolean): string {
  const [first, ...rest] = chain.members;
  const rows = rest.map((member, i) => {
    const relation = chain.signs[i];
    const symbol = relation ? SIGN[relation.operator] : "=";
    const sign = marked && relation?.opId ? wrapHtmlData("op", relation.opId, symbol) : symbol;
    return `${i === 0 && first ? part(first) : ""} &\\mathrel{${sign}} ${part(member)}`;
  });
  return `\\begin{aligned}${rows.join(" \\\\ ")}\\end{aligned}`;
}
