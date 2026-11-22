/**
 * Exact algebra for the normalized one-dimensional Gaussian, evaluated at build time.
 *
 * The shared bounded polynomial ring differentiates the polynomial exponent and amplitudes.
 * The product/chain rules then give derivatives of P(u) exp(q(u)); no numerical sampling
 * or second diffusion evaluator is used. The standard Gaussian area and vanishing-tail
 * theorems are admitted mathematical premises, not conclusions of this arithmetic check.
 */
import { ContentError } from "../../content/compiler/json.ts";
import { divide, rational } from "../../content/dimensions/rational.ts";
import { type Expression, record } from "../ast.ts";
import {
  type BrownianGaussianCheckId,
  type BrownianGaussianInput,
  brownianGaussianCheckRows,
  brownianGaussianInput,
  gaussianEquality,
  gaussianFullLineIntegral,
  gaussianNegative,
  gaussianNumber,
  gaussianProduct,
  gaussianQuotient,
  gaussianRoot,
  gaussianRootPi,
  gaussianSquare,
  gaussianSum,
  gaussianSymbols,
} from "./brownianGaussian.ts";
import {
  equalPolynomials,
  exactPolynomial,
  type Polynomial,
  PolynomialRefusal,
} from "./exactPolynomial.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { structurallyEqual } from "./treeUtils.ts";

type RefusalCode = "brownian-gaussian-expression" | "brownian-gaussian-budget";
export class BrownianGaussianError extends Error {
  readonly refusalCode: RefusalCode;
  constructor(refusalCode: RefusalCode, message: string) {
    super(message);
    this.name = "BrownianGaussianError";
    this.refusalCode = refusalCode;
  }
}
function refuse(message: string): never {
  throw new BrownianGaussianError("brownian-gaussian-expression", message);
}

/** Plain output: the exact polynomial arithmetic never enters the reader's client island. */
export interface BrownianGaussianReport {
  readonly passed: boolean;
  readonly rows: readonly Readonly<{ id: BrownianGaussianCheckId; passed: boolean }>[];
  readonly reason?: string;
  readonly refusalCode?: RefusalCode;
}

const FIELDS = [
  "widthSquared",
  "normalization",
  "exponent",
  "firstWeight",
  "secondWeight",
  "partsWeight",
  "unitSecondMoment",
  "moment",
  "growth",
  "rms",
] as const;
const { x, u, D, t } = gaussianSymbols;
const one = gaussianNumber("1");
const two = gaussianNumber("2");
const zero = gaussianNumber("0");
const expectedMeanSquare: Expression = { kind: "average", argument: gaussianSquare(x) };
const U = u.quantityId;
const U_SQUARED = JSON.stringify([U, U]);

/**
 * Occurrence ids may differ across records. Quantity, component, scale and arguments may not.
 * Check the input's size before projection so a malformed authored tree cannot exhaust a build.
 */
function canonical(expression: Expression): Expression {
  let nodes = 0;
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 2048 || depth > 32)
      throw new BrownianGaussianError(
        "brownian-gaussian-budget",
        "The Gaussian proof exceeds its expression budget.",
      );
    if (Array.isArray(value)) return value.map((child) => visit(child, depth + 1));
    if (value === null || typeof value !== "object") return value;
    const plain = record(value, "brownian-gaussian.expression", [], Object.keys(value));
    const projected = Object.fromEntries(
      Object.entries(plain).map(([key, child]) => [key, visit(child, depth + 1)]),
    );
    if (plain.kind === "symbol") projected.termId = plain.quantityId;
    return projected;
  }
  return visit(expression, 0) as Expression;
}

function equal(left: Expression, right: Expression): boolean {
  return checkRationalSimplification(left, right).outcome === "equal";
}
function polynomial(expression: Expression): Polynomial {
  const result = exactPolynomial(expression);
  for (const key of result.keys())
    if ((JSON.parse(key) as string[]).some((quantity) => quantity !== U))
      refuse("A Gaussian profile polynomial may depend only on the scaled displacement.");
  return result;
}
function samePolynomial(left: Expression, right: Expression): boolean {
  return equalPolynomials(polynomial(left), polynomial(right));
}

/** Differentiate the shared ring's exact monomials, retaining rational coefficients. */
function differentiate(expression: Expression): Expression {
  const terms: Expression[] = [];
  for (const [key, coefficient] of polynomial(expression)) {
    const factors = JSON.parse(key) as string[];
    if (factors.length === 0) continue;
    terms.push(
      gaussianQuotient(
        gaussianProduct(
          gaussianNumber(String(coefficient.num * BigInt(factors.length))),
          ...factors.slice(1).map(() => u),
        ),
        gaussianNumber(String(coefficient.den)),
      ),
    );
  }
  return terms.length === 0 ? zero : gaussianSum(...terms);
}

/** The width has the form a D t with a positive exact number; the PDE will determine a. */
function admitWidth(expression: Expression): void {
  const width = exactPolynomial(expression);
  const identity = JSON.stringify([D.quantityId, t.quantityId].sort());
  const coefficient = width.get(identity);
  if (width.size !== 1 || !coefficient || coefficient.num <= 0n)
    refuse(
      "The Gaussian width squared must be a positive constant times D t, with D > 0 and t > 0.",
    );
}

/**
 * A full-line density cannot borrow a removable singularity from u/u or z/z.
 * Rational simplification retains input guards, so admit the normalizer's domain first.
 * Its small scalar vocabulary permits no cancellation of a sum into an unknown zero:
 * every denominator is a product/quotient of finite numbers, π and its positive root.
 */
function scalarNormalizerNonzero(expression: Expression): boolean {
  if (!expression || typeof expression !== "object")
    refuse("The Gaussian normalizer must be a finite scalar expression.");
  switch (expression.kind) {
    case "number":
      return exactPolynomial(expression).size !== 0;
    case "constant":
      record(expression, "brownian-gaussian.normalizer", ["kind", "name"]);
      if (expression.name === "pi") return true;
      return refuse("Infinity cannot occur in the Gaussian normalizer.");
    case "root": {
      record(expression, "brownian-gaussian.normalizer", ["kind", "degree", "radicand"], ["opId"]);
      const radicand = record(expression.radicand, "brownian-gaussian.normalizer.root", [
        "kind",
        "name",
      ]);
      if (expression.degree === 2 && radicand.kind === "constant" && radicand.name === "pi")
        return true;
      return refuse("The Gaussian normalizer admits only the positive square root of π.");
    }
    case "negate":
    case "group":
      record(expression, "brownian-gaussian.normalizer", ["kind", "argument"], ["opId"]);
      return scalarNormalizerNonzero(expression.argument);
    case "product": {
      record(expression, "brownian-gaussian.normalizer", ["kind", "args"], ["opId"]);
      if (
        !Array.isArray(expression.args) ||
        expression.args.length === 0 ||
        expression.args.length > 32
      )
        refuse("The Gaussian normalizer requires a bounded nonempty scalar product.");
      // Visit every factor so zero cannot conceal an inadmissible expression.
      return expression.args.map(scalarNormalizerNonzero).every(Boolean);
    }
    case "quotient": {
      record(
        expression,
        "brownian-gaussian.normalizer",
        ["kind", "numerator", "denominator"],
        ["opId"],
      );
      const numerator = scalarNormalizerNonzero(expression.numerator);
      const denominator = scalarNormalizerNonzero(expression.denominator);
      if (!denominator) refuse("The Gaussian normalizer cannot divide by zero.");
      return numerator;
    }
    default:
      return refuse(
        "The Gaussian normalizer admits only finite scalar factors, with no variable or sum cancellation.",
      );
  }
}

function relation(expression: Expression): expression is Extract<Expression, { kind: "relation" }> {
  return expression.kind === "relation" && expression.operator === "=";
}

function momentRecordsAgree(
  input: BrownianGaussianInput,
  momentValue: Expression,
  integral: Expression,
): boolean {
  const { moment, growth } = input;
  if (
    !relation(moment) ||
    !relation(moment.left) ||
    !structurallyEqual(moment.left.left, expectedMeanSquare) ||
    moment.left.right.kind !== "product" ||
    moment.left.right.args.length !== 2
  )
    return false;
  const [factor, recordedIntegral] = moment.left.right.args;
  if (!factor || !recordedIntegral) return false;
  return (
    structurallyEqual(recordedIntegral, integral) &&
    equal(gaussianProduct(input.widthSquared, input.normalization), factor) &&
    equal(gaussianProduct(factor, input.unitSecondMoment), moment.right) &&
    equal(momentValue, moment.right) &&
    relation(growth) &&
    structurallyEqual(growth.left, expectedMeanSquare) &&
    equal(momentValue, growth.right)
  );
}

function rmsRecordAgrees(input: BrownianGaussianInput, momentValue: Expression): boolean {
  const { rms } = input;
  const expectedDefinition = gaussianEquality(
    { kind: "symbol", termId: "rmsDisplacement1d", quantityId: "rmsDisplacement1d" },
    gaussianRoot(expectedMeanSquare),
  );
  return (
    relation(rms) &&
    structurallyEqual(rms.left, expectedDefinition) &&
    rms.right.kind === "root" &&
    rms.right.degree === 2 &&
    equal(momentValue, rms.right.radicand)
  );
}

/**
 * Checks the expressions actually rendered and the three canonical conclusion records.
 * It neither derives the diffusion model from microscopic motion nor proves uniqueness
 * of its solution. D > 0, t > 0 and the full-line Gaussian-area/tail premises remain explicit.
 */
export function verifyBrownianGaussian(
  raw: BrownianGaussianInput = brownianGaussianInput,
): BrownianGaussianReport {
  try {
    record(raw, "brownian-gaussian", FIELDS);
    const input = Object.fromEntries(
      FIELDS.map((field) => [field, canonical(raw[field])]),
    ) as unknown as BrownianGaussianInput;
    admitWidth(input.widthSquared);
    scalarNormalizerNonzero(input.normalization);
    if (!samePolynomial(input.exponent, gaussianNegative(gaussianSquare(u))))
      refuse("The admitted Gaussian area and tail identities require the profile exp(−u²).");

    const first = differentiate(input.exponent);
    const second = gaussianSum(differentiate(first), gaussianSquare(first));
    const derivatives =
      samePolynomial(input.firstWeight, first) && samePolynomial(input.secondWeight, second);

    // The scale is sqrt(a D t). Its time derivative divided by itself is 1/(2t),
    // and at fixed x the scaled coordinate has derivative -u/(2t).
    // Clear only the declared positive denominators 2t and aDt before comparing.
    // dx = sqrt(aDt) du cancels the same scale in p. The remaining area is admitted.
    const normalized = equal(gaussianProduct(input.normalization, gaussianRootPi), one);
    const diffusion =
      normalized &&
      derivatives &&
      equalPolynomials(
        exactPolynomial(
          gaussianProduct(
            input.widthSquared,
            gaussianSum(
              gaussianNumber("-1"),
              gaussianNegative(gaussianProduct(u, input.firstWeight)),
            ),
          ),
        ),
        exactPolynomial(gaussianProduct(two, t, D, input.secondWeight)),
      );
    const evenProfile = [...polynomial(input.exponent).keys()].every(
      (key) => (JSON.parse(key) as string[]).length % 2 === 0,
    );

    // d(u exp(q))/du = (1 + u q') exp(q). With its end term zero, integration
    // gives a I0 + b I2 = 0. The exact coefficients, not a recorded result, determine I2.
    const parts = gaussianSum(one, gaussianProduct(u, first));
    const partsPolynomial = polynomial(parts);
    const a = partsPolynomial.get("[]");
    const b = partsPolynomial.get(U_SQUARED);
    if (partsPolynomial.size !== 2 || !a || !b || b.num === 0n)
      refuse("The admitted integration-by-parts step must relate the zeroth and second moments.");
    const ratio = divide(rational(-a.num, a.den), b);
    const coefficient = gaussianQuotient(
      gaussianNumber(String(ratio.num)),
      gaussianNumber(String(ratio.den)),
    );
    const partsChecked =
      samePolynomial(input.partsWeight, parts) &&
      equal(gaussianProduct(coefficient, gaussianRootPi), input.unitSecondMoment);
    const profile: Expression = { kind: "function", name: "exp", argument: input.exponent };
    const integral = gaussianFullLineIntegral(gaussianProduct(gaussianSquare(u), profile), u);
    const momentValue = gaussianProduct(input.widthSquared, coefficient);
    const momentChecked =
      normalized && partsChecked && momentRecordsAgree(input, momentValue, integral);
    const verdicts: Readonly<Record<BrownianGaussianCheckId, boolean>> = {
      "profile-derivatives": derivatives,
      "diffusion-equation": diffusion,
      normalization: normalized,
      "signed-mean": normalized && evenProfile,
      "integration-by-parts": partsChecked,
      "second-moment": momentChecked,
      "root-mean-square": momentChecked && rmsRecordAgrees(input, momentValue),
    };
    const rows = brownianGaussianCheckRows.map(({ id }) => ({ id, passed: verdicts[id] }));
    return { passed: rows.every((row) => row.passed), rows };
  } catch (error) {
    if (
      !(error instanceof BrownianGaussianError) &&
      !(error instanceof PolynomialRefusal) &&
      !(error instanceof ContentError)
    )
      throw error;
    return {
      passed: false,
      rows: [],
      reason: error.message,
      refusalCode:
        error instanceof BrownianGaussianError ? error.refusalCode : "brownian-gaussian-expression",
    };
  }
}
