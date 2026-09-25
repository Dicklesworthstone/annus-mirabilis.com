import {
  add,
  divide,
  multiply,
  type Rational,
  rational,
  subtract,
} from "../../content/dimensions/rational.ts";
import { canonical, type Expression, parseExpression } from "../ast.ts";
import { MASS_ENERGY_QUANTITIES } from "../massEnergyQuantities.ts";
import { type EquationRecord, parseEquationRecord } from "../record.ts";
import { equalPolynomials, exactPolynomial } from "./exactPolynomial.ts";
import { exactSeriesAtZero, monomialQuotientLimit } from "./exactSeries.ts";
import { buildMassEnergyElimination, ELIMINATION_PREMISES } from "./massEnergyElimination.ts";

const q = (quantityId: string): Expression => ({ kind: "symbol", quantityId, termId: "internal" });
const n = (value: string): Expression => ({ kind: "number", value });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const power = (base: Expression, num: number): Expression => ({
  kind: "power",
  base,
  exponent: { num, den: 1 },
});
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const ratio = () => quotient(q("frameSpeed"), q("speedOfLight"));
const prefix = "eq-model-me-low-speed-check";
export class LowSpeedProofError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LowSpeedProofError";
  }
}
function fail(code: string, message: string): never {
  throw new LowSpeedProofError(code, message);
}

/** Strip only rendering identity; scales and scientific quantity IDs survive. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    const node = value as Expression;
    if (node.kind === "group") return shape(node.argument);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== "termId" && k !== "opId")
        .map(([k, v]) => [k, shape(v)]),
    );
  }
  return value;
}
const sameShape = (a: Expression, b: Expression) => canonical(shape(a)) === canonical(shape(b));
/** Build-only substitution; new occurrence IDs never masquerade as printed IDs. */
function rewrite(tree: Expression, replace: (node: Expression) => Expression | null): Expression {
  let count = 0;
  function visit(value: unknown, canReplace = true): unknown {
    if (Array.isArray(value)) return value.map((v) => visit(v));
    if (!value || typeof value !== "object") return value;
    if (canReplace && "kind" in value) {
      const replacement = replace(value as Expression);
      if (replacement) return visit(replacement, false);
    }
    const clone = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, visit(item)]),
    );
    if (clone.kind === "symbol") clone.termId = `${prefix}.t.n${count++}`;
    else if (clone.kind && !["number", "constant"].includes(String(clone.kind)))
      clone.opId = `${prefix}.op.n${count++}`;
    return clone;
  }
  return visit(tree) as Expression;
}
function energyDegree(node: Expression): Rational {
  switch (node.kind) {
    case "symbol":
      return rational(node.quantityId === "emittedEnergyRestFrame" ? 1n : 0n);
    case "number":
    case "constant":
      return rational(0n);
    case "negate":
    case "group":
      return energyDegree(node.argument);
    case "product":
      return node.args.reduce((a, b) => add(a, energyDegree(b)), rational(0n));
    case "sum": {
      const degrees = node.args.map(energyDegree);
      if (degrees.some((d) => d.num !== degrees[0]!.num || d.den !== degrees[0]!.den))
        fail("energy-normalization-inhomogeneous", "Energy normalization is not homogeneous.");
      return degrees[0]!;
    }
    case "quotient":
      return subtract(energyDegree(node.numerator), energyDegree(node.denominator));
    case "power":
      return multiply(
        energyDegree(node.base),
        rational(BigInt(node.exponent.num), BigInt(node.exponent.den)),
      );
    case "root":
      return divide(energyDegree(node.radicand), rational(BigInt(node.degree)));
    default:
      return fail(
        "energy-normalization-unsupported",
        "Unsupported energy normalization operation.",
      );
  }
}
function normalizeEnergy(tree: Expression): Expression {
  const degree = energyDegree(tree);
  if (degree.num !== 1n || degree.den !== 1n)
    fail("energy-drop-not-linear", "The energy drop must be linear in the fixed emitted energy.");
  return rewrite(tree, (node) =>
    node.kind === "symbol" && node.quantityId === "emittedEnergyRestFrame"
      ? node.scale
        ? quotient(n(String(node.scale.num)), n(String(node.scale.den)))
        : n("1")
      : null,
  );
}

export function buildMassEnergyLowSpeed(source: readonly EquationRecord[]) {
  // Recheck the actual prerequisite proof; an authored proof label is never accepted.
  const elimination = buildMassEnergyElimination(source);
  const records = new Map(
    source.map((e) => {
      const checked = parseEquationRecord(e, "low-speed input");
      return [checked.id, checked] as const;
    }),
  );
  function equation(name: string) {
    const eq = records.get(`eq-model-me-${name}`);
    if (!eq || eq.paper !== "mass-energy" || eq.tree.kind !== "relation")
      fail("missing-semantic-equation", `Missing semantic equation ${name}.`);
    return { ...eq, tree: eq.tree };
  }
  const factor = equation("lorentz-factor"),
    exact = equation("exact-drop"),
    approximation = equation("quadratic-drop");
  const expectedFactor: Expression = quotient(n("1"), {
    kind: "root",
    degree: 2,
    radicand: { kind: "sum", args: [n("1"), { kind: "negate", argument: power(ratio(), 2) }] },
  });
  if (
    factor.tree.operator !== "=" ||
    !sameShape(factor.tree.left, q("lorentzFactor")) ||
    !sameShape(factor.tree.right, expectedFactor)
  )
    fail(
      "lorentz-radical-lost",
      "The Lorentz source must retain the declared positive reciprocal radical.",
    );
  if (!sameShape(exact.tree.left, q("kineticEnergyDifference")))
    fail("kinetic-drop-identity-changed", "The kinetic drop changed identity.");
  const normalized = rewrite(normalizeEnergy(exact.tree.right), (node) =>
    node.kind === "symbol" && node.quantityId === "lorentzFactor"
      ? node.scale
        ? product(quotient(n(String(node.scale.num)), n(String(node.scale.den))), factor.tree.right)
        : factor.tree.right
      : null,
  );
  const request = {
    expression: normalized,
    equationId: prefix,
    registry: MASS_ENERGY_QUANTITIES,
    variable: { numerator: "frameSpeed", denominator: "speedOfLight" },
    order: 8,
  };
  const drop = exactSeriesAtZero(request);
  const expected = ["0", "0", "1/2", "0", "3/8", "0", "5/16", "0", "35/128"];
  if (canonical(drop.coefficients) !== canonical(expected))
    fail(
      "low-speed-expansion-lost",
      "The source no longer establishes the stated low-speed expansion.",
    );
  const numerator = rewrite(product(n("2"), normalized), () => null);
  const limit = monomialQuotientLimit({ ...request, expression: numerator }, 2);
  if (limit.limit !== "1")
    fail("mass-proxy-limit-lost", "The mass proxy no longer has the claimed dimensionless limit.");

  const normalizedApproximation = normalizeEnergy(approximation.tree.right);
  // Complete polynomial comparison, not just matching eight coefficients: a
  // hidden tenth-order term cannot pass as the stated quadratic approximation.
  const atomize = (tree: Expression) =>
    rewrite(tree, (node) => (sameShape(node, ratio()) ? q("speedRatioForCheck") : null));
  if (
    approximation.tree.operator !== "approx" ||
    !sameShape(approximation.tree.left, q("kineticEnergyDifference")) ||
    !equalPolynomials(
      exactPolynomial(atomize(normalizedApproximation)),
      exactPolynomial(product(n("0.5"), power(q("speedRatioForCheck"), 2))),
    )
  )
    fail(
      "quadratic-term-not-retained",
      "The approximation record must retain exactly the quadratic term and its approximation sign.",
    );

  function checkRatio(
    name: string,
    quantity: string,
    operator: string,
    numerator: Expression,
    denominator: Expression,
  ) {
    const eq = equation(name);
    if (
      eq.tree.operator !== operator ||
      !sameShape(eq.tree.left, q(quantity)) ||
      eq.tree.right.kind !== "quotient" ||
      !equalPolynomials(exactPolynomial(eq.tree.right.numerator), exactPolynomial(numerator)) ||
      !equalPolynomials(exactPolynomial(eq.tree.right.denominator), exactPolynomial(denominator))
    )
      fail(
        "proof-step-refused",
        `The ${name} equation does not match its checked coefficient role.`,
      );
    return eq;
  }
  const proxy = checkRatio(
    "finite-speed-proxy",
    "finiteSpeedMassProxy",
    "define",
    product(n("2"), q("kineticEnergyDifference")),
    power(q("frameSpeed"), 2),
  );
  const mass = checkRatio(
    "mass-decrease",
    "inertialMassDecrease",
    "=",
    q("emittedEnergyRestFrame"),
    power(q("speedOfLight"), 2),
  );
  // The symbolic quotient remains undefined at zero. The mass identification
  // adds the Newtonian coefficient premise; no absolute body energy is inserted.
  const requirements = elimination.certificate.requirements.find(
    (r) => r.step === "name-difference",
  )!.premises;
  const derivationRequirements = [
    { step: "expand", premises: [] as string[] },
    { step: "kinetic", premises: [...requirements] },
    { step: "divide", premises: [...requirements] },
    { step: "limit", premises: [] as string[] },
    { step: "identify", premises: [...requirements, "inertia"] },
  ];
  return {
    id: "me-low-speed-coefficient",
    check: "exact-taylor-and-removable-limit" as const,
    review: "draft" as const,
    notation: "modern-pedagogical" as const,
    domain:
      "Fix L > 0 and c > 0, hold both fixed, and take v/c toward zero through |v/c| < 1. Division by v² uses v ≠ 0.",
    variable: drop.variable,
    order: drop.order,
    coefficients: drop.coefficients,
    limit,
    leadingCoefficient: drop.coefficients[2]!,
    prerequisites: elimination.certificate,
    premises: [
      ...ELIMINATION_PREMISES,
      {
        id: "inertia",
        label: "Newtonian meaning of inertial mass at low speed",
        explanation:
          "For the before and after body at the same small speed, the kinetic-energy difference has coefficient one half times the mass decrease; the remaining terms vanish faster than v squared. This is an additional physical premise, not proved by the Taylor calculation.",
      },
    ],
    requirements: derivationRequirements,
    equationIds: [factor.id, exact.id, approximation.id, proxy.id, mass.id],
    normalizedTree: parseExpression(normalized, prefix, MASS_ENERGY_QUANTITIES),
    scope:
      "The algebra and local limit are checked. Physical premises and source alignment are not certified; no finite-speed error bound is asserted.",
  };
}
export type LowSpeedCertificate = ReturnType<typeof buildMassEnergyLowSpeed>;
