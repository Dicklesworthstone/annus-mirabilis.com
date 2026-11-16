/**
 * SR §7: one plane-wave phase, expressed in two frames, fixes frequency and direction.
 * The §3 inverse map is an admitted premise. The phase is measured in cycles, so its
 * time coefficient is ordinary frequency; multiplying every line by 2π changes nothing.
 * Rotate the transverse axes so that this ray lies in the x-y plane, without changing
 * the boost. No light-quantum hypothesis, sound medium or invariant-interval axiom enters.
 */
import aberrationRecord from "../../../content/equations/special-relativity/eq-model-sr-aberration.json";
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import ratioRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-ratio.json";
import inversePositionRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-position.json";
import inverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef, StepReadings } from "./types.ts";

type SymbolNode = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
const symbol = (termId: string, quantityId: string, index?: string): SymbolNode => ({
  kind: "symbol",
  termId,
  quantityId,
  ...(index ? { index } : {}),
});
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression, id?: string): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
  ...(id ? { opId: `sr-doppler.op.${id}` } : {}),
});
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  opId: `sr-doppler.op.${id}`,
  left,
  right,
});
const one: Expression = { kind: "number", value: "1" };

const glyphs: Readonly<Record<string, string>> = {
  coordinateTimeStationary: "t",
  coordinateTimeMoving: "t'",
  coordinatePositionStationary: "x",
  coordinatePositionMoving: "x'",
  waveFrequencyStationary: "ν",
  waveFrequencyMoving: "ν'",
  lorentzFactor: "γ",
  frameSpeed: "v",
  speedOfLight: "c",
  propagationAngleStationary: "φ",
  propagationAngleMoving: "φ'",
  dopplerFactor: "q",
};

function canonical(record: { readonly tree: unknown }): Relation {
  return projectDerivationSymbols(
    record.tree as Expression,
    (value) => glyphs[value.quantityId] ?? value.termId,
  ) as Relation;
}

const inverseTime = canonical(inverseTimeRecord);
const inversePosition = canonical(inversePositionRecord);
export const srDopplerCoordinatePremises = { time: inverseTime, position: inversePosition };
export const srDopplerFactor = canonical(factorRecord);
export const srDopplerRatio = canonical(ratioRecord);
export const srDopplerAberration = canonical(aberrationRecord);

const time = symbol("t", "coordinateTimeStationary");
const position = symbol("x", "coordinatePositionStationary");
const sideways = symbol("y", "coordinatePositionStationary", "y");
const timeMoving = symbol("t'", "coordinateTimeMoving");
const positionMoving = symbol("x'", "coordinatePositionMoving");
const sidewaysMoving = symbol("y'", "coordinatePositionMoving", "y");
const frequency = symbol("ν", "waveFrequencyStationary");
const frequencyMoving = symbol("ν'", "waveFrequencyMoving");
const gamma = symbol("γ", "lorentzFactor");
const velocity = symbol("v", "frameSpeed");
const lightSpeed = symbol("c", "speedOfLight");
const angle = symbol("φ", "propagationAngleStationary");
const angleMoving = symbol("φ'", "propagationAngleMoving");
const cosine: Expression = { kind: "function", name: "cos", argument: angle };
const sine: Expression = { kind: "function", name: "sin", argument: angle };
const cosineMoving: Expression = { kind: "function", name: "cos", argument: angleMoving };
const sineMoving: Expression = { kind: "function", name: "sin", argument: angleMoving };
const speedRatio = quotient(velocity, lightSpeed);
const bracket = sum(one, negative(product(speedRatio, cosine)));
const frequencyCoefficient = product(frequency, gamma, bracket);
const longitudinalCoefficient = product(frequency, gamma, sum(cosine, negative(speedRatio)));
const sidewaysCoefficient = product(frequency, sine);

export const srDopplerCoordinates = [timeMoving, positionMoving, sidewaysMoving] as const;
export const srDopplerPhase: Expression = product(
  frequency,
  sum(
    time,
    negative(quotient(sum(product(position, cosine), product(sideways, sine)), lightSpeed)),
  ),
);
const withTime = substituteNode(srDopplerPhase, time.termId, inverseTime.right);
const withPosition = substituteNode(withTime, position.termId, inversePosition.right);
const withSideways = substituteNode(withPosition, sideways.termId, sidewaysMoving);
export const srDopplerCollectedPhase: Expression = sum(
  product(frequencyCoefficient, timeMoving),
  negative(quotient(product(longitudinalCoefficient, positionMoving), lightSpeed)),
  negative(quotient(product(sidewaysCoefficient, sidewaysMoving), lightSpeed)),
);

/** Coefficients of the same independent t', x', y' in the moving-wave description. */
export const srDopplerCoefficientEquations = {
  frequency: equation(frequencyMoving, frequencyCoefficient, "frequency-coefficient"),
  longitudinal: equation(
    product(frequencyMoving, cosineMoving),
    longitudinalCoefficient,
    "longitudinal-coefficient",
  ),
  sideways: equation(
    product(frequencyMoving, sineMoving),
    sidewaysCoefficient,
    "sideways-coefficient",
  ),
} as const;

export const srDopplerDirectionSine = equation(
  sineMoving,
  quotient(sine, product(gamma, bracket)),
  "direction-sine",
);
const rawFrequencyRatio = equation(
  quotient(frequencyMoving, frequency, "frequency-ratio"),
  srDopplerFactor.right,
  "frequency-ratio-result",
);
const withFrequency = (relation: Relation): Relation =>
  substituteNode(relation, frequencyMoving.termId, frequencyCoefficient) as Relation;

const premise = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const reconstruction = (ref: string): PremiseRef => ({
  ref,
  edgeType: "pedagogical-reconstruction",
});
export const srDopplerAssumptions = [
  {
    id: "sr-doppler-admitted-inverse-coordinate-map",
    label: "The previously established inverse coordinate map",
    explanation:
      "Use section 3's inverse Lorentz transformation with identically normalized axes. " +
      "The moving frame travels at signed speed v along the stationary x axis. " +
      "Rotate the transverse axes so this plane wave lies in x-y; y = y′ remains unchanged.",
  },
  {
    id: "sr-doppler-same-plane-wave-phase",
    label: "The same wave crests at the same events",
    explanation:
      "Both descriptions assign the same phase to every event of one vacuum plane wave. " +
      "Phase is written in cycles here: ν[t − (x cos φ + y sin φ)/c]. " +
      "The moving frame has the same plane-wave form with its own frequency and direction.",
  },
  {
    id: "sr-doppler-independent-coordinate-coefficients",
    label: "Equality at all events, not just on a ray",
    explanation:
      "The transformed phase is linear in independently variable t′, x′ and y′. " +
      "Matching their coefficients identifies frequency and direction together. " +
      "Agreement on one selected crest or along one trajectory would not suffice.",
  },
  {
    id: "sr-doppler-positive-frequency-subluminal-domain",
    label: "A positive frequency and a subluminal frame",
    explanation:
      "c and ν are positive, |v| < c, and γ = 1/√(1 − v²/c²) is the positive factor. " +
      "Since |cos φ| ≤ 1, 1 − (v/c) cos φ is positive, so ν′ is positive and every division " +
      "is defined. The boundary |v| = c is not an inertial frame.",
  },
] as const;
const entryAssumptions = srDopplerAssumptions.map((assumption) => reconstruction(assumption.id));
const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "vacuum-plane-wave-subluminal-boost",
  verification: { status: "authored-unverified" },
  isMove: false,
} as const;
function substitution(
  id: string,
  from: Expression,
  targetId: string,
  replacement: Expression,
  to: Expression,
  citedEquality: string,
  reasons: StepReadings,
  refs: readonly PremiseRef[],
  sourceAnchor = "sr-doppler-source-phase",
): DerivationStep {
  return {
    ...draft,
    id,
    from,
    to,
    rule: { kind: "substitute", params: { targetId, replacement, citedEquality } },
    changedSubexpressionIds: [targetId],
    reasonKind: "algebra",
    reasons,
    premiseRefs: refs,
    tool: "foundation:frames-events",
    sourceAnchor,
  };
}
function chain(id: string, target: string, steps: readonly DerivationStep[]): DerivationChain {
  return {
    id: `chain-sr-doppler-${id}`,
    proofRouteId: `route-sr-doppler-${id}`,
    routeKind: "pedagogical-reconstruction",
    entryAssumptions,
    target,
    targetStepId: steps.at(-1)?.id,
    essentialForPrint: true,
    steps,
  };
}

export const srDopplerPhaseChain = chain("phase", "sr-doppler-phase-coefficients", [
  substitution(
    "sr-doppler-insert-inverse-time",
    srDopplerPhase,
    time.termId,
    inverseTime.right,
    withTime,
    "Section 3's inverse time map: t = γ(t′ + vx′/c²).",
    {
      r0: "Write the stationary clock reading using the moving frame's clock and position.",
      r1: "Replace t by γ(t′ + vx′/c²). The place-dependent part matters: keeping only γt′ would lose part of the wave's direction change.",
      r2: "This is the already established inverse map, not a fresh postulate about light. It expresses the same event's stationary time in moving coordinates. The plus sign follows from reversing the forward boost; it is not a choice of Doppler sign.",
    },
    [premise(inverseTimeRecord.id), reconstruction(srDopplerAssumptions[0].id)],
  ),
  substitution(
    "sr-doppler-insert-inverse-position",
    withTime,
    position.termId,
    inversePosition.right,
    withPosition,
    "Section 3's inverse position map: x = γ(x′ + vt′).",
    {
      r0: "Write the stationary position using the same moving coordinates.",
      r1: "Replace x by γ(x′ + vt′). Time and position are transformed together for the same wave and the same event.",
      r2: "The spatial term now contributes to the coefficient of t′ as well as x′. The term −νγ(v/c)cos φ multiplying t′ is what combines with the clock term to set the new frequency. Changing only the clock would omit it.",
    },
    [premise(inversePositionRecord.id), reconstruction("sr-doppler-insert-inverse-time")],
  ),
  substitution(
    "sr-doppler-keep-sideways-coordinate",
    withPosition,
    sideways.termId,
    sidewaysMoving,
    withSideways,
    "The admitted axis normalization for this x boost gives y = y′.",
    {
      r0: "The sideways coordinate keeps the same value under this boost.",
      r1: "Use y = y′ from the normalized coordinate map. The ray was placed in the x-y plane by choosing the transverse axes, not by changing its physical direction.",
      r2: "No z term is needed after orienting the transverse axes to the ray. This is a rotation about the boost axis, so it preserves φ and the longitudinal Doppler problem. The remaining sideways coefficient is −ν sin φ/c; frequency and direction will still change together when it is written as −ν′ sin φ′/c.",
    },
    [
      reconstruction(srDopplerAssumptions[0].id),
      reconstruction("sr-doppler-insert-inverse-position"),
    ],
  ),
  {
    ...draft,
    id: "sr-doppler-collect-phase-coefficients",
    from: withSideways,
    to: srDopplerCollectedPhase,
    rule: { kind: "collect", params: { exact: true } },
    changedSubexpressionIds: [timeMoving.termId, positionMoving.termId, sidewaysMoving.termId],
    reasonKind: "algebra",
    reasons: {
      r0: "Collect the clock terms together and the two position terms separately. One expression now exposes both changes.",
      r1: "The t′ coefficient is νγ[1 − (v/c)cos φ]. The x′ coefficient is −νγ[cos φ − v/c]/c, and the y′ coefficient is −ν sin φ/c. Each is obtained from the same phase substitution.",
      r2: "Expand the two inverse-map brackets and regroup by independently variable t′, x′ and y′. Exact rational algebra checks the whole phase identity, retaining cos φ and sin φ as unchanged functions. No numerical fit, ray-specific event, or desired Doppler formula supplies these coefficients.",
    },
    tool: "foundation:bridge-mathematical-punctuation",
    premiseRefs: [reconstruction("sr-doppler-keep-sideways-coordinate")],
    sourceAnchor: "sr-doppler-source-coefficients",
    isMove: true,
    moveLabel: "Match every coordinate's coefficient in the same wave phase.",
  },
]);

export const srDopplerFrequencyChain = chain("frequency", factorRecord.id, [
  {
    ...draft,
    id: "sr-doppler-frequency-ratio",
    from: srDopplerCoefficientEquations.frequency,
    to: rawFrequencyRatio,
    rule: {
      kind: "add-subtract-multiply-divide",
      params: {
        operation: "divide",
        quantity: frequency,
        nonzeroCondition: "The stationary frequency ν is positive.",
        simplify: true,
      },
    },
    changedSubexpressionIds: [frequencyMoving.termId, frequency.termId],
    reasonKind: "algebra",
    reasons: {
      r0: "The clock coefficient gives the new frequency. Divide by the original frequency to compare them.",
      r1: "At a fixed moving position the phase increases by ν′ cycles each second. Its t′ coefficient is therefore ν′. Dividing that coefficient equality by the positive original ν gives ν′/ν = γ[1 − (v/c)cos φ].",
      r2: "The preceding phase must equal ν′[t′ − (x′cos φ′ + y′sin φ′)/c] for all events. Equality of the t′ coefficients gives the first line here, independently checked against the collected phase. Division by ν is allowed only for a wave with positive frequency; it never divides by the angle, speed, or a component of direction.",
    },
    tool: "foundation:bridge-fractions-ratios",
    premiseRefs: [
      reconstruction("sr-doppler-collect-phase-coefficients"),
      reconstruction(srDopplerAssumptions[2].id),
      reconstruction(srDopplerAssumptions[3].id),
    ],
    sourceAnchor: "sr-doppler-source-frequency",
  },
  substitution(
    "sr-doppler-name-the-ratio",
    rawFrequencyRatio,
    "sr-doppler.op.frequency-ratio",
    srDopplerRatio.left,
    srDopplerFactor,
    "The canonical definition q = ν′/ν names the frequency ratio.",
    {
      r0: "Call that frequency ratio q.",
      r1: "The symbol q shortens ν′/ν. It introduces no new physical assumption: the phase calculation has already determined the ratio.",
      r2: "Use the same definition record as the reader's equation explorer. The canonical Doppler equation is the conclusion of the substitution and division, not an input used to construct the phase. The factor depends on the unprimed angle φ; substituting φ′ would change the question.",
    },
    [premise(ratioRecord.id), reconstruction("sr-doppler-frequency-ratio")],
    "sr-doppler-source-frequency",
  ),
]);

function directionChain(
  id: "aberration" | "sideways-direction",
  coefficient: Relation,
  result: Relation,
  readings: StepReadings,
): DerivationChain {
  const replaced = withFrequency(coefficient);
  return chain(id, id === "aberration" ? aberrationRecord.id : "sr-doppler-direction-sine", [
    substitution(
      `sr-doppler-${id}-frequency`,
      coefficient,
      frequencyMoving.termId,
      frequencyCoefficient,
      replaced,
      "Use ν′ = νγ[1 − (v/c)cos φ], established by the time coefficient of this same phase.",
      {
        r0: "Use the frequency already fixed by this wave's clock coefficient.",
        r1: "The position coefficient contains ν′ times a direction cosine. Replace ν′ with the value obtained from the time coefficient of the same transformed phase.",
        r2: "Frequency and direction are coupled because they are coefficients of one expression. The frequency used here is the result already established above, with the same ν, v, c and unprimed φ. An independent guessed frequency would not reproduce the phase at all events.",
      },
      [
        reconstruction("sr-doppler-collect-phase-coefficients"),
        reconstruction("sr-doppler-frequency-ratio"),
        reconstruction(srDopplerAssumptions[2].id),
      ],
      "sr-doppler-source-direction",
    ),
    {
      ...draft,
      id: `sr-doppler-${id}-divide`,
      from: replaced,
      to: result,
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: frequencyCoefficient,
          nonzeroCondition: "ν > 0, γ > 0 and 1 − (v/c)cos φ > 0 for |v| < c.",
          simplify: true,
        },
      },
      changedSubexpressionIds: [frequency.termId, angleMoving.termId],
      reasonKind: "algebra",
      reasons: readings,
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [
        reconstruction(`sr-doppler-${id}-frequency`),
        reconstruction(srDopplerAssumptions[3].id),
      ],
      sourceAnchor: "sr-doppler-source-direction",
    },
  ]);
}

export const srDopplerAberrationChain = directionChain(
  "aberration",
  srDopplerCoefficientEquations.longitudinal,
  srDopplerAberration,
  {
    r0: "Divide out the new frequency to find the new direction along the motion.",
    r1: "The x′ coefficients give ν′cos φ′ = νγ(cos φ − v/c). Divide by ν′ = νγ[1 − (v/c)cos φ]. The common positive νγ cancels, leaving the aberration formula.",
    r2: "For |v/c| < 1 and |cos φ| ≤ 1, the bracket 1 − (v/c)cos φ is strictly positive. The cancelled ν and γ are also positive. Thus the division is defined even for v = 0 or cos φ = 0. A ray that crosses the boost at right angles in K has cos φ′ = −v/c, so it generally does not cross at right angles in k.",
  },
);
export const srDopplerSidewaysChain = directionChain(
  "sideways-direction",
  srDopplerCoefficientEquations.sideways,
  srDopplerDirectionSine,
  {
    r0: "The sideways coefficient fixes the rest of the new direction.",
    r1: "The y′ coefficients give ν′sin φ′ = ν sin φ. Divide by the same positive ν′. Only ν cancels, leaving sin φ′ = sin φ/[γ(1 − (v/c)cos φ)].",
    r2: "Keeping the sideways coefficient avoids reconstructing a direction from its cosine alone. For the chosen plane and 0 ≤ φ ≤ π the sine is nonnegative, fixing the same half-plane. A different transverse orientation gives the same factor for each transverse direction cosine. This calculation does not divide by sin φ, so the parallel and head-on rays remain admitted.",
  },
);

export const srDopplerChains = [
  srDopplerPhaseChain,
  srDopplerFrequencyChain,
  srDopplerAberrationChain,
  srDopplerSidewaysChain,
] as const;
export const srDopplerSourceLinks = [
  { id: "sr-doppler-source-phase", anchor: "eq-s7-d1", label: "The plane-wave phase in §7" },
  {
    id: "sr-doppler-source-coefficients",
    anchor: "eq-s7-d3",
    label: "The frequency coefficient of the transformed phase",
  },
  { id: "sr-doppler-source-frequency", anchor: "eq-s7-d7", label: "The frequency transformation" },
  { id: "sr-doppler-source-direction", anchor: "eq-s7-d9", label: "The aberration formula" },
] as const;

/** The y glyph already names its axis; keep the semantic index in the checked trees only. */
export function presentSRDopplerExpression(tree: Expression): Expression {
  const project = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(project);
    if (value === null || typeof value !== "object") return value;
    const node = value as Partial<SymbolNode>;
    const coordinate =
      node.kind === "symbol" &&
      ["coordinatePositionStationary", "coordinatePositionMoving"].includes(node.quantityId ?? "");
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !(coordinate && key === "index"))
        .map(([key, child]) => [key, project(child)]),
    );
  };
  return project(tree) as Expression;
}

export function presentSRDopplerChain(value: DerivationChain): DerivationChain {
  return {
    ...value,
    steps: value.steps.map((step) => ({
      ...step,
      from: presentSRDopplerExpression(step.from),
      to: presentSRDopplerExpression(step.to),
    })),
  };
}
