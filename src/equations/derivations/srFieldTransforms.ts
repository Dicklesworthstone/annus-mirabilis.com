/**
 * SR §6 in source order: differentiate the §3 coordinate map, regroup the six
 * vacuum Maxwell–Hertz rows, identify the fields up to a common factor, and
 * normalize that factor. The SI records below are a separate unit conversion.
 *
 * The generic substitution checker checks the authored replacement, not a PDE
 * proof. The component regroupings remain draft, authored-unverified steps;
 * independent analytic-derivative fixtures test their full residual identities.
 */

import bxRecord from "../../../content/equations/special-relativity/eq-model-sr-field-bx.json";
import byRecord from "../../../content/equations/special-relativity/eq-model-sr-field-by.json";
import bzRecord from "../../../content/equations/special-relativity/eq-model-sr-field-bz.json";
import exRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ex.json";
import eyRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ey.json";
import ezRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ez.json";
import { type Expression, nodeId } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import {
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  type FoundationToolId,
  type PremiseRef,
  type StepReadings,
} from "./types.ts";

type SymbolNode = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
type Coordinate = "t" | "x" | "y" | "z" | "τ" | "ξ" | "η" | "ζ";
export type SRFieldComponent = "X" | "Y" | "Z" | "L" | "M" | "N";

export type SRFieldTransformRefusalCode =
  | "sr-field-unaddressable-substitution"
  | "sr-field-unknown-si-symbol";

export class SRFieldTransformError extends DerivationSchemaError {
  readonly refusalCode: SRFieldTransformRefusalCode;

  constructor(refusalCode: SRFieldTransformRefusalCode, message: string, path: string) {
    super(message, path);
    this.refusalCode = refusalCode;
  }
}

const num = (value: number): Expression => ({ kind: "number", value: String(value) });
const symbol = (termId: string, quantityId: string, index?: string): SymbolNode => ({
  kind: "symbol",
  termId,
  quantityId,
  ...(index ? { index } : {}),
});
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const negate = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const root = (radicand: Expression): Extract<Expression, { kind: "root" }> => ({
  kind: "root",
  radicand,
  degree: 2,
});
const named = (opId: string, argument: Expression): Expression => ({
  kind: "group",
  opId: `sr-field.op.${opId}`,
  argument,
});
const equation = (id: string, left: Expression, right: Expression): Relation => ({
  kind: "relation",
  opId: `sr-field.op.${id}`,
  operator: "=",
  left,
  right,
});
const V = symbol("V", "speedOfLight");
const v = symbol("v", "frameSpeed");
const beta = symbol("β", "lorentzFactor");
const ratio = quotient(v, V);
const psi: SymbolNode = { ...symbol("ψ", "fieldScaleFactorUnknown"), at: v };
const psiReversed = named("reversed-scale", { ...psi, at: negate(v) });

const coordinates: Readonly<Record<Coordinate, SymbolNode>> = {
  t: symbol("t", "coordinateTimeStationary"),
  x: symbol("x", "coordinatePositionStationary", "x"),
  y: symbol("y", "coordinatePositionStationary", "y"),
  z: symbol("z", "coordinatePositionStationary", "z"),
  τ: symbol("τ", "coordinateTimeMoving"),
  ξ: symbol("ξ", "coordinatePositionMoving", "x"),
  η: symbol("η", "coordinatePositionMoving", "y"),
  ζ: symbol("ζ", "coordinatePositionMoving", "z"),
};
const fields: Readonly<Record<SRFieldComponent, SymbolNode>> = {
  X: symbol("X", "electricFieldStationary", "x"),
  Y: symbol("Y", "electricFieldStationary", "y"),
  Z: symbol("Z", "electricFieldStationary", "z"),
  L: symbol("L", "magneticFieldStationary", "x"),
  M: symbol("M", "magneticFieldStationary", "y"),
  N: symbol("N", "magneticFieldStationary", "z"),
};
const moving = (field: SRFieldComponent): SymbolNode => ({
  ...fields[field],
  termId: `${field}'`,
  quantityId: fields[field].quantityId.replace("Stationary", "Moving"),
});
const partial = (expression: Expression, coordinate: Coordinate, id?: string): Expression => ({
  kind: "derivative",
  ...(id ? { opId: `sr-field.op.${id}` } : {}),
  expression,
  variable: coordinates[coordinate],
  order: 1,
  partial: true,
});
const operator = (coordinate: Coordinate): Expression => ({
  kind: "partialOperator",
  variable: coordinates[coordinate],
});
const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const draft = {
  verification: { status: "authored-unverified" },
  historicalStatus: "source-order-reconstruction",
  modelStatus: "vacuum-maxwell-hertz-constant-boost",
  isMove: false,
} as const;

/** The authoring boundary used by every substitution in this source reconstruction. */
export function createSRFieldSubstitution(
  from: Expression,
  target: Expression,
  replacement: Expression,
  citedEquality: string,
  path = "sr-field-substitution",
): Pick<DerivationStep, "to" | "changedSubexpressionIds" | "rule"> {
  const targetId = nodeId(target);
  if (!targetId) {
    throw new SRFieldTransformError(
      "sr-field-unaddressable-substitution",
      "The field derivation must name the expression it replaces.",
      path,
    );
  }
  return {
    to: substituteNode(from, targetId, replacement),
    changedSubexpressionIds: [targetId],
    rule: { kind: "substitute", params: { targetId, replacement, citedEquality } },
  };
}

function replacementStep(
  id: string,
  from: Expression,
  target: Expression,
  replacement: Expression,
  citedEquality: string,
  reasons: StepReadings,
  options: {
    sourceAnchor: string;
    tool: FoundationToolId;
    premiseRefs: readonly PremiseRef[];
    reasonKind?: DerivationStep["reasonKind"];
    moveLabel?: string;
  },
): DerivationStep {
  return {
    ...draft,
    id,
    from,
    ...createSRFieldSubstitution(from, target, replacement, citedEquality, id),
    reasonKind: options.reasonKind ?? "algebra",
    reasons,
    ...options,
    ...(options.moveLabel ? { isMove: true } : {}),
  };
}

function chain(
  suffix: string,
  steps: readonly DerivationStep[],
  entryAssumptions: readonly PremiseRef[],
): DerivationChain {
  return {
    id: `chain-sr-field-${suffix}`,
    proofRouteId: `route-sr-field-${suffix}-source-order`,
    routeKind: "source-order",
    entryAssumptions,
    target: `sr-field-${suffix}-result`,
    targetStepId: steps.at(-1)?.id,
    essentialForPrint: true,
    steps,
  };
}

export const srFieldCoordinateMap = [
  equation(
    "coordinate-time",
    coordinates.τ,
    product(beta, sum(coordinates.t, negate(quotient(product(v, coordinates.x), square(V))))),
  ),
  equation(
    "coordinate-x",
    coordinates.ξ,
    product(beta, sum(coordinates.x, negate(product(v, coordinates.t)))),
  ),
  equation("coordinate-y", coordinates.η, coordinates.y),
  equation("coordinate-z", coordinates.ζ, coordinates.z),
  equation("lorentz-factor", beta, quotient(num(1), root(sum(num(1), negate(square(ratio)))))),
] as const;

const tauT = partial(coordinates.τ, "t", "tau-t");
const xiT = partial(coordinates.ξ, "t", "xi-t");
const tauX = partial(coordinates.τ, "x", "tau-x");
const xiX = partial(coordinates.ξ, "x", "xi-x");
const timeChainRule = equation(
  "time-chain-rule",
  operator("t"),
  sum(product(tauT, operator("τ")), product(xiT, operator("ξ"))),
);
const spaceChainRule = equation(
  "space-chain-rule",
  operator("x"),
  sum(product(tauX, operator("τ")), product(xiX, operator("ξ"))),
);

const timeCoefficient = replacementStep(
  "sr-field-time-coefficient",
  timeChainRule,
  tauT,
  beta,
  "At fixed x,y,z, τ = β(t − vx/V²) gives ∂τ/∂t = β.",
  {
    r0: "Changing the stationary clock changes the moving clock at rate β.",
    r1: "A field is a function of the same event expressed in either coordinate system. At fixed x, y and z, differentiating τ = β(t − vx/V²) gives ∂τ/∂t = β. The chain rule still has a spatial term because ξ changes with t.",
    r2: "Hold x, y and z fixed and keep the frame speed v constant. Then β and vx/V² are constant with respect to t, so the partial derivative of τ is β. In the operator identity ∂t = (∂τ/∂t)∂τ + (∂ξ/∂t)∂ξ, replace only the first coefficient. The η and ζ coefficients vanish because η = y and ζ = z. Here τ is a moving coordinate time, not proper time along a particle trajectory.",
  },
  {
    tool: "foundation:partial-derivatives",
    sourceAnchor: "sr-field-source-change-variables",
    premiseRefs: [historical("sr-section-3-coordinate-map")],
    reasonKind: "calculus",
  },
);
const timeMixing = replacementStep(
  "sr-field-time-spatial-mixing",
  timeCoefficient.to,
  xiT,
  negate(product(beta, v)),
  "At fixed x,y,z, ξ = β(x − vt) gives ∂ξ/∂t = −βv.",
  {
    r0: "A fixed place in K moves through k, so the time derivative also samples a spatial change.",
    r1: "Differentiate ξ = β(x − vt) while x is fixed: ∂ξ/∂t = −βv. Therefore ∂t = β∂τ − βv∂ξ. Omitting this second term would treat a fixed point of K as if it were also a fixed point of k.",
    r2: "The derivative of x − vt with respect to t, at fixed x, is −v. Multiplying by the constant β gives −βv. Substitute that coefficient into the second chain-rule term. Both terms have units of inverse time: v multiplies an inverse-length derivative. The minus sign follows from the stated convention that k moves with velocity +v along x relative to K.",
  },
  {
    tool: "foundation:partial-derivatives",
    sourceAnchor: "sr-field-source-change-variables",
    premiseRefs: [historical("sr-section-3-coordinate-map")],
    reasonKind: "calculus",
  },
);
const spaceMixing = replacementStep(
  "sr-field-space-time-mixing",
  spaceChainRule,
  tauX,
  negate(quotient(product(beta, v), square(V))),
  "At fixed t,y,z, τ = β(t − vx/V²) gives ∂τ/∂x = −βv/V².",
  {
    r0: "Comparing nearby places at one K time also compares different k times.",
    r1: "At fixed t, y and z, the moving time changes with x at rate −βv/V². This is the relativity-of-simultaneity term in the spatial derivative, and it is essential to the field-component cancellations.",
    r2: "Take the x derivative of τ = β(t − vx/V²). The derivative of t is zero on this slice and the derivative of −vx/V² is −v/V². Thus the first coefficient in ∂x = (∂τ/∂x)∂τ + (∂ξ/∂x)∂ξ is −βv/V². Its units are time per length, which convert ∂τ into an inverse-length operator.",
  },
  {
    tool: "foundation:partial-derivatives",
    sourceAnchor: "sr-field-source-change-variables",
    premiseRefs: [historical("sr-section-3-coordinate-map")],
    reasonKind: "calculus",
  },
);
const spaceCoefficient = replacementStep(
  "sr-field-space-coefficient",
  spaceMixing.to,
  xiX,
  beta,
  "At fixed t,y,z, ξ = β(x − vt) gives ∂ξ/∂x = β.",
  {
    r0: "The spatial derivative combines a moving-space derivative with the moving-time term.",
    r1: "The remaining coefficient is ∂ξ/∂x = β. Hence ∂x = β∂ξ − βv∂τ/V², while ∂y = ∂η and ∂z = ∂ζ. These are operator identities acting on fields, not equations of motion for a charge.",
    r2: "At fixed t the derivative of x − vt with respect to x is one, leaving β. Insert it into the second term. Together the two completed operator identities tell us how to replace every t and x derivative in the six Maxwell–Hertz equations. The perpendicular coordinates remain η = y and ζ = z, as already established in §3; no new field assumption determines that normalization here.",
  },
  {
    tool: "foundation:partial-derivatives",
    sourceAnchor: "sr-field-source-change-variables",
    premiseRefs: [historical("sr-section-3-coordinate-map")],
    reasonKind: "calculus",
  },
);

export const srFieldOperatorEquations = [
  timeMixing.to,
  spaceCoefficient.to,
  equation("operator-y", operator("y"), operator("η")),
  equation("operator-z", operator("z"), operator("ζ")),
] as const;

/** The six combinations in source eq-s6-d2, before their physical identification. */
export const srFieldCandidateComponents: Readonly<Record<SRFieldComponent, Expression>> = {
  X: fields.X,
  Y: product(beta, sum(fields.Y, negate(product(ratio, fields.N)))),
  Z: product(beta, sum(fields.Z, product(ratio, fields.M))),
  L: fields.L,
  M: product(beta, sum(fields.M, product(ratio, fields.Z))),
  N: product(beta, sum(fields.N, negate(product(ratio, fields.Y)))),
};

const componentOrder = ["X", "Y", "Z", "L", "M", "N"] as const;
const curls: Readonly<
  Record<SRFieldComponent, readonly [SRFieldComponent, Coordinate, SRFieldComponent, Coordinate]>
> = {
  X: ["N", "y", "M", "z"],
  Y: ["L", "z", "N", "x"],
  Z: ["M", "x", "L", "y"],
  L: ["Y", "z", "Z", "y"],
  M: ["Z", "x", "X", "z"],
  N: ["X", "y", "Y", "x"],
};
const movingCoordinate: Readonly<Record<Coordinate, Coordinate>> = {
  t: "τ",
  x: "ξ",
  y: "η",
  z: "ζ",
  τ: "τ",
  ξ: "ξ",
  η: "η",
  ζ: "ζ",
};

function maxwellRow(
  field: SRFieldComponent,
  components: Readonly<Record<SRFieldComponent, Expression>>,
  frame: "stationary" | "moving",
  suffix: string,
): Relation {
  const [positive, positiveVariable, negative, negativeVariable] = curls[field];
  const coordinate = (value: Coordinate) => (frame === "moving" ? movingCoordinate[value] : value);
  return equation(
    `${field.toLowerCase()}-${suffix}`,
    quotient(partial(components[field], coordinate("t")), V),
    sum(
      partial(components[positive], coordinate(positiveVariable)),
      negate(partial(components[negative], coordinate(negativeVariable))),
    ),
  );
}

function changeVariables(expression: Expression): Expression {
  if (expression.kind === "derivative") {
    const coordinate = (expression.variable as SymbolNode).termId as Coordinate;
    const body = expression.expression;
    if (coordinate === "t")
      return product(beta, sum(partial(body, "τ"), negate(product(v, partial(body, "ξ")))));
    if (coordinate === "x")
      return product(
        beta,
        sum(partial(body, "ξ"), negate(quotient(product(v, partial(body, "τ")), square(V)))),
      );
    return partial(body, movingCoordinate[coordinate]);
  }
  if (expression.kind === "relation")
    return {
      ...expression,
      left: changeVariables(expression.left),
      right: changeVariables(expression.right),
    };
  if (expression.kind === "quotient")
    return {
      ...expression,
      numerator: changeVariables(expression.numerator),
      denominator: changeVariables(expression.denominator),
    };
  if (expression.kind === "sum" || expression.kind === "product")
    return { ...expression, args: expression.args.map(changeVariables) };
  if (expression.kind === "negate")
    return { ...expression, argument: changeVariables(expression.argument) };
  return expression;
}
const residual = (row: Relation): Expression => sum(row.left, negate(row.right));
const divergenceE = sum(partial(fields.X, "x"), partial(fields.Y, "y"), partial(fields.Z, "z"));
const divergenceB = sum(partial(fields.L, "x"), partial(fields.M, "y"), partial(fields.N, "z"));

export const srFieldVacuumConstraints = [
  equation("vacuum-electric-divergence", divergenceE, num(0)),
  equation("vacuum-magnetic-divergence", divergenceB, num(0)),
] as const;

/** Each component owns its actual explanation, including the signs and constraints it needs. */
const componentReadings: Readonly<
  Record<
    SRFieldComponent,
    {
      readonly changeVariables: StepReadings;
      readonly groupComponents: StepReadings;
    }
  >
> = {
  X: {
    changeVariables: {
      r0: "Change the derivatives in the electric-field equation along the motion.",
      r1: "The X equation relates its time derivative to spatial derivatives of N and M. Replace the time derivative by its two-term chain rule, and rename y and z as η and ζ. X still denotes the stationary observer's electric component at the same event.",
      r2: "Start from ∂tX/V = ∂yN − ∂zM. Substituting ∂t = β(∂τ − v∂ξ) gives β(∂τX − v∂ξX)/V = ∂ηN − ∂ζM. The y and z derivatives introduce no time mixing because η = y and ζ = z. Keep the spatial term −βv∂ξX: a point fixed in K changes its ξ coordinate as t advances. The frame speed and β are constant, so derivatives do not act on them. No field has yet been identified as X′, N′ or M′; this step changes only the coordinates used to describe the original fields.",
    },
    groupComponents: {
      r0: "The X row takes the moving-frame form when the electric divergence also vanishes.",
      r1: "Group the magnetic combinations β(N − vY/V) and β(M + vZ/V) on the right, leaving X on the left. Their extra electric derivatives combine with the time-change term into the electric divergence. In a charge-free region that divergence is zero, so the grouped X equation follows.",
      r2: "Form the grouped residual ∂τX/V − ∂η[β(N − vY/V)] + ∂ζ[β(M + vZ/V)]. Use the inverse chain rule ∂τ = β(∂t + v∂x), while ∂η = ∂y and ∂ζ = ∂z. Since the boost is constant, take β and v/V outside the derivatives. The result is β times the original residual ∂tX/V − ∂yN + ∂zM, plus β(v/V)(∂xX + ∂yY + ∂zZ). The first part vanishes by the original X curl equation; the second vanishes by the charge-free divergence condition. A static X proportional to x would satisfy the six curl rows but have nonzero electric divergence, so those rows alone would not establish this conclusion. The grouped functions remain candidates for the moving fields until the physical identification step.",
    },
  },
  Y: {
    changeVariables: {
      r0: "Both time and x derivatives mix in the Y component equation.",
      r1: "The Y equation contains a time derivative of Y and an x derivative of N. Each becomes two terms in moving coordinates. The minus sign before the N derivative must apply to both of its chain-rule terms; the z derivative of L simply becomes a ζ derivative.",
      r2: "Start from ∂tY/V = ∂zL − ∂xN. Replace the left side by β(∂τY − v∂ξY)/V. On the right, ∂zL becomes ∂ζL and ∂xN becomes β(∂ξN − v∂τN/V²). The original minus sign therefore makes the last time-derivative term positive when the right side is expanded. This sign is essential to obtaining the later combination Y − vN/V. Throughout this replacement v and β are constants, and Y, N and L are the original field components evaluated at one event. Neither a new physical field law nor the common scale factor ψ has been used yet.",
    },
    groupComponents: {
      r0: "The Y and N combinations restore the Y row with the correct pair of minus signs.",
      r1: "Collect β(Y − vN/V) as the electric candidate and β(N − vY/V) as the magnetic candidate. Together with L, they reproduce the Y equation in τ, ξ and ζ. The mixed derivatives cancel, leaving the original Y equation multiplied only by a factor that equals one.",
      r2: "Subtract the grouped right side from its left side: ∂τ[β(Y − vN/V)]/V + ∂ξ[β(N − vY/V)] − ∂ζL. Insert ∂τ = β(∂t + v∂x) and ∂ξ = β(∂x + v∂t/V²), with ∂ζ = ∂z. The ∂xY contributions have opposite coefficients β²v/V, and the ∂tN contributions have opposite coefficients β²v/V², so both pairs cancel. What remains is β²(1 − v²/V²)(∂tY/V + ∂xN) − ∂zL. The definition of β makes the prefactor one, leaving precisely the original Y residual. Thus a solution of the original Y equation satisfies the grouped equation. No divergence premise is needed for this particular row, although the full vacuum system still includes it for the X and L rows.",
    },
  },
  Z: {
    changeVariables: {
      r0: "Rewrite the time derivative of Z and the x derivative of M together.",
      r1: "The Z equation has the x derivative of M with a positive sign and the y derivative of L with a negative sign. Apply the two-term chain rule to time and x, and replace y by η. Keep those signs when collecting the electric and magnetic terms.",
      r2: "Start from ∂tZ/V = ∂xM − ∂yL. The left side becomes β(∂τZ − v∂ξZ)/V. The x derivative on the right becomes β(∂ξM − v∂τM/V²), and the remaining term is −∂ηL. The negative time derivative of M is therefore inside a positively signed x-derivative contribution. Moving it to the other side during regrouping is what pairs Z with a positive vM/V contribution. Keep v and β fixed while differentiating. Z, M and L still name the stationary field components; the chain rule alone has not assigned the fields that an observer in k measures.",
    },
    groupComponents: {
      r0: "The Z and M candidates mix with plus signs and recover the original Z equation.",
      r1: "Group β(Z + vM/V) and β(M + vZ/V), leaving L as the parallel magnetic component. Their τ and ξ derivatives cancel the mixed terms and produce the moving-coordinate Z row. Both plus signs follow from the original curl equation and the chosen direction of the boost.",
      r2: "Expand the grouped residual ∂τ[β(Z + vM/V)]/V − ∂ξ[β(M + vZ/V)] + ∂ηL. Under the inverse chain rule, the ∂xZ terms cancel because the time derivative contributes +β²v/V while the ξ derivative contributes −β²v/V. The ∂tM terms likewise cancel with coefficients +β²v/V² and −β²v/V². The remaining terms are β²(1 − v²/V²)(∂tZ/V − ∂xM) + ∂yL. Using β²(1 − v²/V²) = 1 leaves the original Z residual, which is zero for an admitted vacuum field. Reversing only the sign of vM/V would spoil these cancellations. Agreement for one specially aligned field would not repair that error; the component identity must hold for arbitrary admissible fields before identifying the grouped functions as physical primed fields.",
    },
  },
  L: {
    changeVariables: {
      r0: "Change coordinates in the magnetic-field equation along the motion.",
      r1: "The L equation relates its time derivative to spatial derivatives of Y and Z. Only the time derivative has two chain-rule terms here. Replacing z and y by ζ and η preserves the original order and signs of the electric-field derivatives on the right.",
      r2: "Start from ∂tL/V = ∂zY − ∂yZ. With the completed time operator, the left side is β(∂τL − v∂ξL)/V; the right side becomes ∂ζY − ∂ηZ. The term −βv∂ξL remains even though L points along the boost. A component being parallel to the motion does not make its spatial variation vanish. This step holds the boost constant and follows the same field at the same event through a coordinate change. It does not yet identify L with L′. The next regrouping will need the zero magnetic-divergence condition as well as this curl equation.",
    },
    groupComponents: {
      r0: "The L row takes the moving-frame form when the magnetic divergence vanishes.",
      r1: "Group β(Y − vN/V) and β(Z + vM/V) as the electric candidates on the right. The additional magnetic derivatives combine into the magnetic divergence. Its vanishing makes this grouped equation equivalent to the original L equation within the stated vacuum conditions.",
      r2: "Take the residual ∂τL/V − ∂ζ[β(Y − vN/V)] + ∂η[β(Z + vM/V)]. The inverse time operator contributes β∂tL/V + β(v/V)∂xL. Expanding the other two derivatives supplies −β∂zY + β∂yZ, together with β(v/V)(∂zN + ∂yM). Collect these terms as β times the original L residual plus β(v/V)(∂xL + ∂yM + ∂zN). The curl equation sets the first part to zero, and zero magnetic divergence sets the second to zero. This identifies the exact additional premise used for the parallel magnetic row. A formal field with nonzero magnetic divergence would not satisfy this conclusion merely by satisfying the six curl equations; it lies outside the admitted electromagnetic fields.",
    },
  },
  M: {
    changeVariables: {
      r0: "Apply both mixed derivative operators to the M equation.",
      r1: "The M equation contains the time derivative of M and the x derivative of Z, while X enters through a z derivative. Substitute both two-term operators before regrouping. The sign in front of the Z derivative is positive, which fixes how its time-mixing term appears.",
      r2: "Start from ∂tM/V = ∂xZ − ∂zX. On the left substitute β(∂τM − v∂ξM)/V. On the right substitute β(∂ξZ − v∂τZ/V²) − ∂ζX. Every term follows from the earlier coordinate map; no equation of motion for a test charge is involved. In particular, the time derivative of Z enters with a minus sign on the right before terms are collected across the equality. All fields still use Gaussian units, in which electric and magnetic components have matching dimensions. Because v and β are constant, these coefficients can pass through the derivatives without generating extra terms.",
    },
    groupComponents: {
      r0: "Pair M with Z using plus signs to recover the moving-coordinate M equation.",
      r1: "The magnetic candidate β(M + vZ/V) and electric candidate β(Z + vM/V) appear together in the M row. Their mixed derivatives cancel, and the remaining Lorentz-factor combination equals one. X supplies the remaining ζ derivative without mixing with another component.",
      r2: "Form ∂τ[β(M + vZ/V)]/V − ∂ξ[β(Z + vM/V)] + ∂ζX. Substituting the inverse chain-rule operators produces two ∂xM contributions of equal magnitude and opposite sign, and the same cancellation for the ∂tZ contributions. The terms left over are β²(1 − v²/V²)(∂tM/V − ∂xZ) + ∂zX. Since the coefficient in front of the parentheses is one, this is exactly the original M residual. The cancellation establishes this component equation for all admitted fields, rather than for a single chosen example. The combinations have consistent Gaussian dimensions because v/V is dimensionless; the later SI conversion rescales magnetic fields differently and is the reason its electric mixing term contains c² in the denominator.",
    },
  },
  N: {
    changeVariables: {
      r0: "Keep the outer minus sign when changing the x derivative in the N equation.",
      r1: "The N equation contains the y derivative of X minus the x derivative of Y. Replace the latter by both chain-rule terms, keeping the outer minus sign. Also replace the time derivative of N by its two-term expression; the y derivative simply becomes an η derivative.",
      r2: "Start from ∂tN/V = ∂yX − ∂xY. Substitute β(∂τN − v∂ξN)/V on the left and ∂ηX − β(∂ξY − v∂τY/V²) on the right. Expanding the last parentheses gives a positive βv∂τY/V² contribution, because two minus signs multiply. Losing that sign would change the later N − vY/V combination. Treat the field values as functions of the transformed coordinates at the same event, and keep the frame speed fixed. The quantities N and Y still carry their original field meanings and units; their physical primed counterparts are introduced only after all six rows have been regrouped.",
    },
    groupComponents: {
      r0: "The N and Y candidates need matching minus signs to preserve the N equation.",
      r1: "Collect β(N − vY/V) as the magnetic candidate and β(Y − vN/V) as the electric candidate. Together with X, they give the moving-coordinate N row. The paired signs make the cross derivatives cancel and recover the original equation after the Lorentz-factor identity is used.",
      r2: "Expand ∂τ[β(N − vY/V)]/V + ∂ξ[β(Y − vN/V)] − ∂ηX. The inverse time operator supplies a negative ∂tY contribution with coefficient β²v/V², cancelled by the positive one from the inverse ξ operator. The positive ∂xN contribution from the time operator is cancelled by the negative one from the ξ operator. The remaining expression is β²(1 − v²/V²)(∂tN/V + ∂xY) − ∂yX. Reducing the prefactor to one gives the original N residual. This cancellation depends on both minus signs: changing only one would generally leave nonzero mixed derivatives. The result is a differential statement about the candidate components, and the later common-factor identification is still needed to connect them with what a moving observer measures.",
    },
  },
};

export const srFieldComponentRows = componentOrder.map((component) => {
  const lower = component.toLowerCase();
  const source = maxwellRow(component, fields, "stationary", "source");
  const changed = changeVariables(source);
  const grouped = maxwellRow(component, srFieldCandidateComponents, "moving", "grouped");
  const sourceResidual = residual(source);
  const originalResidual =
    component === "X"
      ? product(beta, sum(sourceResidual, product(ratio, divergenceE)))
      : component === "L"
        ? product(beta, sum(sourceResidual, product(ratio, divergenceB)))
        : sourceResidual;
  const residualIdentity = equation(
    `${lower}-residual-identity`,
    residual(grouped),
    originalResidual,
  );
  const first = replacementStep(
    `sr-field-${lower}-change-variables`,
    source,
    source,
    changed,
    "Replace every t,x,y,z derivative by the completed §3 chain-rule operators, with v and β constant.",
    componentReadings[component].changeVariables,
    {
      tool: "foundation:partial-derivatives",
      sourceAnchor: "sr-field-source-maxwell",
      premiseRefs: [
        historical("sr-vacuum-maxwell-hertz"),
        historical("sr-section-3-coordinate-map"),
      ],
      reasonKind: "calculus",
    },
  );
  const second = replacementStep(
    `sr-field-${lower}-group-components`,
    first.to,
    first.to,
    grouped,
    componentReadings[component].groupComponents.r2,
    componentReadings[component].groupComponents,
    {
      tool: "foundation:fields-waves",
      sourceAnchor: "sr-field-source-grouped",
      premiseRefs: [
        historical("sr-vacuum-maxwell-hertz"),
        historical("sr-section-3-coordinate-map"),
        teaching("sr-vacuum-zero-divergences"),
        teaching("sr-lorentz-factor-identity"),
      ],
      reasonKind: "algebra",
    },
  );
  return {
    component,
    source,
    changed,
    grouped,
    residualIdentity,
    chain: chain(
      `${lower}-component`,
      [first, second],
      [
        historical("sr-vacuum-maxwell-hertz"),
        historical("sr-section-3-coordinate-map"),
        teaching("sr-vacuum-zero-divergences"),
      ],
    ),
  };
});

export const srFieldAnsatzEquations = componentOrder.map((component) =>
  equation(
    `${component.toLowerCase()}-ansatz`,
    moving(component),
    product(psi, srFieldCandidateComponents[component]),
  ),
);
export const srFieldGaussianEquations = componentOrder.map((component) =>
  equation(
    `${component.toLowerCase()}-normalized`,
    moving(component),
    srFieldCandidateComponents[component],
  ),
);
export const srFieldMovingMaxwellRows = componentOrder.map((component) =>
  maxwellRow(
    component,
    Object.fromEntries(componentOrder.map((field) => [field, moving(field)])) as Record<
      SRFieldComponent,
      Expression
    >,
    "moving",
    "physical-moving",
  ),
);

const Xprime = moving("X");
const Xreturned = { ...fields.X, termId: "X''" };
const inverseX = equation("inverse-x", Xreturned, product(psiReversed, Xprime));
const identifyScale = replacementStep(
  "sr-field-identify-common-scale",
  inverseX,
  Xprime,
  product(psi, fields.X),
  "The local linear common-factor ansatz is X′ = ψ(v)X; the inverse boost uses the same law with −v.",
  {
    r0: "Identify the same physical fields up to one factor, then follow a field out and back.",
    r1: "Einstein identifies the six grouped functions with X′, Y′, Z′, L′, M′ and N′ up to one factor ψ(v), independent of position and time. Apply the inverse boost to the parallel electric component and substitute X′ = ψ(v)X. This identification is an additional physical ansatz; sharing a differential form alone does not prove uniqueness.",
    r2: "The six homogeneous field equations permit a common constant multiplier, so comparing their form leaves ψ(v) undetermined. The argument identifies the same electromagnetic field through a local linear transformation with the stated axis convention and one common scalar factor. It does not classify every mathematical map between solutions, such as duality rotations. In the inverse boost, X″ = ψ(−v)X′. Substituting the forward ansatz gives X″ = ψ(−v)ψ(v)X. A position-dependent multiplier would add derivatives of ψ and is outside this ansatz.",
  },
  {
    tool: "foundation:fields-waves",
    sourceAnchor: "sr-field-source-identification",
    premiseRefs: [
      historical("sr-field-common-factor-ansatz"),
      historical("sr-relativity-same-inverse-law"),
    ],
    reasonKind: "physical-premise",
    moveLabel: "Identify the same fields up to one common position-independent factor.",
  },
);
const returnToOriginal = replacementStep(
  "sr-field-return-to-original-frame",
  identifyScale.to,
  Xreturned,
  fields.X,
  "The boost v followed by the inverse boost −v returns the same event and the same field component: X″ = X.",
  {
    r0: "An inverse boost returns to the original field measurement.",
    r1: "The return to K must recover X itself. Replace X″ by X, giving X = ψ(−v)ψ(v)X. A round trip may not rescale a physical field measured in the original units.",
    r2: "Use the same physical definition and units for the field before and after the inverse coordinate transformation. Since the two boosts compose to the identity, the left side becomes the original X. This is an inverse-transformation premise, independent of the differential equations being homogeneous. The resulting identity must hold for every admissible field, including a nonzero constant field parallel to the boost.",
  },
  {
    tool: "foundation:frames-events",
    sourceAnchor: "sr-field-source-inverse",
    premiseRefs: [historical("sr-relativity-same-inverse-law")],
    reasonKind: "physical-premise",
  },
);
const reciprocal = equation("reciprocal-scale", num(1), product(psiReversed, psi));
const reciprocalStep: DerivationStep = {
  ...draft,
  id: "sr-field-inverse-reciprocity",
  from: returnToOriginal.to,
  to: reciprocal,
  changedSubexpressionIds: [fields.X.termId],
  rule: {
    kind: "add-subtract-multiply-divide",
    params: {
      operation: "divide",
      quantity: fields.X,
      nonzeroCondition:
        "Choose an admissible constant parallel electric field with X ≠ 0; ψ depends on v, not on that chosen field.",
    },
  },
  reasonKind: "algebra",
  reasons: {
    r0: "A nonzero test field leaves ψ(v)ψ(−v) = 1.",
    r1: "Choose a nonzero constant parallel electric field and divide by X. The forward and backward scale factors must be reciprocals. A zero field would instead give 0 = 0 and would determine no factor.",
    r2: "The common scale is assumed to depend only on v. We can therefore determine it using any admissible nonzero test field, without assuming that every possible field has X ≠ 0. Divide X = ψ(−v)ψ(v)X by that nonzero X and simplify to 1 = ψ(−v)ψ(v). This condition alone still admits functions such as exp(av/V), whose inverse-speed value is its reciprocal; the symmetry condition has not yet been used.",
  },
  tool: "foundation:bridge-fractions-ratios",
  sourceAnchor: "sr-field-source-inverse",
  premiseRefs: [
    historical("sr-relativity-same-inverse-law"),
    teaching("sr-nonzero-parallel-field-comparison"),
  ],
};
const evenScale = replacementStep(
  "sr-field-even-scale",
  reciprocal,
  psiReversed,
  psi,
  "Spatial symmetry with a pure N field makes Y′ reverse sign without changing magnitude when v changes sign; β is even, so ψ(−v) = ψ(v).",
  {
    r0: "Reversing the motion cannot change the magnitude of the common factor.",
    r1: "Use the source's pure magnetic example: only N is nonzero. Then Y′ = −ψ(v)βvN/V. Spatial symmetry makes Y′ change sign with v while retaining its magnitude, so ψ(−v) = ψ(v). Combine this with the reciprocal condition.",
    r2: "For X = Y = Z = L = M = 0 and N ≠ 0, the ansatz gives Y′(v) = −ψ(v)β(v)vN/V. The footnote's symmetry requirement is Y′(−v) = −Y′(v). Since β is even and v is nonzero in this comparison, cancellation gives ψ(−v) = ψ(v). Continuity includes v = 0. Substituting this equality into the reciprocal condition produces 1 = ψ(v)ψ(v). This extra premise excludes the reciprocal but direction-dependent exponential family.",
  },
  {
    tool: "foundation:conservation-symmetry",
    sourceAnchor: "sr-field-source-symmetry",
    premiseRefs: [historical("sr-field-spatial-symmetry-pure-magnetic-example")],
    reasonKind: "symmetry",
  },
);
const squaredScale = equation("squared-scale", num(1), square(psi));
const squareScale: DerivationStep = {
  ...draft,
  id: "sr-field-square-scale",
  from: evenScale.to,
  to: squaredScale,
  changedSubexpressionIds: [psi.termId],
  rule: { kind: "collect", params: {} },
  reasonKind: "algebra",
  reasons: {
    r0: "Inverse consistency and symmetry fix the square of the factor.",
    r1: "The two equal factors combine to ψ(v)² = 1. Both +1 and −1 satisfy this algebraic equation; selecting the physical sign needs the normalization at zero speed.",
    r2: "Rewrite the product of ψ(v) with itself as its square. This is a collection of equal scalar factors, not a new physical law. The reciprocal and evenness conditions establish a magnitude of one but do not alone distinguish a transformation connected to the identity from an overall sign reversal. The next step states the continuity and identity normalization that choose the branch.",
  },
  tool: "foundation:bridge-squaring-square-roots",
  sourceAnchor: "sr-field-source-symmetry",
  premiseRefs: [
    historical("sr-relativity-same-inverse-law"),
    historical("sr-field-spatial-symmetry-pure-magnetic-example"),
  ],
};
const rootedScale = equation(
  "rooted-scale",
  { ...root(num(1)), opId: "sr-field.op.unit-root" },
  { ...root(square(psi)), opId: "sr-field.op.positive-root" },
);
const positiveBranch: DerivationStep = {
  ...draft,
  id: "sr-field-positive-branch",
  from: squaredScale,
  to: rootedScale,
  changedSubexpressionIds: [psi.termId],
  rule: {
    kind: "monotonic-function",
    params: {
      function: "square-root",
      domain: "ψ(v)² = 1 is nonnegative for real |v| < V.",
      branch: "positive",
      branchCondition:
        "ψ(0) = 1 and ψ(v) is continuous and nonzero on the connected interval −V < v < V; therefore ψ(v) remains positive.",
    },
  },
  reasonKind: "physical-premise",
  reasons: {
    r0: "Use the branch continuously connected to no change at zero speed.",
    r1: "At v = 0 the two frames coincide, so ψ(0) = 1. Continuity and invertibility prevent this nonzero factor from jumping to −1. Apply the positive square root with that condition stated.",
    r2: "The interval −V < v < V is connected. A continuous real ψ that is one at zero and never vanishes cannot change sign there. Invertibility follows already from ψ(v)ψ(−v) = 1. Thus √(ψ²) = |ψ| = ψ on this branch. This explicit reconstruction supplies the sign selection behind the source's transition to a unit factor; taking a square root without its domain and branch would leave an unproved choice.",
  },
  tool: "foundation:bridge-squaring-square-roots",
  sourceAnchor: "sr-field-source-normalized",
  premiseRefs: [teaching("sr-field-continuity-identity-normalization")],
};
const connectedSign = replacementStep(
  "sr-field-select-connected-sign",
  rootedScale,
  rootedScale.right,
  psi,
  "On the stated positive branch, √(ψ(v)²) = ψ(v).",
  {
    r0: "The positive square root of the squared factor is the factor itself.",
    r1: "Use ψ(v) > 0 to replace √(ψ(v)²) by ψ(v). The left side is still √1, so no negative branch has been silently discarded.",
    r2: "For an arbitrary real number, √(ψ²) is |ψ|. The preceding continuity argument established positivity throughout the allowed speed interval. That is the specific reason absolute value can be removed here. The physical identity normalization, not the vacuum equations alone, selects the sign.",
  },
  {
    tool: "foundation:bridge-squaring-square-roots",
    sourceAnchor: "sr-field-source-normalized",
    premiseRefs: [teaching("sr-field-continuity-identity-normalization")],
  },
);
const unitScale = replacementStep(
  "sr-field-unit-scale",
  connectedSign.to,
  rootedScale.left,
  num(1),
  "The positive square root of one is one.",
  {
    r0: "The common factor is one, leaving all six printed field transformations.",
    r1: "Simplify √1 to obtain 1 = ψ(v). Put that value into all six field-identification equations. Components parallel to the motion remain X′ = X and L′ = L; the other four mix electric and magnetic fields with β and v/V.",
    r2: "The normalization is now complete within the local linear common-factor ansatz. Its ingredients were the six vacuum equations, the §3 coordinate map, physical identification of the fields, inverse consistency, spatial symmetry, and continuity at the identity. No electromagnetic field tensor or invariant was used as a historical premise. The modern SI versions below require a unit conversion as well as the notational changes V to c and β to γ.",
  },
  {
    tool: "foundation:bridge-squaring-square-roots",
    sourceAnchor: "sr-field-source-normalized",
    premiseRefs: [teaching("sr-field-continuity-identity-normalization")],
  },
);

export const srFieldNormalizationDerivation = chain(
  "normalization",
  [
    identifyScale,
    returnToOriginal,
    reciprocalStep,
    evenScale,
    squareScale,
    positiveBranch,
    connectedSign,
    unitScale,
  ],
  [
    historical("sr-field-common-factor-ansatz"),
    historical("sr-relativity-same-inverse-law"),
    historical("sr-field-spatial-symmetry-pure-magnetic-example"),
    teaching("sr-field-continuity-identity-normalization"),
  ],
);

export const srFieldTransformDerivations: readonly DerivationChain[] = [
  chain(
    "time-operator",
    [timeCoefficient, timeMixing],
    [historical("sr-section-3-coordinate-map")],
  ),
  chain(
    "space-operator",
    [spaceMixing, spaceCoefficient],
    [historical("sr-section-3-coordinate-map")],
  ),
  ...srFieldComponentRows.map((row) => row.chain),
  srFieldNormalizationDerivation,
];

const siGlyphs: Readonly<Record<string, string>> = {
  electricFieldStationary: "E",
  electricFieldMoving: "E'",
  magneticFieldStationary: "B",
  magneticFieldMoving: "B'",
  lorentzFactor: "γ",
  frameSpeed: "v",
  speedOfLight: "c",
};
export function projectSRFieldSIExpression(record: {
  readonly id: string;
  readonly tree: Expression;
}): Expression {
  return projectDerivationSymbols(record.tree, (binding) => {
    const glyph = siGlyphs[binding.quantityId];
    if (!glyph) {
      throw new SRFieldTransformError(
        "sr-field-unknown-si-symbol",
        `No SI field glyph for ${binding.quantityId}.`,
        record.id,
      );
    }
    return glyph;
  });
}
export const srFieldSIEquations = [exRecord, eyRecord, ezRecord, bxRecord, byRecord, bzRecord].map(
  (record) => ({
    id: record.id,
    tree: projectSRFieldSIExpression({ id: record.id, tree: record.tree as Expression }),
  }),
);

/**
 * The scientific trees retain vector component indices. In the source display,
 * X already means the x component (and ξ already is a coordinate component), so
 * printing X_x would invent a second index. This local presentation projection
 * leaves the stored trees and canonical SI index notation untouched.
 */
export function srFieldSourceDisplayExpression(expression: Expression): Expression {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const source = value as Record<string, unknown>;
    const projected = Object.fromEntries(
      Object.entries(source).map(([key, child]) => [key, visit(child)]),
    );
    if (source.kind === "symbol" && typeof source.index === "string") {
      const { index: _component, ...withoutPrintedIndex } = projected;
      return withoutPrintedIndex;
    }
    return projected;
  };
  return visit(expression) as Expression;
}
export function srFieldSourceDisplayChain(source: DerivationChain): DerivationChain {
  return {
    ...source,
    steps: source.steps.map((step) => ({
      ...step,
      from: srFieldSourceDisplayExpression(step.from),
      to: srFieldSourceDisplayExpression(step.to),
    })),
  };
}

export const srFieldTransformMetadata = {
  paper: "special-relativity",
  section: "s6",
  argument: "arg-sr-field-components",
  review: "draft",
  notation: "original",
  unitSystem: "gaussian-historical",
  historicalStatus: "source-order-reconstruction",
  modelStatus: "vacuum-maxwell-hertz-constant-boost",
  executionStatus: "static-illustration",
  sourceEquationIds: [
    "eq-s6-d1",
    "eq-s6-d2",
    "eq-s6-d3",
    "eq-s6-d4",
    "eq-s6-d5",
    "eq-s6-d6",
    "eq-s6-d7",
    "eq-s6-d8",
    "eq-s6-d9",
  ],
} as const;
export const srFieldHistoricalReading = {
  r3: "Einstein's §6 first rewrites the six vacuum Maxwell–Hertz curl equations using the coordinate transformation of §3. It next compares the regrouped functions with the fields measured in the moving system, introduces a common factor, and fixes it by an inverse transformation and a spatial-symmetry example. This reconstruction exposes the derivative algebra, the vacuum divergence conditions and the continuity choice for the sign. The identification of fields is a physical step; equal differential form by itself is not a uniqueness theorem. The source's V and β mean the speed of light and Lorentz factor. SI component equations shown separately are a modern unit mapping, not an added historical premise.",
  r3Citations: [
    "Einstein, Zur Elektrodynamik bewegter Körper (1905), §6, pp. 907–910; coordinate transformation in §3, pp. 899–902.",
  ],
} as const;
export function srFieldTransformReadingSet(step: DerivationStep) {
  return { ...step.reasons, ...srFieldHistoricalReading };
}
