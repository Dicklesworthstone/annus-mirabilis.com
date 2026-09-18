/**
 * Numerical Spot-Check Evaluator for Expression Trees.
 *
 * Designed exclusively for compiler and test derivation verification.
 * Client components MUST NEVER import this file (enforced by clientBoundary.test.ts).
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import type { Expression } from "./types.ts";

export type EvaluationResult =
  | { readonly status: "value"; readonly value: number }
  | {
      readonly status: "outside-domain";
      readonly nodeId: string | null;
      readonly reason: string;
    }
  | {
      readonly status: "unsupported-node";
      readonly nodeId: string | null;
      readonly kind: string;
    }
  | { readonly status: "unbound-value"; readonly termId: string };

export type ValueAssignment = Readonly<Record<string, number>>;

export interface EvaluateOptions {
  readonly relationSide?: "left" | "right" | "both" | undefined;
}

export function evaluateForSpotCheck(
  tree: Expression,
  assignment: ValueAssignment,
  options: EvaluateOptions = {},
): EvaluationResult {
  function evalNode(node: Expression): EvaluationResult {
    const opId = "opId" in node && typeof node.opId === "string" ? node.opId : null;

    switch (node.kind) {
      case "symbol": {
        let rawVal = assignment[node.termId];
        if (rawVal === undefined) {
          rawVal = assignment[node.quantityId];
        }
        if (rawVal === undefined) {
          return { status: "unbound-value", termId: node.termId };
        }
        if (!Number.isFinite(rawVal)) {
          return {
            status: "outside-domain",
            nodeId: node.termId,
            reason: `Non-finite assignment for term '${node.termId}'`,
          };
        }
        const scale = node.scale ?? { num: 1, den: 1 };
        const scaledVal = (rawVal * scale.num) / scale.den;
        if (!Number.isFinite(scaledVal)) {
          return {
            status: "outside-domain",
            nodeId: node.termId,
            reason: `Scaled value for '${node.termId}' is non-finite`,
          };
        }
        return { status: "value", value: scaledVal };
      }

      case "constant": {
        if (node.name === "pi") return { status: "value", value: Math.PI };
        if (node.name === "e") return { status: "value", value: Math.E };
        return { status: "unsupported-node", nodeId: null, kind: `constant:${node.name}` };
      }

      case "number": {
        const val = Number(node.value);
        if (!Number.isFinite(val)) {
          return {
            status: "outside-domain",
            nodeId: null,
            reason: `Number '${node.value}' is not finite`,
          };
        }
        return { status: "value", value: val };
      }

      case "sum": {
        let total = 0;
        for (const arg of node.args) {
          const res = evalNode(arg);
          if (res.status !== "value") return res;
          total += res.value;
        }
        if (!Number.isFinite(total)) {
          return { status: "outside-domain", nodeId: opId, reason: "Sum result is non-finite" };
        }
        return { status: "value", value: total };
      }

      case "product": {
        let total = 1;
        for (const arg of node.args) {
          const res = evalNode(arg);
          if (res.status !== "value") return res;
          total *= res.value;
        }
        if (!Number.isFinite(total)) {
          return { status: "outside-domain", nodeId: opId, reason: "Product result is non-finite" };
        }
        return { status: "value", value: total };
      }

      case "quotient": {
        const numRes = evalNode(node.numerator);
        if (numRes.status !== "value") return numRes;
        const denRes = evalNode(node.denominator);
        if (denRes.status !== "value") return denRes;

        if (denRes.value === 0) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: "division by zero",
          };
        }
        const val = numRes.value / denRes.value;
        if (!Number.isFinite(val)) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: "Quotient result is non-finite",
          };
        }
        return { status: "value", value: val };
      }

      case "power": {
        const baseRes = evalNode(node.base);
        if (baseRes.status !== "value") return baseRes;

        let expVal: number;
        if (typeof node.exponent === "object" && "kind" in node.exponent) {
          const expRes = evalNode(node.exponent as Expression);
          if (expRes.status !== "value") return expRes;
          expVal = expRes.value;
        } else {
          expVal = node.exponent.num / node.exponent.den;
        }

        if (baseRes.value < 0 && !Number.isInteger(expVal)) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: `Negative base (${baseRes.value}) with fractional exponent (${expVal})`,
          };
        }
        if (baseRes.value === 0 && expVal < 0) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: "Zero base with negative exponent (division by zero)",
          };
        }
        const val = baseRes.value ** expVal;
        if (!Number.isFinite(val)) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: "Power result is non-finite",
          };
        }
        return { status: "value", value: val };
      }

      case "root": {
        const radRes = evalNode(node.radicand);
        if (radRes.status !== "value") return radRes;

        if (node.degree % 2 === 0 && radRes.value < 0) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: `Even degree (${node.degree}) root of negative radicand (${radRes.value})`,
          };
        }
        let val: number;
        if (radRes.value >= 0) {
          val = radRes.value ** (1 / node.degree);
        } else {
          val = -((-radRes.value) ** (1 / node.degree));
        }
        if (!Number.isFinite(val)) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: "Root result is non-finite",
          };
        }
        return { status: "value", value: val };
      }

      case "negate": {
        const res = evalNode(node.argument);
        if (res.status !== "value") return res;
        return { status: "value", value: -res.value };
      }

      case "group":
      case "average": {
        return evalNode(node.argument);
      }

      case "norm": {
        const res = evalNode(node.argument);
        if (res.status !== "value") return res;
        return { status: "value", value: Math.abs(res.value) };
      }

      case "function": {
        const argRes = evalNode(node.argument);
        if (argRes.status !== "value") return argRes;

        let val: number;
        switch (node.name) {
          case "ln": {
            if (argRes.value <= 0) {
              return {
                status: "outside-domain",
                nodeId: opId,
                reason: `ln of nonpositive argument (${argRes.value})`,
              };
            }
            val = Math.log(argRes.value);
            break;
          }
          case "exp":
            val = Math.exp(argRes.value);
            break;
          case "sin":
            val = Math.sin(argRes.value);
            break;
          case "cos":
            val = Math.cos(argRes.value);
            break;
          case "sinh":
            val = Math.sinh(argRes.value);
            break;
          case "cosh":
            val = Math.cosh(argRes.value);
            break;
          case "tanh":
            val = Math.tanh(argRes.value);
            break;
          case "sqrt": {
            if (argRes.value < 0) {
              return {
                status: "outside-domain",
                nodeId: opId,
                reason: `sqrt of negative argument (${argRes.value})`,
              };
            }
            val = Math.sqrt(argRes.value);
            break;
          }
        }

        if (!Number.isFinite(val)) {
          return {
            status: "outside-domain",
            nodeId: opId,
            reason: `Function '${node.name}' result is non-finite`,
          };
        }
        return { status: "value", value: val };
      }

      case "relation": {
        if (options.relationSide === "left") {
          return evalNode(node.left);
        }
        // Default evaluates right side
        return evalNode(node.right);
      }

      case "piecewise": {
        for (const c of node.cases) {
          const condRes = evaluateCondition(c.condition);
          if (condRes === true) {
            return evalNode(c.value);
          }
          if (typeof condRes !== "boolean") {
            return condRes; // Error from condition
          }
        }
        if (node.otherwise) {
          return evalNode(node.otherwise);
        }
        return {
          status: "outside-domain",
          nodeId: opId,
          reason: "piecewise condition selected no branch",
        };
      }

      default:
        return {
          status: "unsupported-node",
          nodeId: opId,
          kind: node.kind,
        };
    }
  }

  function evaluateCondition(cond: Expression): boolean | EvaluationResult {
    if (cond.kind === "relation") {
      const leftRes = evalNode(cond.left);
      if (leftRes.status !== "value") return leftRes;
      const rightRes = evalNode(cond.right);
      if (rightRes.status !== "value") return rightRes;

      const l = leftRes.value;
      const r = rightRes.value;
      switch (cond.operator) {
        case "=":
        case "equiv":
          return Math.abs(l - r) < 1e-12;
        case "approx":
          return Math.abs(l - r) < 1e-6;
        case "<":
          return l < r;
        case "<=":
          return l <= r;
        case ">":
          return l > r;
        case ">=":
          return l >= r;
        default:
          return false;
      }
    }
    const valRes = evalNode(cond);
    if (valRes.status !== "value") return valRes;
    return valRes.value !== 0;
  }

  return evalNode(tree);
}
