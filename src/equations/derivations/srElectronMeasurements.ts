/**
 * §10's three measured consequences. The first keeps Gaussian field normalization;
 * voltage and radius are explicit SI teaching reconstructions. Physical laws remain premises.
 */

import energyRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-energy.json";
import workRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-result.json";
import radiusRecord from "../../../content/equations/special-relativity/eq-model-sr-magnetic-radius.json";
import laboratoryRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-laboratory.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef } from "./types.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;

/** Keep the published premise and expression identities independent of a caller's mutations. */
function immutable<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

const named = (quantityId: string): Symbol => ({ kind: "symbol", quantityId, termId: quantityId });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const ratio = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: `sr-electron-measurements.op.${id}`,
});
const premise = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const canonical = (record: { readonly tree: unknown }): Relation =>
  projectDerivationSymbols(record.tree as Expression, (symbol) => symbol.quantityId) as Relation;
const laboratory = canonical(laboratoryRecord);
const work = canonical(workRecord);
const energy = canonical(energyRecord);
const radiusResult = canonical(radiusRecord);
const c = named("speedOfLight");
const v = named("frameSpeed");
const m = named("electronMass");
const gamma = named("lorentzFactor");
const q = named("particleChargeMagnitude");
const U = named("acceleratingPotential");
const B = named("magneticFieldStationary");
const radius = named("radiusCurvatureMagnetic");
const force = named("transverseForceLaboratory");
const acceleration = named("accelerationTransverseLaboratory");
const qG = named("gaussianChargeMagnitude");
const EG = named("gaussianElectricFieldMagnitude");
const BG = named("gaussianMagneticFieldMagnitude");
const aE = named("electricDeflectionAcceleration");
const aB = named("magneticDeflectionAcceleration");
const AE = named("gaussianElectricDeflectability");
const AB = named("gaussianMagneticDeflectability");
const magneticAcceleration = ratio(product(qG, v, BG), product(c, m, gamma));
const electricAcceleration = ratio(product(qG, EG), product(m, gamma));
const responseRatio = equation(
  ratio(AB, AE),
  ratio(ratio(aB, BG), ratio(aE, EG)),
  "normalized-responses",
);
const magneticResponse = substituteNode(responseRatio, aB.termId, magneticAcceleration);
const bothResponses = substituteNode(magneticResponse, aE.termId, electricAcceleration);
const deflectability = equation(ratio(AB, AE), ratio(v, c), "deflectability");
const voltageEnergy = substituteNode(energy, "kineticEnergy", work.right);
const voltage = equation(U, ratio(work.right, q), "voltage");
const forceLaw = equation(force, product(m, gamma, acceleration), "laboratory-response");
const magneticForce = substituteNode(forceLaw, force.termId, product(q, v, B));
const circularForce = substituteNode(magneticForce, acceleration.termId, ratio(square(v), radius));
const multipliedRadius = equation(
  product(q, v, B, radius),
  product(m, gamma, square(v)),
  "radius-multiplied",
);

const draft = {
  verification: { status: "authored-unverified" as const },
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "prescribed-fields-without-radiation-reaction",
  isMove: false,
};
function substitution(
  from: Expression,
  to: Expression,
  targetId: string,
  replacement: Expression,
  citedEquality: string,
): Pick<DerivationStep, "from" | "to" | "changedSubexpressionIds" | "rule"> {
  return {
    from,
    to,
    changedSubexpressionIds: [targetId],
    rule: { kind: "substitute", params: { targetId, replacement, citedEquality } },
  };
}
function arithmetic(
  from: Expression,
  to: Expression,
  operation: "multiply" | "divide",
  quantity: Expression,
  nonzeroCondition?: string,
): Pick<DerivationStep, "from" | "to" | "changedSubexpressionIds" | "rule"> {
  return {
    from,
    to,
    changedSubexpressionIds:
      quantity.kind === "symbol"
        ? [quantity.termId]
        : quantity.kind === "product"
          ? quantity.args.flatMap((term) => (term.kind === "symbol" ? [term.termId] : []))
          : [],
    rule: {
      kind: "add-subtract-multiply-divide",
      params: {
        operation,
        quantity,
        simplify: true,
        ...(nonzeroCondition ? { nonzeroCondition } : {}),
      },
    },
  };
}

export const srElectronMeasurementPremises = immutable([
  {
    id: "sr-electron-measurement-domain",
    label: "Finite subluminal motion and a charged massive particle",
    explanation:
      "c > 0, m > 0 and the charge magnitude |q| > 0 are finite; 0 ≤ v < c and γ = (1 − v²/c²)^(−1/2). Force and acceleration refer to the same laboratory frame. Charge sign determines the bend's direction, not these magnitudes.",
  },
  {
    id: "eq-model-sr-transverse-mass-laboratory",
    label: "The previously established laboratory transverse response",
    explanation:
      "Use F⊥ = mγa⊥, with both measurements in K. This is the preceding convention comparison, not the printed mixed-frame ratio mγ². The force-over-acceleration version is used only for a nonzero probe.",
  },
  {
    id: "sr-electron-deflection-normalization",
    label: "Matched local deflection comparisons",
    explanation:
      "Compare the same particle at the same speed and field geometry in separate electric-only and magnetic-only trials. A_e and A_m are response coefficients per field strength; their shared apparatus and observation factors cancel. The derivation does not assert equality of two finite trajectories in arbitrary fields.",
  },
  {
    id: "sr-electron-gaussian-lorentz-force",
    label: "The Gaussian force convention for the first printed relation",
    explanation:
      "For perpendicular fields, the admitted Lorentz law gives force magnitudes q_G E_G and q_G v B_G/c. Dividing each by the same mγ gives the two local accelerations. E_G and B_G have the same Gaussian dimensions and are positive for the normalized comparison.",
  },
  {
    id: "eq-model-sr-electron-work-result",
    label: "The preceding work integral starts from rest",
    explanation:
      "Import W = mc²(γ − 1), established by the preceding longitudinal work argument. It fixes an energy difference with W(0) = 0; it does not establish an additive rest energy.",
  },
  {
    id: "eq-model-sr-electron-energy",
    label: "Electrostatic work supplies kinetic energy",
    explanation:
      "The positive accelerating voltage U supplies |q|U = W in SI. The particle starts at rest; prescribed fields and negligible radiative loss are assumed. This physical work-energy premise is not proved by cancelling symbols.",
  },
  {
    id: "sr-electron-magnetic-circle",
    label: "A nonzero circular magnetic case",
    explanation:
      "For the radius derivation, 0 < v < c, B > 0, no electric field, and uniform B perpendicular to velocity. The admitted SI Lorentz force is |q|vB and circular geometry gives a⊥ = v²/R with R > 0. Choose the transverse axis along the force so the component equation can be used with positive magnitudes. No division by v is made outside this strictly moving case.",
  },
]);

export const srElectronDeflectability: DerivationChain = {
  id: "chain-sr-electron-deflectability",
  proofRouteId: "route-sr-electron-deflectability",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    premise("sr-electron-measurement-domain"),
    premise("eq-model-sr-transverse-mass-laboratory"),
    premise("sr-electron-deflection-normalization"),
    premise("sr-electron-gaussian-lorentz-force"),
  ],
  target: "sr-electron-deflectability-law",
  targetStepId: "sr-electron-measurements-cancel-response",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-electron-measurements-magnetic-response",
      ...substitution(
        responseRatio,
        magneticResponse,
        aB.termId,
        magneticAcceleration,
        "In Gaussian units, a_m = q_G v B_G/(c m gamma), from the admitted perpendicular Lorentz force and laboratory response.",
      ),
      reasonKind: "physical-premise",
      tool: "foundation:electromagnetism-charges",
      premiseRefs: [
        premise("eq-model-sr-transverse-mass-laboratory"),
        premise("sr-electron-gaussian-lorentz-force"),
        premise("sr-electron-deflection-normalization"),
      ],
      sourceAnchor: "sr-electron-measurements-source-deflection",
      reasons: {
        r0: "Compare the turning response per unit field, keeping the particle and its speed fixed.",
        r1: "The magnetic force in the paper's Gaussian convention has magnitude q_G v B_G/c. Divide by the laboratory response coefficient mγ to obtain a_m. A_m = a_m/B_G and A_e = a_e/E_G remove the different field strengths from the comparison.",
        r2: "Here a_m and a_e are positive local acceleration magnitudes in separate matched trials, not displacements from unrelated paths. E_G and B_G denote positive Gaussian field magnitudes and q_G the charge magnitude in that unit system. The same particle, speed, geometry and observation factors are held fixed. The assumed force law and F⊥ = mγa⊥ give a_m = q_G v B_G/(c mγ). Substitute that expression in (a_m/B_G)/(a_e/E_G).",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-electric-response",
      ...substitution(
        magneticResponse,
        bothResponses,
        aE.termId,
        electricAcceleration,
        "In Gaussian units, a_e = q_G E_G/(m gamma), from the admitted perpendicular electric force and laboratory response.",
      ),
      reasonKind: "physical-premise",
      tool: "foundation:electromagnetism-charges",
      premiseRefs: [
        premise("eq-model-sr-transverse-mass-laboratory"),
        premise("sr-electron-gaussian-lorentz-force"),
      ],
      sourceAnchor: "sr-electron-measurements-source-deflection",
      reasons: {
        r0: "Use the same response coefficient for the separate electric comparison.",
        r1: "The electric force has magnitude q_G E_G. Its acceleration is a_e = q_G E_G/(mγ), with the same mass and Lorentz factor as the magnetic trial.",
        r2: "The comparison must keep v fixed: otherwise the two factors γ would differ. Substitute a_e = q_G E_G/(mγ) in the denominator. The particle is charged, m > 0 and E_G > 0, so a_e is nonzero and the response ratio is defined. At v = 0 only the magnetic response vanishes; the normalized ratio remains defined.",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-cancel-response",
      from: bothResponses,
      to: deflectability,
      changedSubexpressionIds: [qG.termId, m.termId, gamma.termId],
      rule: { kind: "collect", params: { exact: true } },
      reasonKind: "algebra",
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [
        premise("sr-electron-measurement-domain"),
        premise("sr-electron-gaussian-lorentz-force"),
        premise("sr-electron-deflection-normalization"),
      ],
      sourceAnchor: "sr-electron-measurements-source-deflection",
      isMove: true,
      moveLabel: "The common charge and response coefficient cancel, leaving a speed ratio.",
      reasons: {
        r0: "The relative deflectability reveals v/c without knowing the particle's mass.",
        r1: "After the field strengths have been divided out, q_G/(mγ) is common to both responses. Their quotient is A_m/A_e = v/c, the first relation printed in §10.",
        r2: "The numerator becomes q_G v/(c mγ), the denominator q_G/(mγ), and division cancels q_G, m and γ. None is zero. No factor v is cancelled, so zero speed is still allowed. This dimensionless relation uses the paper's Gaussian normalization. In SI the corresponding field-normalized acceleration ratio (a_B/B)/(a_E/E) is v, with velocity units; dividing it by c gives v/c. Setting a numeric SI electric field equal to a numeric SI magnetic field would mix units.",
      },
    },
  ],
};

export const srElectronVoltage: DerivationChain = {
  id: "chain-sr-electron-accelerating-voltage",
  proofRouteId: "route-sr-electron-accelerating-voltage",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    premise("sr-electron-measurement-domain"),
    premise("eq-model-sr-electron-work-result"),
    premise("eq-model-sr-electron-energy"),
  ],
  target: "sr-electron-accelerating-voltage-law",
  targetStepId: "sr-electron-measurements-voltage",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-electron-measurements-work-to-voltage",
      ...substitution(
        energy,
        voltageEnergy,
        "kineticEnergy",
        work.right,
        "The preceding work integral from rest gives W = m c^2 (gamma - 1).",
      ),
      reasonKind: "physical-premise",
      tool: "foundation:work-energy",
      premiseRefs: [
        premise("eq-model-sr-electron-work-result"),
        premise("eq-model-sr-electron-energy"),
      ],
      sourceAnchor: "sr-electron-measurements-source-voltage",
      isMove: true,
      moveLabel:
        "Connect the voltage measurement to the already derived kinetic-energy difference.",
      reasons: {
        r0: "The voltage supplies the work already calculated from the motion.",
        r1: "Start with the admitted energy-transfer relation |q|U = W and substitute the previous result W = mc²(γ − 1). The charge and voltage here are SI magnitudes.",
        r2: "U is the positive accelerating voltage, |q| the positive charge magnitude, m the slow-motion mass and γ the Lorentz factor at the final speed. Multiplying coulombs by volts gives joules. With the initial kinetic energy set to zero and radiative losses excluded, all electrical work becomes W. The substitution imports the preceding work argument; it does not use a rest-energy formula or derive the work-energy principle.",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-voltage",
      ...arithmetic(voltageEnergy, voltage, "divide", q, "|q| > 0 is the finite charge magnitude"),
      reasonKind: "algebra",
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [premise("sr-electron-measurement-domain")],
      sourceAnchor: "sr-electron-measurements-source-voltage",
      reasons: {
        r0: "Dividing the energy by the charge gives the required accelerating voltage.",
        r1: "Divide both sides by |q| to obtain U = mc²(γ − 1)/|q|. A measured voltage can be compared with an independently measured speed.",
        r2: "Because |q| > 0, |q|U/|q| = U. The right side keeps the subtraction of 1 that came from starting at rest. At v = 0, γ = 1 and U = 0; the division never removes that boundary. The Newtonian approximation U ≈ mv²/(2|q|) agrees only for v much smaller than c. The relation is a conditional prediction, not evidence that the specified voltage has been measured.",
      },
    },
  ],
};

export const srElectronMagneticRadius: DerivationChain = {
  id: "chain-sr-electron-magnetic-radius",
  proofRouteId: "route-sr-electron-magnetic-radius",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    premise("sr-electron-measurement-domain"),
    premise("eq-model-sr-transverse-mass-laboratory"),
    premise("sr-electron-magnetic-circle"),
  ],
  target: radiusRecord.id,
  targetStepId: "sr-electron-measurements-radius",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-electron-measurements-force-law",
      ...arithmetic(laboratory, forceLaw, "multiply", acceleration),
      reasonKind: "algebra",
      tool: "foundation:work-energy",
      premiseRefs: [
        premise("eq-model-sr-transverse-mass-laboratory"),
        premise("sr-electron-magnetic-circle"),
      ],
      sourceAnchor: "sr-electron-measurements-source-circle",
      reasons: {
        r0: "Use force and acceleration measured in the same laboratory.",
        r1: "The preceding convention comparison gives F⊥/a⊥ = mγ. Multiply by the nonzero acceleration of this circular case to obtain F⊥ = mγa⊥.",
        r2: "The canonical ratio uses the laboratory force, not the momentary rest-frame force. The latter would bring an extra γ and give the wrong laboratory radius if used without conversion. Here B > 0 and 0 < v < c, so the admitted magnetic force and the acceleration are nonzero. Choose the positive transverse axis along that force; the canonical signed component equation then reads as an equality of positive magnitudes.",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-magnetic-force",
      ...substitution(
        forceLaw,
        magneticForce,
        force.termId,
        product(q, v, B),
        "For this pure perpendicular magnetic case, the admitted SI Lorentz-force magnitude is F_perp = |q| v B.",
      ),
      reasonKind: "physical-premise",
      tool: "foundation:electromagnetism-charges",
      premiseRefs: [premise("sr-electron-magnetic-circle")],
      sourceAnchor: "sr-electron-measurements-source-circle",
      reasons: {
        r0: "A perpendicular magnetic field supplies a sideways force.",
        r1: "In SI, replace F⊥ by |q|vB. The magnetic field is uniform and perpendicular to the velocity, and the electric field is zero.",
        r2: "The Lorentz force q(v × B) is perpendicular to v. In the prescribed-field model without radiation reaction it changes the direction but does no work, so the speed and γ stay fixed. Taking magnitudes for perpendicular v and B gives |q|vB. A component of B parallel to v would not contribute this force; arbitrary combined electric and magnetic fields are outside this circular calculation.",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-circular-acceleration",
      ...substitution(
        magneticForce,
        circularForce,
        acceleration.termId,
        ratio(square(v), radius),
        "Uniform circular motion has acceleration magnitude a_perp = v^2/R, with R > 0.",
      ),
      reasonKind: "physical-premise",
      tool: "foundation:derivatives",
      premiseRefs: [premise("sr-electron-magnetic-circle")],
      sourceAnchor: "sr-electron-measurements-source-circle",
      isMove: true,
      moveLabel: "Turn the force law into a measurable geometric radius.",
      reasons: {
        r0: "A smaller circle needs more acceleration at the same speed.",
        r1: "Use the circular-motion relation a⊥ = v²/R. The force equation becomes |q|vB = mγv²/R.",
        r2: "R denotes the radius of a genuine moving circle. With constant speed v, the acceleration is inward and has magnitude v²/R. Substituting this kinematic relation connects the laboratory force to path geometry. This is the SI magnitude form of the step printed before the radius in §10; the printed sign depends on the selected transverse direction.",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-clear-radius",
      ...arithmetic(circularForce, multipliedRadius, "multiply", radius),
      reasonKind: "algebra",
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [premise("sr-electron-magnetic-circle")],
      sourceAnchor: "sr-electron-measurements-source-radius",
      reasons: {
        r0: "Multiply by the radius to remove it from the denominator.",
        r1: "Since R > 0, multiplication by R gives |q|vBR = mγv².",
        r2: "Both sides are multiplied by the same R. On the right, R cancels only against the existing radius denominator, giving mγv². The finite positive radius is part of this circular case; the operation does not assign a radius to a stationary electron or to straight motion.",
      },
    },
    {
      ...draft,
      id: "sr-electron-measurements-radius",
      ...arithmetic(
        multipliedRadius,
        radiusResult,
        "divide",
        product(q, v, B),
        "|q| > 0, v > 0 and B > 0 in the moving magnetic circle",
      ),
      reasonKind: "algebra",
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [
        premise("sr-electron-measurement-domain"),
        premise("sr-electron-magnetic-circle"),
      ],
      sourceAnchor: "sr-electron-measurements-source-radius",
      reasons: {
        r0: "The circle is larger by γ than the low-speed prediction.",
        r1: "Divide by |q|vB and cancel one factor v. The result is R = γmv/(|q|B), the canonical SI radius.",
        r2: "Every divisor is nonzero in this branch: |q| > 0, B > 0 and v > 0. The numerator mγv² then leaves mγv. At fixed speed, mass and charge, doubling B halves R; compared with the Newtonian mv/(|q|B), the radius is larger by γ. The limit R → 0 as v → 0 does not make a stationary particle trace a zero-radius orbit, and B = 0 gives no magnetic circle.",
      },
    },
  ],
};

export const srElectronMeasurementChains: readonly DerivationChain[] = immutable([
  srElectronDeflectability,
  srElectronVoltage,
  srElectronMagneticRadius,
]);
export const srElectronMeasurementRecords = Object.freeze([
  laboratoryRecord,
  workRecord,
  energyRecord,
  radiusRecord,
]);

const glyphs: Readonly<Record<string, string>> = {
  speedOfLight: "c",
  frameSpeed: "v",
  electronMass: "m",
  lorentzFactor: "γ",
  particleChargeMagnitude: "Q",
  acceleratingPotential: "U",
  kineticEnergy: "W",
  magneticFieldStationary: "B",
  radiusCurvatureMagnetic: "R",
  transverseForceLaboratory: "F_y",
  accelerationTransverseLaboratory: "a_y",
  gaussianChargeMagnitude: "q_G",
  gaussianElectricFieldMagnitude: "E_G",
  gaussianMagneticFieldMagnitude: "B_G",
  electricDeflectionAcceleration: "a_e",
  magneticDeflectionAcceleration: "a_m",
  gaussianElectricDeflectability: "A_e",
  gaussianMagneticDeflectability: "A_m",
};
export function presentElectronMeasurement(expression: Expression): Expression {
  return projectDerivationSymbols(
    expression,
    (symbol) => glyphs[symbol.quantityId] ?? symbol.quantityId,
  );
}
export function presentElectronMeasurementChain(chain: DerivationChain): DerivationChain {
  return {
    ...chain,
    steps: chain.steps.map((step) => ({
      ...step,
      changedSubexpressionIds: step.changedSubexpressionIds.map((id) => glyphs[id] ?? id),
      from: presentElectronMeasurement(step.from),
      to: presentElectronMeasurement(step.to),
    })),
  };
}
export const srElectronMeasurementHistory = {
  r3: "Einstein closes §10 with three relations accessible to experiment: the ratio of magnetic to electric deflectability, the potential difference needed to reach a speed from rest, and the curvature in a perpendicular magnetic field. The first is printed on p. 920 and the last two formulas on p. 921. The first reconstruction retains Gaussian field normalization. The voltage and radius calculations use explicit modern SI magnitudes and the already explained laboratory-force convention; this is a unit and convention bridge, not a silent renaming of the source. The mathematical check establishes consequences of admitted force, work and circular-motion premises. It neither certifies the draft source transcription nor supplies experimental confirmation.",
  r3Citations: [
    "Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §10, pp. 920–921.",
  ],
};
export function electronMeasurementReadings(step: DerivationStep) {
  return { ...step.reasons, ...srElectronMeasurementHistory };
}
