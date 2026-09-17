/**
 * Accessible spoken text and ClearSpeak-style descriptions for derivation steps (am-eq-derivation-renderer-9gd7).
 *
 * Implements single-source accessible names for mathematical steps,
 * authored spoken forms, and plain-sentence fallbacks without flooding live regions.
 */

import type { Expression } from "../ast.ts";
import type { DerivationStep, RuleKind } from "./types.ts";

/**
 * Returns a human-friendly spoken label for a transformation rule.
 */
export function ruleInWords(kind: RuleKind): string {
  switch (kind) {
    case "substitute":
      return "Substitution";
    case "cancel-common-factor":
      return "Cancel common factor";
    case "monotonic-function":
      return "Apply monotonic function";
    case "integrate":
      return "Integrate";
    case "truncate-series":
      return "Truncate series";
    case "registered-identity":
      return "Registered identity";
    case "expand":
      return "Expand algebraic terms";
    case "collect":
      return "Collect like terms";
    case "factor":
      return "Factor common terms";
    case "reorder":
      return "Reorder terms";
    case "add-subtract-multiply-divide":
      return "Algebraic balance operation";
    case "differentiate":
      return "Differentiate";
    case "take-limit":
      return "Take limit";
    case "evaluate-numerical-instance":
      return "Evaluate numerical instance";
    default:
      return "Mathematical transformation";
  }
}

/**
 * Converts a symbolic Expression tree to a clear spoken English sentence.
 */
export function expressionToSpokenText(expr: Expression): string {
  switch (expr.kind) {
    case "number": {
      const [m, e] = expr.value.split("e");
      if (e !== undefined) {
        return `${m} times 10 to the power ${e}`;
      }
      return expr.value;
    }

    case "constant":
      return "pi";

    case "symbol": {
      let name = expr.termId || expr.quantityId;
      // Convert common subscript notations like x_sum -> sum of x, Delta_i -> Delta i
      if (name === "x_sum") return "sum of x";
      if (name === "x2") return "x squared";
      if (name === "Delta_i") return "Delta i";
      if (name === "lambda_x") return "lambda x";
      if (name === "k_B") return "k sub B";
      if (name.includes("_")) {
        const [base, sub] = name.split("_");
        return `${base} sub ${sub}`;
      }
      if (expr.scale && (expr.scale.num !== 1 || expr.scale.den !== 1)) {
        return `${expr.scale.num} over ${expr.scale.den} times ${name}`;
      }
      return name;
    }

    case "sum":
      return expr.args.map(expressionToSpokenText).join(" plus ");

    case "product":
      return expr.args.map(expressionToSpokenText).join(" times ");

    case "quotient":
      return `${expressionToSpokenText(expr.numerator)} over ${expressionToSpokenText(expr.denominator)}`;

    case "power":
      if (expr.exponent.den === 1) {
        if (expr.exponent.num === 2) return `${expressionToSpokenText(expr.base)} squared`;
        if (expr.exponent.num === 3) return `${expressionToSpokenText(expr.base)} cubed`;
        return `${expressionToSpokenText(expr.base)} to the power ${expr.exponent.num}`;
      }
      return `${expressionToSpokenText(expr.base)} to the power ${expr.exponent.num} over ${expr.exponent.den}`;

    case "root":
      if (expr.degree === 2) {
        return `square root of ${expressionToSpokenText(expr.radicand)}`;
      }
      return `${expr.degree}th root of ${expressionToSpokenText(expr.radicand)}`;

    case "negate":
      return `negative of ${expressionToSpokenText(expr.argument)}`;

    case "group":
      return `quantity ${expressionToSpokenText(expr.argument)}`;

    case "average":
      return `mean of ${expressionToSpokenText(expr.argument)}`;

    case "function":
      return `${expr.name} of ${expressionToSpokenText(expr.argument)}`;

    case "relation": {
      const opWord =
        expr.operator === "approx"
          ? "is approximately equal to"
          : expr.operator === "define"
            ? "is defined as"
            : "equals";
      return `${expressionToSpokenText(expr.left)} ${opWord} ${expressionToSpokenText(expr.right)}`;
    }

    case "derivative": {
      const kind = expr.partial ? "partial derivative" : "derivative";
      const order = expr.order > 1 ? `${expr.order}th ` : "";
      return `${order}${kind} of ${expressionToSpokenText(expr.expression)} with respect to ${expressionToSpokenText(expr.variable)}`;
    }

    case "integral":
      return `integral of ${expressionToSpokenText(expr.expression)} with respect to ${expressionToSpokenText(expr.variable)}`;

    default:
      return "expression";
  }
}

/**
 * Builds a comprehensive accessible text representation for a derivation step.
 */
export function stepAccessibleText(step: DerivationStep, index: number): string {
  const parts: string[] = [];

  parts.push(`Step ${index + 1}.`);

  if (step.isMove && step.moveLabel) {
    parts.push(`The move: ${step.moveLabel}.`);
  }

  parts.push(`Rule: ${ruleInWords(step.rule.kind)}.`);

  const fromText = expressionToSpokenText(step.from);
  const toText = expressionToSpokenText(step.to);
  parts.push(`From: ${fromText}. To: ${toText}.`);

  if (step.approximation) {
    parts.push(
      `Approximation: to order ${step.approximation.order} in ${step.approximation.variable}, valid when ${step.approximation.domain}.`,
    );
  }

  if (step.tool) {
    parts.push(`Foundation tool: ${step.tool.replace("foundation:", "")}.`);
  }

  if (step.reasons.r0) {
    parts.push(`Overview: ${step.reasons.r0}`);
  }

  return parts.join(" ");
}
