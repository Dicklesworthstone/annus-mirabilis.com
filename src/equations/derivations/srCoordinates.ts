/**
 * SR §3, two deliberately distinct routes through the coordinate transformation.
 *
 * These are authored, unreviewed explanations. A rule's structural check establishes
 * the indicated substitution, not the physical premises or historical interpretation.
 * Canonical equation records own the final, inverse, and one-parameter maps. Numerical
 * checks belong to the existing kinematics reference owner, never to this manuscript.
 */

import inversePositionRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-position.json";
import inverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-lorentz-factor.json";
import ansatzPositionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-ansatz-position.json";
import ansatzTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-ansatz-time.json";
import positionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import timeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import { type Expression, nodeId, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import {
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  type FoundationToolId,
  type PremiseRef,
  type RuleApplication,
  type StepReadings,
} from "./types.ts";

type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
export type SRCoordinateNotation = "source" | "modern";
export type SRCoordinateRefusalCode =
  | "sr-coordinate-missing-glyph"
  | "sr-coordinate-unaddressable-substitution";
export class SRCoordinateError extends DerivationSchemaError {
  constructor(
    readonly code: SRCoordinateRefusalCode,
    message: string,
    path: string,
  ) {
    super(message, path);
  }
}

const symbol = (
  quantityId: string,
  suffix = "",
  fields: Partial<SymbolExpression> = {},
): SymbolExpression => ({
  kind: "symbol",
  quantityId,
  termId: quantityId + suffix,
  ...fields,
});
const one: Expression = { kind: "number", value: "1" };
const zero: Expression = { kind: "number", value: "0" };
const two: Expression = { kind: "number", value: "2" };
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const mul = (...args: Expression[]): Expression => ({ kind: "product", args });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const sub = (a: Expression, b: Expression): Expression => sum(a, neg(b));
const div = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const sq = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const root = (radicand: Expression): Expression => ({ kind: "root", radicand, degree: 2 });
const eq = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: `sr-coordinate.op.${id}`,
});
const named = (tree: Expression, id: string): Expression =>
  ({ ...tree, opId: `sr-coordinate.op.${id}` }) as Expression;
const x = symbol("coordinatePositionStationary");
const y = symbol("coordinatePositionStationary", ".y", { index: "y" });
const z = symbol("coordinatePositionStationary", ".z", { index: "z" });
const t = symbol("coordinateTimeStationary");
const X = symbol("coordinatePositionMoving");
const Y = symbol("coordinatePositionMoving", ".y", { index: "y" });
const Z = symbol("coordinatePositionMoving", ".z", { index: "z" });
const T = symbol("coordinateTimeMoving");
const v = symbol("frameSpeed");
const c = symbol("speedOfLight");
const g = symbol("lorentzFactor");
const q = symbol("auxiliaryGalileanCoordinate");
const A = symbol("transformationCoefficientA");
const phi = symbol("scaleFactorUnknown", ".plus", { at: v });
const phiMinus = symbol("scaleFactorUnknown", ".minus", { at: neg(v) });
const a = symbol("ansatzSpatialScale", ".plus", { at: v });
const aMinus = symbol("ansatzSpatialScale", ".minus", { at: neg(v) });
const b = symbol("ansatzTimeScale", "", { at: v });
const d = symbol("ansatzTimeSpaceCoefficient", "", { at: v });
const transverseScale = symbol("ansatzTransverseScale");
const length = symbol("lengthProper");
const c2 = sq(c);
const difference = sub(c2, sq(v));
const delta = sub(one, div(sq(v), c2));
const w = root(difference);
const shiftX = sub(x, mul(v, t));

/** Reuse canonical trees; only the ansatz record's old broad coefficient is rebound
 * to the already-registered, distinct pedagogical ansatz quantity. */
function canonical(record: { readonly tree: unknown }, ansatz = false): Relation {
  const tree = projectDerivationSymbols(record.tree as Expression, (s) =>
    ansatz && s.quantityId === "transformationCoefficientA" ? a.termId : s.quantityId,
  );
  const replace = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(replace);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (ansatz && obj.kind === "symbol" && obj.quantityId === "transformationCoefficientA")
        return a;
      return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, replace(value)]));
    }
    return node;
  };
  return replace(tree) as Relation;
}
const finalX = canonical(positionRecord);
const finalT = canonical(timeRecord);
const inverseX = canonical(inversePositionRecord);
const inverseT = canonical(inverseTimeRecord);
const gammaDefinition = canonical(factorRecord);
const familyX = canonical(ansatzPositionRecord, true);
const familyT = canonical(ansatzTimeRecord, true);
const finalY = eq(Y, y, "final-y");
const finalZ = eq(Z, z, "final-z");
const commonScale = named(mul(phi, g), "common-longitudinal-scale");
const scaledX = substituteNode(finalX, g.termId, commonScale) as Relation;
const scaledT = substituteNode(finalT, g.termId, commonScale) as Relation;
const scaledY = eq(Y, named(mul(phi, y), "scaled-side-y"), "scaled-y");
const scaledZ = eq(Z, named(mul(phi, z), "scaled-side-z"), "scaled-z");

const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const foundations = {
  algebra: "foundation:bridge-fractions-ratios",
  frames: "foundation:frames-events",
  roots: "foundation:bridge-squaring-square-roots",
  calculus: "foundation:partial-derivatives",
  taylor: "foundation:taylor-expansion",
  linear: "foundation:matrices-linear-maps",
} satisfies Readonly<Record<string, FoundationToolId>>;
const sourcePremises = [
  historical("sr-common-origin-identical-rods-clocks"),
  historical("sr-linearity-from-homogeneity"),
  historical("arg-sr-synchronization"),
  historical("sr-positive-light-speed-subluminal-frame"),
];
const transversePremises = [
  historical("sr-axis-normalization"),
  historical("sr-spatial-symmetry"),
  historical("sr-transverse-light-propagation"),
];
const branchPremise = teaching("sr-continuous-positive-identity-branch");
const readings = (r0: string, r1: string, r2: string): StepReadings => ({ r0, r1, r2 });
function step(
  id: string,
  from: Expression,
  to: Expression,
  rule: RuleApplication,
  reasons: StepReadings,
  tool: FoundationToolId,
  sourceAnchor: string,
  options: Partial<
    Pick<
      DerivationStep,
      "premiseRefs" | "isMove" | "moveLabel" | "reasonKind" | "approximation" | "layout"
    >
  > = {},
): DerivationStep {
  const explicit =
    rule.kind === "substitute" && typeof rule.params.targetId === "string"
      ? [rule.params.targetId]
      : [nodeId(from), nodeId(to)].filter((id): id is string => id !== null);
  return {
    id,
    from,
    to,
    rule,
    reasons,
    tool,
    sourceAnchor,
    changedSubexpressionIds: explicit.length ? explicit : [v.termId],
    reasonKind: "algebra",
    isMove: false,
    historicalStatus: "source-order-reconstruction",
    modelStatus: "exact-within-stated-assumptions",
    verification: { status: "authored-unverified" },
    premiseRefs: sourcePremises,
    ...options,
  };
}
function arithmetic(
  operation: "add" | "subtract" | "multiply" | "divide",
  quantity: Expression,
  nonzeroCondition?: string,
): RuleApplication {
  return {
    kind: "add-subtract-multiply-divide",
    params: { operation, quantity, ...(nonzeroCondition ? { nonzeroCondition } : {}) },
  };
}
export function srCoordinateSubstitution(
  target: Expression,
  replacement: Expression,
  citedEquality: string,
): RuleApplication {
  const targetId = nodeId(target);
  if (!targetId)
    throw new SRCoordinateError(
      "sr-coordinate-unaddressable-substitution",
      "A substitution must name an actual subtree.",
      "sr-coordinates.substitution",
    );
  return { kind: "substitute", params: { targetId, replacement, citedEquality } };
}
const collect: RuleApplication = { kind: "collect", params: {} };
const sqrtRule = (condition: string): RuleApplication => ({
  kind: "monotonic-function",
  params: {
    function: "square-root",
    domain: "Both sides are nonnegative on |v| < c, c > 0.",
    branch: "positive",
    branchCondition: condition,
  },
});
function chain(id: string, steps: readonly DerivationStep[], modern = false): DerivationChain {
  return {
    id: `chain-sr-coordinate-${id}`,
    proofRouteId: modern
      ? "route-sr-coordinate-linear-reconstruction"
      : "route-sr-coordinate-source-synchronization",
    routeKind: modern ? "pedagogical-reconstruction" : "source-order",
    entryAssumptions: sourcePremises,
    target: `sr-coordinate-result-${id}`,
    targetStepId: steps.at(-1)?.id,
    essentialForPrint: true,
    steps: modern
      ? steps.map((s) => ({ ...s, historicalStatus: "pedagogical-reconstruction" }))
      : steps,
  };
}

const timeAt = (...args: Expression[]): SymbolExpression =>
  symbol(
    "coordinateTimeMoving",
    `.at.${JSON.stringify(args, (key, value) => (key === "opId" ? undefined : value))}`,
    { args },
  );
const tau0 = symbol("coordinateTimeMoving", ".departure", { index: "0" });
const tau1 = symbol("coordinateTimeMoving", ".reflection", { index: "1" });
const tau2 = symbol("coordinateTimeMoving", ".return", { index: "2" });
const departure = timeAt(zero, zero, zero, t);
const outwardTime = sum(t, div(q, sub(c, v)));
const returnTime = sum(t, div(q, sub(c, v)), div(q, sum(c, v)));
const reflection = timeAt(q, zero, zero, outwardTime);
const returned = timeAt(zero, zero, zero, returnTime);
const midpoint = eq(div(sum(tau0, tau2), two), tau1, "midpoint");
const withDeparture = substituteNode(midpoint, tau0.termId, departure);
const withReturn = substituteNode(withDeparture, tau2.termId, returned);
const functional = substituteNode(withReturn, tau1.termId, reflection);
const partial = (variable: Expression): Expression => ({
  kind: "derivative",
  expression: T,
  variable,
  order: 1,
  partial: true,
  opId: `sr-coordinate.op.partial-${nodeId(variable)}`,
});
const dt = partial(t);
const dq = partial(q);
const coefficientEquation = eq(
  mul(div(sum(div(one, sub(c, v)), div(one, sum(c, v))), two), dt),
  sum(dq, mul(div(one, sub(c, v)), dt)),
  "differentiated-synchronization",
);
const pde = eq(sum(dq, mul(div(v, difference), dt)), zero, "time-pde");
const timeAux = eq(T, mul(A, sub(t, div(mul(v, q), difference))), "time-auxiliary");

const sourceSynchronization = chain("source-synchronization", [
  step(
    "sr-coordinate-source-departure",
    midpoint,
    withDeparture,
    srCoordinateSubstitution(tau0, departure, "The departure event is (x′,y,z,t) = (0,0,0,t)."),
    readings(
      "Assign the first moving-clock reading to the emission event.",
      "The midpoint convention compares three readings of clocks at rest in k. The departure clock is at the moving origin, where the auxiliary coordinate x′ = x − vt is zero.",
      "Keep the coordinate labels distinct. Einstein’s x′ means x − vt, a distance measured with K’s coordinates from k’s moving origin; ξ is the actual moving-frame coordinate. At emission the event has auxiliary coordinates (0,0,0,t), so τ₀ is the value τ(0,0,0,t). Replacing this event value does not assume any transformation formula for τ.",
    ),
    foundations.frames,
    "sr-coordinate-source-sync",
  ),
  step(
    "sr-coordinate-source-return",
    withDeparture,
    withReturn,
    srCoordinateSubstitution(
      tau2,
      returned,
      "Outward and return flight times in K are x′/(V−v) and x′/(V+v).",
    ),
    readings(
      "Use the two different travel times measured in the stationary frame.",
      "The outward ray catches a receding endpoint at relative speed V − v; the return ray meets the origin at relative speed V + v. Add both times to t.",
      "For the outward leg, VΔt = x′ + vΔt gives Δt = x′/(V − v). For the return leg, the light and origin approach one another, giving Δt = x′/(V + v). These are K-coordinate travel times, not a claim that either frame measures a different local light speed. The return event lies again at auxiliary coordinate zero. The subluminal assumption keeps both denominators positive for a positive outward separation.",
    ),
    foundations.frames,
    "sr-coordinate-source-functional",
  ),
  step(
    "sr-coordinate-source-functional-equation",
    withReturn,
    functional,
    srCoordinateSubstitution(
      tau1,
      reflection,
      "The reflection event has auxiliary coordinate x′ and K time t+x′/(V−v).",
    ),
    readings(
      "Express the moving frame’s synchronization rule using the stationary frame’s light journeys.",
      "Replace the reflection reading by τ(x′,0,0,t + x′/(V − v)). The midpoint rule has now become an equation constraining the unknown function τ of the event coordinates.",
      "The reflector remains at a fixed auxiliary x′ because it is at rest in k. The reflection occurs after the outward flight, while the other two τ values refer to the origin. Thus one-half of the departure and return readings equals the reflection reading. This is the decisive connection: a clock-setting convention in k is expressed through light paths whose speed in K is V. No Lorentz factor or invariant interval has been used.",
    ),
    foundations.frames,
    "sr-coordinate-source-functional",
    {
      reasonKind: "physical-premise",
      isMove: true,
      moveLabel: "Use K’s light paths to constrain k’s synchronized time function.",
    },
  ),
  step(
    "sr-coordinate-source-differentiate",
    functional,
    coefficientEquation,
    {
      kind: "differentiate",
      params: { variable: q.termId, heldFixed: [t.termId, v.termId, c.termId], order: 1 },
    },
    readings(
      "Compare the first-order changes when the reflector is very close to the origin.",
      "Differentiate with respect to the auxiliary separation at x′ = 0, holding t and v fixed. The common τ(0,0,0,t) terms cancel; the chain rule retains both a spatial and a time derivative.",
      "Write τ₀ = τ(0,0,0,t). The left side expands as τ₀ + (x′/2)[1/(V−v)+1/(V+v)]τ_t + O(x′²). The right side is τ₀ + x′τ_x′ + x′τ_t/(V−v) + O(x′²). Subtract τ₀, divide by nonzero x′, and take x′→0. Smoothness supplies the derivative limit; under the separate linearity premise the higher terms vanish identically. The displayed differential equation is exact at that limit, not a finite-distance Taylor approximation.",
    ),
    foundations.taylor,
    "sr-coordinate-source-differential",
    { reasonKind: "calculus" },
  ),
  step(
    "sr-coordinate-source-time-constraint",
    coefficientEquation,
    pde,
    arithmetic("subtract", coefficientEquation.left),
    readings(
      "The clock’s position dependence is tied to its time dependence.",
      "Move the common time-derivative term to the right. The remaining coefficient is one-half of 1/(V − v) minus 1/(V + v), which is v/(V² − v²).",
      "Subtract the entire left side from the right. The coefficient of τ_t becomes 1/(V−v) − ½[1/(V−v)+1/(V+v)] = ½[1/(V−v)−1/(V+v)]. Taking a common denominator gives ½[(V+v)−(V−v)]/(V²−v²) = v/(V²−v²). Hence τ_x′ + [v/(V²−v²)]τ_t = 0. The same experiment can start at any event, so homogeneity extends the constraint beyond the origin.",
    ),
    foundations.calculus,
    "sr-coordinate-source-pde",
  ),
]);

const triangle = eq(mul(c2, sq(t)), sum(mul(sq(v), sq(t)), sq(y)), "ray-triangle");
const flightSquared = eq(sq(t), div(sq(y), difference), "sideways-flight-squared");
const flightRoots = eq(
  root(flightSquared.left),
  root(flightSquared.right),
  "sideways-flight-roots",
);
const flight = eq(t, div(y, w), "sideways-flight");
const sidewaysFunctional = eq(
  div(sum(departure, timeAt(zero, zero, zero, sum(t, div(mul(two, y), w)))), two),
  timeAt(zero, y, zero, sum(t, div(y, w))),
  "sideways-synchronization",
);
const noSideTime = eq(partial(y), zero, "no-sideways-time");
const sourceClocks = chain("source-clocks", [
  step(
    "sr-coordinate-source-transverse-triangle",
    triangle,
    flightSquared,
    arithmetic("divide", difference, "V²−v² > 0; subtract v²t² first."),
    readings(
      "A light ray following the moving sideways axis makes a right triangle in K.",
      "The ray must move horizontally by vt while crossing the sideways separation y. Its total distance is Vt, so V²t² = v²t² + y². Rearrangement gives the crossing time squared.",
      "The endpoint remains on k’s y axis, so its K position changes by vt during the flight. The perpendicular displacement is y. Pythagoras therefore gives (Vt)² = (vt)² + y², with no transverse transformation assumed. Subtract v²t² and divide by V²−v², positive for |v|<V. This derives the transverse component of the ray’s K velocity; it cannot be replaced by the unsupported assertion that the ray travels sideways at V in K.",
    ),
    foundations.roots,
    "sr-coordinate-source-sideways",
    { premiseRefs: [...sourcePremises, ...transversePremises], reasonKind: "physical-premise" },
  ),
  step(
    "sr-coordinate-source-transverse-root",
    flightSquared,
    flightRoots,
    sqrtRule("Use the future-directed flight with t≥0 and choose the positive y axis."),
    readings(
      "Choose the future-directed flight along the positive sideways axis.",
      "Take the positive square root of both nonnegative sides. The experiment chooses t ≥ 0 and y ≥ 0; a ray in the opposite direction uses the absolute value of y.",
      "A squared equation alone does not choose a time direction. We take the forward flight, so √(t²)=t. With the reflector on the positive y axis, √(y²)=y; reversing the axis would require |y| in the travel time. The square root of V²−v² is real and positive because the frame is subluminal. The branch is an explicit condition of the experiment, not a conclusion extracted from squaring.",
    ),
    foundations.roots,
    "sr-coordinate-source-sideways",
    { premiseRefs: [...transversePremises, branchPremise] },
  ),
  step(
    "sr-coordinate-source-transverse-flight",
    flightRoots,
    flight,
    arithmetic("multiply", one),
    readings(
      "The transverse component of the ray’s K velocity is √(V² − v²).",
      "Simplify the positive roots to t = y/√(V² − v²). Both the outward and return sideways legs take this time because reversing y leaves the horizontal catching motion unchanged.",
      "On the stated positive branch, √[y²/(V²−v²)] = y/√(V²−v²), and √(t²)=t. Thus y/t = √(V²−v²). A negative y experiment has the same elapsed time for the same absolute separation. Axis normalization and spatial symmetry let us repeat this geometry along z. This is a light-travel calculation in K; it has not yet established η=y or ζ=z.",
    ),
    foundations.roots,
    "sr-coordinate-source-sideways",
    { premiseRefs: [...transversePremises, branchPremise] },
  ),
  step(
    "sr-coordinate-source-transverse-clock-gradient",
    sidewaysFunctional,
    noSideTime,
    {
      kind: "differentiate",
      params: { variable: y.termId, heldFixed: [t.termId, v.termId, c.termId] },
    },
    readings(
      "Equal sideways flight times leave no sideways clock offset.",
      "Apply the midpoint convention to the equal sideways legs and differentiate at y = 0. The identical time-derivative contributions cancel, leaving ∂τ/∂y = 0; repeating the construction along z gives ∂τ/∂z = 0.",
      "Set w=√(V²−v²), the just-derived K transverse speed. The midpoint equation is ½[τ(0,0,0,t)+τ(0,0,0,t+2y/w)] = τ(0,y,0,t+y/w). Its first-order terms are τ_t/w on the left and τ_y+τ_t/w on the right, so τ_y=0. Interchanging the equally normalized y and z axes gives τ_z=0 by the same calculation. These cancellations remove two coefficients of the linear time map; they do not assume the final transverse coordinate equations.",
    ),
    foundations.calculus,
    "sr-coordinate-source-sideways-clocks",
    { premiseRefs: [...sourcePremises, ...transversePremises], reasonKind: "calculus" },
  ),
  step(
    "sr-coordinate-source-linear-time",
    pde,
    timeAux,
    {
      kind: "integrate",
      params: {
        variable: q.termId,
        boundaryCondition:
          "Linearity, τ_y=τ_z=0, and τ(0,0,0,0)=0; the time slope a(v) remains free.",
      },
    },
    readings(
      "Linearity leaves one unknown multiplier in the moving time.",
      "Write the linear time function as a t + Bx′ + Cy + Dz plus a constant. The sideways equations give C=D=0, the common origin fixes the constant, and the differential constraint fixes B = −av/(V²−v²).",
      "Homogeneity and inertial-coordinate conventions motivate linearity; we retain that as a premise. Then τ_t=a and τ_x′=B are constant at fixed v. Substitution into the earlier differential constraint yields B=−av/(V²−v²). The sideways synchronization calculations eliminate C and D, and choosing both origins’ zero event makes the additive constant zero. Integrating gives the displayed τ. The multiplier a is still an arbitrary function of frame speed. Assigning it the Lorentz factor here would assume the normalization we have yet to derive.",
    ),
    foundations.linear,
    "sr-coordinate-source-linear-time-reference",
    {
      reasonKind: "boundary-condition",
      premiseRefs: [
        ...sourcePremises,
        historical("sr-coordinate-source-time-constraint"),
        historical("sr-coordinate-source-transverse-clock-gradient"),
      ],
    },
  ),
]);

const alongX = eq(X, mul(c, T), "longitudinal-light");
const alongXTime = substituteNode(alongX, T.termId, timeAux.right);
const alongXFlight = substituteNode(alongXTime, t.termId, div(q, sub(c, v)));
const sourceX = eq(X, mul(A, div(c2, difference), q), "source-x-auxiliary");
const alongY = eq(Y, mul(c, T), "sideways-light");
const alongYTime = eq(Y, mul(c, mul(A, t)), "sideways-time");
const sourceY = eq(Y, mul(c, mul(A, div(y, w))), "source-y");
const alongZ = eq(Z, mul(c, T), "z-light");
const sourceZ = eq(Z, mul(c, mul(A, div(z, w))), "source-z");
const sourceRays = chain("source-rays", [
  step(
    "sr-coordinate-source-longitudinal-time",
    alongX,
    alongXTime,
    srCoordinateSubstitution(
      T,
      timeAux.right,
      "The synchronized linear time just obtained is τ=a[t−vx′/(V²−v²)].",
    ),
    readings(
      "Use the synchronized time to locate a light ray in k.",
      "For a ray along the positive moving x axis, ξ = Vτ. Substitute the time function, retaining the unknown a. Light’s speed in k supplies this coordinate relation.",
      "Start with the same physical ray described by the moving system. Because the origins coincide at emission and the ray travels along ξ at speed V, its position is ξ=Vτ. Replacing only τ by the function derived from synchronization gives the next expression. The relation ξ=Vτ applies to this ray, while linearity will determine the position coefficient for every event. The scale has still not been chosen.",
    ),
    foundations.frames,
    "sr-coordinate-source-longitudinal",
  ),
  step(
    "sr-coordinate-source-longitudinal-flight",
    alongXTime,
    alongXFlight,
    srCoordinateSubstitution(
      t,
      div(q, sub(c, v)),
      "Along this emitted ray x=Vt, so x′=x−vt=(V−v)t.",
    ),
    readings(
      "Evaluate that time function on the longitudinal light path.",
      "The emitted ray has x=Vt in K. Therefore its auxiliary coordinate is x′=(V−v)t and t=x′/(V−v); substitute this value of t into the ray equation.",
      "This substitution uses a trajectory condition, not a formula for arbitrary events: for the selected ray, x=Vt and x′=x−vt. Since V−v is nonzero in the admitted domain, solve for t. The calculation determines the coefficient multiplying x′. Homogeneity and the moving origin’s zero position then extend that linear spatial map to all events. Distinguishing the ray used to determine a coefficient from the map’s eventual domain avoids treating every event as a light event.",
    ),
    foundations.frames,
    "sr-coordinate-source-longitudinal",
  ),
  step(
    "sr-coordinate-source-longitudinal-coefficient",
    alongXFlight,
    sourceX,
    collect,
    readings(
      "The longitudinal coefficient is aV²/(V² − v²).",
      "Combine 1/(V−v) − v/(V²−v²) into V/(V²−v²), then multiply by the outer V. The unknown a remains attached to the result.",
      "Use (V−v)(V+v)=V²−v². Thus 1/(V−v)=(V+v)/(V²−v²); subtracting v/(V²−v²) leaves V/(V²−v²). The outer factor aV supplies another V, giving ξ=aV²x′/(V²−v²). Because ξ vanishes at the moving origin and depends linearly on the auxiliary position, this coefficient specifies the longitudinal coordinate map, not merely the location of the particular light ray.",
    ),
    foundations.algebra,
    "sr-coordinate-source-longitudinal",
  ),
  step(
    "sr-coordinate-source-transverse-time",
    alongY,
    alongYTime,
    srCoordinateSubstitution(
      T,
      mul(A, t),
      "On the moving y axis x′=0, so the established time map gives τ=at.",
    ),
    readings(
      "On the moving sideways axis, the position-dependent time term vanishes.",
      "A ray along η stays at auxiliary x′=0. The time map therefore becomes τ=at; substitute it into η=Vτ, keeping the undetermined scale visible.",
      "The sideways axis moves horizontally through K, so x=vt and x′=x−vt=0 along the ray. Setting this auxiliary coordinate to zero in the established time expression removes its position term, leaving τ=at. The light postulate in k then supplies η=Vτ. This is why the earlier right-triangle crossing time matters: a transverse light ray in k is not a ray with x=0 in K.",
    ),
    foundations.frames,
    "sr-coordinate-source-sideways",
    { premiseRefs: [...sourcePremises, ...transversePremises] },
  ),
  step(
    "sr-coordinate-source-transverse-position",
    alongYTime,
    sourceY,
    srCoordinateSubstitution(
      t,
      div(y, w),
      "The right-triangle light calculation gives t=y/√(V²−v²).",
    ),
    readings(
      "The sideways position coefficient is aV/√(V² − v²).",
      "Insert the crossing time from the right triangle into η=aVt. This gives η=[aV/√(V²−v²)]y rather than assuming η=y at the outset.",
      "The previous geometry supplies the K travel time t=y/√(V²−v²) for a positive sideways separation. Multiplication by aV gives the displayed coefficient. Reflection of the y axis extends the same linear map to negative y; this uses the stated spatial-symmetry and normalization assumptions. Its coefficient differs from the longitudinal coefficient by one factor V/√(V²−v²), so there is no basis for copying the longitudinal formula onto the transverse direction.",
    ),
    foundations.frames,
    "sr-coordinate-source-sideways",
    { premiseRefs: [...sourcePremises, ...transversePremises] },
  ),
  step(
    "sr-coordinate-source-transverse-z",
    alongZ,
    sourceZ,
    srCoordinateSubstitution(
      T,
      mul(A, div(z, w)),
      "Repeat the equally normalized sideways-ray construction along z: x′=0 and τ=az/√(V²−v²).",
    ),
    readings(
      "The same sideways construction determines the other transverse coordinate.",
      "Interchange the y and z axes in the ray experiment. Their identical normalization and spatial symmetry give the same coefficient for ζ; no unchanged transverse length has been presumed.",
      "For the positive z ray, (Vt)²=(vt)²+z², so t=z/√(V²−v²) on the future-directed branch. It lies at x′=0, hence τ=at. Finally ζ=Vτ gives ζ=[aV/√(V²−v²)]z. This repeats the actual light-travel argument rather than borrowing ζ=z from the desired result. The y and z coefficients agree because the axes are equally normalized and the setup is symmetric under rotations around the direction of motion.",
    ),
    foundations.frames,
    "sr-coordinate-source-sideways",
    { premiseRefs: [...sourcePremises, ...transversePremises] },
  ),
]);

const sourceLongScale = named(mul(A, div(c2, difference)), "source-longitudinal-scale");
const sourceSideScale = named(mul(A, div(c, w)), "source-sideways-scale");
const timeStationary = substituteNode(timeAux, q.termId, shiftX);
const timeFactored = eq(
  T,
  mul(
    sourceLongScale,
    (finalT.right as Extract<Expression, { kind: "sum" | "product" }>).args[1] as Expression,
  ),
  "time-factored",
);
const positionStationary = substituteNode(sourceX, q.termId, shiftX);
const positionFactored = eq(
  X,
  mul(
    sourceLongScale,
    (finalX.right as Extract<Expression, { kind: "sum" | "product" }>).args[1] as Expression,
  ),
  "position-factored",
);
const yFactored = eq(Y, mul(sourceSideScale, y), "y-factored");
const zFactored = eq(Z, mul(sourceSideScale, z), "z-factored");
const sourceScale = chain("source-common-scale", [
  step(
    "sr-coordinate-source-replace-auxiliary",
    timeAux,
    timeStationary,
    srCoordinateSubstitution(
      q,
      shiftX,
      "The auxiliary coordinate is defined by x′=x−vt; it is not ξ.",
    ),
    readings(
      "Return from the auxiliary coordinate to K’s ordinary coordinates.",
      "Replace x′ by x−vt in the time equation. This auxiliary substitution does not rename ξ: ξ remains the moving system’s measured coordinate.",
      "The auxiliary x′ was introduced only to label positions fixed in k while solving the synchronization condition. Its definition x′=x−vt is valid for every event. Inserting it produces a[t−v(x−vt)/(V²−v²)]. The two appearances of t must now be combined; omitting the second one would lose a factor and confuse the source’s a with the later common scale.",
    ),
    foundations.algebra,
    "sr-coordinate-source-common-scale",
  ),
  step(
    "sr-coordinate-source-factor-time",
    timeStationary,
    timeFactored,
    collect,
    readings(
      "Combining the time terms exposes the same longitudinal multiplier.",
      "The coefficient of t is 1+v²/(V²−v²)=V²/(V²−v²). Factoring it gives [aV²/(V²−v²)](t−vx/V²).",
      "Expand the bracket as t−vx/(V²−v²)+v²t/(V²−v²). The two time terms sum to V²t/(V²−v²). Pull aV²/(V²−v²) outside; the remaining position term is −vx/V². This is the source time map written in K coordinates, still with the unknown multiplier a. It has the same overall longitudinal coefficient as ξ, which is why one common scale can organize both equations.",
    ),
    foundations.algebra,
    "sr-coordinate-source-common-scale",
  ),
  step(
    "sr-coordinate-source-name-common-scale",
    timeFactored,
    scaledT,
    srCoordinateSubstitution(
      sourceLongScale,
      commonScale,
      "Define β=V/√(V²−v²) and φ=aβ, so aV²/(V²−v²)=aβ²=φβ.",
    ),
    readings(
      "Separate the known speed factor from the still-unknown scale.",
      "Define β=V/√(V²−v²) and write φ=aβ. Then aV²/(V²−v²)=φβ. The source β is the modern γ, and φ is still undetermined.",
      "Since V>0, β=V/√(V²−v²) equals 1/√(1−v²/V²). The longitudinal multiplier is aβ², while the transverse multiplier is aβ. Calling the latter φ organizes the full map as τ=φβ(t−vx/V²), ξ=φβ(x−vt), η=φy, ζ=φz. This bookkeeping explicitly distinguishes a from φ: the source prose uses φ for an unknown function at both stages, and we do not silently identify those two coefficients.",
    ),
    foundations.roots,
    "sr-coordinate-source-common-scale",
    { reasonKind: "definition" },
  ),
  step(
    "sr-coordinate-source-position-in-K",
    positionStationary,
    positionFactored,
    collect,
    readings(
      "The longitudinal position has the same coefficient as time.",
      "With x′=x−vt, regroup ξ=aV²(x−vt)/(V²−v²) so its common multiplier is aV²/(V²−v²), exactly as in the time equation.",
      "The auxiliary-coordinate position formula already determined the coefficient of x′. Replace that auxiliary variable by its defining x−vt and group the constant factors. This is a change of coordinates in the expression, not a new physical assumption about ξ. The coefficient matches the one just extracted from τ, so both longitudinal equations retain the same undetermined normalization.",
    ),
    foundations.algebra,
    "sr-coordinate-source-common-scale",
  ),
  step(
    "sr-coordinate-source-scaled-position",
    positionFactored,
    scaledX,
    srCoordinateSubstitution(
      sourceLongScale,
      commonScale,
      "The same definitions give aβ²=φβ in the position equation.",
    ),
    readings(
      "Write the position map using the same still-free φ.",
      "Replace aV²/(V²−v²) by φβ. The light constraints have fixed the space-time mixing, but have left the overall normalization φ visible.",
      "This replacement uses precisely the definition already introduced in the time equation: φ=aβ. No new scale is assigned to ξ. Both longitudinal coordinates are multiplied by φβ, whereas the sideways coordinates will be multiplied only by φ. Light propagation alone is compatible with this whole scaled family, so setting φ=1 at this stage would skip the inverse and symmetry argument.",
    ),
    foundations.algebra,
    "sr-coordinate-source-common-scale",
  ),
  step(
    "sr-coordinate-source-transverse-factor-y",
    sourceY,
    yFactored,
    collect,
    readings(
      "Expose the sideways multiplier already derived from the ray.",
      "Regroup aVy/√(V²−v²) as [aV/√(V²−v²)]y. The coefficient is aβ, with one fewer factor β than the longitudinal map.",
      "The ray calculation produced η=V·a·[y/√(V²−v²)]. Multiplication can be regrouped because the coefficients are constant at a fixed frame speed. The coefficient of y is therefore aV/√(V²−v²)=aβ. Its derivation used the sideways light path and the equal normalization of axes; merely preserving longitudinal light rays would not constrain this multiplier.",
    ),
    foundations.algebra,
    "sr-coordinate-source-sideways",
    { premiseRefs: transversePremises },
  ),
  step(
    "sr-coordinate-source-transverse-scaled-y",
    yFactored,
    scaledY,
    srCoordinateSubstitution(sourceSideScale, phi, "The common scale is φ=aV/√(V²−v²)=aβ."),
    readings(
      "The still-free scale also multiplies the sideways coordinate.",
      "Replace the derived sideways multiplier aβ by φ. The equation is η=φy, so the sideways coordinate is not yet asserted to be unchanged.",
      "The definition φ=aβ was chosen from this same coefficient, not fitted separately to each axis. Substituting it in the established y equation yields η=φy. This makes the remaining freedom especially clear: a rod across the motion would have its measured length scaled by 1/φ. The source will use that measurable consequence, together with reversal symmetry, to fix φ.",
    ),
    foundations.frames,
    "sr-coordinate-source-common-scale",
    { premiseRefs: transversePremises },
  ),
  step(
    "sr-coordinate-source-transverse-factor-z",
    sourceZ,
    zFactored,
    collect,
    readings(
      "The second sideways equation carries the identical derived coefficient.",
      "Regroup ζ=Va z/√(V²−v²) in the same way. The scalar multiplying z is again aβ because the two transverse axes have identical normalization.",
      "The z-ray experiment gave the same crossing-time expression after exchanging y and z. Pulling the fixed factors a and V outside its fraction displays aV/√(V²−v²) as the coefficient of z. The equality of these coefficients follows from the physical symmetry already stated, while their value is still allowed to depend on v. No final value of the transverse scale has entered this regrouping.",
    ),
    foundations.algebra,
    "sr-coordinate-source-sideways",
    { premiseRefs: transversePremises },
  ),
  step(
    "sr-coordinate-source-transverse-scaled-z",
    zFactored,
    scaledZ,
    srCoordinateSubstitution(
      sourceSideScale,
      phi,
      "The same scale definition φ=aβ applies to the equally normalized z axis.",
    ),
    readings(
      "All four equations now display the one remaining freedom.",
      "The map is τ=φβ(t−vx/V²), ξ=φβ(x−vt), η=φy, ζ=φz. The next stage must determine φ rather than introduce another light-speed assumption.",
      "Substitute the already-defined scalar φ for aβ in the z equation. The four coordinates now form a single family of transformations: longitudinal mixing is fixed, and one common dimensionless scale remains. At v=0 the identity convention will select the positive unit normalization. At nonzero v, reciprocal frame changes and spatial symmetry supply the missing constraint; neither a coordinate renaming nor a second copy of a longitudinal light ray supplies it.",
    ),
    foundations.frames,
    "sr-coordinate-source-common-scale",
    { premiseRefs: transversePremises },
  ),
]);

const sourceReturnExpanded = eq(
  mul(phiMinus, g, sum(scaledX.right, mul(v, scaledT.right))),
  x,
  "return-expanded",
);
const gammaCancellation = named(mul(sq(g), delta), "gamma-cancellation");
const sourceReturnFactored = eq(mul(phiMinus, phi, gammaCancellation, x), x, "return-factored");
const sourceReturned = substituteNode(
  sourceReturnFactored,
  nodeId(gammaCancellation) as string,
  one,
);
const inverseScale = eq(mul(phiMinus, phi), one, "inverse-scale");
const rodSymmetry = eq(div(length, phi), div(length, phiMinus), "rod-symmetry");
const scaleEven = eq(phiMinus, phi, "scale-even");
const scaleSame = substituteNode(inverseScale, phiMinus.termId, phi);
const scaleSquared = eq(sq(phi), one, "scale-squared");
const sourcePositiveTarget = named(root(scaleSquared.left), "positive-phi-root");
const scaleRoots = eq(sourcePositiveTarget, root(one), "scale-roots");
const phiPositive = eq(phi, root(one), "scale-positive");
const scaleOne = eq(phi, one, "scale-one");
const sourceNormalizationSteps: readonly DerivationStep[] = [
  step(
    "sr-coordinate-source-inverse-compose",
    sourceReturnExpanded,
    sourceReturnFactored,
    collect,
    readings(
      "Change frames by v, then back by −v, while leaving both scale factors visible.",
      "Insert the scaled forward map into the reverse position formula. The mixed vt terms cancel, leaving φ(−v)φ(v)β²(1−v²/V²)x. The third frame is at rest relative to K.",
      "The reverse transformation has the same functional form by relativity, with speed −v. Since β depends on v², β(−v)=β(v). Expand φ(−v)β[φ(v)β(x−vt)+vφ(v)β(t−vx/V²)]: the −vt and +vt terms cancel, leaving φ(−v)φ(v)β²(1−v²/V²)x. Identifying the equally calibrated third frame with K is the inverse/reciprocity premise. The analogous calculation applies to time and to both transverse coordinates.",
    ),
    foundations.linear,
    "sr-coordinate-source-inverse",
    { premiseRefs: [...sourcePremises, historical("sr-reciprocity-identical-calibration")] },
  ),
  step(
    "sr-coordinate-source-inverse-cancel-speed",
    sourceReturnFactored,
    sourceReturned,
    srCoordinateSubstitution(
      gammaCancellation,
      one,
      "The definition β=1/√(1−v²/V²) gives β²(1−v²/V²)=1.",
    ),
    readings(
      "The known speed factors cancel, leaving only the unknown scales.",
      "Use β²(1−v²/V²)=1, which follows from the definition of β. Returning to the original frame therefore changes x only by φ(−v)φ(v).",
      "The factor β was defined from the subluminal speed, independently of the still-unknown φ. Squaring its definition gives β²=1/(1−v²/V²), so the indicated product is exactly one. Substitute only that product. The remaining multiplier must be one if an identically calibrated frame change followed by its inverse is to return the same coordinate readings. Reciprocity has not by itself made either individual φ equal to one.",
    ),
    foundations.algebra,
    "sr-coordinate-source-inverse",
  ),
  step(
    "sr-coordinate-source-inverse-scale",
    sourceReturned,
    inverseScale,
    arithmetic(
      "divide",
      x,
      "Compare a nonzero coordinate x; the map must hold for every event, including such an event.",
    ),
    readings(
      "Going there and back constrains the product of the two scales.",
      "The composed map must return every x. Compare any nonzero x and divide it out to obtain φ(v)φ(−v)=1. This still permits reciprocal unequal scale factors.",
      "The coefficient comparison can use any event with x≠0, so division is legitimate and the resulting speed-only identity also governs events at x=0. The product φ(v)φ(−v) must equal one, but that does not imply φ(v)=1: a positive function and its reciprocal can satisfy it. A separate statement about reversing the direction of motion is required. This distinction is the reason the source keeps the rod-symmetry step.",
    ),
    foundations.algebra,
    "sr-coordinate-source-inverse",
  ),
  step(
    "sr-coordinate-source-rod-isotropy",
    rodSymmetry,
    scaleEven,
    arithmetic(
      "multiply",
      div(mul(phi, phiMinus), length),
      "The rod has l>0 and the inverse relation excludes zero scale factors.",
    ),
    readings(
      "Reversing the direction of motion cannot change a transverse rod’s length.",
      "A rod of length l along η has length l/φ(v) in K. Spatial isotropy equates this with l/φ(−v); multiplying by φ(v)φ(−v)/l gives φ(v)=φ(−v).",
      "Use the derived equation η=φ(v)y for a rod at rest in k. Equal-K-time endpoint measurements give its transverse length l/φ(v). Reversing the direction v while keeping identical rods and axis calibration cannot alter that transverse length in an isotropic space. Hence l/φ(v)=l/φ(−v). Multiplying both sides by the nonzero product of scales and dividing by l gives the displayed equality. This is an additional physical symmetry premise, not a consequence of the product constraint alone.",
    ),
    foundations.frames,
    "sr-coordinate-source-isotropy",
    {
      reasonKind: "symmetry",
      premiseRefs: [...transversePremises, historical("sr-identical-transverse-rods")],
      isMove: true,
      moveLabel:
        "Use a transverse rod and reversal symmetry to make the two remaining scales equal.",
    },
  ),
  step(
    "sr-coordinate-source-use-isotropy",
    inverseScale,
    scaleSame,
    srCoordinateSubstitution(
      phiMinus,
      phi,
      "The transverse-rod isotropy argument just established φ(−v)=φ(v).",
    ),
    readings(
      "Combine the independent inverse and symmetry conditions.",
      "Replace φ(−v) by φ(v) in their product. The inverse condition becomes φ(v)φ(v)=1, so only a sign ambiguity remains.",
      "There are two inputs: composition gave φ(v)φ(−v)=1, and the rod comparison supplied φ(−v)=φ(v). Substitute the latter only into the former. The repeated factor is still a function of the chosen speed; no derivative or small-speed approximation is involved. These conditions fix its magnitude but permit both signs algebraically. The coordinate orientation and identity convention must resolve that last ambiguity.",
    ),
    foundations.algebra,
    "sr-coordinate-source-isotropy",
    {
      premiseRefs: [
        historical("sr-coordinate-source-inverse-scale"),
        historical("sr-coordinate-source-rod-isotropy"),
      ],
    },
  ),
  step(
    "sr-coordinate-source-square-scale",
    scaleSame,
    scaleSquared,
    collect,
    readings(
      "The scale has unit magnitude.",
      "Write the repeated factor as φ(v)². Its square is one, which allows φ=+1 or φ=−1 until the orientation branch is specified.",
      "Multiplication of the same real scalar by itself gives its square. Thus φ(v)φ(v)=1 is φ(v)²=1. It would be incorrect to remove the square and silently discard the negative solution. The experiment uses identically oriented spatial axes and clocks increasing toward the future, and the map must connect continuously to the identity when v goes to zero. Those assumptions will select the positive sign.",
    ),
    foundations.roots,
    "sr-coordinate-source-isotropy",
  ),
  step(
    "sr-coordinate-source-scale-root",
    scaleSquared,
    scaleRoots,
    sqrtRule(
      "Identically oriented rods and future-increasing clocks; continuity from the identity at v=0 selects φ>0.",
    ),
    readings(
      "Choose the scale branch connected to the identity.",
      "Take the nonnegative roots, with φ>0 specified by the coordinate orientation and continuous identity limit. The left root is |φ|; it equals φ only on this branch.",
      "For a real scale, √(φ²)=|φ| rather than φ without qualification. The common-origin, identical-calibration convention gives the identity at v=0, and continuity within |v|<V keeps the nonzero scale on that positive branch. Reversing all coordinate and time orientations would describe another branch, not the experiment as defined. The square-root step records these conditions explicitly instead of treating them as algebra.",
    ),
    foundations.roots,
    "sr-coordinate-source-isotropy",
    { premiseRefs: [branchPremise] },
  ),
  step(
    "sr-coordinate-source-positive-scale",
    scaleRoots,
    phiPositive,
    srCoordinateSubstitution(
      sourcePositiveTarget,
      phi,
      "On the explicitly chosen positive branch, √(φ²)=φ.",
    ),
    readings(
      "On that branch the scale itself equals the positive unit root.",
      "Use φ>0 to replace √(φ²) by φ. This is the only point where the sign branch enters the simplification.",
      "The chosen branch is a stated premise, not something a substitution checker can establish. With φ positive, its absolute value is φ, so the left side of the root equation simplifies as shown. The right side remains √1. Keeping these two actions separate makes the physical sign choice visible before the arithmetic simplification finishes the normalization.",
    ),
    foundations.roots,
    "sr-coordinate-source-isotropy",
    { premiseRefs: [branchPremise] },
  ),
  step(
    "sr-coordinate-source-scale-one",
    phiPositive,
    scaleOne,
    collect,
    readings(
      "The remaining scale is one.",
      "The positive square root of one is one. Thus φ(v)=1, after using the inverse relation, spatial isotropy, and the positive identity branch.",
      "Evaluating √1 finishes the algebra after the branch has already been selected. The conclusion is exact within the admitted inertial-frame, homogeneity, light-propagation, reciprocity, and isotropy assumptions. The source’s earlier coefficient a is therefore 1/β, not β; the common longitudinal coefficient aβ² is β. This distinction also prevents confusing the historical a with the modern ansatz coefficient introduced in the other route.",
    ),
    foundations.roots,
    "sr-coordinate-source-result",
  ),
];

// The source changes subject to the transverse rod before using the inverse result.
// Separate those stages instead of claiming that a changed subject is one adjacent rewrite.
const sourceInverseStage = chain("source-inverse", sourceNormalizationSteps.slice(0, 3));
const sourceIsotropyStage = chain("source-isotropy", sourceNormalizationSteps.slice(3));
const sourceFinal = chain("source-result", [
  step(
    "sr-coordinate-source-final-position",
    scaledX,
    finalX,
    srCoordinateSubstitution(
      commonScale,
      g,
      "φ=1, so the common longitudinal coefficient φβ equals β.",
    ),
    readings(
      "Insert the now-determined scale into the position map.",
      "The normalization argument gives φ=1. Replacing φβ by β yields ξ=β(x−vt), the canonical position equation with the paper’s notation.",
      "The unknown multiplier has been removed only after the inverse, transverse-rod symmetry, and positive-branch steps. The remaining β is fixed by the subluminal frame speed. This substitution reuses the reader’s canonical position tree; the source display calls its coordinates ξ and x and its speed constant V. A modern rendering calls the same Lorentz factor γ, never v/c.",
    ),
    foundations.frames,
    "sr-coordinate-source-result",
  ),
  step(
    "sr-coordinate-source-final-time",
    scaledT,
    finalT,
    srCoordinateSubstitution(
      commonScale,
      g,
      "The same φ=1 fixes the common coefficient of the time equation.",
    ),
    readings(
      "The same normalization completes the coordinate-time map.",
      "With φ=1, τ=β(t−vx/V²). The position-dependent term expresses synchronized clock assignment; τ is the moving coordinate time, not one clock’s proper time along an arbitrary path.",
      "Both time and longitudinal position inherited the identical coefficient φβ from the synchronization construction. The same normalization therefore fixes both. The time at an event depends on its K position through −vx/V². That term does not describe a faulty clock or a delayed image; it belongs to the frame’s event-coordinate assignment. Proper time along a selected worldline is a different quantity and has not been substituted for τ.",
    ),
    foundations.frames,
    "sr-coordinate-source-result",
  ),
  step(
    "sr-coordinate-source-final-transverse-y",
    scaledY,
    finalY,
    srCoordinateSubstitution(scaledY.right, y, "φ=1 in η=φy; multiplication by one leaves y."),
    readings(
      "The derived sideways scale now becomes one.",
      "The transverse ray supplied η=φy before normalization. Inserting φ=1 gives η=y, so this equation follows from its own light-path and symmetry arguments.",
      "The longitudinal light conditions were never sufficient to set the sideways coefficient. The source first obtained it from the moving sideways ray and only then identified it with the same φ fixed by reversal symmetry. Replacing that coefficient by one completes the y equation. The result is unchanged transverse coordinate in this parallel-axis, identically calibrated setup, not an assumption imported at the beginning.",
    ),
    foundations.frames,
    "sr-coordinate-source-result",
    { premiseRefs: [...transversePremises, historical("sr-coordinate-source-scale-one")] },
  ),
  step(
    "sr-coordinate-source-final-transverse-z",
    scaledZ,
    finalZ,
    srCoordinateSubstitution(scaledZ.right, z, "φ=1 in ζ=φz; multiplication by one leaves z."),
    readings(
      "The equally normalized second sideways axis is unchanged as well.",
      "The repeated z-ray argument gave ζ=φz. The same scale normalization therefore yields ζ=z and completes the four-coordinate map.",
      "The two transverse axes used the same rods, light-speed postulate, and symmetry under rotation about the motion axis. Their coefficient was derived before its value was fixed, so inserting φ=1 now is justified for both. The complete map connects the same event described in K and k with the stated sign convention: the origin of k moves along increasing x at speed v.",
    ),
    foundations.frames,
    "sr-coordinate-source-result",
    { premiseRefs: [...transversePremises, historical("sr-coordinate-source-scale-one")] },
  ),
]);

// The modern route starts with three independent coefficients, not with gamma.
const positiveRay = eq(
  mul(c, sum(mul(b, t), mul(d, c, t))),
  mul(a, sub(c, v), t),
  "modern-positive-ray",
);
const positiveConstraint = eq(
  sum(b, mul(d, c)),
  mul(a, sub(one, div(v, c))),
  "modern-positive-constraint",
);
const negativeRay = eq(
  mul(neg(c), sub(mul(b, t), mul(d, c, t))),
  mul(a, sub(neg(c), v), t),
  "modern-negative-ray",
);
const negativeConstraint = eq(
  sub(b, mul(d, c)),
  mul(a, sum(one, div(v, c))),
  "modern-negative-constraint",
);
const addedConstraints = eq(
  sum(positiveConstraint.left, negativeConstraint.left),
  sum(positiveConstraint.right, negativeConstraint.right),
  "modern-add-light",
);
const equalTimeCoefficient = eq(b, a, "modern-b-is-a");
const subtractedConstraints = eq(
  sub(positiveConstraint.left, negativeConstraint.left),
  sub(positiveConstraint.right, negativeConstraint.right),
  "modern-subtract-light",
);
const mixedTimeCoefficient = eq(d, neg(div(mul(a, v), c2)), "modern-d");
const timeAnsatz = eq(T, sum(mul(b, t), mul(d, x)), "modern-time-ansatz");
const timeOneCoefficient = substituteNode(timeAnsatz, b.termId, a);
const timeMixed = substituteNode(timeOneCoefficient, d.termId, mixedTimeCoefficient.right);
const modernLight = chain(
  "modern-light",
  [
    step(
      "sr-coordinate-modern-positive-light",
      positiveRay,
      positiveConstraint,
      arithmetic("divide", mul(c, t), "Choose a light event with t≠0; c>0."),
      readings(
        "One light direction gives one relation among the three coefficients.",
        "Start with x′=a(x−vt), t′=bt+dx. For x=ct require x′=ct′. Cancelling a nonzero ct gives b+dc=a(1−v/c), without fixing a, b, or d separately.",
        "The ansatz follows from the explicit linearity and origin conventions: offsets vanish when both origins’ zero event is identified, and x′=0 at x=vt fixes the spatial combination. On the right-moving light ray, substituting x=ct into both coordinate expressions and imposing x′=ct′ gives the first displayed equality. Divide by ct for any nonzero light event. One equation still allows many coefficients, so it cannot establish the Lorentz map by itself.",
      ),
      foundations.linear,
      "sr-coordinate-source-functional",
      {
        premiseRefs: [
          teaching("sr-linear-affine-ansatz-origin-convention"),
          historical("sr-longitudinal-light-propagation"),
        ],
      },
    ),
    step(
      "sr-coordinate-modern-negative-light",
      negativeRay,
      negativeConstraint,
      arithmetic("divide", neg(mul(c, t)), "Choose t≠0 and c>0."),
      readings(
        "The opposite light direction supplies the second independent relation.",
        "For x=−ct impose x′=−ct′. Dividing by −ct gives b−dc=a(1+v/c). Keeping both directions is what determines the time mixing.",
        "Substitute x=−ct into the same ansatz, with the same a, b, and d. The moving coordinate of this left-moving ray must be −ct′, not +ct′. The resulting equation is −c(bt−dct)=a(−c−v)t. Cancelling the nonzero −ct gives the displayed relation. This independent sign constraint is essential: a map can preserve the right-moving ray while assigning the wrong speed to the left-moving one.",
      ),
      foundations.linear,
      "sr-coordinate-source-functional",
      {
        premiseRefs: [
          teaching("sr-linear-affine-ansatz-origin-convention"),
          historical("sr-longitudinal-light-propagation"),
        ],
      },
    ),
    step(
      "sr-coordinate-modern-match-time-scale",
      addedConstraints,
      equalTimeCoefficient,
      arithmetic(
        "divide",
        two,
        "Add the two established light equations, then cancel the nonzero factor 2.",
      ),
      readings(
        "Adding the two light equations makes the time scale equal the space scale.",
        "Add b+dc=a(1−v/c) and b−dc=a(1+v/c). The opposite dc and v/c terms cancel, leaving 2b=2a; division by two gives b=a.",
        "Both equations hold for the same frame speed and the same coefficient functions. Addition gives (b+dc)+(b−dc)=a(1−v/c)+a(1+v/c). On the left the mixed coefficients cancel, and on the right the speed terms cancel. Thus 2b=2a, and the nonzero constant two can be removed. This determines only the equality of the two scales, not their numerical value. The remaining free a must stay visible.",
      ),
      foundations.algebra,
      "sr-coordinate-source-common-scale",
      {
        isMove: true,
        moveLabel: "Use both light directions to fix the mixing while keeping one scale free.",
        premiseRefs: [
          teaching("sr-coordinate-modern-positive-light"),
          teaching("sr-coordinate-modern-negative-light"),
        ],
      },
    ),
    step(
      "sr-coordinate-modern-fix-mixing",
      subtractedConstraints,
      mixedTimeCoefficient,
      arithmetic(
        "divide",
        mul(two, c),
        "Subtract the negative-ray equation from the positive-ray equation, then divide by 2c>0.",
      ),
      readings(
        "Subtracting instead fixes the coefficient of position in the time map.",
        "Subtract the second light equation from the first: 2dc=−2av/c. Division by 2c gives d=−av/c², including its sign and its time-per-length dimension.",
        "The b terms cancel under subtraction. On the right, a[(1−v/c)−(1+v/c)] equals −2av/c. Dividing by 2c, which is nonzero, leaves d=−av/c². Because v/c² has units of time per length, dx has units of time as required. The negative sign follows the stated convention that the moving origin travels toward increasing x. The unknown a has still not been assigned any Lorentz-factor formula.",
      ),
      foundations.algebra,
      "sr-coordinate-source-common-scale",
      {
        premiseRefs: [
          teaching("sr-coordinate-modern-positive-light"),
          teaching("sr-coordinate-modern-negative-light"),
        ],
      },
    ),
    step(
      "sr-coordinate-modern-use-time-scale",
      timeAnsatz,
      timeOneCoefficient,
      srCoordinateSubstitution(b, a, "The two light directions established b(v)=a(v)."),
      readings(
        "Put the common time scale back into the original ansatz.",
        "Replace b by a in t′=bt+dx. The position equation already uses a, so this makes the shared scale explicit while d is still shown separately.",
        "The original time ansatz allowed independent coefficients of t and x. The addition of the two light constraints established b=a without determining a. Substitute that equality only into the coefficient multiplying t. This keeps the provenance of each coefficient visible: the other one will be replaced using the subtraction result. Neither substitution introduces the final scale in advance.",
      ),
      foundations.algebra,
      "sr-coordinate-source-common-scale",
    ),
    step(
      "sr-coordinate-modern-use-mixing",
      timeOneCoefficient,
      timeMixed,
      srCoordinateSubstitution(
        d,
        mixedTimeCoefficient.right,
        "The two light directions established d(v)=−a(v)v/c².",
      ),
      readings(
        "Insert the place-dependent clock term forced by the light constraints.",
        "Replace d by −av/c². The time expression is now at−avx/c², with the same unknown a multiplying both terms.",
        "Use the independently obtained mixing coefficient in the x term of the time ansatz. This produces t′=at+(−av/c²)x. The spatial factor a remains a free function of frame speed, and the newly visible negative clock offset depends on where the event occurs. The algebra has reconciled both light directions without yet using reciprocity, isotropy, or a positive-branch condition.",
      ),
      foundations.algebra,
      "sr-coordinate-source-common-scale",
    ),
    step(
      "sr-coordinate-modern-one-parameter-family",
      timeMixed,
      familyT,
      collect,
      readings(
        "The light equations leave a one-parameter family of coordinate maps.",
        "Factor out a to obtain t′=a(t−vx/c²), paired with x′=a(x−vt). Both light directions work for any nonzero common a, so more information is needed.",
        "Factoring the common coefficient gives the canonical one-parameter time equation; the position ansatz already has the corresponding factor. The free coefficient here is the pedagogical a(v), bound separately from Einstein’s earlier a. In source bookkeeping it equals φβ, or the earlier aβ². Since either positive rescaling of both longitudinal coordinates still preserves their light-line slopes, preserving those slopes alone cannot select the correct normalization.",
      ),
      foundations.linear,
      "sr-coordinate-source-common-scale",
    ),
  ],
  true,
);

const modernReturnExpanded = eq(
  mul(aMinus, sum(familyX.right, mul(v, familyT.right))),
  x,
  "modern-return-expanded",
);
const modernReturnFactored = eq(mul(aMinus, a, delta, x), x, "modern-return-factored");
const modernInverse = eq(mul(aMinus, a, delta), one, "modern-inverse");
const modernEven = substituteNode(modernInverse, aMinus.termId, a);
const modernSquared = eq(sq(a), div(one, delta), "modern-scale-squared");
const positiveARoot = named(root(sq(a)), "positive-a-root");
const modernRoots = eq(positiveARoot, root(modernSquared.right), "modern-roots");
const modernPositive = eq(a, modernRoots.right, "modern-positive");
const modernScaleFormula = eq(a, gammaDefinition.right, "modern-scale-formula");
const modernGamma = eq(a, g, "modern-gamma");
const modernNormalization = chain(
  "modern-normalization",
  [
    step(
      "sr-coordinate-modern-compose-inverse",
      modernReturnExpanded,
      modernReturnFactored,
      collect,
      readings(
        "Compose the still-unknown map with the same construction at reversed speed.",
        "The reverse position is a(−v)(x′+vt′). Substituting the forward family cancels the mixed time terms and leaves a(−v)a(v)(1−v²/c²)x.",
        "Relativity and identical calibration give the inverse the same functional form with −v. Insert x′=a(v)(x−vt) and t′=a(v)(t−vx/c²). The bracket becomes a(v)[x−vt+vt−v²x/c²]=a(v)(1−v²/c²)x. The coefficient a(−v) is deliberately kept independent at this stage. Identifying it with a(v) here would quietly assume the isotropy condition that comes later.",
      ),
      foundations.linear,
      "sr-coordinate-source-inverse",
      {
        premiseRefs: [
          teaching("sr-coordinate-modern-one-parameter-family"),
          historical("sr-reciprocity-identical-calibration"),
        ],
      },
    ),
    step(
      "sr-coordinate-modern-inverse-condition",
      modernReturnFactored,
      modernInverse,
      arithmetic(
        "divide",
        x,
        "Compare any event with x≠0; a linear map must return every coordinate.",
      ),
      readings(
        "Returning every event fixes a product, not either scale on its own.",
        "Divide the composed identity by a nonzero x. Reciprocity requires a(v)a(−v)(1−v²/c²)=1, leaving the individual scales undetermined.",
        "The coefficient of x must be one because the reverse frame change returns the original coordinate. Selecting one nonzero coordinate is enough to compare that coefficient; the resulting speed-only identity then applies to all events. Functions a(v) and a(−v) can be unequal while their product satisfies it. Thus the inverse test supplies a real constraint but does not finish the derivation without reversal symmetry and a branch choice.",
      ),
      foundations.algebra,
      "sr-coordinate-source-inverse",
    ),
    step(
      "sr-coordinate-modern-isotropy",
      modernInverse,
      modernEven,
      srCoordinateSubstitution(
        aMinus,
        a,
        "Spatial isotropy with equally oriented/calibrated axes gives a(−v)=a(v).",
      ),
      readings(
        "Use spatial isotropy to equate the scales for opposite motions.",
        "Reversing the direction of motion in the same isotropic setup cannot change its scalar normalization. Replace a(−v) by a(v), leaving a(v)²(1−v²/c²)=1.",
        "The setup contains no preferred spatial direction, and both frames use identically calibrated axes. Reversing the x direction together with the sign of relative velocity therefore leaves the scalar coefficient unchanged. This is the explicit isotropy premise, separate from reciprocity. Applying it makes the two a factors identical. The displayed unsimplified product keeps the substitution honest; the next algebraic step will collect its square and divide by the known positive factor.",
      ),
      foundations.frames,
      "sr-coordinate-source-isotropy",
      {
        reasonKind: "symmetry",
        premiseRefs: [historical("sr-spatial-symmetry"), teaching("sr-even-ansatz-scale")],
        isMove: true,
        moveLabel:
          "Add isotropy and the identity branch to fix the scale that light alone left free.",
      },
    ),
    step(
      "sr-coordinate-modern-isolate-square",
      modernEven,
      modernSquared,
      arithmetic("divide", delta, "1−v²/c²>0 for |v|<c."),
      readings(
        "Isolate the square of the unknown scale.",
        "Collect a(v)a(v) into a(v)² and divide by the positive factor 1−v²/c². The result fixes the magnitude of a but still permits either sign.",
        "For an inertial frame inside the light-speed boundary, 1−v²/c² is strictly positive and may be divided out. The inverse-and-isotropy condition becomes a(v)²=1/(1−v²/c²). Nothing in that squared equation alone distinguishes a future-increasing coordinate time from its sign-reversed counterpart. The next step therefore states the continuous positive identity branch before taking roots; a Lorentz factor has not been an input to this construction.",
      ),
      foundations.roots,
      "sr-coordinate-source-isotropy",
    ),
    step(
      "sr-coordinate-modern-positive-root",
      modernSquared,
      modernRoots,
      sqrtRule(
        "Future-increasing clocks and the continuously connected identity at v=0 select a(v)>0.",
      ),
      readings(
        "Select the positive scale continuously connected to unchanged coordinates at rest.",
        "Take the nonnegative roots with the stated condition a(v)>0. The identity map at zero speed has a(0)=1; continuity on the subluminal domain fixes its sign.",
        "The square-root operation gives |a(v)| on the left. The physical coordinate convention selects future-increasing clocks and identically oriented spatial axes. At v=0 these are unchanged coordinates, with a(0)=1. Since the inverse condition forbids a zero and the map varies continuously with speed, the same positive branch applies throughout the connected subluminal domain. This is the first point at which the sign can legitimately be fixed.",
      ),
      foundations.roots,
      "sr-coordinate-source-isotropy",
      { premiseRefs: [branchPremise] },
    ),
    step(
      "sr-coordinate-modern-remove-absolute-value",
      modernRoots,
      modernPositive,
      srCoordinateSubstitution(
        positiveARoot,
        a,
        "The explicitly selected branch a(v)>0 makes √(a(v)²)=a(v).",
      ),
      readings(
        "The branch condition removes the absolute value of the scale.",
        "On the chosen positive branch, √(a²) equals a. The right side remains the positive square root of 1/(1−v²/c²).",
        "Removing the square on the left is a conditional identity, not an unrestricted cancellation of a power. The just-stated positive branch ensures that √(a²)=|a|=a. Replacing only that root leaves the speed dependence on the right unchanged. If a negative coordinate-orientation branch were selected instead, this substitution would be false; the focused checks keep that counterexample visible.",
      ),
      foundations.roots,
      "sr-coordinate-source-isotropy",
      { premiseRefs: [branchPremise] },
    ),
    step(
      "sr-coordinate-modern-write-scale-formula",
      modernPositive,
      modernScaleFormula,
      arithmetic("multiply", one),
      readings(
        "The positive coefficient is the reciprocal square root of 1−v²/c².",
        "For a positive denominator, √(1/δ)=1/√δ, where δ=1−v²/c². This gives a(v)=1/√(1−v²/c²) without having assumed that expression earlier.",
        "The admitted speed domain makes δ positive, so both reciprocal-root forms are real and take the same positive value. Simplifying the right side yields the canonical expression for the coefficient. This algebraic form is derived from the two light directions, reciprocity, isotropy, and the identity branch. It is not obtained by substituting the desired final coefficient into the initial ansatz.",
      ),
      foundations.roots,
      "sr-coordinate-source-result",
    ),
    step(
      "sr-coordinate-modern-name-gamma",
      modernScaleFormula,
      modernGamma,
      srCoordinateSubstitution(
        gammaDefinition.right,
        g,
        "Only now name the derived positive expression γ, using eq-model-sr-lorentz-factor.",
      ),
      readings(
        "Only after deriving the coefficient, call it γ.",
        "The derived expression is the Lorentz factor γ. This name is introduced at the end of the scale calculation; it is the source’s β, not the ratio v/c.",
        "Replace the complete reciprocal-root expression by the symbol already owned by the canonical Lorentz-factor equation. Its quantity binding is distinct from the frame speed and the speed of light. No earlier step of this modern scale construction required a Lorentz-factor value. The name now shortens the finished coordinate equations without providing an extra premise to the derivation.",
      ),
      foundations.frames,
      "sr-coordinate-source-result",
      { reasonKind: "definition" },
    ),
  ],
  true,
);

const modernLongitudinal = chain(
  "modern-longitudinal",
  [
    step(
      "sr-coordinate-modern-final-position",
      familyX,
      finalX,
      srCoordinateSubstitution(a, g, "The preceding scale derivation established a(v)=γ."),
      readings(
        "Insert the derived scale into the position equation.",
        "The original position ansatz was x′=a(x−vt). The completed scale argument now permits replacing a by γ, yielding the canonical longitudinal position map.",
        "This substitution returns to the spatial ansatz whose factor was deliberately left unknown while the light and normalization constraints were imposed. The result is x′=γ(x−vt), with the moving origin at x=vt as required. The same derivation will fix the longitudinal time equation. It still says nothing by itself about y′ or z′; those coordinates need their own transverse-light condition.",
      ),
      foundations.frames,
      "sr-coordinate-source-result",
    ),
    step(
      "sr-coordinate-modern-final-time",
      familyT,
      finalT,
      srCoordinateSubstitution(
        a,
        g,
        "The same derived a(v)=γ fixes the time map’s shared coefficient.",
      ),
      readings(
        "The same scale completes the time equation.",
        "Replace a by γ in t′=a(t−vx/c²). The coefficient of position was already fixed by the two light directions, so no new mixing term is introduced here.",
        "The earlier light calculation established b=a and d=−av/c², hence the factored one-parameter time equation. Normalization now supplies a=γ and produces t′=γ(t−vx/c²). These t and t′ are frame-coordinate times for the same event, assigned by synchronized clocks. The sign convention remains the one fixed at the start, and no change of visual viewpoint reverses it.",
      ),
      foundations.frames,
      "sr-coordinate-source-result",
    ),
    step(
      "sr-coordinate-modern-inverse-position",
      substituteNode(inverseX, g.termId, aMinus),
      inverseX,
      srCoordinateSubstitution(
        aMinus,
        g,
        "Isotropy gives a(−v)=a(v)=γ; reversing v changes x′−vt′ into x′+vt′.",
      ),
      readings(
        "The inverse has the same positive scale and the opposite velocity sign.",
        "Apply the established family at −v, so x=a(−v)(x′+vt′). Since a is even and equals γ, the inverse position map is x=γ(x′+vt′).",
        "The inverse equation follows by exchanging the roles of the identically calibrated frames and reversing their relative speed. The sign of the mixed term changes, while the scalar a(−v)=a(v)=γ remains unchanged by isotropy. This canonical inverse tree is also used by the kinematics owner. Checking the forward and inverse composition is a validation of the finished map, distinct from assuming its final coefficients at the outset.",
      ),
      foundations.linear,
      "sr-coordinate-source-inverse",
    ),
    step(
      "sr-coordinate-modern-inverse-time",
      substituteNode(inverseT, g.termId, aMinus),
      inverseT,
      srCoordinateSubstitution(
        aMinus,
        g,
        "The reverse time map is t=a(−v)(t′+vx′/c²), with a(−v)=γ.",
      ),
      readings(
        "Reverse the time mixing with the same sign convention.",
        "The inverse time equation is t=γ(t′+vx′/c²). It returns the original event time when composed with the forward position and time maps.",
        "Exchange primed and unprimed coordinates in the one-parameter family and use the reversed relative velocity. The factor a(−v) is γ after the scale derivation, and −(−v)x′/c² produces the plus sign. Both coordinate equations are needed when checking the inverse; treating x′ as fixed during a general event transformation would omit part of the cancellation. The reference-owner tests exercise the composition on complete events.",
      ),
      foundations.linear,
      "sr-coordinate-source-inverse",
    ),
  ],
  true,
);

const transverseRay = eq(
  sum(mul(sq(g), sq(v)), mul(sq(transverseScale), c2)),
  mul(sq(g), c2),
  "modern-transverse-ray",
);
const transverseSquared = eq(sq(transverseScale), gammaCancellation, "modern-transverse-square");
const transverseUnitSquare = substituteNode(
  transverseSquared,
  nodeId(gammaCancellation) as string,
  one,
) as Relation;
const positiveTransverseRoot = named(root(sq(transverseScale)), "positive-transverse-root");
const transverseRoots = eq(positiveTransverseRoot, root(one), "modern-transverse-roots");
const transversePositive = eq(transverseScale, root(one), "modern-transverse-positive");
const transverseOne = eq(transverseScale, one, "modern-transverse-one");
const transverseFamilyY = eq(
  Y,
  named(mul(transverseScale, y), "modern-y-coefficient"),
  "modern-y-family",
);
const transverseFamilyZ = eq(
  Z,
  named(mul(transverseScale, z), "modern-z-coefficient"),
  "modern-z-family",
);
const modernTransverse = chain(
  "modern-transverse",
  [
    step(
      "sr-coordinate-modern-transverse-light",
      transverseRay,
      transverseSquared,
      arithmetic("divide", c2, "Subtract γ²v² from both sides, then divide by c²>0."),
      readings(
        "A genuinely transverse ray fixes the sideways coefficient that the first two rays could not.",
        "Let y′=a⊥y and z′=a⊥z by axis normalization and spatial symmetry. For x=0, y=ct, the established map gives x′=−γvt and t′=γt. Requiring x′²+y′²=c²t′² gives the displayed constraint.",
        "The linear transverse ansatz allows a common scalar a⊥, with no mixing into x or t by the stated reflection and rotation symmetries. Along the unprimed transverse ray, y′=a⊥ct. Insert x′=−γvt, y′=a⊥ct, and t′=γt into the moving frame’s light-speed condition, then divide by a nonzero t². The first displayed equation follows. Subtract γ²v² and divide by c² to get a⊥²=γ²(1−v²/c²). This is a new directional light constraint, not a copy of the final answer.",
      ),
      foundations.frames,
      "sr-coordinate-source-sideways",
      {
        premiseRefs: [
          ...transversePremises,
          teaching("sr-coordinate-modern-final-time"),
          teaching("sr-coordinate-modern-final-position"),
        ],
        reasonKind: "physical-premise",
        isMove: true,
        moveLabel:
          "Test a transverse light ray before deciding whether sideways coordinates stay unchanged.",
      },
    ),
    step(
      "sr-coordinate-modern-transverse-unit-square",
      transverseSquared,
      transverseUnitSquare,
      srCoordinateSubstitution(
        gammaCancellation,
        one,
        "The now-derived γ satisfies γ²(1−v²/c²)=1.",
      ),
      readings(
        "The derived longitudinal factor makes the sideways scale’s square equal one.",
        "Substitute γ²(1−v²/c²)=1, now justified by the previous scale derivation. Thus a⊥²=1; a sign choice is still required.",
        "The longitudinal calculation has already established γ as the positive reciprocal square root of 1−v²/c². Its squared identity therefore reduces the right side of the transverse constraint to one. This use of γ is downstream of its derivation and is not circular. The remaining equation determines only the magnitude of the sideways coefficient, so axis orientation must still select the positive value.",
      ),
      foundations.algebra,
      "sr-coordinate-source-sideways",
      { premiseRefs: transversePremises },
    ),
    step(
      "sr-coordinate-modern-transverse-root",
      transverseUnitSquare,
      transverseRoots,
      sqrtRule(
        "The transverse axes have the same orientation and normalization at rest, continued continuously to this frame speed.",
      ),
      readings(
        "Keep the transverse axis on the positive identity branch.",
        "Take the nonnegative roots with identically oriented transverse axes. Continuity from the identity selects a⊥>0, so the absolute value can be removed next.",
        "The light-speed equation alone would allow a reflection of both transverse coordinates. The setup specifies identically oriented axes and the identity at zero relative speed, and continuity chooses the same nonzero positive branch throughout the admitted domain. Taking roots therefore yields |a⊥|=√1 with that branch condition stated. The subsequent simplification uses this condition; it is not supplied by the root symbol itself.",
      ),
      foundations.roots,
      "sr-coordinate-source-sideways",
      { premiseRefs: [...transversePremises, branchPremise] },
    ),
    step(
      "sr-coordinate-modern-transverse-positive",
      transverseRoots,
      transversePositive,
      srCoordinateSubstitution(
        positiveTransverseRoot,
        transverseScale,
        "The selected positive transverse orientation gives √(a⊥²)=a⊥.",
      ),
      readings(
        "The orientation condition selects the positive transverse scale.",
        "Replace √(a⊥²) by a⊥ on the chosen positive branch. The remaining right-hand side is the positive unit root.",
        "The branch selected in the preceding step makes the absolute value of a⊥ equal to a⊥ itself. Apply that conditional identity to the left-hand root only. A reflected transverse axis would have the opposite sign and would not admit this substitution under the same label. Keeping the orientation premise explicit prevents a squared light-speed test from silently deciding a coordinate convention.",
      ),
      foundations.roots,
      "sr-coordinate-source-sideways",
      { premiseRefs: [...transversePremises, branchPremise] },
    ),
    step(
      "sr-coordinate-modern-transverse-one",
      transversePositive,
      transverseOne,
      collect,
      readings(
        "The transverse scale is one.",
        "Evaluate √1 to obtain a⊥=1. This coefficient followed from the transverse light ray and orientation convention, after the longitudinal scale was derived.",
        "The only remaining arithmetic is the positive square root of one. The transverse coefficient is now determined, and it can be inserted into both transverse coordinate equations. The route has therefore accounted separately for longitudinal mixing, normalization, and sideways scaling. A candidate preserving the two longitudinal light directions but choosing any other transverse magnitude would fail this final directional light test.",
      ),
      foundations.roots,
      "sr-coordinate-source-result",
      { premiseRefs: transversePremises },
    ),
    step(
      "sr-coordinate-modern-transverse-y",
      transverseFamilyY,
      finalY,
      srCoordinateSubstitution(transverseFamilyY.right, y, "The derived a⊥=1 gives a⊥y=y."),
      readings(
        "Insert the derived scale into the first transverse coordinate.",
        "With a⊥=1, the transverse ansatz y′=a⊥y becomes y′=y. This equality was obtained after testing sideways light propagation.",
        "The original transverse ansatz was permitted by axis normalization and the reflection/rotation symmetries of the setup. The transverse light condition then fixed its magnitude, and the positive identity branch fixed its sign. Replacing the actual factor a⊥y by y now applies that completed result. The equation was not used to determine γ or smuggled into the first light-ray constraints.",
      ),
      foundations.frames,
      "sr-coordinate-source-result",
      { premiseRefs: transversePremises },
    ),
    step(
      "sr-coordinate-modern-transverse-z",
      transverseFamilyZ,
      finalZ,
      srCoordinateSubstitution(
        transverseFamilyZ.right,
        z,
        "The equally normalized transverse z axis has the same derived coefficient a⊥=1.",
      ),
      readings(
        "The second transverse coordinate completes the same four-dimensional event map.",
        "The common transverse coefficient also gives z′=z. Both routes now reach the same coordinate transformation through explicitly different sequences of premises.",
        "Rotational symmetry about the x axis made the transverse scalar common to y and z; a separate unmotivated scale for z would violate that premise. Substituting its derived value completes the map x′=γ(x−vt), t′=γ(t−vx/c²), y′=y, z′=z. The source route writes the same quantities as ξ, τ, η, ζ and β. Neither route claims to reconstruct Einstein’s private thought process.",
      ),
      foundations.frames,
      "sr-coordinate-source-result",
      { premiseRefs: transversePremises },
    ),
  ],
  true,
);

export interface SRCoordinateStage {
  readonly title: string;
  readonly chain: DerivationChain;
}
const stationaryWaveResidual = named(
  sub(sum(sq(x), sq(y), sq(z)), mul(c2, sq(t))),
  "stationary-wave-residual",
);
const expandedWave = sum(
  sq(scaledX.right),
  sq(scaledY.right),
  sq(scaledZ.right),
  neg(mul(c2, sq(scaledT.right))),
);
const explicitWave = substituteNode(expandedWave, g.termId, gammaDefinition.right);
const factoredWave = mul(sq(phi), stationaryWaveResidual);
const zeroWave = substituteNode(factoredWave, nodeId(stationaryWaveResidual) as string, zero);
const sourceSphere = chain("source-spherical-wave", [
  step(
    "sr-coordinate-source-spherical-expand-factor",
    expandedWave,
    explicitWave,
    srCoordinateSubstitution(
      g,
      gammaDefinition.right,
      "Use the definition β=1/√(1−v²/V²) in the already-obtained scaled map.",
    ),
    readings(
      "Check a spherical light wave using the map already constructed.",
      "Insert the scaled coordinates into ξ²+η²+ζ²−V²τ², then replace β by its speed formula. This checks consistency of the light postulate after deriving the candidate map.",
      "The first expression is the moving-frame spherical-wave equation’s left side after substituting ξ=φβ(x−vt), η=φy, ζ=φz, and τ=φβ(t−vx/V²). Keep φ arbitrary. Replacing β by its definition prepares a direct algebraic comparison with the original spherical wave. The check does not assume a general spacetime interval law or use later geometry as a premise; it starts from the constructed coordinates and the source’s emitted wave.",
    ),
    foundations.algebra,
    "sr-coordinate-source-sphere",
    { layout: { from: "terms", to: "terms" } },
  ),
  step(
    "sr-coordinate-source-spherical-cancellation",
    explicitWave,
    factoredWave,
    collect,
    readings(
      "The mixed terms cancel and leave the original wave equation times φ².",
      "Expanding the two longitudinal squares cancels their xt terms. The factor 1−v²/V² cancels β², leaving φ²(x²+y²+z²−V²t²).",
      "The longitudinal difference is (x−vt)²−V²(t−vx/V²)². Expansion gives x²−2vxt+v²t²−V²t²+2vxt−v²x²/V², which factors as (1−v²/V²)(x²−V²t²). Multiplication by β² cancels that speed factor. The y and z contributions each carry φ², yielding the displayed common factor. This is an algebraic consistency check on the derived scaled map; it still cannot determine φ.",
    ),
    foundations.algebra,
    "sr-coordinate-source-sphere",
    { layout: { from: "terms" } },
  ),
  step(
    "sr-coordinate-source-spherical-use-wave",
    factoredWave,
    zeroWave,
    srCoordinateSubstitution(
      stationaryWaveResidual,
      zero,
      "For the emitted spherical light wave, x²+y²+z²=V²t² (eq-s3-d17).",
    ),
    readings(
      "For an emitted spherical light wave, the remaining bracket is zero.",
      "Use the original spherical-wave condition x²+y²+z²=V²t². Its residual vanishes, so the transformed spherical-wave residual vanishes for every allowed φ.",
      "The source describes a light pulse emitted from the common origin: its K coordinates satisfy the displayed sphere relation. Subtracting V²t² makes the bracket exactly zero on that wave. Replacing only that bracket leaves φ²·0. The conclusion is restricted to the assumed light wave as a consistency test; no new invariant-interval axiom has entered the route. The survival of an arbitrary φ shows why the inverse and rod symmetry steps are still necessary.",
    ),
    foundations.frames,
    "sr-coordinate-source-sphere",
    { reasonKind: "physical-premise", premiseRefs: [historical("eq-s3-d17")] },
  ),
  step(
    "sr-coordinate-source-spherical-consistent",
    zeroWave,
    zero,
    collect,
    readings(
      "The constructed map gives the same light speed for this spherical wave.",
      "The residual is zero, hence ξ²+η²+ζ²=V²τ². The paper’s consistency check succeeds without removing the still-unknown common scale.",
      "Multiplying zero by the finite scale squared gives zero. Re-expressing that residual states the moving-frame sphere equation. The algebra confirms that the candidate coordinates reconcile the postulates for the emitted spherical wave. It does not force φ=1 because a common rescaling of space and time leaves this wave-speed relation unchanged. Normalization must therefore come from the independent inverse and spatial-symmetry considerations that follow in the source.",
    ),
    foundations.frames,
    "sr-coordinate-source-sphere",
  ),
]);
export const srCoordinateSourceStages: readonly SRCoordinateStage[] = [
  { title: "1. Turn clock synchronization into a constraint", chain: sourceSynchronization },
  { title: "2. Sideways light and the linear time function", chain: sourceClocks },
  { title: "3. Determine the three spatial coefficients", chain: sourceRays },
  { title: "4. Display the remaining common scale", chain: sourceScale },
  { title: "5. Check the source’s spherical light wave", chain: sourceSphere },
  { title: "6. Return with the inverse transformation", chain: sourceInverseStage },
  { title: "7. Use spatial isotropy and choose the positive branch", chain: sourceIsotropyStage },
  { title: "8. Complete the source transformation", chain: sourceFinal },
];
export const srCoordinateModernStages: readonly SRCoordinateStage[] = [
  { title: "1. Impose both longitudinal light directions", chain: modernLight },
  { title: "2. Determine the positive scale", chain: modernNormalization },
  { title: "3. Write the longitudinal map and its inverse", chain: modernLongitudinal },
  { title: "4. Derive the transverse equations separately", chain: modernTransverse },
];
export const srCoordinateChains = [...srCoordinateSourceStages, ...srCoordinateModernStages].map(
  (stage) => stage.chain,
);
export const srCoordinateResults = {
  position: finalX,
  time: finalT,
  y: finalY,
  z: finalZ,
  inversePosition: inverseX,
  inverseTime: inverseT,
  factor: gammaDefinition,
};
export const srCoordinateIntroductions = {
  auxiliary: eq(q, shiftX, "auxiliary-definition"),
  positionAnsatz: familyX,
  timeAnsatz,
  transverseAnsatzY: transverseFamilyY,
  transverseAnsatzZ: transverseFamilyZ,
  sidewaysTimeZ: eq(partial(z), zero, "no-z-time"),
  scaleDefinition: eq(phi, mul(A, g), "scale-bookkeeping"),
  rodSymmetry,
  sphericalStationary: eq(sum(sq(x), sq(y), sq(z)), mul(c2, sq(t)), "sphere-K"),
  sphericalMoving: eq(sum(sq(X), sq(Y), sq(Z)), mul(c2, sq(T)), "sphere-k"),
};
export const srCoordinateCrossRouteLinks = [
  {
    label: "Light constraints",
    source: "sr-coordinate-source-functional-equation",
    modern: "sr-coordinate-modern-positive-light",
  },
  {
    label: "One unknown multiplier",
    source: "sr-coordinate-source-linear-time",
    modern: "sr-coordinate-modern-one-parameter-family",
  },
  {
    label: "The inverse",
    source: "sr-coordinate-source-inverse-scale",
    modern: "sr-coordinate-modern-inverse-condition",
  },
  {
    label: "Isotropy and the positive branch",
    source: "sr-coordinate-source-rod-isotropy",
    modern: "sr-coordinate-modern-isotropy",
  },
  {
    label: "Transverse light",
    source: "sr-coordinate-source-transverse-position",
    modern: "sr-coordinate-modern-transverse-light",
  },
] as const;
export const srCoordinateSourceLinks = [
  {
    id: "sr-coordinate-source-sync",
    anchor: "eq-s3-d1",
    label: "The midpoint synchronization condition",
  },
  {
    id: "sr-coordinate-source-functional",
    anchor: "eq-s3-d2",
    label: "The functional equation for moving time",
  },
  {
    id: "sr-coordinate-source-differential",
    anchor: "eq-s3-d3",
    label: "The first-order coefficient equation",
  },
  { id: "sr-coordinate-source-pde", anchor: "eq-s3-d4", label: "The differential time constraint" },
  {
    id: "sr-coordinate-source-sideways-clocks",
    anchor: "eq-s3-d5",
    label: "No sideways clock gradient",
  },
  {
    id: "sr-coordinate-source-linear-time-reference",
    anchor: "eq-s3-d6",
    label: "The linear time function with an unknown a",
  },
  {
    id: "sr-coordinate-source-longitudinal",
    anchor: "eq-s3-d10",
    label: "The longitudinal coordinate coefficient",
  },
  {
    id: "sr-coordinate-source-sideways",
    anchor: "eq-s3-d12",
    label: "The sideways ray and its crossing time",
  },
  {
    id: "sr-coordinate-source-common-scale",
    anchor: "eq-s3-d15",
    label: "The four equations with a common scale φ",
  },
  {
    id: "sr-coordinate-source-sphere",
    anchor: "eq-s3-d18",
    label: "The historical spherical-wave consistency check",
  },
  { id: "sr-coordinate-source-inverse", anchor: "eq-s3-d19", label: "The double transformation" },
  {
    id: "sr-coordinate-source-isotropy",
    anchor: "eq-s3-d23",
    label: "The transverse rod and reversal symmetry",
  },
  {
    id: "sr-coordinate-source-result",
    anchor: "eq-s3-d25",
    label: "The completed source transformation",
  },
] as const;
export const srCoordinateHistoricalReading = {
  r3: "Section 3 constructs the transformation by expressing moving-clock synchronization through light paths measured in the stationary system. The source uses x′ for the auxiliary x−vt, ξ for the moving longitudinal coordinate, τ for moving coordinate time, V for the speed of light, and β for the modern γ. It carries an unknown a before rewriting the map with a common φ(v); this reconstruction makes the relation φ=aβ explicit. The printed prose calls the earlier a an unknown φ(v), so the symbol’s bookkeeping changes between those stages rather than asserting a=φ for both formulas. The spherical-wave calculation is the paper’s own consistency check. The second route here is an explicitly modern pedagogical reconstruction, not an account of Einstein’s private thought process. These explanatory chains remain authored drafts and do not certify a historical or physics review.",
  r3Citations: [
    "Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §3, pp. 897–902. Source anchors eq-s3-d1 through eq-s3-d26; notation concordance sr.xprime.auxiliaryGalileanCoordinate, sr.a.transformationCoefficientA, sr.varphi.scaleFactorUnknown.",
  ],
};
export const srCoordinateMetadata = {
  argument: "arg-sr-lorentz-map",
  relatedArgument: "arg-sr-transverse-and-inverse",
  section: "s3",
  review: "draft",
  modelStatus: "exact-within-stated-assumptions",
  ownerBeadId: "am-srk-equations-30cq",
  canonicalEquationIds: [
    positionRecord.id,
    timeRecord.id,
    inversePositionRecord.id,
    inverseTimeRecord.id,
    factorRecord.id,
    ansatzPositionRecord.id,
    ansatzTimeRecord.id,
  ],
} as const;

/** Presentation only: preserve the authored bindings for verification and numerical tests.
 * Coordinate components retain `index` in the data, but display y/η rather than x_y/ξ_y.
 * The auxiliary has a distinct modern x-tilde glyph, never modern x-prime. */
export function presentSRCoordinateExpression(
  tree: Expression,
  notation: SRCoordinateNotation,
): Expression {
  const glyphs: Readonly<Record<string, string>> = {
    speedOfLight: notation === "source" ? "V" : "c",
    frameSpeed: "v",
    lorentzFactor: notation === "source" ? "β" : "γ",
    coordinateTimeStationary: "t",
    coordinateTimeMoving: notation === "source" ? "τ" : "t'",
    auxiliaryGalileanCoordinate: notation === "source" ? "x'" : "x̃",
    transformationCoefficientA: notation === "source" ? "a" : "A",
    scaleFactorUnknown: "φ",
    ansatzSpatialScale: "a",
    ansatzTimeScale: "b",
    ansatzTimeSpaceCoefficient: "d",
    ansatzTransverseScale: "a_perp",
    lengthProper: "l",
  };
  const projected = projectDerivationSymbols(tree, (s) => {
    if (s.quantityId === "coordinatePositionStationary")
      return s.index === "y" ? "y" : s.index === "z" ? "z" : "x";
    if (s.quantityId === "coordinatePositionMoving") {
      if (notation === "source") return s.index === "y" ? "η" : s.index === "z" ? "ζ" : "ξ";
      return s.index === "y" ? "y'" : s.index === "z" ? "z'" : "x'";
    }
    const glyph = glyphs[s.quantityId];
    if (!glyph)
      throw new SRCoordinateError(
        "sr-coordinate-missing-glyph",
        `No SR §3 display glyph for ${s.quantityId}.`,
        "sr-coordinates.presentation",
      );
    return glyph;
  });
  const components = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(components);
    if (value && typeof value === "object") {
      const fields = Object.entries(value);
      const s = value as Partial<SymbolExpression>;
      const isCoordinate =
        s.kind === "symbol" &&
        (s.quantityId === "coordinatePositionStationary" ||
          s.quantityId === "coordinatePositionMoving");
      return Object.fromEntries(
        fields
          .filter(([key]) => !(isCoordinate && key === "index"))
          .map(([key, child]) => [key, components(child)]),
      );
    }
    return value;
  };
  return components(projected) as Expression;
}
export function presentSRCoordinateChain(
  value: DerivationChain,
  notation: SRCoordinateNotation,
): DerivationChain {
  return {
    ...value,
    steps: value.steps.map((s) => {
      const originals = [...walk(s.from), ...walk(s.to)];
      const from = presentSRCoordinateExpression(s.from, notation);
      const to = presentSRCoordinateExpression(s.to, notation);
      const projected = [...walk(from), ...walk(to)];
      return {
        ...s,
        from,
        to,
        changedSubexpressionIds: s.changedSubexpressionIds.map((id) => {
          const index = originals.findIndex((node) => nodeId(node) === id);
          return index < 0 ? id : (nodeId(projected[index] as Expression) ?? id);
        }),
      };
    }),
  };
}
