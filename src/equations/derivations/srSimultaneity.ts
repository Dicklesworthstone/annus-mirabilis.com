/**
 * Subtract two events in the admitted §3 time map, then impose simultaneity in K.
 * This is a pedagogical consequence of that map, not the earlier §2 light-chase
 * derivation. No clock zero, event position or signed separation is suppressed.
 */
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-lorentz-factor.json";
import timeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import offsetRecord from "../../../content/equations/special-relativity/eq-model-sr-simultaneity-offset.json";
import { type Expression, nodeId, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
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
export type SRSimultaneityRecords = Readonly<{
  time: CanonicalRecord;
  factor: CanonicalRecord;
  offset: CanonicalRecord;
}>;
export const SR_SIMULTANEITY_RECORDS: SRSimultaneityRecords = {
  time: timeRecord,
  factor: factorRecord,
  offset: offsetRecord,
};

export class SRSimultaneityError extends DerivationSchemaError {
  constructor(
    readonly code: "sr-simultaneity-canonical-mismatch" | "sr-simultaneity-missing-glyph",
    message: string,
    path: string,
  ) {
    super(message, path);
  }
}

const symbol = (quantityId: string, event?: "1" | "2"): SymbolExpression => ({
  kind: "symbol",
  quantityId,
  termId: quantityId + (event ? ".event" + event : ""),
  ...(event ? { index: event } : {}),
});
const number = (value: string): Expression => ({ kind: "number", value });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const difference = (left: Expression, right: Expression): Expression => sum(left, negative(right));
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
const named = (tree: Expression, id: string): Expression =>
  ({ ...tree, opId: "sr-simultaneity.op." + id }) as Expression;
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: "sr-simultaneity.op." + id,
});
const t = symbol("coordinateTimeStationary");
const x = symbol("coordinatePositionStationary");
const tp = symbol("coordinateTimeMoving");
const v = symbol("frameSpeed");
const c = symbol("speedOfLight");
const gamma = symbol("lorentzFactor");
const elapsed = symbol("eventSeparationTemporalStationary");
const elapsedMoving = symbol("eventSeparationTemporalMoving");
const separation = symbol("eventSeparationSpatial");
const t1 = symbol(t.quantityId, "1"),
  t2 = symbol(t.quantityId, "2");
const x1 = symbol(x.quantityId, "1"),
  x2 = symbol(x.quantityId, "2");
const tp1 = symbol(tp.quantityId, "1"),
  tp2 = symbol(tp.quantityId, "2");
const deltaT = named(difference(t2, t1), "stationary-time-difference");
const deltaTp = named(difference(tp2, tp1), "moving-time-difference");
const deltaX = named(difference(x2, x1), "signed-position-difference");

/** Reject a changed sign, frame, Lorentz branch or conclusion at the canonical boundary. */
export function createSRSimultaneitySetup(
  records: SRSimultaneityRecords = SR_SIMULTANEITY_RECORDS,
) {
  const expected = {
    time: equation(tp, product(gamma, difference(t, quotient(product(v, x), square(c)))), "time"),
    factor: equation(
      gamma,
      quotient(number("1"), {
        kind: "root",
        degree: 2,
        radicand: difference(number("1"), quotient(square(v), square(c))),
      }),
      "factor",
    ),
    offset: equation(
      elapsedMoving,
      quotient(negative(product(gamma, v, separation)), square(c)),
      "offset",
    ),
  };
  const canonical = {} as Record<keyof SRSimultaneityRecords, Relation>;
  for (const key of Object.keys(expected) as (keyof SRSimultaneityRecords)[]) {
    const record = records[key];
    const tree = projectDerivationSymbols(record.tree as Expression, (value) => value.quantityId);
    if (record.id !== SR_SIMULTANEITY_RECORDS[key].id || !structurallyEqual(tree, expected[key]))
      throw new SRSimultaneityError(
        "sr-simultaneity-canonical-mismatch",
        "The simultaneity calculation needs the stated time map, positive Lorentz factor and signed time offset.",
        record.id,
      );
    canonical[key] = tree as Relation;
  }
  const atEvent = (event: "1" | "2"): Relation => {
    let result: Expression = canonical.time;
    for (const quantity of [t, x, tp])
      result = substituteNode(result, quantity.termId, symbol(quantity.quantityId, event));
    return result as Relation;
  };
  return Object.freeze({ ...canonical, firstEvent: atEvent("1"), secondEvent: atEvent("2") });
}

const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const mapPremise = teaching("arg-sr-lorentz-map");
const domainPremise = teaching("sr-simultaneity-inertial-domain");
const differencesPremise = teaching("sr-simultaneity-ordered-event-differences");
const simultaneousPremise = teaching("sr-simultaneity-equal-stationary-times");
const mapPremises = [mapPremise, domainPremise];
const readings = (r0: string, r1: string, r2: string): StepReadings => ({ r0, r1, r2 });
const replace = (
  targetId: string,
  replacement: Expression,
  citedEquality: string,
): RuleApplication => ({ kind: "substitute", params: { targetId, replacement, citedEquality } });
function step(
  id: string,
  from: Expression,
  to: Expression,
  rule: RuleApplication,
  reasons: StepReadings,
  premiseRefs: readonly PremiseRef[],
  sourceAnchor: string,
  options: Partial<Pick<DerivationStep, "isMove" | "moveLabel" | "reasonKind">> = {},
): DerivationStep {
  return {
    id,
    from,
    to,
    rule,
    reasons,
    premiseRefs,
    sourceAnchor,
    tool:
      rule.kind === "substitute"
        ? "foundation:frames-events"
        : "foundation:bridge-fractions-ratios",
    changedSubexpressionIds:
      rule.kind === "substitute"
        ? [rule.params.targetId as string]
        : [nodeId(from), nodeId(to)].filter((id): id is string => id !== null),
    reasonKind: "algebra",
    isMove: false,
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-stated-assumptions",
    verification: { status: "authored-unverified" },
    ...options,
  };
}

export function createSRSimultaneityDerivation(
  records: SRSimultaneityRecords = SR_SIMULTANEITY_RECORDS,
) {
  const setup = createSRSimultaneitySetup(records);
  const firstMappedTime = named(setup.firstEvent.right, "first-mapped-time-left");
  const subtracted = equation(
    difference(tp2, firstMappedTime),
    difference(setup.secondEvent.right, setup.firstEvent.right),
    "subtract-first-event",
  );
  const bothEvents = substituteNode(subtracted, nodeId(firstMappedTime)!, tp1);
  const collected = equation(
    deltaTp,
    product(gamma, difference(deltaT, quotient(product(v, deltaX), square(c)))),
    "collect-event-differences",
  );
  const namedMoving = substituteNode(collected, nodeId(deltaTp)!, elapsedMoving);
  const namedStationary = substituteNode(namedMoving, nodeId(deltaT)!, elapsed);
  const namedSeparation = substituteNode(namedStationary, nodeId(deltaX)!, separation);
  const simultaneous = substituteNode(namedSeparation, elapsed.termId, number("0"));
  const chain: DerivationChain = {
    id: "chain-sr-simultaneity-offset",
    proofRouteId: "route-sr-simultaneity-from-admitted-map",
    routeKind: "pedagogical-reconstruction",
    entryAssumptions: [...mapPremises, differencesPremise, simultaneousPremise],
    target: records.offset.id,
    targetStepId: "sr-simultaneity-read-offset",
    essentialForPrint: true,
    steps: [
      step(
        "sr-simultaneity-subtract-first-event",
        setup.secondEvent,
        subtracted,
        {
          kind: "add-subtract-multiply-divide",
          params: { operation: "subtract", quantity: setup.firstEvent.right, simplify: true },
        },
        readings(
          "Compare two events without placing either at the clock's zero.",
          "Start with the admitted time map for event 2. Subtract the mapped time of event 1 from both sides, using the same frame speed and Lorentz factor.",
          "Apply t′ = γ(t − vx/c²) to event 2, then subtract γ(t₁ − vx₁/c²) from both sides. The same inertial frames describe both events. Neither t₁ nor x₁ has been set to zero, so the result will concern differences and cannot depend on a conveniently chosen origin.",
        ),
        mapPremises,
        "sr-simultaneity-source-map",
      ),
      step(
        "sr-simultaneity-map-first-event",
        subtracted,
        bothEvents,
        replace(
          nodeId(firstMappedTime)!,
          tp1,
          "Apply the admitted time map to event 1: t′₁ = γ(t₁ − vx₁/c²).",
        ),
        readings(
          "The first event's mapped time is its time coordinate in k.",
          "Use the same map for event 1 to replace the subtracted expression on the left by t′₁. The left side now compares the two moving-frame times.",
          "The substitution uses t′₁ = γ(t₁ − vx₁/c²), not an assumption about simultaneity. Both stationary times and both stationary positions remain on the right. At this stage either frame may assign a nonzero interval to the pair; the choice of simultaneous events has not yet been made.",
        ),
        mapPremises,
        "sr-simultaneity-source-map",
      ),
      step(
        "sr-simultaneity-collect-differences",
        bothEvents,
        collected,
        { kind: "collect", params: { exact: true } },
        readings(
          "The offset depends on the separation between the events.",
          "Collect the two time terms and the two position terms. The result contains t₂ − t₁ and x₂ − x₁, with the same factor γ outside.",
          "Expand γ(t₂ − vx₂/c²) − γ(t₁ − vx₁/c²), then collect it as γ[(t₂ − t₁) − v(x₂ − x₁)/c²]. All cancellations are exact on c > 0. The position difference is signed: reversing the event order changes both coordinate differences rather than replacing the distance by its absolute value.",
        ),
        mapPremises,
        "sr-simultaneity-source-map",
      ),
      step(
        "sr-simultaneity-name-moving-interval",
        collected,
        namedMoving,
        replace(
          nodeId(deltaTp)!,
          elapsedMoving,
          "Define Δt′ = t′₂ − t′₁ for the same ordered pair.",
        ),
        readings(
          "Name the moving frame's time difference.",
          "Write Δt′ for t′₂ − t′₁. The prime names the frame, while the subscripts name events; neither notation refers to a signal's arrival at a camera.",
          "This is a definition of the ordered coordinate difference in k. It compares the readings assigned to event 2 and event 1 by k's synchronized clocks. It is not generally the proper time of one clock, because the two events need not share a moving-frame position.",
        ),
        [differencesPremise],
        "sr-simultaneity-source-events",
        { reasonKind: "definition" },
      ),
      step(
        "sr-simultaneity-name-stationary-interval",
        namedMoving,
        namedStationary,
        replace(nodeId(deltaT)!, elapsed, "Define Δt = t₂ − t₁ for the same ordered pair."),
        readings(
          "Name the stationary frame's time difference.",
          "Write Δt for t₂ − t₁. Keep it visible before imposing equal times, so the special case can be distinguished from the general event transformation.",
          "The equality Δt = t₂ − t₁ is a definition, not a claim that the difference is zero. A pair chosen at different stationary times retains this term. Erasing it for an arbitrary pair would drop a physical part of the transformation and could reverse the inferred event order.",
        ),
        [differencesPremise],
        "sr-simultaneity-source-events",
        { reasonKind: "definition" },
      ),
      step(
        "sr-simultaneity-name-separation",
        namedStationary,
        namedSeparation,
        replace(
          nodeId(deltaX)!,
          separation,
          "Define the signed Δx = x₂ − x₁ for the same ordered pair.",
        ),
        readings(
          "Name the signed separation along the direction of motion.",
          "Write Δx for x₂ − x₁. The result so far is the full difference relation Δt′ = γ(Δt − vΔx/c²), valid for this admitted linear map.",
          "Only the separation along the relative motion enters the time correction. A negative Δx means event 2 lies behind event 1 in K; it is allowed. This definition introduces no division by v or Δx, so a stationary frame change and zero longitudinal separation both remain in the calculation's domain.",
        ),
        [differencesPremise],
        "sr-simultaneity-source-events",
        { reasonKind: "definition" },
      ),
      step(
        "sr-simultaneity-choose-equal-times",
        namedSeparation,
        simultaneous,
        replace(elapsed.termId, number("0"), "Choose events simultaneous in K: Δt = t₂ − t₁ = 0."),
        readings(
          "Now choose the two events to be simultaneous in K.",
          "Set Δt to zero because this pair was selected at one stationary-frame time. Do not also set Δt′ to zero: the calculation asks what the moving frame assigns.",
          "The measurement choice is equality of the two K times, not equality of both frames' times. The general relation therefore becomes Δt′ = γ(0 − vΔx/c²). The zero can be imposed at any common t₁ = t₂, not only at the coordinate origin. No assumption that the events lie on a rod is required for this pairwise result.",
        ),
        [simultaneousPremise],
        "sr-simultaneity-source-events",
        {
          isMove: true,
          moveLabel: "Select equal stationary times, and let the moving time difference follow.",
          reasonKind: "definition",
        },
      ),
      step(
        "sr-simultaneity-read-offset",
        simultaneous,
        setup.offset,
        { kind: "collect", params: { exact: true } },
        readings(
          "The moving times differ unless the speed or longitudinal separation vanishes.",
          "Collect the zero term to obtain Δt′ = −γvΔx/c². With positive v and Δx, event 2 has the earlier time coordinate in k.",
          "The positive finite γ and c² leave the sign opposite to vΔx. Reversing the motion or the order of the two events reverses the offset. If v = 0 or Δx = 0, the offset is exactly zero; no cancellation has excluded either case. This compares coordinate assignments to the same events, not light arriving together and not a change in a clock's mechanism.",
        ),
        [domainPremise, simultaneousPremise],
        "sr-simultaneity-source-events",
      ),
    ],
  };
  return Object.freeze({ setup, generalDifference: namedSeparation, chain });
}

export const srSimultaneity = createSRSimultaneityDerivation();
export const srSimultaneityChain = srSimultaneity.chain;
export const srSimultaneityAssumptions = [
  {
    id: mapPremise.ref,
    label: "The time transformation is already admitted",
    explanation:
      "Use the §3 time map for each event. This is a pedagogical consequence of that map, not the source-order §2 light-chase derivation and not a premise used to construct the map.",
  },
  {
    id: domainPremise.ref,
    label: "The same inertial frames describe both events",
    explanation:
      "The axes are aligned, clocks in each frame follow the stated synchronization convention, c is positive and |v| < c. Both events use the same signed v and positive finite Lorentz factor. These physical and domain premises are admitted, not established by the algebra.",
  },
  {
    id: differencesPremise.ref,
    label: "Keep the same ordered pair of events",
    explanation:
      "Each difference is event 2 minus event 1. Δx is signed longitudinal separation, not a rod's rest length, and Δt′ is a coordinate-time difference, not generally a single clock's proper time.",
  },
  {
    id: simultaneousPremise.ref,
    label: "Equal stationary times are the chosen condition",
    explanation:
      "Select t₂ = t₁ in K; this does not impose equality of the moving times. The conclusion allows v = 0 and Δx = 0, where the offset vanishes.",
  },
] as const;

const glyphs: Readonly<Record<string, string>> = {
  coordinateTimeStationary: "t",
  coordinatePositionStationary: "x",
  coordinateTimeMoving: "t'",
  frameSpeed: "v",
  speedOfLight: "c",
  lorentzFactor: "\\gamma",
  eventSeparationTemporalStationary: "\\Delta t",
  eventSeparationTemporalMoving: "\\Delta t'",
  eventSeparationSpatial: "\\Delta x",
};
export function presentSRSimultaneityExpression(tree: Expression): Expression {
  return projectDerivationSymbols(tree, (value) => {
    const glyph = glyphs[value.quantityId];
    if (!glyph)
      throw new SRSimultaneityError(
        "sr-simultaneity-missing-glyph",
        "No simultaneity glyph for " + value.quantityId + ".",
        "sr-simultaneity.presentation",
      );
    return glyph;
  });
}
export function presentSRSimultaneityChain(source: DerivationChain): DerivationChain {
  const displayIds = new Map<string, string>();
  for (const current of source.steps)
    for (const node of [...walk(current.from), ...walk(current.to)])
      if (node.kind === "symbol")
        displayIds.set(node.termId, glyphs[node.quantityId] ?? node.termId);
  return {
    ...source,
    steps: source.steps.map((current) => ({
      ...current,
      from: presentSRSimultaneityExpression(current.from),
      to: presentSRSimultaneityExpression(current.to),
      changedSubexpressionIds: current.changedSubexpressionIds.map(
        (id) => displayIds.get(id) ?? id,
      ),
    })),
  };
}

export const srSimultaneitySourceLinks = [
  {
    id: "sr-simultaneity-source-map",
    anchor: "eq-s3-d25",
    label: "The later §3 time transformation used by this teaching route",
  },
  {
    id: "sr-simultaneity-source-events",
    anchor: "s2-p8",
    label: "The §2 conclusion about simultaneity, reached there by the light-chase argument",
  },
] as const;

export const srSimultaneityHistoricalReading = {
  r3: "The paper's §2 argues from the unequal light-travel times along a moving rod and the synchronization convention of §1. It has not yet derived the coordinate transformation. This teaching route instead imports §3's completed time map to quantify the disagreement for an ordered pair of events. Every dependency here is labeled pedagogical reconstruction, so this consequence cannot become a historical premise of the map that it uses. Modern primes label the moving frame and Δ names a difference; the source uses τ for moving coordinate time, not for a single clock's proper elapsed time. The exact algebra check is separate from historical and physical review.",
  r3Citations: [
    "Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §§2–3. Source anchors eq-s2-d2, eq-s2-d3, s2-p8 and eq-s3-d25.",
  ],
} as const;
