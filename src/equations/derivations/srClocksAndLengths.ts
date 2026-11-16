/**
 * SR §4: two measurement protocols applied to the already admitted §3 maps.
 * Subtracting two events keeps arbitrary clock zeros and endpoint positions visible.
 * This teaching reconstruction checks algebra, not the physical premises or source review.
 */
import inverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import lengthRecord from "../../../content/equations/special-relativity/eq-model-sr-length-contraction.json";
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-lorentz-factor.json";
import positionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import clockRecord from "../../../content/equations/special-relativity/eq-model-sr-time-dilation.json";
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
export type SRClocksAndLengthsRecords = Readonly<{
  inverseTime: CanonicalRecord;
  position: CanonicalRecord;
  factor: CanonicalRecord;
  clock: CanonicalRecord;
  length: CanonicalRecord;
}>;
export const SR_CLOCKS_AND_LENGTHS_RECORDS: SRClocksAndLengthsRecords = {
  inverseTime: inverseTimeRecord,
  position: positionRecord,
  factor: factorRecord,
  clock: clockRecord,
  length: lengthRecord,
};

export class SRClocksAndLengthsError extends DerivationSchemaError {
  constructor(
    readonly code: "sr-clock-length-canonical-mismatch" | "sr-clock-length-missing-glyph",
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
const difference = (left: Expression, right: Expression): Expression =>
  sum(left, { kind: "negate", argument: right });
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
const named = (value: Expression, id: string): Expression =>
  ({ ...value, opId: "sr-clock-length.op." + id }) as Expression;
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: "sr-clock-length.op." + id,
});
const t = symbol("coordinateTimeStationary");
const x = symbol("coordinatePositionStationary");
const tp = symbol("coordinateTimeMoving");
const xp = symbol("coordinatePositionMoving");
const v = symbol("frameSpeed");
const c = symbol("speedOfLight");
const gamma = symbol("lorentzFactor");
const elapsed = symbol("eventSeparationTemporalStationary");
const proper = symbol("properTimeElapsed");
const length = symbol("lengthMeasuredStationary");
const rest = symbol("lengthProper");
const t1 = symbol(t.quantityId, "1"),
  t2 = symbol(t.quantityId, "2");
const x1 = symbol(x.quantityId, "1"),
  x2 = symbol(x.quantityId, "2");
const tp1 = symbol(tp.quantityId, "1"),
  tp2 = symbol(tp.quantityId, "2");
const xp1 = symbol(xp.quantityId, "1"),
  xp2 = symbol(xp.quantityId, "2");
const deltaT = named(difference(t2, t1), "stationary-time-interval");
const deltaTp = named(difference(tp2, tp1), "moving-time-interval");
const deltaX = named(difference(x2, x1), "stationary-endpoint-separation");
const deltaXp = named(difference(xp2, xp1), "moving-endpoint-separation");

/** The input maps and output meanings must keep their canonical frame direction and dimensions. */
export function createSRClocksAndLengthsSetup(
  records: SRClocksAndLengthsRecords = SR_CLOCKS_AND_LENGTHS_RECORDS,
) {
  const expected = {
    inverseTime: equation(
      t,
      product(gamma, sum(tp, quotient(product(v, xp), square(c)))),
      "inverse-time",
    ),
    position: equation(xp, product(gamma, difference(x, product(v, t))), "position"),
    factor: equation(
      gamma,
      quotient(number("1"), {
        kind: "root",
        degree: 2,
        radicand: difference(number("1"), quotient(square(v), square(c))),
      }),
      "factor",
    ),
    clock: equation(elapsed, product(gamma, proper), "clock-result"),
    length: equation(length, quotient(rest, gamma), "length-result"),
  };
  const canonical = {} as Record<keyof SRClocksAndLengthsRecords, Relation>;
  for (const key of Object.keys(expected) as (keyof SRClocksAndLengthsRecords)[]) {
    const record = records[key];
    const tree = projectDerivationSymbols(record.tree as Expression, (value) => value.quantityId);
    if (
      record.id !== SR_CLOCKS_AND_LENGTHS_RECORDS[key].id ||
      !structurallyEqual(tree, expected[key])
    )
      throw new SRClocksAndLengthsError(
        "sr-clock-length-canonical-mismatch",
        "The clock and length calculation requires the stated coordinate maps, positive Lorentz factor and measurement quantities.",
        record.id,
      );
    canonical[key] = tree as Relation;
  }
  const atEvent = (map: Relation, event: "1" | "2"): Relation => {
    let result: Expression = map;
    for (const quantity of [t, x, tp, xp])
      result = substituteNode(result, quantity.termId, symbol(quantity.quantityId, event));
    return result as Relation;
  };
  return Object.freeze({
    ...canonical,
    firstClockEvent: atEvent(canonical.inverseTime, "1"),
    secondClockEvent: atEvent(canonical.inverseTime, "2"),
    firstRodEvent: atEvent(canonical.position, "1"),
    secondRodEvent: atEvent(canonical.position, "2"),
  });
}

const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const mapPremises = [
  historical("arg-sr-lorentz-map"),
  historical("arg-sr-transverse-and-inverse"),
  teaching("sr-clock-length-inertial-domain"),
];
const clockPremise = teaching("sr-clock-length-same-resting-clock");
const rodPremise = teaching("sr-clock-length-resting-rigid-rod");
const simultaneityPremise = teaching("sr-clock-length-stationary-simultaneity");
const NONZERO_GAMMA = "c > 0 and |v| < c select the positive finite gamma, so gamma is nonzero.";
const readings = (r0: string, r1: string, r2: string): StepReadings => ({ r0, r1, r2 });
const replace = (
  targetId: string,
  replacement: Expression,
  citedEquality: string,
): RuleApplication => ({
  kind: "substitute",
  params: { targetId, replacement, citedEquality },
});
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
    changedSubexpressionIds: [nodeId(from), nodeId(to)].filter((id): id is string => id !== null),
    reasonKind: "algebra",
    isMove: false,
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    verification: { status: "authored-unverified" },
    ...options,
  };
}
function chain(
  id: string,
  target: string,
  assumptions: readonly PremiseRef[],
  steps: readonly DerivationStep[],
): DerivationChain {
  return {
    id: "chain-sr-" + id,
    proofRouteId: "route-sr-" + id + "-measurement",
    routeKind: "pedagogical-reconstruction",
    entryAssumptions: assumptions,
    target,
    targetStepId: steps.at(-1)?.id,
    essentialForPrint: true,
    steps,
  };
}

export function createSRClocksAndLengthsDerivations(
  records: SRClocksAndLengthsRecords = SR_CLOCKS_AND_LENGTHS_RECORDS,
) {
  const setup = createSRClocksAndLengthsSetup(records);
  const firstMappedTime = named(setup.firstClockEvent.right, "first-mapped-time-left");
  const clockDifference = equation(
    named(difference(t2, firstMappedTime), "stationary-time-interval"),
    difference(setup.secondClockEvent.right, setup.firstClockEvent.right),
    "clock-subtraction",
  );
  const bothClockEvents = substituteNode(clockDifference, nodeId(firstMappedTime)!, t1);
  const sameClock = substituteNode(bothClockEvents, xp2.termId, xp1);
  const clockIntervals = equation(deltaT, product(gamma, deltaTp), "clock-intervals");
  const properClock = substituteNode(clockIntervals, nodeId(deltaTp)!, proper);
  const clock = chain(
    "moving-clock",
    records.clock.id,
    [...mapPremises, clockPremise],
    [
      step(
        "sr-clock-subtract-first-event",
        setup.secondClockEvent,
        clockDifference,
        {
          kind: "add-subtract-multiply-divide",
          params: { operation: "subtract", quantity: setup.firstClockEvent.right, simplify: true },
        },
        readings(
          "Compare two ticks instead of relying on where a clock's zero was set.",
          "Start from the inverse time map for the second tick. Subtract the first tick's mapped stationary-frame time from both sides.",
          "Apply t = γ(t′ + vx′/c²) to event 2, then subtract γ(t′₁ + vx′₁/c²). This begins with the admitted §3 map, not with a clock-rate formula. Both events are described in the same pair of inertial frames with the same v and γ.",
        ),
        mapPremises,
        "sr-clock-length-source-map",
      ),
      step(
        "sr-clock-map-first-event",
        clockDifference,
        bothClockEvents,
        replace(
          nodeId(firstMappedTime)!,
          t1,
          "Apply the same canonical inverse time map to event 1: t₁ = γ(t′₁ + vx′₁/c²).",
        ),
        readings(
          "Use that same coordinate map for the first tick.",
          "The subtracted expression on the left is t₁ by the same inverse map. Keep the two moving-frame position terms on the right until the measurement identifies which events were chosen.",
          "Subtract γ(t′₁ + vx′₁/c²) from γ(t′₂ + vx′₂/c²). Neither t′₁ nor x′₁ is assumed zero. For unrelated events, a position-dependent correction remains; the time-dilation conclusion is not available yet. The remaining correction is proportional to x′₂ − x′₁. Only a stated choice of events can remove it; the coordinate map alone does not.",
        ),
        mapPremises,
        "sr-clock-length-source-map",
      ),
      step(
        "sr-clock-same-place",
        bothClockEvents,
        sameClock,
        replace(xp2.termId, xp1, "The two ticks belong to one clock at rest in k, so x′₂ = x′₁."),
        readings(
          "Choose two ticks of the same clock, at one place in its own frame.",
          "The moving clock is at rest in k. Its two ticks have the same x′ coordinate, even when that coordinate is not zero.",
          "This is the measurement choice: x′₂ = x′₁. It would be wrong to impose Δx = 0 in K for a clock moving through K, or to use two distant moving clocks and call their interval one clock's elapsed time.",
        ),
        [clockPremise],
        "sr-clock-length-source-clock",
        {
          isMove: true,
          reasonKind: "definition",
          moveLabel: "Use one clock's co-located ticks, not an arbitrary pair of events.",
        },
      ),
      step(
        "sr-clock-cancel-position",
        sameClock,
        clockIntervals,
        { kind: "collect", params: { exact: true } },
        readings(
          "The equal position contributions cancel, leaving gamma times the clock interval.",
          "The same vx′/c² term occurs in each reading. Subtracting it leaves γ(t′₂ − t′₁).",
          "Collect the exact difference: γ(t′₂ + vx′₁/c²) − γ(t′₁ + vx′₁/c²) = γ(t′₂ − t′₁). The cancellation uses a common inertial boost and equal moving-frame positions, not a zero clock reading or a zero clock position.",
        ),
        [teaching("sr-clock-same-place")],
        "sr-clock-length-source-clock",
      ),
      step(
        "sr-clock-name-proper-interval",
        clockIntervals,
        properClock,
        replace(
          nodeId(deltaTp)!,
          proper,
          "For one ideal clock at rest in inertial k, Δτ = t′₂ − t′₁ is its proper elapsed time.",
        ),
        readings(
          "Name the interval that the moving clock itself records.",
          "Use Δτ for the elapsed time on this one clock. This identification uses its rest-frame position; it is not a claim about every difference of moving-frame coordinate times.",
          "The modern proper-time interval Δτ equals t′₂ − t′₁ along this resting ideal clock. The paper uses τ for k's time coordinate, so the modern Δτ used here is a distinct notation and meaning. This equality uses the clock's single inertial worldline; a coordinate-time difference between separate clocks has no such interpretation.",
        ),
        [clockPremise],
        "sr-clock-length-source-clock",
        { reasonKind: "definition" },
      ),
      step(
        "sr-clock-name-stationary-interval",
        properClock,
        setup.clock,
        replace(
          nodeId(deltaT)!,
          elapsed,
          "Δt = t₂ − t₁ is the stationary frame's elapsed coordinate time between the same ticks.",
        ),
        readings(
          "The stationary clocks assign gamma times as much time to those same two ticks.",
          "Name t₂ − t₁ as Δt. The result is Δt = γΔτ. Since γ is at least one, the moving clock records no more time between the ticks than the stationary frame assigns.",
          "The two ticks occur at different places in K when v is nonzero, so Δt uses K's synchronized clocks at those places. The result is conditional on the §3 map and an inertial ideal clock. It neither establishes a round-trip aging comparison nor extends the inertial result to accelerated or curved paths.",
        ),
        [clockPremise, teaching("sr-clock-length-inertial-domain")],
        "sr-clock-length-source-clock",
        { reasonKind: "definition" },
      ),
    ],
  );

  const firstMappedPosition = named(setup.firstRodEvent.right, "first-mapped-position-left");
  const rodDifference = equation(
    named(difference(xp2, firstMappedPosition), "moving-endpoint-separation"),
    difference(setup.secondRodEvent.right, setup.firstRodEvent.right),
    "rod-subtraction",
  );
  const bothRodEvents = substituteNode(rodDifference, nodeId(firstMappedPosition)!, xp1);
  const simultaneous = substituteNode(bothRodEvents, t2.termId, t1);
  const rodIntervals = equation(deltaXp, product(gamma, deltaX), "rod-intervals");
  const namedRest = substituteNode(rodIntervals, nodeId(deltaXp)!, rest);
  const namedLengths = substituteNode(namedRest, nodeId(deltaX)!, length);
  const rod = chain(
    "simultaneous-length",
    records.length.id,
    [...mapPremises, rodPremise, simultaneityPremise],
    [
      step(
        "sr-length-subtract-first-event",
        setup.secondRodEvent,
        rodDifference,
        {
          kind: "add-subtract-multiply-divide",
          params: { operation: "subtract", quantity: setup.firstRodEvent.right, simplify: true },
        },
        readings(
          "Compare the two endpoint marks instead of choosing one endpoint as the origin.",
          "Start from x′₂ = γ(x₂ − vt₂), then subtract γ(x₁ − vt₁) from both sides. Both marks belong to the same rigid rod at rest in k.",
          "Apply the canonical position map to endpoint event 2 and subtract the first endpoint's mapped position. The rest-frame endpoint locations are fixed because the rod is at rest in k; the measuring frame still has to say when its two marks are made.",
        ),
        [...mapPremises, rodPremise],
        "sr-clock-length-source-map",
      ),
      step(
        "sr-length-map-first-event",
        rodDifference,
        bothRodEvents,
        replace(
          nodeId(firstMappedPosition)!,
          xp1,
          "Apply the same canonical position map to event 1: x′₁ = γ(x₁ − vt₁).",
        ),
        readings(
          "Use the coordinate map for both ends of the rod.",
          "The subtracted expression on the left is x′₁ by the same position map. Before choosing the measurement times, the difference on the right includes the rod's motion between those times.",
          "The exact difference is x′₂ − x′₁ = γ[(x₂ − x₁) − v(t₂ − t₁)]. If the stationary observer marks one end later than the other, x₂ − x₁ alone is not the rod's simultaneous length. The extra term v(t₂ − t₁) is the displacement during the interval between endpoint marks, so the chosen timing is part of the measurement.",
        ),
        mapPremises,
        "sr-clock-length-source-map",
      ),
      step(
        "sr-length-same-time",
        bothRodEvents,
        simultaneous,
        replace(t2.termId, t1, "Measure the two endpoint positions at one time in K: t₂ = t₁."),
        readings(
          "Mark both ends at the same time in the frame that measures the length.",
          "Choose t₂ = t₁ in the stationary system K. This is a simultaneous coordinate measurement, not a photograph of arriving light.",
          "The measurement protocol is Δt = 0 in K, not Δt′ = 0 in k. Those two simultaneity conditions select different endpoint events when v is nonzero. Holding the wrong frame's time equal would give a different separation, not the measured moving length.",
        ),
        [simultaneityPremise],
        "sr-clock-length-source-length",
        {
          isMove: true,
          reasonKind: "definition",
          moveLabel: "Choose simultaneous endpoint marks in the measuring frame.",
        },
      ),
      step(
        "sr-length-cancel-motion",
        simultaneous,
        rodIntervals,
        { kind: "collect", params: { exact: true } },
        readings(
          "The equal motion contributions cancel, leaving a relation between the two separations.",
          "Both marks use the same vt. Their difference is x′₂ − x′₁ = γ(x₂ − x₁).",
          "Collect γ(x₂ − vt₁) − γ(x₁ − vt₁) exactly. The cancellation needs equal K times; it does not require t₁ = 0 or x₁ = 0. γ is constant because the frames have constant relative velocity.",
        ),
        [teaching("sr-length-same-time")],
        "sr-clock-length-source-length",
      ),
      step(
        "sr-length-name-rest-separation",
        rodIntervals,
        namedRest,
        replace(
          nodeId(deltaXp)!,
          rest,
          "The ordered endpoints of the rigid rod are at rest in k, so their fixed separation x′₂ − x′₁ is its positive rest length L₀.",
        ),
        readings(
          "The fixed separation in the rod's own frame is its rest length.",
          "Name x′₂ − x′₁ as L₀. The endpoints do not move in k, so their separation is the same even though K's simultaneous marks need not be simultaneous in k.",
          "Order the rod's endpoints along the positive x′ direction so L₀ > 0. Their coordinates remain constant in k. This rest condition is why a difference of their coordinates is the rest length despite the differing moving-frame times of the selected events.",
        ),
        [rodPremise],
        "sr-clock-length-source-length",
        { reasonKind: "definition" },
      ),
      step(
        "sr-length-name-measurement",
        namedRest,
        namedLengths,
        replace(
          nodeId(deltaX)!,
          length,
          "Because t₂ = t₁ in K, x₂ − x₁ is the positive simultaneous measured length L.",
        ),
        readings(
          "The separation between the simultaneous stationary marks is the measured length.",
          "Name x₂ − x₁ as L. The condition just imposed is what makes this separation a length measurement of the moving rod.",
          "The equation is now L₀ = γL. A spatial difference between events at unequal K times cannot be given this same L label. Light-travel delay would require a separate optical model.",
        ),
        [simultaneityPremise],
        "sr-clock-length-source-length",
        { reasonKind: "definition" },
      ),
      step(
        "sr-length-divide-factor",
        namedLengths,
        setup.length,
        {
          kind: "add-subtract-multiply-divide",
          params: {
            operation: "divide",
            quantity: gamma,
            simplify: true,
            swapSides: true,
            nonzeroCondition: NONZERO_GAMMA,
          },
        },
        readings(
          "Divide the rest length by gamma to get the moving length.",
          "Divide both sides by the same positive γ and exchange the sides: L = L₀/γ. At rest γ is one; at nonzero subluminal speed it is greater than one.",
          "The admitted domain c > 0 and |v| < c selects a positive finite γ, so division is defined. The result shortens only the direction of motion. The unchanged transverse axes of the source's sphere use the separate §3 transverse coordinate equations, not this one-dimensional calculation.",
        ),
        [teaching("sr-clock-length-inertial-domain")],
        "sr-clock-length-source-length",
      ),
    ],
  );
  return Object.freeze({ setup, clock, length: rod });
}

export const srClocksAndLengths = createSRClocksAndLengthsDerivations();
export const srClockLengthChains = [srClocksAndLengths.clock, srClocksAndLengths.length] as const;
const glyphs: Readonly<Record<string, string>> = {
  coordinateTimeStationary: "t",
  coordinatePositionStationary: "x",
  coordinateTimeMoving: "t'",
  coordinatePositionMoving: "x'",
  frameSpeed: "v",
  speedOfLight: "c",
  lorentzFactor: "\\gamma",
  eventSeparationTemporalStationary: "\\Delta t",
  properTimeElapsed: "\\Delta\\tau",
  lengthMeasuredStationary: "L",
  lengthProper: "L_0",
};
export function presentSRClockLengthExpression(tree: Expression): Expression {
  return projectDerivationSymbols(tree, (value) => {
    const glyph = glyphs[value.quantityId];
    if (!glyph)
      throw new SRClocksAndLengthsError(
        "sr-clock-length-missing-glyph",
        "No clock or length glyph for " + value.quantityId + ".",
        "sr-clock-length.presentation",
      );
    return glyph;
  });
}
export function presentSRClockLengthChain(source: DerivationChain): DerivationChain {
  const displayIds = new Map<string, string>();
  for (const current of source.steps)
    for (const node of [...walk(current.from), ...walk(current.to)])
      if (node.kind === "symbol")
        displayIds.set(node.termId, glyphs[node.quantityId] ?? node.termId);
  return {
    ...source,
    steps: source.steps.map((current) => ({
      ...current,
      from: presentSRClockLengthExpression(current.from),
      to: presentSRClockLengthExpression(current.to),
      changedSubexpressionIds: current.changedSubexpressionIds.map(
        (id) => displayIds.get(id) ?? id,
      ),
    })),
  };
}

export const srClockLengthAssumptions = [
  {
    id: "arg-sr-lorentz-map",
    label: "The coordinate transformation is already admitted",
    explanation:
      "Use the position map and inverse time map from §3 for the same two events in inertial frames K and k. This calculation does not rederive that map or use the clock or length result as a premise.",
  },
  {
    id: "sr-clock-length-inertial-domain",
    label: "A common, subluminal inertial boost",
    explanation:
      "Both frames use identically calibrated rods and clocks, c is positive, and their signed relative speed satisfies |v| < c. The same positive finite Lorentz factor applies to both events.",
  },
  {
    id: clockPremise.ref,
    label: "One ideal clock at rest in k",
    explanation:
      "The two ticks occur at the same moving-frame position. Their difference of moving coordinate times is that clock's proper elapsed time; two distant clocks do not meet this condition.",
  },
  {
    id: rodPremise.ref,
    label: "A rigid rod at rest along the moving x axis",
    explanation:
      "Its ordered endpoint coordinates in k stay fixed, and their positive separation is its rest length. The result concerns coordinate measurements, not received-light appearance.",
  },
  {
    id: simultaneityPremise.ref,
    label: "Simultaneous endpoint marks in K",
    explanation:
      "The stationary observer locates both ends at equal stationary-frame times. Equal moving-frame times would select a different pair of endpoint events.",
  },
] as const;
export const srClockLengthSourceLinks = [
  {
    id: "sr-clock-length-source-map",
    anchor: "eq-s3-d25",
    label: "The §3 coordinate map used as a premise",
  },
  {
    id: "sr-clock-length-source-length",
    anchor: "s4-p1",
    label: "§4: the sphere's points at one stationary time",
  },
  {
    id: "sr-clock-length-source-clock",
    anchor: "s4-p5",
    label: "§4: the clock at rest in the moving system",
  },
] as const;
export const srClockLengthHistoricalReading = {
  r3: "This is a teaching reconstruction of §4 using two events and modern interval notation. Einstein measures the sphere at t = 0 and obtains the clock rate by substituting x = vt into the forward time transformation. Subtracting two instances of the already admitted maps makes the measurement conditions and the cancellation of arbitrary starting readings explicit. Modern Δτ denotes one clock's proper elapsed time; the paper's τ is the moving system's time coordinate. The source's later curved-path extension and low-speed approximation are distinct claims.",
  r3Citations: [
    "A. Einstein, Zur Elektrodynamik bewegter Körper (1905), §4, Annalen der Physik 17, pp. 903–906; §3 supplies the coordinate transformation.",
  ],
} as const;
