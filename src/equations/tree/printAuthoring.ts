/**
 * Authoring Grammar Printer for Semantic Expression Trees.
 *
 * Emits valid authoring grammar for any tree, driving round-trip tests and diagnostics.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.3).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import type { ExactScale, Expression } from "./types.ts";

export interface PrintOptions {
  readonly symbolNames?: Record<string, string> | undefined;
  readonly includeOpIds?: boolean | undefined;
}

export function printAuthoring(node: Expression, options: PrintOptions = {}): string {
  const includeOp = options.includeOpIds !== false;

  function localOpName(opId: string): string {
    const idx = opId.indexOf(".op.");
    if (idx !== -1) {
      return opId.slice(idx + 4);
    }
    return opId;
  }

  function printNode(n: Expression): string {
    let prefix = "";
    if (includeOp && "opId" in n && typeof n.opId === "string" && n.opId) {
      prefix = `@${localOpName(n.opId)} `;
    }

    switch (n.kind) {
      case "symbol": {
        if (options.symbolNames && options.symbolNames[n.termId]) {
          return options.symbolNames[n.termId]!;
        }
        const idx = n.termId.indexOf(".t.");
        if (idx !== -1) {
          return n.termId.slice(idx + 3);
        }
        return n.termId;
      }
      case "constant":
        return n.name;
      case "number":
        return n.value;
      case "sum": {
        const parts: string[] = [];
        for (let i = 0; i < n.args.length; i++) {
          const arg = n.args[i]!;
          if (arg.kind === "negate") {
            if (i === 0) {
              parts.push(`-${printAtom(arg.argument)}`);
            } else {
              parts.push(`- ${printAtom(arg.argument)}`);
            }
          } else {
            if (i === 0) {
              parts.push(printAtom(arg));
            } else {
              parts.push(`+ ${printAtom(arg)}`);
            }
          }
        }
        return `${prefix}${parts.join(" ")}`;
      }
      case "product": {
        if (n.style === "juxtaposed") {
          return `${prefix}${n.args.map(printAtom).join(" ")}`;
        }
        return `${prefix}${n.args.map(printAtom).join(" * ")}`;
      }
      case "quotient": {
        if (n.style === "solidus") {
          return `${prefix}${printAtom(n.numerator)} / ${printAtom(n.denominator)}`;
        }
        return `${prefix}frac(${printNode(n.numerator)}, ${printNode(n.denominator)})`;
      }
      case "power": {
        const expStr =
          typeof n.exponent === "object" && "kind" in n.exponent
            ? printAtom(n.exponent as Expression)
            : printScale(n.exponent as ExactScale);
        return `${prefix}${printAtom(n.base)}^${expStr}`;
      }
      case "root": {
        if (n.degree === 2) {
          return `${prefix}sqrt(${printNode(n.radicand)})`;
        }
        return `${prefix}root(${printNode(n.radicand)}, ${n.degree})`;
      }
      case "negate": {
        return `${prefix}-${printAtom(n.argument)}`;
      }
      case "average":
        return `${prefix}avg(${printNode(n.argument)})`;
      case "norm":
        return `${prefix}norm(${printNode(n.argument)})`;
      case "group":
        return `${prefix}(${printNode(n.argument)})`;
      case "function":
        return `${prefix}${n.name}(${printNode(n.argument)})`;
      case "relation":
        return `${prefix}${printNode(n.left)} ${n.operator} ${printNode(n.right)}`;
      case "derivative": {
        const fn = n.partial ? "pdiff" : "diff";
        const extra: string[] = [];
        if (n.order > 1 || n.heldFixed) {
          extra.push(String(n.order));
        }
        if (n.heldFixed) {
          extra.push(
            typeof n.heldFixed === "object" ? printNode(n.heldFixed as Expression) : n.heldFixed,
          );
        }
        const extraStr = extra.length > 0 ? `, ${extra.join(", ")}` : "";
        return `${prefix}${fn}(${printNode(n.expression)}, ${printNode(n.variable)}${extraStr})`;
      }
      case "integral": {
        const bounds =
          n.lowerBound || n.upperBound
            ? `, ${n.lowerBound ? printNode(n.lowerBound) : "0"}, ${n.upperBound ? printNode(n.upperBound) : "0"}`
            : "";
        return `${prefix}int(${printNode(n.expression)}, ${printNode(n.variable)}${bounds})`;
      }
      case "seriesSum": {
        const idx = typeof n.index === "object" ? printNode(n.index as Expression) : n.index;
        const bounds =
          n.lowerBound || n.upperBound
            ? `, ${n.lowerBound ? printNode(n.lowerBound) : "0"}, ${n.upperBound ? printNode(n.upperBound) : "0"}`
            : "";
        return `${prefix}sum(${printNode(n.body)}, ${idx}${bounds})`;
      }
      case "seriesProduct": {
        const idx = typeof n.index === "object" ? printNode(n.index as Expression) : n.index;
        const bounds =
          n.lowerBound || n.upperBound
            ? `, ${n.lowerBound ? printNode(n.lowerBound) : "0"}, ${n.upperBound ? printNode(n.upperBound) : "0"}`
            : "";
        return `${prefix}prod(${printNode(n.body)}, ${idx}${bounds})`;
      }
      case "limit":
        return `${prefix}limit(${printNode(n.body)}, ${printNode(n.variable)}, ${printNode(n.target)})`;
      case "dotProduct":
        return `${prefix}dot(${printNode(n.left)}, ${printNode(n.right)})`;
      case "crossProduct":
        return `${prefix}cross(${printNode(n.left)}, ${printNode(n.right)})`;
      case "vector":
        return `${prefix}[${n.elements.map(printNode).join(", ")}]`;
      case "matrix": {
        const rowStrs = n.rows.map((r) => `[${r.map(printNode).join(", ")}]`);
        return `${prefix}matrix(${rowStrs.join(", ")})`;
      }
      case "piecewise": {
        const caseStrs = n.cases.map((c) => `[${printNode(c.condition)}, ${printNode(c.value)}]`);
        if (n.otherwise) {
          caseStrs.push(printNode(n.otherwise));
        }
        return `${prefix}piecewise(${caseStrs.join(", ")})`;
      }
      case "seriesTruncation":
        return `${prefix}trunc(${n.order ? `"${n.order}"` : ""})`;
      case "textAnnotation":
        return `${prefix}text("${n.text}")`;
    }
  }

  function printAtom(n: Expression): string {
    if (
      n.kind === "sum" ||
      n.kind === "relation" ||
      (n.kind === "product" && n.style !== "juxtaposed") ||
      (n.kind === "quotient" && n.style === "solidus")
    ) {
      return `(${printNode(n)})`;
    }
    return printNode(n);
  }

  function printScale(s: ExactScale): string {
    if (s.den === 1) {
      return String(s.num);
    }
    return `(${s.num} / ${s.den})`;
  }

  return printNode(node);
}
