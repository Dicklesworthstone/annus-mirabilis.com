/**
 * Local, self-contained tree helpers (structural equality and pure
 * substitution) over `Expression` (`src/equations/ast.ts`). Deliberately
 * independent of that module's `substitute`/`parseExpression`, which are
 * tied to the content compiler's equation-record ingestion grammar
 * (`equationId`-prefixed ids revalidated on every substitution); a
 * derivation step's `from`/`to` trees are authored directly and do not
 * need that grammar. Reuses `ast.ts`'s `nodeId`/`children`/`walk` for
 * traversal so the two modules never disagree about node identity.
 */

import type { ExactScale, Expression } from "../ast.ts";
import { nodeId } from "../ast.ts";

function scaleEqual(a: ExactScale | undefined, b: ExactScale | undefined): boolean {
  const an = a ?? { num: 1, den: 1 };
  const bn = b ?? { num: 1, den: 1 };
  return an.num === bn.num && an.den === bn.den;
}

function optionalEqual(a: Expression | undefined, b: Expression | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return structurallyEqual(a, b);
}

/** Deep structural equality: same shape and same authored ids, ignoring nothing. */
export function structurallyEqual(a: Expression, b: Expression): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "symbol":
      return (
        b.kind === "symbol" &&
        a.termId === b.termId &&
        a.quantityId === b.quantityId &&
        scaleEqual(a.scale, b.scale) &&
        a.index === b.index &&
        optionalEqual(a.at, b.at) &&
        (a.args ?? []).length === (b.args ?? []).length &&
        (a.args ?? []).every((x, i) => optionalEqual(x, b.args?.[i]))
      );
    case "constant":
      return b.kind === "constant" && a.name === b.name;
    case "number":
      return b.kind === "number" && a.value === b.value;
    case "sum":
    case "product":
      return (
        b.kind === a.kind &&
        a.args.length === b.args.length &&
        a.args.every((x, i) => {
          const bi = b.args[i];
          return bi !== undefined && structurallyEqual(x, bi);
        })
      );
    case "quotient":
      return (
        b.kind === "quotient" &&
        structurallyEqual(a.numerator, b.numerator) &&
        structurallyEqual(a.denominator, b.denominator)
      );
    case "power":
      return (
        b.kind === "power" &&
        structurallyEqual(a.base, b.base) &&
        scaleEqual(a.exponent, b.exponent)
      );
    case "symbolPower":
      return (
        b.kind === "symbolPower" &&
        structurallyEqual(a.base, b.base) &&
        structurallyEqual(a.exponent, b.exponent)
      );
    case "root":
      return (
        b.kind === "root" && structurallyEqual(a.radicand, b.radicand) && a.degree === b.degree
      );
    case "negate":
    case "average":
    case "group":
      return b.kind === a.kind && structurallyEqual(a.argument, b.argument);
    case "function":
      return (
        b.kind === "function" && a.name === b.name && structurallyEqual(a.argument, b.argument)
      );
    case "relation":
      return (
        b.kind === "relation" &&
        a.operator === b.operator &&
        structurallyEqual(a.left, b.left) &&
        structurallyEqual(a.right, b.right)
      );
    case "derivative":
      return (
        b.kind === "derivative" &&
        a.order === b.order &&
        a.partial === b.partial &&
        structurallyEqual(a.expression, b.expression) &&
        structurallyEqual(a.variable, b.variable) &&
        (a.heldFixed ?? []).length === (b.heldFixed ?? []).length &&
        (a.heldFixed ?? []).every((h, i) => {
          const bh = b.heldFixed?.[i];
          return bh !== undefined && structurallyEqual(h, bh);
        })
      );
    case "integral":
      return (
        b.kind === "integral" &&
        structurallyEqual(a.expression, b.expression) &&
        structurallyEqual(a.variable, b.variable) &&
        optionalEqual(a.lower, b.lower) &&
        optionalEqual(a.upper, b.upper)
      );
    case "limit":
      return (
        b.kind === "limit" &&
        structurallyEqual(a.expression, b.expression) &&
        structurallyEqual(a.variable, b.variable) &&
        structurallyEqual(a.approaches, b.approaches)
      );
    case "indexedSum":
      return (
        b.kind === "indexedSum" &&
        a.index === b.index &&
        structurallyEqual(a.expression, b.expression) &&
        structurallyEqual(a.from, b.from) &&
        structurallyEqual(a.to, b.to)
      );
    case "partialOperator":
      return b.kind === "partialOperator" && structurallyEqual(a.variable, b.variable);
  }
}

/** Pure substitution by node id, with no re-validation against any ingestion grammar. */
export function substituteNode(
  root: Expression,
  targetId: string,
  replacement: Expression,
): Expression {
  if (nodeId(root) === targetId) return replacement;
  switch (root.kind) {
    case "symbol":
      if (root.args)
        return { ...root, args: root.args.map((x) => substituteNode(x, targetId, replacement)) };
      return root.at ? { ...root, at: substituteNode(root.at, targetId, replacement) } : root;
    case "constant":
    case "number":
      return root;
    case "sum":
    case "product":
      return { ...root, args: root.args.map((a) => substituteNode(a, targetId, replacement)) };
    case "quotient":
      return {
        ...root,
        numerator: substituteNode(root.numerator, targetId, replacement),
        denominator: substituteNode(root.denominator, targetId, replacement),
      };
    case "power":
      return { ...root, base: substituteNode(root.base, targetId, replacement) };
    case "symbolPower":
      return {
        ...root,
        base: substituteNode(root.base, targetId, replacement),
        exponent: substituteNode(root.exponent, targetId, replacement),
      };
    case "root":
      return { ...root, radicand: substituteNode(root.radicand, targetId, replacement) };
    case "negate":
    case "average":
    case "group":
      return { ...root, argument: substituteNode(root.argument, targetId, replacement) };
    case "function":
      return { ...root, argument: substituteNode(root.argument, targetId, replacement) };
    case "relation":
      return {
        ...root,
        left: substituteNode(root.left, targetId, replacement),
        right: substituteNode(root.right, targetId, replacement),
      };
    case "derivative":
      return { ...root, expression: substituteNode(root.expression, targetId, replacement) };
    case "integral":
      return {
        ...root,
        expression: substituteNode(root.expression, targetId, replacement),
        ...(root.lower && root.upper
          ? {
              lower: substituteNode(root.lower, targetId, replacement),
              upper: substituteNode(root.upper, targetId, replacement),
            }
          : {}),
      };
    case "limit":
      // Like an integral's variable, the variable and the value it approaches are not rewritten.
      return { ...root, expression: substituteNode(root.expression, targetId, replacement) };
    case "indexedSum":
      return { ...root, expression: substituteNode(root.expression, targetId, replacement) };
    case "partialOperator":
      return root;
  }
}

/** True when a node with this id appears anywhere in the tree. */
export function containsId(root: Expression, id: string): boolean {
  if (nodeId(root) === id) return true;
  return childrenOf(root).some((child) => containsId(child, id));
}

function childrenOf(n: Expression): readonly Expression[] {
  switch (n.kind) {
    case "symbol":
      return n.at ? [n.at] : (n.args ?? []);
    case "number":
    case "constant":
      return [];
    case "sum":
    case "product":
      return n.args;
    case "quotient":
      return [n.numerator, n.denominator];
    case "power":
      return [n.base];
    case "symbolPower":
      return [n.base, n.exponent];
    case "root":
      return [n.radicand];
    case "negate":
    case "average":
    case "group":
    case "function":
      return [n.argument];
    case "relation":
      return [n.left, n.right];
    case "derivative":
      return [n.expression, n.variable, ...(n.heldFixed ?? [])];
    case "integral":
      return [
        n.expression,
        n.variable,
        ...(n.lower ? [n.lower] : []),
        ...(n.upper ? [n.upper] : []),
      ];
    case "limit":
      return [n.expression, n.variable, n.approaches];
    case "indexedSum":
      return [n.expression, n.from, n.to];
    case "partialOperator":
      return [n.variable];
  }
}

export const relationSides = (relation: Extract<Expression, { kind: "relation" }>) => ({
  left: relation.left,
  right: relation.right,
});

/** Collects all distinct symbol termIds from an expression tree. */
export function collectTermIds(root: Expression): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };
  const visit = (n: Expression) => {
    if (n.kind === "symbol") add(n.termId);
    for (const child of childrenOf(n)) visit(child);
  };
  visit(root);
  return ids;
}
