/**
 * Tree traversal, lookup, substitution, and structural equality utilities.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import type { ExactScale, Expression, NodeKind } from "./types.ts";

export function children(node: Expression): readonly Expression[] {
  switch (node.kind) {
    case "symbol":
    case "constant":
    case "number":
    case "seriesTruncation":
    case "textAnnotation":
      return [];
    case "sum":
    case "product":
      return node.args;
    case "quotient":
      return [node.numerator, node.denominator];
    case "power":
      return typeof node.exponent === "object" && "kind" in node.exponent
        ? [node.base, node.exponent as Expression]
        : [node.base];
    case "root":
      return [node.radicand];
    case "negate":
    case "average":
    case "norm":
    case "group":
    case "function":
      return [node.argument];
    case "relation":
      return [node.left, node.right];
    case "derivative":
      return typeof node.heldFixed === "object" &&
        node.heldFixed !== null &&
        "kind" in node.heldFixed
        ? [node.expression, node.variable, node.heldFixed as Expression]
        : [node.expression, node.variable];
    case "integral": {
      const list: Expression[] = [node.expression, node.variable];
      if (node.lowerBound) list.push(node.lowerBound);
      if (node.upperBound) list.push(node.upperBound);
      return list;
    }
    case "seriesSum":
    case "seriesProduct": {
      const list: Expression[] = [];
      if (typeof node.index === "object" && "kind" in node.index) {
        list.push(node.index as Expression);
      }
      if (node.lowerBound) list.push(node.lowerBound);
      if (node.upperBound) list.push(node.upperBound);
      list.push(node.body);
      return list;
    }
    case "limit": {
      const list: Expression[] = [node.variable, node.target, node.body];
      return list;
    }
    case "dotProduct":
    case "crossProduct":
      return [node.left, node.right];
    case "vector":
      return node.elements;
    case "matrix":
      return node.rows.flat();
    case "piecewise": {
      const list: Expression[] = [];
      for (const c of node.cases) {
        list.push(c.condition, c.value);
      }
      if (node.otherwise) list.push(node.otherwise);
      return list;
    }
  }
}

export function walk(root: Expression): readonly Expression[] {
  const result: Expression[] = [root];
  for (const child of children(root)) {
    result.push(...walk(child));
  }
  return result;
}

export function nodeId(node: Expression): string | null {
  if (node.kind === "symbol") return node.termId;
  if ("opId" in node && typeof node.opId === "string" && node.opId.length > 0) {
    return node.opId;
  }
  return null;
}

export function findNodeById(root: Expression, id: string): Expression | undefined {
  return walk(root).find((n) => nodeId(n) === id);
}

export function scaleEqual(a: ExactScale | undefined, b: ExactScale | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.num === b.num && a.den === b.den;
}

export function structuralEqual(a: Expression, b: Expression): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "symbol": {
      const bSym = b as typeof a;
      return (
        a.termId === bSym.termId &&
        a.quantityId === bSym.quantityId &&
        scaleEqual(a.scale, bSym.scale) &&
        a.component === bSym.component &&
        a.role === bSym.role
      );
    }
    case "constant":
      return a.name === (b as typeof a).name;
    case "number": {
      const bNum = b as typeof a;
      return a.value === bNum.value && a.unit === bNum.unit;
    }
    case "sum":
    case "product": {
      const bArr = b as typeof a;
      if (a.args.length !== bArr.args.length) return false;
      if (a.opId !== bArr.opId) return false;
      return a.args.every((arg, i) => {
        const bArg = bArr.args[i];
        return bArg !== undefined && structuralEqual(arg, bArg);
      });
    }
    case "quotient": {
      const bQuot = b as typeof a;
      return (
        a.opId === bQuot.opId &&
        structuralEqual(a.numerator, bQuot.numerator) &&
        structuralEqual(a.denominator, bQuot.denominator)
      );
    }
    case "power": {
      const bPow = b as typeof a;
      if (a.opId !== bPow.opId) return false;
      if (!structuralEqual(a.base, bPow.base)) return false;
      const aIsExp = typeof a.exponent === "object" && "kind" in a.exponent;
      const bIsExp = typeof bPow.exponent === "object" && "kind" in bPow.exponent;
      if (aIsExp !== bIsExp) return false;
      if (aIsExp) {
        return structuralEqual(a.exponent as Expression, bPow.exponent as Expression);
      }
      return scaleEqual(a.exponent as ExactScale, bPow.exponent as ExactScale);
    }
    case "root": {
      const bRoot = b as typeof a;
      return (
        a.opId === bRoot.opId &&
        a.degree === bRoot.degree &&
        structuralEqual(a.radicand, bRoot.radicand)
      );
    }
    case "negate":
    case "average":
    case "norm":
    case "group": {
      const bUn = b as typeof a;
      return a.opId === bUn.opId && structuralEqual(a.argument, bUn.argument);
    }
    case "function": {
      const bFn = b as typeof a;
      return (
        a.opId === bFn.opId && a.name === bFn.name && structuralEqual(a.argument, bFn.argument)
      );
    }
    case "relation": {
      const bRel = b as typeof a;
      return (
        a.opId === bRel.opId &&
        a.operator === bRel.operator &&
        structuralEqual(a.left, bRel.left) &&
        structuralEqual(a.right, bRel.right)
      );
    }
    case "derivative": {
      const bDer = b as typeof a;
      if (a.opId !== bDer.opId || a.order !== bDer.order || a.partial !== bDer.partial) {
        return false;
      }
      if (!structuralEqual(a.expression, bDer.expression)) return false;
      if (!structuralEqual(a.variable, bDer.variable)) return false;
      if (typeof a.heldFixed !== typeof bDer.heldFixed) return false;
      if (typeof a.heldFixed === "object" && a.heldFixed !== null) {
        return structuralEqual(a.heldFixed as Expression, bDer.heldFixed as Expression);
      }
      return a.heldFixed === bDer.heldFixed;
    }
    case "integral": {
      const bInt = b as typeof a;
      if (a.opId !== bInt.opId) return false;
      if (!structuralEqual(a.expression, bInt.expression)) return false;
      if (!structuralEqual(a.variable, bInt.variable)) return false;
      const hasLowerA = !!a.lowerBound;
      const hasLowerB = !!bInt.lowerBound;
      if (hasLowerA !== hasLowerB) return false;
      if (a.lowerBound && bInt.lowerBound && !structuralEqual(a.lowerBound, bInt.lowerBound)) {
        return false;
      }
      const hasUpperA = !!a.upperBound;
      const hasUpperB = !!bInt.upperBound;
      if (hasUpperA !== hasUpperB) return false;
      if (a.upperBound && bInt.upperBound && !structuralEqual(a.upperBound, bInt.upperBound)) {
        return false;
      }
      return true;
    }
    case "seriesSum":
    case "seriesProduct": {
      const bSer = b as typeof a;
      if (a.opId !== bSer.opId) return false;
      if (typeof a.index !== typeof bSer.index) return false;
      if (typeof a.index === "object" && a.index !== null) {
        if (!structuralEqual(a.index as Expression, bSer.index as Expression)) return false;
      } else if (a.index !== bSer.index) {
        return false;
      }
      if (!!a.lowerBound !== !!bSer.lowerBound) return false;
      if (a.lowerBound && bSer.lowerBound && !structuralEqual(a.lowerBound, bSer.lowerBound))
        return false;
      if (!!a.upperBound !== !!bSer.upperBound) return false;
      if (a.upperBound && bSer.upperBound && !structuralEqual(a.upperBound, bSer.upperBound))
        return false;
      return structuralEqual(a.body, bSer.body);
    }
    case "limit": {
      const bLim = b as typeof a;
      return (
        a.opId === bLim.opId &&
        structuralEqual(a.variable, bLim.variable) &&
        structuralEqual(a.target, bLim.target) &&
        structuralEqual(a.body, bLim.body)
      );
    }
    case "dotProduct":
    case "crossProduct": {
      const bVecOp = b as typeof a;
      return (
        a.opId === bVecOp.opId &&
        structuralEqual(a.left, bVecOp.left) &&
        structuralEqual(a.right, bVecOp.right)
      );
    }
    case "vector": {
      const bVec = b as typeof a;
      if (a.opId !== bVec.opId || a.elements.length !== bVec.elements.length) return false;
      return a.elements.every((el, i) => {
        const bEl = bVec.elements[i];
        return bEl !== undefined && structuralEqual(el, bEl);
      });
    }
    case "matrix": {
      const bMat = b as typeof a;
      if (a.opId !== bMat.opId || a.rows.length !== bMat.rows.length) return false;
      return a.rows.every((row, r) => {
        const bRow = bMat.rows[r];
        if (!bRow || row.length !== bRow.length) return false;
        return row.every((el, c) => {
          const bEl = bRow[c];
          return bEl !== undefined && structuralEqual(el, bEl);
        });
      });
    }
    case "piecewise": {
      const bPw = b as typeof a;
      if (a.opId !== bPw.opId || a.cases.length !== bPw.cases.length) return false;
      for (let i = 0; i < a.cases.length; i++) {
        const ca = a.cases[i];
        const cb = bPw.cases[i];
        if (!ca || !cb) return false;
        if (!structuralEqual(ca.condition, cb.condition) || !structuralEqual(ca.value, cb.value)) {
          return false;
        }
      }
      if (!!a.otherwise !== !!bPw.otherwise) return false;
      if (a.otherwise && bPw.otherwise && !structuralEqual(a.otherwise, bPw.otherwise)) {
        return false;
      }
      return true;
    }
    case "seriesTruncation": {
      const bTr = b as typeof a;
      return a.opId === bTr.opId && a.order === bTr.order;
    }
    case "textAnnotation": {
      const bTa = b as typeof a;
      return a.opId === bTa.opId && a.text === bTa.text;
    }
  }
}

export function substitute(
  tree: Expression,
  targetId: string,
  replacement: Expression,
): Expression {
  if (nodeId(tree) === targetId) {
    return replacement;
  }

  switch (tree.kind) {
    case "symbol":
    case "constant":
    case "number":
    case "seriesTruncation":
    case "textAnnotation":
      return tree;
    case "sum":
      return {
        ...tree,
        args: tree.args.map((arg) => substitute(arg, targetId, replacement)),
      };
    case "product":
      return {
        ...tree,
        args: tree.args.map((arg) => substitute(arg, targetId, replacement)),
      };
    case "quotient":
      return {
        ...tree,
        numerator: substitute(tree.numerator, targetId, replacement),
        denominator: substitute(tree.denominator, targetId, replacement),
      };
    case "power":
      return {
        ...tree,
        base: substitute(tree.base, targetId, replacement),
        exponent:
          typeof tree.exponent === "object" && "kind" in tree.exponent
            ? substitute(tree.exponent as Expression, targetId, replacement)
            : tree.exponent,
      };
    case "root":
      return {
        ...tree,
        radicand: substitute(tree.radicand, targetId, replacement),
      };
    case "negate":
      return {
        ...tree,
        argument: substitute(tree.argument, targetId, replacement),
      };
    case "average":
      return {
        ...tree,
        argument: substitute(tree.argument, targetId, replacement),
      };
    case "norm":
      return {
        ...tree,
        argument: substitute(tree.argument, targetId, replacement),
      };
    case "group":
      return {
        ...tree,
        argument: substitute(tree.argument, targetId, replacement),
      };
    case "function":
      return {
        ...tree,
        argument: substitute(tree.argument, targetId, replacement),
      };
    case "relation":
      return {
        ...tree,
        left: substitute(tree.left, targetId, replacement),
        right: substitute(tree.right, targetId, replacement),
      };
    case "derivative":
      return {
        ...tree,
        expression: substitute(tree.expression, targetId, replacement),
        variable: substitute(tree.variable, targetId, replacement),
        heldFixed:
          typeof tree.heldFixed === "object" && tree.heldFixed !== null && "kind" in tree.heldFixed
            ? substitute(tree.heldFixed as Expression, targetId, replacement)
            : tree.heldFixed,
      };
    case "integral":
      return {
        ...tree,
        expression: substitute(tree.expression, targetId, replacement),
        variable: substitute(tree.variable, targetId, replacement),
        lowerBound: tree.lowerBound
          ? substitute(tree.lowerBound, targetId, replacement)
          : undefined,
        upperBound: tree.upperBound
          ? substitute(tree.upperBound, targetId, replacement)
          : undefined,
      };
    case "seriesSum":
      return {
        ...tree,
        index:
          typeof tree.index === "object" && "kind" in tree.index
            ? substitute(tree.index as Expression, targetId, replacement)
            : tree.index,
        lowerBound: tree.lowerBound
          ? substitute(tree.lowerBound, targetId, replacement)
          : undefined,
        upperBound: tree.upperBound
          ? substitute(tree.upperBound, targetId, replacement)
          : undefined,
        body: substitute(tree.body, targetId, replacement),
      };
    case "seriesProduct":
      return {
        ...tree,
        index:
          typeof tree.index === "object" && "kind" in tree.index
            ? substitute(tree.index as Expression, targetId, replacement)
            : tree.index,
        lowerBound: tree.lowerBound
          ? substitute(tree.lowerBound, targetId, replacement)
          : undefined,
        upperBound: tree.upperBound
          ? substitute(tree.upperBound, targetId, replacement)
          : undefined,
        body: substitute(tree.body, targetId, replacement),
      };
    case "limit":
      return {
        ...tree,
        variable: substitute(tree.variable, targetId, replacement),
        target: substitute(tree.target, targetId, replacement),
        body: substitute(tree.body, targetId, replacement),
      };
    case "dotProduct":
      return {
        ...tree,
        left: substitute(tree.left, targetId, replacement),
        right: substitute(tree.right, targetId, replacement),
      };
    case "crossProduct":
      return {
        ...tree,
        left: substitute(tree.left, targetId, replacement),
        right: substitute(tree.right, targetId, replacement),
      };
    case "vector":
      return {
        ...tree,
        elements: tree.elements.map((el) => substitute(el, targetId, replacement)),
      };
    case "matrix":
      return {
        ...tree,
        rows: tree.rows.map((row) => row.map((el) => substitute(el, targetId, replacement))),
      };
    case "piecewise":
      return {
        ...tree,
        cases: tree.cases.map((c) => ({
          condition: substitute(c.condition, targetId, replacement),
          value: substitute(c.value, targetId, replacement),
        })),
        otherwise: tree.otherwise ? substitute(tree.otherwise, targetId, replacement) : undefined,
      };
  }
}

export function referencedTermIds(tree: Expression): readonly string[] {
  return walk(tree)
    .filter((n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol")
    .map((s) => s.termId);
}

export function quantityIdsReferenced(
  tree: Expression,
): readonly (readonly [string, ExactScale | undefined])[] {
  return walk(tree)
    .filter((n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol")
    .map((s) => [s.quantityId, s.scale] as const);
}

export const referencedQuantityIds = quantityIdsReferenced;
