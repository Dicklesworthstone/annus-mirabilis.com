/**
 * Exact, conditional check of the six §6 Maxwell–Hertz residual identities.
 *
 * Each field value and each first derivative is an independent indeterminate.
 * The only reductions involving the boost are c/c = 1 (c > 0) and
 * gamma² (1 - (v/c)²) = 1. No numerical samples, field equations, divergence
 * constraints or physical identification of the fields are used in these
 * identities. The latter premises are needed when an identity is used to infer
 * a vacuum solution. Evaluate this owner on the server and serialize its report.
 */
import {
  add,
  divide,
  multiply,
  type Rational,
  rational,
} from "../../content/dimensions/rational.ts";
import type { Expression } from "../ast.ts";
import { exactPolynomial, type Polynomial, PolynomialRefusal } from "./exactPolynomial.ts";
import {
  type SRFieldComponent,
  srFieldCandidateComponents,
  srFieldComponentRows,
} from "./srFieldTransforms.ts";

type Axis = "t" | "x" | "y" | "z";
type FieldRow = Pick<
  (typeof srFieldComponentRows)[number],
  "component" | "source" | "changed" | "grouped" | "residualIdentity"
>;
type Divergence = "electric" | "magnetic" | null;

export interface SRFieldCovarianceRowCheck {
  readonly component: SRFieldComponent;
  readonly coordinateChange: boolean;
  readonly residualIdentity: boolean;
  readonly divergence: Divergence;
}

/** Plain data: the exact polynomial evaluator never belongs in the client island. */
export interface SRFieldCovarianceReport {
  readonly passed: boolean;
  readonly rows: readonly SRFieldCovarianceRowCheck[];
  readonly inverseTransform: boolean;
  readonly reason?: string;
  readonly refusalCode?: RefusalCode;
}

type RefusalCode = "sr-field-covariance-expression" | "sr-field-covariance-budget";
export class SRFieldCovarianceError extends Error {
  readonly refusalCode: RefusalCode;
  constructor(refusalCode: RefusalCode, message: string) {
    super(message);
    this.name = "SRFieldCovarianceError";
    this.refusalCode = refusalCode;
  }
}
function refuse(message: string): never {
  throw new SRFieldCovarianceError("sr-field-covariance-expression", message);
}

const order = ["X", "Y", "Z", "L", "M", "N"] as const;
const axes = ["x", "y", "z"] as const;
const fieldCoordinates = {
  X: ["electricFieldStationary", "x"],
  Y: ["electricFieldStationary", "y"],
  Z: ["electricFieldStationary", "z"],
  L: ["magneticFieldStationary", "x"],
  M: ["magneticFieldStationary", "y"],
  N: ["magneticFieldStationary", "z"],
} as const;
const C = "constant:c",
  INVERSE_C = "constant:1/c",
  G = "constant:gamma",
  U = "constant:v/c";
const ONE = "[]";
const zero: Polynomial = new Map();
const one: Polynomial = new Map([[ONE, rational(1n)]]);
const atom = (name: string): Polynomial => new Map([[JSON.stringify([name]), rational(1n)]]);
const c = atom(C),
  inverseC = atom(INVERSE_C),
  gamma = atom(G),
  ratio = atom(U);
function fieldAtom(component: SRFieldComponent, derivative?: Axis): Polynomial {
  return atom(JSON.stringify([...fieldCoordinates[component], derivative ?? "value"]));
}

/** A bounded polynomial ring modulo one Lorentz identity, with c invertible. */
function algebra() {
  let work = 0;
  function budget(condition: boolean): void {
    if (!condition || ++work > 100_000)
      throw new SRFieldCovarianceError(
        "sr-field-covariance-budget",
        "The exact field check exceeds its arithmetic or expression budget.",
      );
  }
  function put(
    result: Map<string, Rational>,
    factors: readonly string[],
    coefficient: Rational,
  ): void {
    budget(
      factors.length <= 32 &&
        coefficient.num.toString(2).length <= 1024 &&
        coefficient.den.toString(2).length <= 1024,
    );
    if (coefficient.num === 0n) return;
    let cCount = 0,
      gCount = 0,
      uCount = 0;
    const remaining: string[] = [];
    for (const factor of factors) {
      if (factor === C) cCount++;
      else if (factor === INVERSE_C) cCount--;
      else if (factor === G) gCount++;
      else if (factor === U) uCount++;
      else remaining.push(factor);
    }
    remaining.push(...Array<string>(Math.abs(cCount)).fill(cCount >= 0 ? C : INVERSE_C));
    // Leading monomial g²u² -> g² - 1; each reduction lowers the u degree.
    if (gCount >= 2 && uCount >= 2) {
      put(
        result,
        [...remaining, ...Array<string>(gCount).fill(G), ...Array<string>(uCount - 2).fill(U)],
        coefficient,
      );
      put(
        result,
        [...remaining, ...Array<string>(gCount - 2).fill(G), ...Array<string>(uCount - 2).fill(U)],
        rational(-coefficient.num, coefficient.den),
      );
      return;
    }
    const key = JSON.stringify(
      [...remaining, ...Array<string>(gCount).fill(G), ...Array<string>(uCount).fill(U)].sort(),
    );
    const next = add(result.get(key) ?? rational(0n), coefficient);
    if (next.num === 0n) result.delete(key);
    else result.set(key, next);
    budget(result.size <= 256);
  }
  function sum(...terms: readonly Polynomial[]): Polynomial {
    const result = new Map<string, Rational>();
    for (const term of terms)
      for (const [key, coefficient] of term) put(result, JSON.parse(key) as string[], coefficient);
    return result;
  }
  function product(...terms: readonly Polynomial[]): Polynomial {
    return terms.reduce((left, right) => {
      const result = new Map<string, Rational>();
      for (const [a, av] of left)
        for (const [b, bv] of right)
          put(
            result,
            [...(JSON.parse(a) as string[]), ...(JSON.parse(b) as string[])],
            multiply(av, bv),
          );
      return result;
    }, one);
  }
  const negative = (value: Polynomial) => product(new Map([[ONE, rational(-1n)]]), value);
  const equal = (left: Polynomial, right: Polynomial) => sum(left, negative(right)).size === 0;
  function inverse(denominator: Polynomial): Polynomial {
    const entry = [...denominator][0];
    if (denominator.size !== 1 || !entry)
      refuse("Only nonzero numeric constants and powers of c may divide a field expression.");
    const [key, coefficient] = entry;
    const factors = JSON.parse(key) as string[];
    if (factors.some((factor) => factor !== C && factor !== INVERSE_C))
      refuse("A field, frame speed or Lorentz factor cannot be cancelled as a denominator.");
    const result = new Map<string, Rational>();
    put(
      result,
      factors.map((factor) => (factor === C ? INVERSE_C : C)),
      divide(rational(1n), coefficient),
    );
    return result;
  }
  function coordinate(variable: Expression): { readonly axis: Axis; readonly moving: boolean } {
    if (variable.kind !== "symbol" || variable.at || variable.args || variable.scale)
      refuse("A partial derivative must name an unscaled coordinate of one frame.");
    const { quantityId, index } = variable;
    if (
      (quantityId === "coordinateTimeStationary" || quantityId === "coordinateTimeMoving") &&
      index === undefined
    )
      return { axis: "t", moving: quantityId === "coordinateTimeMoving" };
    if (
      (quantityId === "coordinatePositionStationary" ||
        quantityId === "coordinatePositionMoving") &&
      axes.some((axis) => axis === index)
    )
      return { axis: index as Axis, moving: quantityId === "coordinatePositionMoving" };
    return refuse("The coordinate quantity and component must retain their frame identity.");
  }
  function expand(expression: Expression, derivative?: Axis, depth = 0): Polynomial {
    budget(depth <= 24);
    switch (expression.kind) {
      case "number": {
        const value = exactPolynomial(expression);
        return derivative ? zero : value;
      }
      case "symbol": {
        if (expression.at || expression.args)
          refuse("Fields are local first derivatives; arguments require another checker.");
        let value: Polynomial;
        const component = order.find(
          (name) =>
            fieldCoordinates[name][0] === expression.quantityId &&
            fieldCoordinates[name][1] === expression.index,
        );
        if (component) value = fieldAtom(component, derivative);
        else if (
          expression.index === undefined &&
          ["speedOfLight", "frameSpeed", "lorentzFactor"].includes(expression.quantityId)
        )
          value = derivative
            ? zero
            : expression.quantityId === "speedOfLight"
              ? c
              : expression.quantityId === "frameSpeed"
                ? product(ratio, c)
                : gamma;
        else
          return refuse(
            "Only the six stationary field components and the constant boost parameters belong to this proof.",
          );
        const scale = expression.scale;
        if (!scale) return value;
        if (!Number.isSafeInteger(scale.num) || !Number.isSafeInteger(scale.den) || scale.den <= 0)
          refuse("A symbol scale must be an exact rational with a positive denominator.");
        return product(value, new Map([[ONE, rational(BigInt(scale.num), BigInt(scale.den))]]));
      }
      case "group":
        return expand(expression.argument, derivative, depth + 1);
      case "negate":
        return negative(expand(expression.argument, derivative, depth + 1));
      case "sum":
        budget(expression.args.length > 0 && expression.args.length <= 32);
        return sum(...expression.args.map((term) => expand(term, derivative, depth + 1)));
      case "product": {
        budget(expression.args.length > 0 && expression.args.length <= 32);
        const values = expression.args.map((term) => expand(term, undefined, depth + 1));
        if (!derivative) return product(...values);
        return sum(
          ...expression.args.map((term, index) =>
            product(
              ...values.map((value, at) =>
                at === index ? expand(term, derivative, depth + 1) : value,
              ),
            ),
          ),
        );
      }
      case "quotient": {
        const denominator = expand(expression.denominator, undefined, depth + 1);
        const reciprocal = inverse(denominator);
        if (derivative && expand(expression.denominator, derivative, depth + 1).size !== 0)
          refuse("Only coordinate-independent denominators are admitted.");
        return product(expand(expression.numerator, derivative, depth + 1), reciprocal);
      }
      case "power": {
        if (
          expression.exponent.den !== 1 ||
          !Number.isSafeInteger(expression.exponent.num) ||
          expression.exponent.num < 0 ||
          expression.exponent.num > 4
        )
          refuse("Only integer powers from zero to four belong to this field proof.");
        const value = expand(expression.base, undefined, depth + 1);
        const factors = Array<Polynomial>(expression.exponent.num).fill(value);
        if (!derivative) return product(...factors);
        const differentiated = expand(expression.base, derivative, depth + 1);
        return sum(
          ...factors.map((_, index) =>
            product(...factors.map((factor, at) => (at === index ? differentiated : factor))),
          ),
        );
      }
      case "derivative": {
        if (derivative || expression.order !== 1 || !expression.partial || expression.heldFixed)
          refuse("Only first partial derivatives at fixed other coordinates belong to this check.");
        const variable = coordinate(expression.variable);
        const partial = (axis: Axis) => expand(expression.expression, axis, depth + 1);
        if (!variable.moving || variable.axis === "y" || variable.axis === "z")
          return partial(variable.axis);
        return variable.axis === "t"
          ? product(gamma, sum(partial("t"), product(ratio, c, partial("x"))))
          : product(gamma, sum(partial("x"), product(ratio, inverseC, partial("t"))));
      }
      default:
        return refuse(`The ${expression.kind} node requires a different mathematical checker.`);
    }
  }
  function residual(expression: Expression): Polynomial {
    if (expression.kind !== "relation" || expression.operator !== "=")
      refuse("A Maxwell row must be an equality.");
    return sum(expand(expression.left), negative(expand(expression.right)));
  }
  function original(component: SRFieldComponent): Polynomial {
    // Independently state the curl orientation, including the opposite magnetic sign.
    const curls: Record<
      SRFieldComponent,
      readonly [SRFieldComponent, Axis, SRFieldComponent, Axis]
    > = {
      X: ["N", "y", "M", "z"],
      Y: ["L", "z", "N", "x"],
      Z: ["M", "x", "L", "y"],
      L: ["Y", "z", "Z", "y"],
      M: ["Z", "x", "X", "z"],
      N: ["X", "y", "Y", "x"],
    };
    const [positive, alongPositive, negated, alongNegative] = curls[component];
    return sum(
      product(inverseC, fieldAtom(component, "t")),
      negative(fieldAtom(positive, alongPositive)),
      fieldAtom(negated, alongNegative),
    );
  }
  function regrouped(component: SRFieldComponent): Polynomial {
    const source = original(component);
    if (component !== "X" && component !== "L") return source;
    const fields = component === "X" ? (["X", "Y", "Z"] as const) : (["L", "M", "N"] as const);
    const divergence = sum(
      fieldAtom(fields[0], "x"),
      fieldAtom(fields[1], "y"),
      fieldAtom(fields[2], "z"),
    );
    return product(gamma, sum(source, product(ratio, divergence)));
  }
  function inverseTransform(): boolean {
    const replacements = new Map(
      order.map((component) => [
        JSON.stringify([...fieldCoordinates[component], "value"]),
        expand(srFieldCandidateComponents[component]),
      ]),
    );
    return order.every((component) => {
      const forward = expand(srFieldCandidateComponents[component]);
      const reverse = sum(
        ...[...forward].map(([key, coefficient]) =>
          product(
            new Map([[ONE, coefficient]]),
            ...(JSON.parse(key) as string[]).map((factor) =>
              factor === U ? negative(ratio) : (replacements.get(factor) ?? atom(factor)),
            ),
          ),
        ),
      );
      return equal(reverse, fieldAtom(component));
    });
  }
  return { expand, residual, equal, original, regrouped, inverseTransform };
}

/** Check the actual displayed expressions, including both sides of each residual identity. */
export function verifySRFieldCovariance(
  rows: readonly FieldRow[] = srFieldComponentRows,
): SRFieldCovarianceReport {
  const results: SRFieldCovarianceRowCheck[] = [];
  try {
    if (rows.length !== order.length || rows.some((row, index) => row.component !== order[index]))
      refuse("Every electric and magnetic component is required exactly once in source order.");
    const ring = algebra();
    for (const row of rows) {
      const source = ring.original(row.component),
        grouped = ring.regrouped(row.component);
      const identity = row.residualIdentity;
      results.push({
        component: row.component,
        coordinateChange:
          ring.equal(ring.residual(row.source), source) &&
          ring.equal(ring.residual(row.changed), source),
        residualIdentity:
          identity.kind === "relation" &&
          identity.operator === "=" &&
          ring.equal(ring.residual(row.grouped), grouped) &&
          ring.equal(ring.expand(identity.left), grouped) &&
          ring.equal(ring.expand(identity.right), grouped),
        divergence: row.component === "X" ? "electric" : row.component === "L" ? "magnetic" : null,
      });
    }
    const inverseTransform = ring.inverseTransform();
    return {
      passed:
        inverseTransform && results.every((row) => row.coordinateChange && row.residualIdentity),
      rows: results,
      inverseTransform,
    };
  } catch (error) {
    if (!(error instanceof SRFieldCovarianceError) && !(error instanceof PolynomialRefusal))
      throw error;
    return {
      passed: false,
      rows: results,
      inverseTransform: false,
      reason: error.message,
      ...(error instanceof SRFieldCovarianceError ? { refusalCode: error.refusalCode } : {}),
    };
  }
}
