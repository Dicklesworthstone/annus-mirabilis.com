/**
 * SR §5: compose a point's velocity from k to K, using the admitted §3 map.
 * Canonical equation records own the input maps and both final components.
 * The algebra is checked separately from its physical premises and editorial review.
 */
import inverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import positionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import timeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import longitudinalRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-x.json";
import transverseRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-y.json";
import { type Expression, nodeId, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import {
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  type PremiseRef,
  type RuleApplication,
  type StepReadings,
} from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type CanonicalRecord = Readonly<{ id: string; tree: unknown }>;
export type SRVelocityRecords = Readonly<{
  position: CanonicalRecord;
  time: CanonicalRecord;
  inverseTime: CanonicalRecord;
  longitudinal: CanonicalRecord;
  transverse: CanonicalRecord;
}>;
export const SR_VELOCITY_RECORDS: SRVelocityRecords = {
  position: positionRecord,
  time: timeRecord,
  inverseTime: inverseTimeRecord,
  longitudinal: longitudinalRecord,
  transverse: transverseRecord,
};
export type SRVelocityRefusalCode =
  | "sr-velocity-relation-required"
  | "sr-velocity-missing-quantity"
  | "sr-velocity-result-shape"
  | "sr-velocity-missing-glyph";

export class SRVelocityError extends DerivationSchemaError {
  readonly code: SRVelocityRefusalCode;

  constructor(code: SRVelocityRefusalCode, message: string, path: string) {
    super(message, path);
    this.code = code;
  }
}

function canonical(record: CanonicalRecord): Relation {
  const tree = projectDerivationSymbols(record.tree as Expression, (symbol) => symbol.quantityId);
  if (tree.kind !== "relation" || tree.operator !== "=")
    throw new SRVelocityError(
      "sr-velocity-relation-required",
      "Velocity composition requires a canonical equality.",
      record.id,
    );
  return tree;
}
const number = (value: string): Expression => ({ kind: "number", value });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const difference = (left: Expression, right: Expression): Expression => sum(left, negative(right));
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const named = (value: Expression, id: string): Expression =>
  ({ ...value, opId: "sr-velocity.op." + id }) as Expression;
const equality = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: "sr-velocity.op." + id,
});
const premise = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const DOMAIN = "sr-velocity-positive-light-speed-subluminal-frame-causal-point";
const NONZERO_TIME = "sr-velocity-nonzero-elapsed-time";
const MAP_PREMISES = [
  premise("arg-sr-lorentz-map"),
  premise("arg-sr-transverse-and-inverse"),
  premise("sr-axis-normalization"),
  premise("sr-spatial-symmetry"),
  premise("sr-transverse-light-propagation"),
  teaching(DOMAIN),
  teaching(NONZERO_TIME),
];
const BETA_NONZERO = "c > 0 and |v| < c imply gamma > 0.";
const TIME_NONZERO =
  "t is nonzero; |v| < c and |w_x| <= c imply 1 + v w_x/c squared > 0.";
const SCALE_NONZERO =
  "c > 0 and |v| < c imply gamma > 0; |w_x| <= c implies 1 + v w_x/c squared > 0.";
const readings = (r0: string, r1: string, r2: string): StepReadings => ({ r0, r1, r2 });

/** Read quantities and target operations from the canonical records, rather than from letters. */
export function createSRVelocitySetup(records: SRVelocityRecords = SR_VELOCITY_RECORDS) {
  const position = canonical(records.position);
  const time = canonical(records.time);
  const inverseTime = canonical(records.inverseTime);
  const longitudinal = canonical(records.longitudinal);
  const transverse = canonical(records.transverse);
  const roots = [position, time, inverseTime, longitudinal, transverse];
  const quantity = (id: string): SymbolExpression => {
    const symbol = roots.flatMap(walk).find((node) => node.kind === "symbol" && node.quantityId === id);
    if (!symbol || symbol.kind !== "symbol")
      throw new SRVelocityError(
        "sr-velocity-missing-quantity",
        "A required canonical quantity is absent: " + id + ".",
        "sr-velocity.canonical-inputs",
      );
    return symbol;
  };
  if (
    longitudinal.left.kind !== "symbol" ||
    longitudinal.left.quantityId !== "velocityComponentXStationary" ||
    longitudinal.right.kind !== "quotient" ||
    transverse.left.kind !== "symbol" ||
    transverse.left.quantityId !== "velocityComponentYStationary" ||
    transverse.right.kind !== "quotient"
  )
    throw new SRVelocityError(
      "sr-velocity-result-shape",
      "Both composition results must give a stationary-frame component as a quotient.",
      "sr-velocity.canonical-results",
    );
  const x = quantity("coordinatePositionStationary");
  const t = quantity("coordinateTimeStationary");
  const xi = quantity("coordinatePositionMoving");
  const tau = quantity("coordinateTimeMoving");
  const v = quantity("frameSpeed");
  const c = quantity("speedOfLight");
  const beta = quantity("lorentzFactor");
  const wx = quantity("velocityComponentXMoving");
  const wy = quantity("velocityComponentYMoving");
  const y: SymbolExpression = {
    kind: "symbol",
    termId: "coordinatePositionStationary.y",
    quantityId: "coordinatePositionStationary",
    index: "y",
  };
  const delta = named(sum(number("1"), quotient(product(v, wx), square(c))), "time-correction");
  const longitudinalMotion = equality(xi, product(wx, tau), "moving-longitudinal-motion");
  const transverseMotion = equality(y, named(product(wy, tau), "moving-sideways-motion"), "sideways-motion");
  return {
    position, time, inverseTime, longitudinal, transverse,
    x, y, t, xi, tau, v, c, beta, wx, wy, delta,
    longitudinalMotion, transverseMotion,
  };
}

function replaceRule(target: Expression, replacement: Expression, citedEquality: string): RuleApplication {
  return {
    kind: "substitute",
    params: { targetId: nodeId(target), replacement, citedEquality },
  };
}
function arithmetic(
  operation: "add" | "multiply" | "divide",
  quantity: Expression,
  nonzeroCondition?: string,
  swapSides = false,
): RuleApplication {
  return {
    kind: "add-subtract-multiply-divide",
    params: {
      operation, quantity, simplify: true,
      ...(nonzeroCondition ? { nonzeroCondition } : {}),
      ...(swapSides ? { swapSides: true } : {}),
    },
  };
}
function step(
  id: string,
  from: Expression,
  to: Expression,
  rule: RuleApplication,
  reasons: StepReadings,
  sourceAnchor: string,
  previous?: string,
  move = false,
): DerivationStep {
  return {
    id, from, to, rule, reasons, sourceAnchor,
    changedSubexpressionIds: rule.kind === "substitute"
      ? [String(rule.params.targetId)]
      : [nodeId(from), nodeId(to)].filter((id): id is string => id !== null),
    reasonKind: id.endsWith("name-component") ? "definition" : "algebra",
    tool: "foundation:bridge-fractions-ratios",
    premiseRefs: [...MAP_PREMISES, ...(previous ? [teaching(previous)] : [])],
    isMove: move,
    ...(move ? { moveLabel: "Transform the time used to measure the velocity as well as the displacement." } : {}),
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-stated-assumptions",
    verification: { status: "authored-unverified" },
  };
}

/** The same builder is used in production and when testing changed canonical inputs. */
export function createSRVelocityDerivations(records: SRVelocityRecords = SR_VELOCITY_RECORDS) {
  const s = createSRVelocitySetup(records);
  const { x, y, t, xi, tau, v, c, beta, wx, wy, delta } = s;
  const x1 = substituteNode(s.longitudinalMotion, xi.termId, s.position.right);
  const x2 = substituteNode(x1, tau.termId, s.time.right);
  const x3 = equality(difference(x, product(v, t)), product(wx, difference(t, quotient(product(v, x), square(c)))), "cancel-factor");
  const x4 = equality(x, sum(product(wx, difference(t, quotient(product(v, x), square(c)))), product(v, t)), "add-frame-distance");
  const xTerm = quotient(product(wx, v, x), square(c));
  const x5 = equality(sum(x, xTerm), sum(product(wx, t), product(v, t)), "move-x-term");
  const x6 = equality(product(x, delta), product(t, sum(wx, v)), "factor");
  const longitudinalRatio = named(quotient(x, t), "longitudinal-ratio");
  const x7 = equality(longitudinalRatio, s.longitudinal.right, "divide-time");

  const longitudinalSteps = [
    step(
      "sr-velocity-longitudinal-position", s.longitudinalMotion, x1,
      replaceRule(xi, s.position.right, "The admitted section 3 map is xi = gamma (x - v t)."),
      readings(
        "Begin with the point's straight motion in k and replace its position using the coordinate map.",
        "The given motion is ξ = wξ τ. Insert ξ = β(x - vt), keeping the moving-frame time τ on the other side.",
        "The point starts at the common origin and moves uniformly in k. Its longitudinal coordinate is therefore its constant k velocity times elapsed k time. The position transformation supplies the left side, but the right side still contains a time measured in k. Substituting the position alone cannot yet give a velocity measured in K.",
      ), "sr-velocity-source-motion",
    ),
    step(
      "sr-velocity-longitudinal-time", x1, x2,
      replaceRule(tau, s.time.right, "The admitted section 3 map is tau = gamma (t - v x/c squared)."),
      readings(
        "Transform the time on the same path as well as its position.",
        "Insert τ = β(t - vx/V²) into the motion equation. The position term in this clock reading is the origin of the velocity rule's denominator.",
        "The velocity in k divides a k displacement by a k time. Expressing it through K's variables therefore requires both coordinate relations for the same event. The resulting equation is β(x - vt) = wξ β(t - vx/V²). No new velocity-composition law has been assumed; all the mixing comes from the admitted coordinate map.",
      ), "sr-velocity-source-map", "sr-velocity-longitudinal-position", true,
    ),
    step(
      "sr-velocity-longitudinal-cancel-factor", x2, x3,
      arithmetic("divide", beta, BETA_NONZERO),
      readings(
        "The same nonzero factor multiplies both sides, so divide it out.",
        "Cancel β on both sides. Its positivity follows from V > 0 and the subluminal frame condition |v| < V.",
        "For a frame moving slower than light, β = 1/sqrt(1 - v²/V²) is finite and positive. Dividing both sides by β therefore preserves the equation and leaves x - vt = wξ(t - vx/V²). This cancellation is not allowed for a frame at light speed, where the admitted coordinate transformation itself is undefined.",
      ), "sr-velocity-source-components", "sr-velocity-longitudinal-time",
    ),
    step(
      "sr-velocity-longitudinal-add-frame-distance", x3, x4,
      arithmetic("add", product(v, t)),
      readings(
        "Add the frame's displacement to both sides.",
        "Adding vt leaves x alone on the left. The right still contains x through the transformed time.",
        "The left side x - vt is the point's displacement relative to the moving origin, expressed in K coordinates. Add the same quantity vt to both sides to obtain x = wξ(t - vx/V²) + vt. At this stage ordinary addition appears in the right-hand side, but its remaining x term must still be moved and accounted for.",
      ), "sr-velocity-source-components", "sr-velocity-longitudinal-cancel-factor",
    ),
    step(
      "sr-velocity-longitudinal-move-x-term", x4, x5,
      arithmetic("add", xTerm),
      readings(
        "Bring the position contribution from the clock transformation to the left.",
        "Add v wξ x/V² to both sides. The right-hand negative position term cancels, leaving only terms proportional to t.",
        "Expand wξ(t - vx/V²) as wξ t - v wξ x/V². Adding v wξ x/V² removes the second term from the right and places it beside x on the left. Thus x + v wξ x/V² = wξ t + vt. This is the part of the algebra that a simple addition of speeds omits.",
      ), "sr-velocity-source-components", "sr-velocity-longitudinal-add-frame-distance",
    ),
    step(
      "sr-velocity-longitudinal-factor", x5, x6,
      { kind: "collect", params: { exact: true } },
      readings(
        "Collect the common position on one side and the common time on the other.",
        "Factor x from the left and t from the right. The position now carries the factor 1 + v wξ/V².",
        "Both left-hand terms contain x, and both right-hand terms contain t. Exact collection gives x(1 + v wξ/V²) = t(wξ + v). The correction is dimensionless because its numerator and denominator both have dimensions of speed squared. No small-speed approximation has been used in obtaining this factor.",
      ), "sr-velocity-source-components", "sr-velocity-longitudinal-move-x-term",
    ),
    step(
      "sr-velocity-longitudinal-divide-time", x6, x7,
      arithmetic("divide", product(t, delta), TIME_NONZERO),
      readings(
        "Divide by elapsed time and the positive correction to obtain displacement per K time.",
        "Use a nonzero elapsed t and divide by t(1 + v wξ/V²). The left becomes x/t, while the right retains the time correction in its denominator.",
        "The given point has speed at most V, so |wξ| is at most V. Together with |v| < V this gives |v wξ/V²| < 1, hence 1 + v wξ/V² > 0. The elapsed time is chosen nonzero. Both divisions are therefore admitted, and the result is x/t = (wξ + v)/(1 + v wξ/V²).",
      ), "sr-velocity-source-components", "sr-velocity-longitudinal-factor",
    ),
    step(
      "sr-velocity-longitudinal-name-component", x7, s.longitudinal,
      replaceRule(longitudinalRatio, s.longitudinal.left, "For this uniform path from the common origin, U_x is defined as x/t."),
      readings(
        "Name the resulting longitudinal velocity, measured entirely in K.",
        "Write Ux for x/t. This component formula works whether or not the point also moves sideways in k.",
        "The motion is uniform, and x and t refer to the same path and frame, so the ratio is its constant longitudinal velocity in K. Calling that component Ux distinguishes it from the paper's U, the magnitude of the full velocity. Only when the transverse component vanishes does the signed longitudinal rule supply the complete collinear motion.",
      ), "sr-velocity-source-collinear", "sr-velocity-longitudinal-divide-time",
    ),
  ];
  const y1 = substituteNode(s.inverseTime, xi.termId, product(wx, tau));
  const scale = product(beta, delta);
  const y2 = equality(t, product(beta, tau, delta), "transverse-factor-time");
  const y3 = equality(tau, quotient(t, scale), "transverse-solve-time");
  const motionSide = named(product(wy, tau), "moving-sideways-motion");
  const y4 = equality(motionSide, quotient(product(wy, t), scale), "transverse-multiply-velocity");
  const y5 = equality(y, quotient(product(wy, t), scale), "transverse-name-position");
  const transverseRatio = named(quotient(y, t), "transverse-ratio");
  const y6 = equality(transverseRatio, s.transverse.right, "transverse-divide-time");
  const transverseSteps = [
    step(
      "sr-velocity-transverse-insert-motion", s.inverseTime, y1,
      replaceRule(xi, product(wx, tau), "The specified straight motion in k is xi = w_xi tau (section 5, eq-s5-d1)."),
      readings(
        "Evaluate the inverse time transformation along the same moving point's path.",
        "Start with t = β(τ + vξ/V²) and replace ξ by wξ τ. The same longitudinal component controls the elapsed-time conversion for every direction of motion.",
        "The inverse map expresses K time in terms of k coordinates. It follows from the admitted section 3 transformation by exchanging the frame roles and reversing v. The point's longitudinal motion supplies ξ = wξ τ, so t = β(τ + v wξ τ/V²). Its sideways component has not entered this clock relation.",
      ), "sr-velocity-source-map",
    ),
    step(
      "sr-velocity-transverse-factor-time", y1, y2,
      { kind: "collect", params: { exact: true } },
      readings(
        "Factor out the moving-frame elapsed time.",
        "Collect τ to obtain t = β τ(1 + v wξ/V²). This relation supplies the denominator used to measure the sideways velocity.",
        "Both terms inside the bracket contain τ. Factoring it out is exact rational algebra and leaves the same dimensionless correction found in the longitudinal chain. The factor β remains because this chain converts elapsed time alone. It will not be cancelled by a longitudinal position transformation when the transverse coordinate is used.",
      ), "sr-velocity-source-components", "sr-velocity-transverse-insert-motion",
    ),
    step(
      "sr-velocity-transverse-solve-time", y2, y3,
      arithmetic("divide", scale, SCALE_NONZERO, true),
      readings(
        "Solve for the time recorded by k.",
        "Divide by β(1 + v wξ/V²) and put τ on the left. Both factors are positive under the stated physical conditions.",
        "The positive Lorentz factor belongs to a subluminal inertial frame. The correction is positive because |v wξ/V²| < 1. Their product cannot vanish, so τ = t/[β(1 + v wξ/V²)]. This is the elapsed k time available for the sideways displacement during elapsed K time t.",
      ), "sr-velocity-source-components", "sr-velocity-transverse-factor-time",
    ),
    step(
      "sr-velocity-transverse-multiply-velocity", y3, y4,
      arithmetic("multiply", wy),
      readings(
        "Multiply that moving-frame time by the given sideways velocity.",
        "The product wη τ is the sideways displacement in k. Multiplying both sides by wη also admits wη = 0.",
        "The point moves uniformly, so its sideways displacement is wη times elapsed τ. Multiply the time relation by that velocity on both sides. There is no division by wη: a path with no sideways motion remains allowed and gives a zero sideways displacement. The transformed time factor stays in the denominator.",
      ), "sr-velocity-source-motion", "sr-velocity-transverse-solve-time",
    ),
    step(
      "sr-velocity-transverse-name-position", y4, y5,
      replaceRule(motionSide, y, "Section 5 gives eta = w_eta tau, and the admitted equally normalized section 3 transverse map gives eta = y."),
      readings(
        "Use the transverse coordinate equality to read the same displacement in K.",
        "The specified motion gives η = wη τ, and the admitted coordinate map gives η = y. Replace the product by y.",
        "Section 3 derived the transverse coordinate equality using the normalization and symmetry of the axes and transverse light propagation. That result is a premise here, not a new assumption about a sideways force. Using η = y converts the left side to a K displacement while the right side still contains the full time-conversion factor.",
      ), "sr-velocity-source-map", "sr-velocity-transverse-multiply-velocity",
    ),
    step(
      "sr-velocity-transverse-divide-time", y5, y6,
      arithmetic("divide", t, TIME_NONZERO),
      readings(
        "Divide the sideways displacement by K's elapsed time.",
        "For nonzero t, the ratio y/t equals wη/[β(1 + v wξ/V²)]. The Lorentz factor remains in this component.",
        "Cancel the same nonzero elapsed K time from the two sides after division. A sideways coordinate is unchanged by the boost, while the time used to measure its rate changes. Consequently the sideways velocity generally differs between frames even though there is no sideways acceleration or force in this coordinate comparison.",
      ), "sr-velocity-source-components", "sr-velocity-transverse-name-position",
    ),
    step(
      "sr-velocity-transverse-name-component", y6, s.transverse,
      replaceRule(transverseRatio, s.transverse.left, "For this uniform path from the common origin, U_y is defined as y/t."),
      readings(
        "Name the sideways component of the velocity in K.",
        "Write Uy for y/t. Together, Ux and Uy describe oblique motion; their magnitude is the paper's resulting speed U.",
        "The two component relations use the same event path and the same K time. The speed magnitude can be formed only after both components have been transformed. Setting wη = 0 gives Uy = 0 and the collinear case. For an oblique path, treating Ux alone as the speed would discard part of the motion.",
      ), "sr-velocity-source-components", "sr-velocity-transverse-divide-time",
    ),
  ];
  const chain = (axis: "longitudinal" | "transverse", target: string, steps: DerivationStep[]): DerivationChain => ({
    id: "chain-sr-velocity-" + axis,
    proofRouteId: "route-sr-velocity-" + axis,
    routeKind: "pedagogical-reconstruction",
    entryAssumptions: [...MAP_PREMISES, premise("sr-velocity-straight-path-through-common-origin")],
    target,
    targetStepId: steps.at(-1)?.id,
    essentialForPrint: true,
    steps,
  });
  return {
    setup: s,
    longitudinal: chain("longitudinal", records.longitudinal.id, longitudinalSteps),
    transverse: chain("transverse", records.transverse.id, transverseSteps),
  };
}
export const srVelocityDerivations = createSRVelocityDerivations();
export const srVelocityChains = [
  srVelocityDerivations.longitudinal,
  srVelocityDerivations.transverse,
] as const;

export const srVelocityHistoricalReading = {
  r3: "Section 5 gives a uniform motion in k, transforms it to K, and obtains separate longitudinal and transverse components before discussing the speed magnitude and its collinear specialization. This reconstruction expands that algebra. Its transverse chain uses the inverse time map to keep the surviving Lorentz factor visible; it does not claim to reproduce unprinted intermediate work. The source writes V for light speed, beta for the Lorentz factor and w_xi, w_eta for the moving-frame components. Ux and Uy are introduced here for K components; the paper's U is their magnitude. These are authored explanatory drafts, and an executable algebra check does not certify historical or physics review.",
  r3Citations: ["Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §5, pp. 905–907; source anchors eq-s5-d1, eq-s5-d2 and eq-s5-d6. The coordinate map is in §3, eq-s3-d25."],
} as const;
export const srVelocitySourceLinks = [
  { id: "sr-velocity-source-motion", anchor: "eq-s5-d1", label: "Section 5: the given straight motion in k" },
  { id: "sr-velocity-source-map", anchor: "eq-s3-d25", label: "Section 3: the coordinate map used here" },
  { id: "sr-velocity-source-components", anchor: "eq-s5-d2", label: "Section 5: the transformed longitudinal and sideways motion" },
  { id: "sr-velocity-source-collinear", anchor: "eq-s5-d6", label: "Section 5: the collinear specialization" },
] as const;

/** The proof keeps canonical quantity identities; only the reader's display uses source glyphs. */
export function presentSRVelocityExpression(tree: Expression): Expression {
  const glyphs: Readonly<Record<string, string>> = {
    coordinateTimeStationary: "t", coordinateTimeMoving: "τ",
    frameSpeed: "v", speedOfLight: "V", lorentzFactor: "β",
    velocityComponentXMoving: "w_ξ", velocityComponentYMoving: "w_η",
    velocityComponentXStationary: "U_x", velocityComponentYStationary: "U_y",
  };
  const projected = projectDerivationSymbols(tree, (symbol) => {
    if (symbol.quantityId === "coordinatePositionStationary") return symbol.index === "y" ? "y" : "x";
    if (symbol.quantityId === "coordinatePositionMoving") return symbol.index === "y" ? "η" : "ξ";
    const glyph = glyphs[symbol.quantityId];
    if (!glyph)
      throw new SRVelocityError("sr-velocity-missing-glyph", "No velocity-composition glyph for " + symbol.quantityId + ".", "sr-velocity.presentation");
    return glyph;
  });
  const removeCoordinateIndex = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(removeCoordinateIndex);
    if (value === null || typeof value !== "object") return value;
    const node = value as Partial<SymbolExpression>;
    const coordinate = node.kind === "symbol" && ["coordinatePositionStationary", "coordinatePositionMoving"].includes(node.quantityId ?? "");
    return Object.fromEntries(Object.entries(value).filter(([key]) => !(coordinate && key === "index")).map(([key, child]) => [key, removeCoordinateIndex(child)]));
  };
  return removeCoordinateIndex(projected) as Expression;
}
export function presentSRVelocityChain(chain: DerivationChain): DerivationChain {
  return {
    ...chain,
    steps: chain.steps.map((step) => {
      const original = [...walk(step.from), ...walk(step.to)];
      const from = presentSRVelocityExpression(step.from);
      const to = presentSRVelocityExpression(step.to);
      const projected = [...walk(from), ...walk(to)];
      return {
        ...step, from, to,
        changedSubexpressionIds: step.changedSubexpressionIds.map((id) => {
          const index = original.findIndex((node) => nodeId(node) === id);
          return index < 0 ? id : (nodeId(projected[index] as Expression) ?? id);
        }),
      };
    }),
  };
}
