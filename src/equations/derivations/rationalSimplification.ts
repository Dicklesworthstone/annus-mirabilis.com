/**
 * Exact simplification of rational arithmetic on the input expression's domain.
 * The bounded polynomial ring owns expansion and rational coefficients. Functions, derivatives
 * and integrals remain opaque values; no calculus or physical premise is inferred here.
 */
import { divide } from "../../content/dimensions/rational.ts";
import { type Expression, record } from "../ast.ts";
import { equalPolynomials, exactPolynomial, type Polynomial } from "./exactPolynomial.ts";

type Fraction = Readonly<{ numerator: Expression; denominator: Expression }>;
export type RationalSimplification = Readonly<{
  outcome: "equal" | "different" | "undefined" | "domain-change" | "unsupported";
  reason?: string;
}>;

const ONE: Expression = { kind: "number", value: "1" };
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const isOne = (value: Expression): boolean => value.kind === "number" && value.value === "1";
const times = (left: Expression, right: Expression): Expression =>
  isOne(left) ? right : isOne(right) ? left : product(left, right);

/** A nonzero rational multiple imposes the same nonzero condition. */
function conditionKey(polynomial: Polynomial): string {
  const entries = [...polynomial].sort(([a], [b]) => a.localeCompare(b));
  const scale = entries[0]?.[1];
  if (!scale) return "zero";
  return JSON.stringify(
    entries.map(([key, coefficient]) => {
      const normalized = divide(coefficient, scale);
      return [key, normalized.num.toString(), normalized.den.toString()];
    }),
  );
}

/**
 * x -> x²/x changes the domain at zero and is refused. Conversely, x/x -> 1 retains
 * the input's x ≠ 0 condition; simplification never extends the input's domain.
 */
export function checkRationalSimplification(
  expected: Expression,
  actual: Expression,
): RationalSimplification {
  const atoms = new Map<string, Expression>();
  const opaqueInputs = new Set<string>();
  let input = true;
  let nodes = 0;
  let issue: RationalSimplification | undefined;

  // Occurrence identities matter: the same quantity can have different values at different
  // positions or times. Neither quantityId alone nor a display glyph may merge these values.
  function key(value: unknown, depth = 0): string {
    if (++nodes > 2048 || depth > 24) {
      issue = {
        outcome: "unsupported",
        reason: "Rational expression exceeds its structural budget.",
      };
      return "";
    }
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
    if (Array.isArray(value))
      return "[" + value.map((entry) => key(entry, depth + 1)).join(",") + "]";
    const descriptors = Object.getOwnPropertyDescriptors(value);
    record(value, "rational.atom", [], Object.keys(descriptors));
    return (
      "{" +
      Object.keys(descriptors)
        .filter((field) => field !== "opId")
        .sort()
        .map((field) => JSON.stringify(field) + ":" + key(descriptors[field]?.value, depth + 1))
        .join(",") +
      "}"
    );
  }
  function atom(node: Expression, opaque = false): Expression {
    const identity = key(node);
    if (opaque) {
      if (input) opaqueInputs.add(identity);
      else if (!opaqueInputs.has(identity))
        issue = {
          outcome: "unsupported",
          reason: "Simplification introduced or changed an operation whose domain is not checked.",
        };
    }
    let value = atoms.get(identity);
    if (!value) {
      const id = "atom" + atoms.size;
      value = { kind: "symbol", termId: id, quantityId: id };
      atoms.set(identity, value);
    }
    return value;
  }
  function fraction(node: Expression, guards: Expression[], depth = 0): Fraction {
    if (++nodes > 2048 || depth > 24) {
      issue = {
        outcome: "unsupported",
        reason: "Rational expression exceeds its structural budget.",
      };
      return { numerator: ONE, denominator: ONE };
    }
    switch (node.kind) {
      case "number":
        return { numerator: node, denominator: ONE };
      case "symbol": {
        const { scale, ...unscaled } = node;
        const value = atom(unscaled, node.at !== undefined || node.args !== undefined);
        if (scale === undefined) return { numerator: value, denominator: ONE };
        record(scale, "rational.scale", ["num", "den"]);
        if (
          !Number.isSafeInteger(scale.num) ||
          !Number.isSafeInteger(scale.den) ||
          scale.den <= 0
        ) {
          issue = {
            outcome: "unsupported",
            reason: "A symbol scale must be an exact finite rational.",
          };
          return { numerator: ONE, denominator: ONE };
        }
        return {
          numerator: product({ kind: "number", value: String(scale.num) }, value),
          denominator: { kind: "number", value: String(scale.den) },
        };
      }
      case "constant":
        if (node.name !== "pi") {
          issue = {
            outcome: "undefined",
            reason: "Infinity is not a finite arithmetic value.",
          };
          return { numerator: ONE, denominator: ONE };
        }
        return { numerator: atom(node), denominator: ONE };
      case "group":
        return fraction(node.argument, guards, depth + 1);
      case "negate": {
        const value = fraction(node.argument, guards, depth + 1);
        return { ...value, numerator: { kind: "negate", argument: value.numerator } };
      }
      case "sum":
      case "product": {
        if (node.args.length === 0 || node.args.length > 32) {
          issue = {
            outcome: "unsupported",
            reason: "Expected a bounded, nonempty arithmetic expression.",
          };
          return { numerator: ONE, denominator: ONE };
        }
        const values = node.args.map((value) => fraction(value, guards, depth + 1));
        const first = values[0];
        if (!first) return { numerator: ONE, denominator: ONE };
        return values.slice(1).reduce(
          (left, right) => ({
            numerator:
              node.kind === "product"
                ? times(left.numerator, right.numerator)
                : sum(
                    times(left.numerator, right.denominator),
                    times(right.numerator, left.denominator),
                  ),
            denominator: times(left.denominator, right.denominator),
          }),
          first,
        );
      }
      case "quotient": {
        const numerator = fraction(node.numerator, guards, depth + 1);
        const denominator = fraction(node.denominator, guards, depth + 1);
        // Inner fractions keep their own guards, even when their factors later cancel.
        guards.push(denominator.numerator);
        return {
          numerator: times(numerator.numerator, denominator.denominator),
          denominator: times(numerator.denominator, denominator.numerator),
        };
      }
      case "power": {
        if (
          node.exponent.den !== 1 ||
          !Number.isSafeInteger(node.exponent.num) ||
          node.exponent.num < 0 ||
          node.exponent.num > 16
        )
          return { numerator: atom(node, true), denominator: ONE };
        const base = fraction(node.base, guards, depth + 1);
        return {
          numerator: { kind: "power", base: base.numerator, exponent: node.exponent },
          denominator: { kind: "power", base: base.denominator, exponent: node.exponent },
        };
      }
      case "function":
      case "derivative":
      case "integral":
      case "average":
      case "root":
      case "symbolPower":
      case "limit":
      case "indexedSum":
        return { numerator: atom(node, true), denominator: ONE };
      case "relation":
      case "partialOperator":
        issue = {
          outcome: "unsupported",
          reason: "An equation or differential operator is not a scalar arithmetic value.",
        };
        return { numerator: ONE, denominator: ONE };
    }
  }

  // General factorization is intentionally outside the vocabulary. A product and a positive
  // integer power are nonzero exactly when their factors are nonzero.
  function factors(node: Expression): readonly Expression[] {
    if (node.kind === "product") return node.args.flatMap(factors);
    if (node.kind === "negate" || node.kind === "group") return factors(node.argument);
    if (node.kind === "power" && node.exponent.num > 0) return factors(node.base);
    return [node];
  }

  try {
    const expectedGuards: Expression[] = [];
    const before = fraction(expected, expectedGuards);
    if (issue) return issue;
    input = false;
    const actualGuards: Expression[] = [];
    const after = fraction(actual, actualGuards);
    if (issue) return issue;
    const known = new Set<string>();
    // π is nonzero independently of any authored condition.
    known.add(conditionKey(exactPolynomial(atom({ kind: "constant", name: "pi" }))));
    for (const guard of expectedGuards) {
      if (exactPolynomial(guard).size === 0)
        return {
          outcome: "undefined",
          reason: "The expected operation divides by an identically zero expression.",
        };
      for (const factor of factors(guard)) known.add(conditionKey(exactPolynomial(factor)));
    }
    for (const guard of actualGuards) {
      const polynomial = exactPolynomial(guard);
      if (polynomial.size === 0)
        return {
          outcome: "undefined",
          reason: "The proposed result divides by an identically zero expression.",
        };
      for (const factor of factors(guard)) {
        const condition = exactPolynomial(factor);
        const constant = condition.size === 1 && condition.has("[]");
        if (!constant && !known.has(conditionKey(condition)))
          return {
            outcome: "domain-change",
            reason: "The proposed simplification requires a new nonzero denominator condition.",
          };
      }
    }
    const equal = equalPolynomials(
      exactPolynomial(times(before.numerator, after.denominator)),
      exactPolynomial(times(after.numerator, before.denominator)),
    );
    if (!equal && opaqueInputs.size > 0)
      return {
        outcome: "unsupported",
        reason:
          "Opaque operations do not establish the proposed identity by rational algebra alone.",
      };
    return { outcome: equal ? "equal" : "different" };
  } catch (error) {
    return {
      outcome: "unsupported",
      reason:
        error instanceof Error ? error.message : "Expression is outside exact rational algebra.",
    };
  }
}
