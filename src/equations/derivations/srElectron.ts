/**
 * SR §10: force and acceleration retain their frames, then longitudinal work is integrated
 * from rest. Canonical equation records own the results; these authored source-order steps
 * expose the assumptions and the later all-laboratory comparison without certifying review.
 */
import workIntegralRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-integral.json";
import workResultRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-result.json";
import longitudinalRecord from "../../../content/equations/special-relativity/eq-model-sr-longitudinal-mass.json";
import laboratoryRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-laboratory.json";
import printedRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-printed.json";
import { type Expression, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef, StepReadings } from "./types.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
type Integral = Extract<Expression, { kind: "integral" }>;
const named = (quantityId: string): Symbol => ({ kind: "symbol", quantityId, termId: quantityId });
const number = (value: number): Expression => ({ kind: "number", value: String(value) });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const power = (base: Expression, exponent: number): Expression => ({
  kind: "power",
  base,
  exponent: { num: exponent, den: 1 },
});
const ratio = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  opId: `sr-electron.op.${id}`,
  left,
  right,
});
const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
// These are inherited from the already-derived §3 transverse coordinate map.
const transverseMapPremises = [
  historical("sr-axis-normalization"),
  historical("sr-spatial-symmetry"),
  historical("sr-transverse-light-propagation"),
];
function canonical(record: { readonly tree: unknown }): Relation {
  return projectDerivationSymbols(record.tree as Expression, (symbol) =>
    symbol.at ? `${symbol.quantityId}:at-speed` : symbol.quantityId,
  ) as Relation;
}
const longitudinal = canonical(longitudinalRecord);
const printed = canonical(printedRecord);
const laboratory = canonical(laboratoryRecord);
const workIntegral = canonical(workIntegralRecord);
const workResult = canonical(workResultRecord);
const mass = named("electronMass");
const gamma = named("lorentzFactor");
const light = named("speedOfLight");
const xAcceleration = named("accelerationLongitudinalLaboratory");
const yAcceleration = named("accelerationTransverseLaboratory");
const xRestAcceleration = named("accelerationLongitudinalComoving");
const yRestAcceleration = named("accelerationTransverseComoving");
const xForce = named("longitudinalForce");
const xRestForce = named("longitudinalForceComoving");
const yRestForce = named("transverseForceComoving");
const yForce = named("transverseForceLaboratory");
const xRestLaw = equation(xRestForce, product(mass, xRestAcceleration), "rest-longitudinal");
const xTransformed = substituteNode(
  xRestLaw,
  xRestAcceleration.termId,
  product(power(gamma, 3), xAcceleration),
) as Relation;
const xLaboratoryLaw = substituteNode(xTransformed, xRestForce.termId, xForce) as Relation;
const xDivided = equation(
  ratio(xForce, xAcceleration),
  ratio(xLaboratoryLaw.right, xAcceleration),
  "longitudinal-divided",
);
const yRestLaw = equation(yRestForce, product(mass, yRestAcceleration), "rest-transverse");
const yTransformed = substituteNode(
  yRestLaw,
  yRestAcceleration.termId,
  product(power(gamma, 2), yAcceleration),
) as Relation;
const yDivided = equation(
  ratio(yRestForce, yAcceleration),
  ratio(yTransformed.right, yAcceleration),
  "transverse-divided",
);
const yChangedForce = substituteNode(
  printed,
  yRestForce.termId,
  product(gamma, yForce),
) as Relation;
const yChangedDivided = equation(
  ratio(yChangedForce.left, gamma),
  ratio(yChangedForce.right, gamma),
  "laboratory-divided",
);

const draft = {
  verification: { status: "authored-unverified" as const },
  historicalStatus: "source-order-reconstruction",
  modelStatus: "prescribed-fields-without-self-force",
  isMove: false,
};
function substitute(
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
function divide(
  from: Relation,
  to: Relation,
  quantity: Symbol,
  condition: string,
): Pick<DerivationStep, "from" | "to" | "changedSubexpressionIds" | "rule"> {
  return {
    from,
    to,
    changedSubexpressionIds: [quantity.termId],
    rule: {
      kind: "add-subtract-multiply-divide",
      params: { operation: "divide", quantity, nonzeroCondition: condition },
    },
  };
}
function collect(
  from: Expression,
  to: Expression,
): Pick<DerivationStep, "from" | "to" | "changedSubexpressionIds" | "rule"> {
  return {
    from,
    to,
    changedSubexpressionIds: [mass.termId, gamma.termId],
    rule: { kind: "collect", params: {} },
  };
}

export const srElectronLongitudinal: DerivationChain = {
  id: "chain-sr-electron-longitudinal",
  proofRouteId: "route-sr-electron-longitudinal",
  routeKind: "source-order",
  entryAssumptions: [
    historical("sr-electron-momentary-rest-law"),
    historical("arg-sr-transverse-and-inverse"),
    historical("arg-sr-field-components"),
  ],
  target: longitudinalRecord.id,
  targetStepId: "sr-electron-longitudinal-coefficient",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-electron-longitudinal-acceleration",
      ...substitute(
        xRestLaw,
        xTransformed,
        xRestAcceleration.termId,
        product(power(gamma, 3), xAcceleration),
        "Differentiate the §3 velocity transformation at u_x = v: a′_x = γ³ a_x.",
      ),
      reasonKind: "calculus",
      tool: "foundation:derivatives",
      reasons: {
        r0: "Apply ordinary mechanics in the frame where the electron is momentarily at rest, then transform its acceleration.",
        r1: "In the momentary rest frame k, F′_x = m a′_x. The coordinate transformation makes a′_x = γ³ a_x at the selected event. The acceleration a_x is measured in the laboratory K, while the force still belongs to k.",
        r2: "Hold the inertial boost v fixed while differentiating u′_x = (u_x − v)/(1 − vu_x/c²). At the event u_x = v, ∂u′_x/∂u_x = 1/(1 − v²/c²) = γ², and dt′/dt = γ(1 − vu_x/c²) = 1/γ. Thus du′_x/dt′ = γ² (du_x/dt) γ = γ³ a_x. Substitute this into the admitted slow-motion rest-frame law F′_x = m a′_x. The primed frame is an inertial frame tangent to the motion at this event, not a single frame following the electron throughout acceleration.",
      },
      premiseRefs: [
        historical("sr-electron-momentary-rest-law"),
        historical("arg-sr-transverse-and-inverse"),
      ],
      sourceAnchor: "sr-electron-source-acceleration",
      isMove: true,
      moveLabel:
        "Use the momentary rest-frame law with the acceleration measured in the laboratory.",
    },
    {
      ...draft,
      id: "sr-electron-longitudinal-force",
      ...substitute(
        xTransformed,
        xLaboratoryLaw,
        xRestForce.termId,
        xForce,
        "At the event with velocity along x, §6 gives X′ = X and therefore F′_x = F_x.",
      ),
      reasonKind: "physical-premise",
      tool: "foundation:frames-events",
      reasons: {
        r0: "Along the instantaneous motion, the force has the same component in these two frames.",
        r1: "Section 6 gives X′ = X. At the electron's momentary rest event, F′_x = εX′ = εX = F_x. Replace the primed force by the laboratory longitudinal force.",
        r2: "The velocity in K is (v, 0, 0), so the magnetic part of the Lorentz force has no x component. The charge ε is the same in this comparison, and the source's longitudinal electric component is unchanged. Hence F′_x = F_x while a′_x and a_x remain different. This equality is for the component parallel to the instantaneous velocity; it is not a claim that all force components agree between frames.",
      },
      premiseRefs: [historical("arg-sr-field-components")],
      sourceAnchor: "sr-electron-source-acceleration",
    },
    {
      ...draft,
      id: "sr-electron-longitudinal-ratio",
      ...divide(
        xLaboratoryLaw,
        xDivided,
        xAcceleration,
        "a_x ≠ 0 for the displayed force/acceleration ratio",
      ),
      reasonKind: "definition",
      tool: "foundation:work-energy",
      reasons: {
        r0: "Divide by the laboratory acceleration to ask for the longitudinal response coefficient.",
        r1: "For a nonzero longitudinal acceleration, divide both sides by a_x. This names a force-to-acceleration coefficient, not a new rest mass.",
        r2: "From F_x = mγ³a_x, division by a_x gives F_x/a_x = (mγ³a_x)/a_x. The numerical ratio requires a_x ≠ 0. At zero acceleration the quotient 0/0 does not define a mass; mγ³ is instead the response coefficient obtained by a nonzero probe or its limit.",
      },
      premiseRefs: [teaching("sr-electron-nonzero-probe")],
      sourceAnchor: "sr-electron-source-masses",
    },
    {
      ...draft,
      id: "sr-electron-longitudinal-coefficient",
      ...collect(xDivided, longitudinal),
      reasonKind: "algebra",
      tool: "foundation:work-energy",
      reasons: {
        r0: "The longitudinal coefficient is mγ³.",
        r1: "Cancel the same nonzero acceleration. Along the motion, the source's convention and the all-laboratory convention both give mγ³.",
        r2: "The cancellation yields F_x/a_x = mγ³, the canonical longitudinal equation. In the paper's symbols this is μβ³. Here m denotes the mass determined in slow motion, γ is the paper's β, and c is its V. No new assumption about the body's rest energy enters this coefficient.",
      },
      premiseRefs: [teaching("sr-electron-nonzero-probe")],
      sourceAnchor: "sr-electron-source-masses",
    },
  ],
};

export const srElectronTransverse: DerivationChain = {
  id: "chain-sr-electron-transverse-source",
  proofRouteId: "route-sr-electron-transverse-source",
  routeKind: "source-order",
  entryAssumptions: [
    historical("sr-electron-momentary-rest-law"),
    historical("arg-sr-transverse-and-inverse"),
  ],
  target: printedRecord.id,
  targetStepId: "sr-electron-transverse-coefficient",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-electron-transverse-acceleration",
      ...substitute(
        yRestLaw,
        yTransformed,
        yRestAcceleration.termId,
        product(power(gamma, 2), yAcceleration),
        "Differentiate u′_y = u_y/[γ(1 − vu_x/c²)] at u_x = v, u_y = 0: a′_y = γ²a_y.",
      ),
      reasonKind: "calculus",
      tool: "foundation:derivatives",
      reasons: {
        r0: "Across the motion, transforming the acceleration supplies two factors of γ.",
        r1: "The rest-frame law is F′_y = m a′_y. At the selected event, the transverse velocity transformation and the time conversion give a′_y = γ² a_y, so F′_y = mγ²a_y.",
        r2: "Use u′_y = u_y/[γ(1 − vu_x/c²)] with a fixed boost v. At u_x = v and u_y = 0, differentiating the numerator gives du′_y/dt = γa_y; the denominator derivative multiplies u_y = 0 and vanishes at this event. Dividing by dt′/dt = 1/γ gives a′_y = γ²a_y. Substitution into F′_y = m a′_y leaves a force measured in k and an acceleration measured in K. The z component follows by the same transverse calculation.",
      },
      premiseRefs: [
        historical("sr-electron-momentary-rest-law"),
        historical("arg-sr-transverse-and-inverse"),
        ...transverseMapPremises,
      ],
      sourceAnchor: "sr-electron-source-acceleration",
      isMove: true,
      moveLabel:
        "Keep the force in the momentary rest frame while expressing acceleration in the laboratory.",
    },
    {
      ...draft,
      id: "sr-electron-transverse-ratio",
      ...divide(
        yTransformed,
        yDivided,
        yAcceleration,
        "a_y ≠ 0 for the displayed force/acceleration ratio",
      ),
      reasonKind: "definition",
      tool: "foundation:frames-events",
      reasons: {
        r0: "Use the paper's chosen force and divide by the laboratory acceleration.",
        r1: "Einstein's force is measured by a balance at rest with the electron at that moment. Divide F′_y by a_y, the acceleration in the original frame, keeping both labels visible.",
        r2: "The source explicitly chooses force components measured in the instantaneously comoving system and acceleration components measured in K. With a_y ≠ 0, F′_y/a_y = (mγ²a_y)/a_y. This is a mixed-frame response coefficient by definition. If a_y = 0, use the linear response law instead of interpreting 0/0 as a measured ratio.",
      },
      premiseRefs: [
        historical("sr-electron-source-force-definition"),
        teaching("sr-electron-nonzero-probe"),
        ...transverseMapPremises,
      ],
      sourceAnchor: "sr-electron-source-masses",
    },
    {
      ...draft,
      id: "sr-electron-transverse-coefficient",
      ...collect(yDivided, printed),
      reasonKind: "algebra",
      tool: "foundation:work-energy",
      reasons: {
        r0: "The printed transverse coefficient is mγ².",
        r1: "Cancel a_y to obtain F′_y/a_y = mγ². At v = 0.6c this is 1.5625m. The primed force is essential to what this number means.",
        r2: "After cancellation the canonical source-convention equation is F′_y/a_y = mγ², or μβ² in Einstein's notation. The paper warns that changing the definitions of force and acceleration changes the mass coefficients. The later all-laboratory comparison below changes the force definition explicitly; it does not replace or correct this printed result.",
      },
      premiseRefs: [
        historical("sr-electron-source-force-definition"),
        teaching("sr-electron-nonzero-probe"),
        ...transverseMapPremises,
      ],
      sourceAnchor: "sr-electron-source-masses",
    },
  ],
};

export const srElectronLaboratory: DerivationChain = {
  id: "chain-sr-electron-transverse-laboratory",
  proofRouteId: "route-sr-electron-transverse-laboratory",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [historical("arg-sr-field-components"), teaching(printedRecord.id)],
  target: laboratoryRecord.id,
  targetStepId: "sr-electron-laboratory-coefficient",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      historicalStatus: "later-force-convention",
      id: "sr-electron-change-force-frame",
      ...substitute(
        printed,
        yChangedForce,
        yRestForce.termId,
        product(gamma, yForce),
        "At the event u = (v, 0, 0), §6 gives F′_y = εγ(Y − vN/V) = γF_y in Gaussian units.",
      ),
      reasonKind: "definition",
      tool: "foundation:frames-events",
      reasons: {
        r0: "Now change the question: measure the sideways force in the laboratory too.",
        r1: "For this event, the rest-frame transverse force is γ times the laboratory transverse force: F′_y = γF_y. Substitute that relation into the printed coefficient before comparing the numbers.",
        r2: "The source gives Y′ = γ(Y − vN/c), so F′_y = εY′ = γ ε(Y − vN/c) = γF_y, using the Gaussian Lorentz force at u = (v, 0, 0). The same relation in SI is F′_y = γq(E_y − vB_z). This is an explicit change from the source's mixed-frame ratio to force and acceleration both in K. The later momentum convention F = dp/dt supplies this all-laboratory interpretation; it is not a new value of m.",
      },
      premiseRefs: [
        historical("arg-sr-field-components"),
        teaching("sr-electron-laboratory-force-definition"),
      ],
      sourceAnchor: "sr-electron-source-force-warning",
      isMove: true,
      moveLabel: "Transform the force frame before comparing the two transverse coefficients.",
    },
    {
      ...draft,
      historicalStatus: "later-force-convention",
      id: "sr-electron-laboratory-divide-factor",
      ...divide(yChangedForce, yChangedDivided, gamma, "γ > 0 for |v| < c"),
      reasonKind: "algebra",
      tool: "foundation:work-energy",
      reasons: {
        r0: "Divide by the extra factor supplied by the change of force frame.",
        r1: "The left side is γF_y/a_y. Divide both sides by γ, which is positive for a subluminal electron.",
        r2: "For |v| < c, γ = (1 − v²/c²)^(−1/2) is finite and strictly positive. Dividing γF_y/a_y = mγ² by γ is valid. The acceleration is still the same a_y in K; only the force convention has changed.",
      },
      premiseRefs: [teaching("sr-electron-subluminal-domain")],
      sourceAnchor: "sr-electron-source-force-warning",
    },
    {
      ...draft,
      historicalStatus: "later-force-convention",
      id: "sr-electron-laboratory-coefficient",
      ...collect(yChangedDivided, laboratory),
      reasonKind: "algebra",
      tool: "foundation:work-energy",
      reasons: {
        r0: "The all-laboratory transverse coefficient is mγ.",
        r1: "One factor cancels: F_y/a_y = mγ. At 0.6c it is 1.25m, while the source's mixed-frame coefficient remains 1.5625m.",
        r2: "Collecting the quotient gives the canonical all-laboratory equation F_y/a_y = mγ. At γ = 1.25 the two ratios differ by precisely γ. Both describe the same acceleration and trajectory when their forces are transformed consistently. Neither coefficient is a competing scalar rest mass, and neither changes the work or deflection observed in a fixed frame.",
      },
      premiseRefs: [teaching("sr-electron-laboratory-force-definition")],
      sourceAnchor: "sr-electron-source-force-warning",
    },
  ],
};

const speedIntegral = workIntegral.right as Integral;
const speed = speedIntegral.variable;
const gammaAtSpeed = walk(speedIntegral).find(
  (node) => node.kind === "symbol" && node.at,
) as Symbol;
const gammaDerivative: Expression = {
  kind: "derivative",
  opId: "sr-electron.op.gamma-derivative",
  expression: gammaAtSpeed,
  variable: speed,
  order: 1,
  partial: false,
};
const derivativeIntegrand = product(mass, power(light, 2), gammaDerivative);
const derivativeIntegral: Integral = { ...speedIntegral, expression: derivativeIntegrand };
const workDerivative = { ...workIntegral, right: derivativeIntegral };
const gammaAtRest: Symbol = { ...gamma, termId: "lorentzFactor:at-rest", at: number(0) };
const workBoundary = equation(
  workResult.left,
  product(mass, power(light, 2), sum(gamma, { kind: "negate", argument: gammaAtRest })),
  "work-boundary",
);
const workRest = substituteNode(workBoundary, gammaAtRest.termId, number(1)) as Relation;
const position = named("positionCoordinate1d");
const workSpatialIntegral: Integral = {
  kind: "integral",
  opId: "sr-electron.op.work-spatial",
  expression: xForce,
  variable: position,
  lower: named("workStartPosition"),
  upper: named("workEndPosition"),
};
const workSpatial = equation(workResult.left, workSpatialIntegral, "work-definition");

export const srElectronWork: DerivationChain = {
  id: "chain-sr-electron-work",
  proofRouteId: "route-sr-electron-work",
  routeKind: "source-order",
  entryAssumptions: [
    historical("arg-sr-electron-conventions"),
    historical("sr-electron-work-from-rest"),
  ],
  target: workResultRecord.id,
  targetStepId: "sr-electron-work-result",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-electron-work-change-variable",
      ...substitute(
        workSpatial,
        { ...workSpatial, right: speedIntegral },
        "sr-electron.op.work-spatial",
        speedIntegral,
        "For longitudinal acceleration from rest, F_x = mγ(u)³ du/dt and dx = u dt, hence ∫ F_x dx = ∫₀ᵛ mγ(u)³u du.",
      ),
      reasonKind: "calculus",
      tool: "foundation:work-energy",
      reasons: {
        r0: "Compute work from the force over the electron's path, starting at rest.",
        r1: "Use laboratory force and laboratory displacement: dW = F_x dx. With F_x = mγ(u)³ du/dt and dx = u dt, the time increment cancels. The integral runs over speed from 0 to v.",
        r2: "For straight acceleration from rest, write F_x dx = mγ(u)³(du/dt) u dt = mγ(u)³u du. Thus W = ∫₀ᵛ mγ(u)³u du, with γ(u) = (1 − u²/c²)^(−1/2). The initial kinetic energy is fixed to zero; this is work supplied during the acceleration, not an assumption that the body's rest energy equals mc². Radiation, self-fields and radiation reaction are excluded by the prescribed-field point-particle model.",
      },
      premiseRefs: [
        historical("arg-sr-electron-conventions"),
        historical("sr-electron-work-from-rest"),
      ],
      sourceAnchor: "sr-electron-source-work",
    },
    {
      ...draft,
      id: "sr-electron-work-recognize-derivative",
      ...substitute(
        { ...workSpatial, right: speedIntegral },
        workDerivative,
        `${workIntegralRecord.id}.op.integrand`,
        derivativeIntegrand,
        "Differentiating γ(u) gives dγ/du = γ(u)³u/c², so mγ(u)³u = mc² dγ/du.",
      ),
      reasonKind: "calculus",
      tool: "foundation:derivatives",
      reasons: {
        r0: "Recognize the integrand as the derivative of the Lorentz factor.",
        r1: "Differentiate γ(u): dγ/du = γ(u)³u/c². The integrand mγ(u)³u is therefore mc² times that derivative.",
        r2: "The chain rule gives d(1 − u²/c²)^(−1/2)/du = (−1/2)(1 − u²/c²)^(−3/2)(−2u/c²) = γ(u)³u/c². Multiplication by mc² reproduces the force-work integrand exactly for |u| < c. This is the step that turns the accumulated work into an endpoint change of γ, with no low-speed approximation.",
      },
      premiseRefs: [historical("sr-electron-subluminal-domain")],
      sourceAnchor: "sr-electron-source-work",
      isMove: true,
      moveLabel: "Recognize longitudinal work as mc² times the change in the Lorentz factor.",
    },
    {
      ...draft,
      id: "sr-electron-work-evaluate-endpoints",
      ...substitute(
        workDerivative,
        workBoundary,
        `${workIntegralRecord.id}.op.integral`,
        workBoundary.right,
        "The fundamental theorem of calculus gives ∫₀ᵛ mc²(dγ/du) du = mc²[γ(v) − γ(0)]; the lower endpoint is the stated rest condition.",
      ),
      reasonKind: "calculus",
      tool: "foundation:work-energy",
      reasons: {
        r0: "Evaluate the change between the final speed and rest.",
        r1: "The integral of the derivative is γ(v) − γ(0). Keep the lower endpoint until the rest condition is applied.",
        r2: "Mass m and light speed c are fixed in the integral. The fundamental theorem gives W = mc²[γ(v) − γ(0)]. Both endpoints remain visible, so an arbitrary integration constant cannot silently become a rest-energy claim. We abbreviate the final γ(v) as γ; it belongs to the final laboratory speed v.",
      },
      premiseRefs: [historical("sr-electron-work-from-rest")],
      sourceAnchor: "sr-electron-source-work",
    },
    {
      ...draft,
      id: "sr-electron-work-rest-boundary",
      ...substitute(
        workBoundary,
        workRest,
        gammaAtRest.termId,
        number(1),
        "At the lower endpoint u = 0, γ(0) = 1 and the accumulated work W(0) = 0.",
      ),
      reasonKind: "boundary-condition",
      tool: "foundation:work-energy",
      reasons: {
        r0: "At rest, the Lorentz factor is one and the accumulated work is zero.",
        r1: "Use γ(0) = 1. The subtraction is fixed by starting from rest, so W vanishes at v = 0.",
        r2: "The definition gives γ(0) = (1 − 0²/c²)^(−1/2) = 1. Substitute it only after evaluating both endpoints. For an initial speed u₀ instead, the work would be mc²[γ(v) − γ(u₀)]; the subtraction of 1 is specific to the rest boundary condition.",
      },
      premiseRefs: [historical("sr-electron-work-from-rest")],
      sourceAnchor: "sr-electron-source-work",
    },
    {
      ...draft,
      id: "sr-electron-work-result",
      ...collect(workRest, workResult),
      reasonKind: "algebra",
      tool: "foundation:work-energy",
      reasons: {
        r0: "The work from rest is mc²(γ − 1).",
        r1: "Collect the terms to get W = mc²(γ − 1), printed as μV²(β − 1). For slow motion its leading term is ½mv².",
        r2: "This is the canonical kinetic-energy result for the stated model. Expanding γ = 1 + ½(v/c)² + ⅜(v/c)⁴ + … gives W = ½mv² + ⅜mv⁴/c² + … for |v| ≪ c. At v = 0.6c, W = 0.25mc² whereas the leading classical term is 0.18mc². The displayed exact formula uses no series truncation and does not determine an additive rest energy.",
      },
      premiseRefs: [historical("sr-electron-work-from-rest")],
      sourceAnchor: "sr-electron-source-work",
    },
  ],
};

const glyphs: Readonly<Record<string, string>> = {
  electronMass: "m",
  lorentzFactor: "γ",
  speedOfLight: "c",
  frameSpeed: "v",
  electronSpeedStationary: "u",
  kineticEnergy: "W",
  positionCoordinate1d: "x",
  workStartPosition: "x_0",
  workEndPosition: "x_1",
  longitudinalForce: "F_x",
  longitudinalForceComoving: "\\mathrm{F}'_x",
  transverseForceLaboratory: "F_y",
  transverseForceComoving: "\\mathrm{F}'_y",
  accelerationLongitudinalLaboratory: "a_x",
  accelerationTransverseLaboratory: "a_y",
  accelerationLongitudinalComoving: "\\mathrm{a}'_x",
  accelerationTransverseComoving: "\\mathrm{a}'_y",
};
export function srElectronDisplayExpression(expression: Expression): Expression {
  return projectDerivationSymbols(
    expression,
    (symbol) => glyphs[symbol.quantityId] ?? symbol.quantityId,
  );
}
export function srElectronDisplayChain(chain: DerivationChain): DerivationChain {
  return {
    ...chain,
    steps: chain.steps.map((step) => ({
      ...step,
      from: srElectronDisplayExpression(step.from),
      to: srElectronDisplayExpression(step.to),
    })),
  };
}
export const srElectronChains = [
  srElectronLongitudinal,
  srElectronTransverse,
  srElectronLaboratory,
  srElectronWork,
] as const;
export const srElectronHistoricalReading = {
  r3: "Section 10 first assumes ordinary mechanics for a slowly moving electron, applies that law in its momentary rest frame, and transforms back. Einstein's force is measured in the comoving frame, while the acceleration used for the longitudinal and transverse mass coefficients is measured in the original frame. He explicitly warns that other definitions would give different coefficients. The all-laboratory transverse ratio is presented here as a later comparison. The work calculation in §10 integrates the longitudinal force from rest and fixes only the kinetic-energy difference. This reconstruction writes m, γ and c for the paper's μ, β and V; it does not use the September mass–energy argument as a premise.",
  r3Citations: [
    "Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §10, pp. 917–921.",
  ],
} as const;
export function srElectronReadingSet(step: { readonly reasons: StepReadings }) {
  return { ...step.reasons, ...srElectronHistoricalReading };
}
