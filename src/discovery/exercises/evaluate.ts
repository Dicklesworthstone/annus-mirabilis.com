/**
 * Pure evaluation over the exercise checker's syntax tree
 * (am-disc-exercise-checker-i4h2). No `eval`, no `Function` constructor,
 * no `with`, no property access on the environment: `env` is a plain
 * object used only as a `name -> number` lookup keyed by the same
 * declared-name set the parser already validated, so an identifier the
 * parser accepted always resolves here -- there is nothing left for a
 * prototype-pollution attempt to reach.
 */

import type { Expr, FunctionName } from "./grammar";

export type EvalResult =
  | Readonly<{ status: "value"; value: number }>
  | Readonly<{ status: "nonfinite"; reason: string }>
  | Readonly<{ status: "undefined-identifier"; name: string }>;

const CONSTANTS: Readonly<Record<string, number>> = Object.freeze({ pi: Math.PI });

const FUNCTIONS: Readonly<Record<FunctionName, (x: number) => number>> = Object.freeze({
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  abs: Math.abs,
});

function ok(value: number): EvalResult {
  return Number.isFinite(value)
    ? { status: "value", value }
    : { status: "nonfinite", reason: `Result is not a finite number (got ${value}).` };
}

/**
 * `env` supplies the declared variables; declared constants (currently
 * only `pi`) resolve without appearing in `env`. Every identifier reaching
 * this function was already checked against the exercise's declared-name
 * set by `parse()`, so `undefined-identifier` here would indicate a
 * grammar/evaluator name-set mismatch, not a reader input.
 */
export function evaluate(expr: Expr, env: Readonly<Record<string, number>>): EvalResult {
  switch (expr.kind) {
    case "number":
      return ok(expr.value);
    case "identifier": {
      if (Object.hasOwn(env, expr.name)) return ok(env[expr.name] as number);
      if (Object.hasOwn(CONSTANTS, expr.name)) return ok(CONSTANTS[expr.name] as number);
      return { status: "undefined-identifier", name: expr.name };
    }
    case "unary": {
      const operand = evaluate(expr.operand, env);
      if (operand.status !== "value") return operand;
      return ok(-operand.value);
    }
    case "call": {
      const arg = evaluate(expr.arg, env);
      if (arg.status !== "value") return arg;
      return ok(FUNCTIONS[expr.name](arg.value));
    }
    case "binary": {
      const left = evaluate(expr.left, env);
      if (left.status !== "value") return left;
      const right = evaluate(expr.right, env);
      if (right.status !== "value") return right;
      switch (expr.op) {
        case "+":
          return ok(left.value + right.value);
        case "-":
          return ok(left.value - right.value);
        case "*":
          return ok(left.value * right.value);
        case "/":
          return ok(left.value / right.value);
        case "^":
          return ok(left.value ** right.value);
      }
    }
  }
}
