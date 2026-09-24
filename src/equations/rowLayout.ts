/**
 * An authored layout hint for a displayed equation (am-eq-static-katex-7da: "an equation record
 * carrying layout hints renders as aligned rows with the same term and operation ids as its
 * single-line form, and no renderer-invented break appears anywhere in the output").
 *
 * "rows" sets a relation chain a = b = c on one row per relation sign, aligned at the signs.
 * Paper 2's second-moment chain runs four members wide and scrolled sideways on a 320px phone as
 * one line. Only a record that says so is broken; the renderer never decides to break a line.
 *
 * Two more for a single relation too wide for a phone (measured at 320px, 2026-09-24):
 * "break" sets its left side on one row and "= right side" on the next, as for paper 2's
 * p(x, t + tau) = integral; "terms" gives each addend of a summed left side its own row, then
 * "= right side", as for paper 4's two emissions added. Every row keeps its term and operation ids:
 * a relation's marker wraps its sign, and a broken sum's marker wraps each of its plus signs.
 */
import type { Expression } from "./ast.ts";
import { wrapHtmlData } from "./latex/markers.ts";

export type EquationLayout = "rows" | "break" | "terms";
export const EQUATION_LAYOUTS: readonly EquationLayout[] = ["rows", "break", "terms"];

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

/** A single relation, neither side itself a relation, or a problem string naming the layout. */
function singleRelation(tree: Expression, layout: string): Relation | string {
  if (tree.kind !== "relation" || tree.left.kind === "relation" || tree.right.kind === "relation")
    return `The "${layout}" layout breaks a single relation; a chain takes "rows".`;
  return tree;
}

/** Why a record's layout hint cannot apply, or undefined when it can. */
export function layoutProblem(layout: unknown, tree: Expression): string | undefined {
  if (!EQUATION_LAYOUTS.includes(layout as EquationLayout))
    return `Unsupported layout ${JSON.stringify(layout)}; the layouts are "rows", "break" and "terms".`;
  if (layout === "rows") {
    const chain = relationChain(tree);
    return typeof chain === "string" ? chain : undefined;
  }
  const relation = singleRelation(tree, String(layout));
  if (typeof relation === "string") return relation;
  if (layout === "terms") {
    const left = relation.left;
    if (left.kind !== "sum" || left.args.length < 2)
      return 'The "terms" layout needs a left side that is a sum of at least two terms.';
    // A subtracted term prints its own minus sign on one line; its marker could not move to a row.
    if (left.args.some((a) => a.kind === "negate"))
      return 'The "terms" layout needs every term of the sum added, not subtracted.';
  }
  return undefined;
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

/** A relation's sign, carrying the relation's marker when marked, kept a relation by \mathrel. */
function relationSign(relation: Relation, marked: boolean): string {
  const symbol = SIGN[relation.operator];
  return `\\mathrel{${marked && relation.opId ? wrapHtmlData("op", relation.opId, symbol) : symbol}}`;
}

/**
 * The record's formula in its authored layout, or undefined for one line. The parser has refused
 * a layout the tree cannot take, so each case meets the shape layoutProblem checked. Rows after
 * the first are indented by \qquad under the first, so a broken line reads as a continuation.
 */
export function layoutLatex(
  layout: EquationLayout | undefined,
  tree: Expression,
  part: (e: Expression) => string,
  marked: boolean,
): string | undefined {
  if (layout === undefined) return undefined;
  if (layout === "rows") {
    const chain = relationChain(tree);
    return typeof chain === "string" ? undefined : rowsLatex(chain, part, marked);
  }
  if (tree.kind !== "relation") return undefined;
  const last = `&\\qquad ${relationSign(tree, marked)} ${part(tree.right)}`;
  if (layout === "break") return `\\begin{aligned}& ${part(tree.left)} \\\\ ${last}\\end{aligned}`;
  const sum = tree.left;
  if (sum.kind !== "sum") return undefined;
  // A plus sign between rows is still a binary operator: {} before \mathbin keeps its spacing.
  const plus = `\\mathbin{${marked && sum.opId ? wrapHtmlData("op", sum.opId, "+") : "+"}}`;
  const [first, ...rest] = sum.args;
  const rows = [
    `& ${first ? part(first) : ""}`,
    ...rest.map((term) => `&\\qquad {} ${plus} ${part(term)}`),
    last,
  ];
  return `\\begin{aligned}${rows.join(" \\\\ ")}\\end{aligned}`;
}
