/**
 * SR §8: transform a plane wave into a perfect mirror's rest frame, reflect it,
 * and transform back. The resulting frequency and direction feed the energy
 * account at the moving surface. All fluxes are per unit mirror area in K.
 *
 * These are exact conditional algebra chains. The physical wave, reflection,
 * moving-boundary and work premises remain explicit. Pressure at zero speed
 * uses a separately named continuity assumption, never division by zero.
 */
import aberrationRecord from "../../../content/equations/special-relativity/eq-model-sr-aberration.json";
import dopplerRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import mirrorRecord from "../../../content/equations/special-relativity/eq-model-sr-mirror-frequency.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef, StepReadings } from "./types.ts";

type SymbolNode = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
const symbol = (termId: string, quantityId: string): SymbolNode => ({
  kind: "symbol",
  termId,
  quantityId,
});
const number = (value: string): Expression => ({ kind: "number", value });
const one = number("1");
const two = number("2");
const zero = number("0");
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const difference = (left: Expression, right: Expression): Expression =>
  sum(left, negative(right));
const quotient = (
  numerator: Expression,
  denominator: Expression,
  opId?: string,
): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
  ...(opId ? { opId } : {}),
});
const square = (base: Expression, opId?: string): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
  ...(opId ? { opId } : {}),
});
const equality = (left: Expression, right: Expression): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});

export const srMirrorSymbols = {
  b: symbol("b", "speedRatio"),
  a: symbol("a", "directionCosineStationary"),
  moving: symbol("a'", "directionCosineMoving"),
  reflectedMoving: symbol("a''", "directionCosineMoving"),
  reflected: symbol("a_r", "directionCosineStationary"),
  gamma: symbol("γ", "lorentzFactor"),
  ratio: symbol("r", "reflectedFrequencyRatio"),
  density: symbol("u", "lightEnergyDensityStationary"),
  lightSpeed: symbol("c", "speedOfLight"),
  incidentFlux: symbol("J_in", "intensity"),
  reflectedFlux: symbol("J_out", "intensity"),
  pressure: symbol("P", "radiationPressureMirror"),
} as const;
const { b, a, moving, reflectedMoving, reflected, gamma, ratio, density, lightSpeed } =
  srMirrorSymbols;
const denominator = difference(one, square(b));
const numerator = sum(one, negative(product(two, b, a)), square(b));
const approach = difference(a, b);
const gammaSquared = square(gamma, "sr-mirror.gamma-squared");

const glyphs: Readonly<Record<string, string>> = {
  waveFrequencyStationary: "ν",
  waveFrequencyReflectedStationary: "ν_r",
  lorentzFactor: "γ",
  frameSpeed: "v",
  speedOfLight: "c",
  propagationAngleStationary: "φ",
  propagationAngleMoving: "φ'",
  dopplerFactor: "q",
};

/** Name only v/c and the direction cosines; leave canonical equation structure intact. */
export function abbreviateSRMirror(expression: Expression): Expression {
  const projected = projectDerivationSymbols(
    expression,
    (value) => glyphs[value.quantityId] ?? value.termId,
  );
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (value === null || typeof value !== "object") return value;
    const node = value as Expression;
    if (
      node.kind === "quotient" &&
      node.numerator.kind === "symbol" &&
      node.numerator.quantityId === "frameSpeed" &&
      node.denominator.kind === "symbol" &&
      node.denominator.quantityId === "speedOfLight"
    )
      return b;
    if (node.kind === "function" && node.name === "cos" && node.argument.kind === "symbol") {
      if (node.argument.quantityId === "propagationAngleStationary") return a;
      if (node.argument.quantityId === "propagationAngleMoving") return moving;
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
  };
  return visit(projected) as Expression;
}
const canonical = (record: { readonly tree: unknown }): Relation =>
  abbreviateSRMirror(record.tree as Expression) as Relation;
export const srMirrorCanonicalFrequency = canonical(mirrorRecord);
export const srMirrorIncoming = {
  frequencyFactor: canonical(dopplerRecord).right,
  direction: canonical(aberrationRecord).right,
} as const;

/** The return boost reverses b and uses the outgoing direction in the mirror frame. */
const inverseOf = (expression: Expression): Expression =>
  substituteNode(substituteNode(expression, b.termId, negative(b)), a.termId, reflectedMoving);
export const srMirrorInverse = {
  frequencyFactor: inverseOf(srMirrorIncoming.frequencyFactor),
  direction: inverseOf(srMirrorIncoming.direction),
} as const;

export const srMirrorFrequency = equality(
  srMirrorCanonicalFrequency.left,
  quotient(numerator, denominator),
);
export const srMirrorDirection = equality(
  reflected,
  quotient(difference(product(two, b), product(sum(one, square(b)), a)), numerator),
);
export const srMirrorIncidentFlux = equality(
  srMirrorSymbols.incidentFlux,
  product(density, lightSpeed, approach),
);
export const srMirrorOutgoingFlux = equality(
  srMirrorSymbols.reflectedFlux,
  product(density, lightSpeed, approach, ratio),
);
export const srMirrorPressure = equality(
  srMirrorSymbols.pressure,
  quotient(product(two, density, square(approach)), denominator),
);
export const srMirrorEnergyTransfer = equality(
  difference(srMirrorSymbols.incidentFlux, srMirrorSymbols.reflectedFlux),
  quotient(product(two, density, lightSpeed, b, square(approach)), denominator),
);

export const srMirrorAssumptions = [
  {
    id: "sr-mirror-subluminal-interception",
    label: "The light reaches a subluminal mirror",
    explanation:
      "b = v/c and a = cos φ refer to K. Take c > 0, |b| < 1, −1 ≤ a ≤ 1 and a > b. " +
      "The last inequality says the ray catches the moving surface. It excludes grazing and " +
      "non-interception. The denominators 1 − b², 1 − ba and 1 − 2ba + b² are strictly positive.",
  },
  {
    id: "sr-mirror-admitted-wave-transforms",
    label: "The preceding wave transformations",
    explanation:
      "Admit §7's frequency, direction and field-amplitude transformations for a vacuum " +
      "plane wave. The return transformation reverses b and uses the reflected direction " +
      "in the mirror frame. Its amplitude factor equals its frequency factor.",
  },
  {
    id: "sr-mirror-elastic-specular-reflection",
    label: "Ideal reflection in the mirror's rest frame",
    explanation:
      "The stationary perfect mirror preserves the wave's frequency and amplitude and reverses " +
      "its normal direction cosine: a″ = −a′. The mirror has prescribed uniform speed. " +
      "Finite-body recoil, absorption and material dispersion are outside this model.",
  },
  {
    id: "sr-mirror-moving-boundary-energy",
    label: "Energy crossing the moving surface",
    explanation:
      "The incident energy density is u > 0; the reflected density in K is u r². " +
      "The incident and outgoing normal speeds relative to the mirror are c(a − b) and " +
      "c(b − a_r). Thus the two energy rates per unit mirror area are uc(a − b) and " +
      "u r²c(b − a_r), measured per unit K time.",
  },
  {
    id: "sr-mirror-work-balance",
    label: "The energy difference is mechanical work",
    explanation:
      "Energy balance identifies J_in − J_out with P v = Pbc. For b ≠ 0 this determines " +
      "the pressure P. When b = 0 the work is zero for any pressure, so this equation " +
      "alone cannot determine the stationary pressure.",
  },
  {
    id: "sr-mirror-stationary-continuity",
    label: "A separate continuity premise at rest",
    explanation:
      "For fixed incident density u and fixed a > 0, assume the ideal-reflector pressure " +
      "is continuous as b approaches zero. The nonzero-speed expression then tends to " +
      "2u a². This physical continuity premise is stated separately from the checked algebra.",
  },
] as const;
const reconstruction = (ref: string): PremiseRef => ({
  ref,
  edgeType: "pedagogical-reconstruction",
});
const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const entryAssumptions = srMirrorAssumptions.map((assumption) => reconstruction(assumption.id));
const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "perfect-reflector-prescribed-subluminal-motion",
  verification: { status: "authored-unverified" },
  isMove: false,
} as const;

function substitution(
  id: string,
  from: Expression,
  targetId: string,
  replacement: Expression,
  citedEquality: string,
  reasons: StepReadings,
  premiseRefs: readonly PremiseRef[],
  sourceAnchor = "sr-mirror-source-reflection",
): DerivationStep {
  return {
    ...draft,
    id,
    from,
    to: substituteNode(from, targetId, replacement),
    rule: { kind: "substitute", params: { targetId, replacement, citedEquality } },
    changedSubexpressionIds: [targetId],
    reasonKind: "algebra",
    reasons,
    premiseRefs,
    tool: "foundation:frames-events",
    sourceAnchor,
  };
}
function collect(
  id: string,
  from: Expression,
  to: Expression,
  reasons: StepReadings,
  premiseRefs: readonly PremiseRef[],
  sourceAnchor = "sr-mirror-source-reflection",
): DerivationStep {
  return {
    ...draft,
    id,
    from,
    to,
    rule: { kind: "collect", params: { exact: true } },
    changedSubexpressionIds: [b.termId, a.termId],
    reasonKind: "algebra",
    reasons,
    premiseRefs,
    tool: "foundation:bridge-fractions-ratios",
    sourceAnchor,
  };
}
function chain(
  id: string,
  target: string,
  steps: readonly DerivationStep[],
  extraPremises: readonly PremiseRef[] = [],
): DerivationChain {
  return {
    id: "chain-sr-mirror-" + id,
    proofRouteId: "route-sr-mirror-" + id,
    routeKind: "pedagogical-reconstruction",
    entryAssumptions: [...entryAssumptions, ...extraPremises],
    target,
    targetStepId: steps.at(-1)?.id,
    essentialForPrint: true,
    steps,
  };
}

const reflectedFrequency = substitution(
  "sr-mirror-frequency-reflect",
  equality(
    srMirrorFrequency.left,
    product(srMirrorIncoming.frequencyFactor, srMirrorInverse.frequencyFactor),
  ),
  reflectedMoving.termId,
  negative(moving),
  "In the mirror frame, elastic specular reflection gives a″ = −a′ and preserves frequency.",
  {
    r0: "Reflect where the mirror is at rest, then transform the outgoing wave back.",
    r1: "The first Doppler factor takes the incoming wave into k. Reflection there preserves " +
      "frequency and reverses the normal cosine. The inverse boost has −b and the outgoing " +
      "cosine a″, not the original direction a.",
    r2: "Multiply the incident K→k frequency factor by the reflected k→K factor. The same " +
      "positive Lorentz factor occurs twice. Substituting a″ = −a′ implements the physical " +
      "rest-frame reflection; changing the sign of b alone would undo the incoming boost.",
  },
  [
    historical(dopplerRecord.id),
    reconstruction("sr-mirror-admitted-wave-transforms"),
    reconstruction("sr-mirror-elastic-specular-reflection"),
  ],
);
const frequencyDirection = substitution(
  "sr-mirror-frequency-incident-direction",
  reflectedFrequency.to,
  moving.termId,
  srMirrorIncoming.direction,
  "The admitted incoming aberration law gives a′ = (a − b)/(1 − ba).",
  {
    r0: "Use the incoming ray's direction in the mirror frame.",
    r1: "Replace a′ with (a − b)/(1 − ba), from the same wave transformation used for the " +
      "frequency. The incidence condition a > b makes this cosine positive.",
    r2: "All inputs now refer to K: b is the signed mirror speed divided by c, and a is " +
      "the incoming propagation cosine. Since |b| < 1 and |a| ≤ 1, 1 − ba is positive, " +
      "so this substitution does not cross a singular direction.",
  },
  [historical(aberrationRecord.id), reconstruction(reflectedFrequency.id)],
);
const frequencyCollected = collect(
  "sr-mirror-frequency-collect",
  frequencyDirection.to,
  equality(srMirrorFrequency.left, product(gammaSquared, numerator)),
  {
    r0: "The two Doppler factors combine into one frequency change.",
    r1: "Collect γ(1 − ba) × γ[1 − b(a − b)/(1 − ba)]. The common nonzero " +
      "bracket cancels, leaving γ²(1 − 2ba + b²).",
    r2: "Exact rational algebra checks the entire product, with b, a and γ still free. " +
      "The term −2ba includes both the inward and outward frame changes. Reusing a " +
      "as the return angle would not give this polynomial.",
  },
  [reconstruction(frequencyDirection.id), reconstruction("sr-mirror-subluminal-interception")],
);
const frequencyGamma = substitution(
  "sr-mirror-frequency-lorentz-factor",
  frequencyCollected.to,
  "sr-mirror.gamma-squared",
  quotient(one, denominator),
  "The positive subluminal Lorentz factor satisfies γ² = 1/(1 − b²).",
  {
    r0: "Write the Lorentz factor using the signed mirror speed.",
    r1: "Replace γ² by 1/(1 − b²). The denominator is strictly positive for |b| < 1.",
    r2: "Only the definition of the already admitted Lorentz factor is used. This " +
      "substitution is valid for either sign of b and also at b = 0; it neither " +
      "assumes a desired frequency shift nor divides by the speed.",
  },
  [reconstruction(frequencyCollected.id), reconstruction("sr-mirror-subluminal-interception")],
);
export const srMirrorFrequencyChain = chain("frequency", mirrorRecord.id, [
  {
    ...reflectedFrequency,
    isMove: true,
    moveLabel: "Reflect in the mirror's rest frame, then transform the outgoing wave back.",
  },
  frequencyDirection,
  frequencyCollected,
  frequencyGamma,
  collect(
    "sr-mirror-frequency-result",
    frequencyGamma.to,
    srMirrorFrequency,
    {
      r0: "Read the reflected frequency divided by the incoming frequency.",
      r1: "The ratio r = ν_r/ν is (1 − 2ba + b²)/(1 − b²). At normal incidence, " +
        "a = 1, this reduces to (1 − b)/(1 + b).",
      r2: "The conclusion is checked against the existing canonical moving-mirror equation. " +
        "Both frequencies belong to K. This is a frequency ratio, not a fixed-surface " +
        "intensity ratio or a mirror-intercepted power.",
    },
    [reconstruction(frequencyGamma.id)],
  ),
]);

const reflectedDirection = substitution(
  "sr-mirror-direction-reflect",
  equality(reflected, srMirrorInverse.direction),
  reflectedMoving.termId,
  negative(moving),
  "Specular reflection in k reverses the normal direction: a″ = −a′.",
  {
    r0: "Transform the reflected direction back to K.",
    r1: "The inverse aberration law uses −b and the outgoing cosine a″. Replace a″ " +
      "by −a′ to reflect in the stationary mirror's own frame.",
    r2: "Normal specular reflection reverses the x component in k while preserving the " +
      "transverse direction. An outgoing ray can still have a positive x component in K; " +
      "separation requires its x speed to be below the mirror speed.",
  },
  [
    historical(aberrationRecord.id),
    reconstruction("sr-mirror-admitted-wave-transforms"),
    reconstruction("sr-mirror-elastic-specular-reflection"),
  ],
);
const directionIncident = substitution(
  "sr-mirror-direction-incident",
  reflectedDirection.to,
  moving.termId,
  srMirrorIncoming.direction,
  "Use the same incoming aberration result a′ = (a − b)/(1 − ba).",
  {
    r0: "Express that direction using the original incidence angle.",
    r1: "Insert the incoming cosine in k. Both incoming and outgoing frame changes " +
      "now use the same b and original K angle.",
    r2: "The mirror-frame incoming angle is a producer shared with the frequency chain. " +
      "It cannot be adjusted separately to make the final outgoing direction look plausible.",
  },
  [historical(aberrationRecord.id), reconstruction(reflectedDirection.id)],
);
export const srMirrorDirectionChain = chain("direction", "sr-mirror-reflected-direction", [
  reflectedDirection,
  directionIncident,
  collect(
    "sr-mirror-direction-result",
    directionIncident.to,
    srMirrorDirection,
    {
      r0: "The returned ray has a definite normal direction in K.",
      r1: "Collect the fraction to obtain a_r = [2b − (1 + b²)a]/(1 − 2ba + b²). " +
        "Its sign depends on the incidence and the mirror speed.",
      r2: "The positive denominator can be written (a − b)² + 1 − a². Under a > b " +
        "and |a| ≤ 1 it cannot vanish. Also b − a_r = (a − b)(1 − b²)/(1 − 2ba + b²) " +
        "is positive, so the reflected ray separates from the mirror even if a_r > 0.",
    },
    [reconstruction(directionIncident.id), reconstruction("sr-mirror-subluminal-interception")],
  ),
]);

const fluxDirection = substitution(
  "sr-mirror-flux-direction",
  equality(
    srMirrorSymbols.reflectedFlux,
    product(density, square(ratio), lightSpeed, difference(b, reflected)),
  ),
  reflected.termId,
  srMirrorDirection.right,
  "Use the reflected K direction established by the inverse aberration calculation.",
  {
    r0: "Count energy leaving the moving mirror.",
    r1: "The reflected energy density is u r². Multiply by c(b − a_r), the speed " +
      "at which the surface separates from the outgoing wave, and insert the direction just found.",
    r2: "The rate is per unit mirror area and per unit K time. Using c|a_r| would count " +
      "energy through a fixed plane instead. The amplitude factor equals r by the admitted " +
      "field transformation and perfect reflection, so the energy density has the squared factor.",
  },
  [
    reconstruction("sr-mirror-direction-result"),
    reconstruction("sr-mirror-moving-boundary-energy"),
    reconstruction("sr-mirror-admitted-wave-transforms"),
  ],
  "sr-mirror-source-ledger",
);
const fluxFrequency = substitution(
  "sr-mirror-flux-frequency",
  fluxDirection.to,
  ratio.termId,
  srMirrorFrequency.right,
  "Define r = ν_r/ν using the frequency ratio established above.",
  {
    r0: "Use the same frequency factor in the reflected energy density.",
    r1: "Replace r with (1 − 2ba + b²)/(1 − b²). The reflected density and the " +
      "outgoing direction must come from one reflected wave.",
    r2: "This replacement is bound to the preceding frequency producer. Frequency, " +
      "amplitude and moving-surface crossing speed are distinct factors; no independent " +
      "guess about a power ratio is admitted.",
  },
  [reconstruction("sr-mirror-frequency-result"), reconstruction(fluxDirection.id)],
  "sr-mirror-source-ledger",
);
const fluxRatio = quotient(numerator, denominator, "sr-mirror.flux-ratio");
const fluxCollected = collect(
  "sr-mirror-flux-collect",
  fluxFrequency.to,
  equality(srMirrorSymbols.reflectedFlux, product(density, lightSpeed, approach, fluxRatio)),
  {
    r0: "The outgoing crossing rate cancels one frequency factor.",
    r1: "Exact simplification gives J_out = uc(a − b)(1 − 2ba + b²)/(1 − b²). " +
      "One factor r remains, even though the energy density contained r².",
    r2: "The identity r²(b − a_r) = r(a − b) is the moving-boundary correction. " +
      "The incident energy rate is J_in = uc(a − b), so the reflected-to-incident " +
      "intercepted-power ratio is r. A fixed detector samples a different quantity.",
  },
  [
    reconstruction(fluxFrequency.id),
    reconstruction("sr-mirror-subluminal-interception"),
    reconstruction("sr-mirror-moving-boundary-energy"),
  ],
  "sr-mirror-source-ledger",
);
export const srMirrorFluxChain = chain("flux", "sr-mirror-outgoing-energy-flux", [
  fluxDirection,
  fluxFrequency,
  fluxCollected,
  substitution(
    "sr-mirror-flux-result",
    fluxCollected.to,
    "sr-mirror.flux-ratio",
    ratio,
    "The preceding frequency result defines r = (1 − 2ba + b²)/(1 − b²).",
    {
      r0: "Name the remaining factor r.",
      r1: "The result is J_out = r J_in, where J_in = uc(a − b). Both rates cross " +
        "the same moving mirror and use K time.",
      r2: "This renaming uses the derived frequency ratio, without identifying energy " +
        "density with power. The mirror's area multiplies both rates to obtain the " +
        "powers displayed in the laboratory.",
    },
    [reconstruction("sr-mirror-frequency-result"), reconstruction(fluxCollected.id)],
    "sr-mirror-source-ledger",
  ),
]);

const energyFrequency = substitution(
  "sr-mirror-energy-frequency",
  equality(
    srMirrorEnergyTransfer.left,
    difference(srMirrorIncidentFlux.right, srMirrorOutgoingFlux.right),
  ),
  ratio.termId,
  srMirrorFrequency.right,
  "Use the derived r in the incident-minus-reflected energy account.",
  {
    r0: "Subtract the energy carried away from the energy arriving.",
    r1: "J_in − J_out = uc(a − b)(1 − r). Insert the derived reflected frequency ratio.",
    r2: "A receding mirror receives mechanical energy, while an approaching one can " +
      "supply energy to the reflected wave. The signed energy difference distinguishes " +
      "these cases without changing the positive direction used to define the pressure.",
  },
  [
    reconstruction("sr-mirror-flux-result"),
    reconstruction("sr-mirror-frequency-result"),
    reconstruction("sr-mirror-moving-boundary-energy"),
  ],
  "sr-mirror-source-ledger",
);
export const srMirrorEnergyChain = chain("energy", "sr-mirror-energy-transfer", [
  energyFrequency,
  collect(
    "sr-mirror-energy-result",
    energyFrequency.to,
    srMirrorEnergyTransfer,
    {
      r0: "The energy transfer contains the mirror speed as a factor.",
      r1: "The difference is 2ucb(a − b)²/(1 − b²). Its sign follows b, and it " +
        "vanishes at b = 0.",
      r2: "This exact identity holds at zero speed as well as at nonzero speed. It " +
        "establishes zero mechanical work at rest, not zero radiation pressure. " +
        "Extracting pressure is a separate step with a narrower division domain.",
    },
    [reconstruction(energyFrequency.id), reconstruction("sr-mirror-subluminal-interception")],
    "sr-mirror-source-ledger",
  ),
]);

export const SR_MIRROR_NONZERO_SPEED =
  "b ≠ 0 and c > 0; pressure is extracted from work only for a moving mirror.";
const nonzero = reconstruction("sr-mirror-nonzero-speed-branch");
export const srMirrorPressureChain = chain(
  "pressure",
  "sr-mirror-radiation-pressure",
  [
    {
      ...draft,
      id: "sr-mirror-pressure-result",
      from: equality(
        product(srMirrorSymbols.pressure, lightSpeed, b),
        srMirrorEnergyTransfer.right,
      ),
      to: srMirrorPressure,
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: product(lightSpeed, b),
          nonzeroCondition: SR_MIRROR_NONZERO_SPEED,
          simplify: true,
        },
      },
      changedSubexpressionIds: [b.termId, lightSpeed.termId, srMirrorSymbols.pressure.termId],
      reasonKind: "algebra",
      reasons: {
        r0: "For a moving mirror, divide the work rate by its nonzero speed.",
        r1: "Energy conservation identifies the difference with Pbc. Only when b ≠ 0 " +
          "may we divide by bc to obtain P = 2u(a − b)²/(1 − b²).",
        r2: "The physical work premise supplies the starting equality; the checker " +
          "verifies the division conditional on b ≠ 0 and c > 0. At b = 0 the starting " +
          "equation is 0 = 0 for any P. Cancelling b there would be invalid.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [
        reconstruction("sr-mirror-energy-result"),
        reconstruction("sr-mirror-work-balance"),
        nonzero,
      ],
      sourceAnchor: "sr-mirror-source-pressure",
    },
  ],
  [nonzero],
);

export const srMirrorStationaryChain = chain("stationary", "sr-mirror-stationary-pressure", [
  collect(
    "sr-mirror-stationary-result",
    equality(
      srMirrorSymbols.pressure,
      substituteNode(srMirrorPressure.right, b.termId, zero),
    ),
    equality(srMirrorSymbols.pressure, product(two, density, square(a))),
    {
      r0: "The separately assumed continuous limit gives the pressure at rest.",
      r1: "For fixed a > 0, the nonzero-speed pressure has a continuous rational " +
        "extension to b = 0: P = 2u a². At normal incidence a = 1, P = 2u.",
      r2: "Continuity of the physical pressure is an explicit additional premise. " +
        "The algebra checks the value of the rational extension; it does not derive " +
        "continuity from the zero-work equation. The grazing case a = b = 0 is outside " +
        "the intercepted-wave domain.",
    },
    [
      reconstruction("sr-mirror-pressure-result"),
      reconstruction("sr-mirror-stationary-continuity"),
    ],
    "sr-mirror-source-pressure",
  ),
]);

export const srMirrorChains = [
  srMirrorFrequencyChain,
  srMirrorDirectionChain,
  srMirrorFluxChain,
  srMirrorEnergyChain,
  srMirrorPressureChain,
  srMirrorStationaryChain,
] as const;

export const srMirrorSourceLinks = [
  {
    id: "sr-mirror-source-reflection",
    anchor: "eq-s8-d12",
    label: "The reflected wave in §8, with the printed frequency denominator",
  },
  {
    id: "sr-mirror-source-ledger",
    anchor: "s8-p10",
    label: "Energy arriving at and leaving the moving mirror",
  },
  {
    id: "sr-mirror-source-pressure",
    anchor: "eq-s8-d13",
    label: "The radiation pressure on the moving mirror",
  },
] as const;
