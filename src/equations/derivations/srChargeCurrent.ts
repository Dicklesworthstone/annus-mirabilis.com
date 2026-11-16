/**
 * SR §9: consequences of the source's density and velocity transformations.
 * The source density law is an admitted physical result, not a conclusion of these
 * algebraic steps. Modern J notation exposes linearity without dividing by net charge.
 */
import densityRecord from "../../../content/equations/special-relativity/eq-model-sr-charge-density.json";
import currentRecord from "../../../content/equations/special-relativity/eq-model-sr-current-density.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef, StepReadings } from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
const symbol = (termId: string, quantityId: string): Expression => ({ kind: "symbol", termId, quantityId });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({ kind: "quotient", numerator, denominator });
const equation = (left: Expression, right: Expression): Relation => ({ kind: "relation", operator: "=", left, right });
const identified = (tree: Expression, id: string): Expression => ({ ...tree, opId: "sr-current.op." + id } as Expression);
const one: Expression = { kind: "number", value: "1" };

const rho = symbol("ρ", "chargeDensityStationary");
const rhoPrime = symbol("ρ'", "chargeDensityMoving");
const gamma = symbol("γ", "lorentzFactor");
const velocity = symbol("v", "frameSpeed");
const light = symbol("c", "speedOfLight");
const lightSquared: Expression = { kind: "power", base: light, exponent: { num: 2, den: 1 } };
const ux = symbol("u_x", "chargeVelocityStationary");
const uy = symbol("u_y", "chargeVelocityStationary");
const uz = symbol("u_z", "chargeVelocityStationary");
const uxPrime = symbol("u'_x", "chargeVelocityMoving");
const uyPrime = symbol("u'_y", "chargeVelocityMoving");
const uzPrime = symbol("u'_z", "chargeVelocityMoving");
const jx = symbol("J_x", "currentDensityStationary");
const jy = symbol("J_y", "currentDensityStationary");
const jz = symbol("J_z", "currentDensityStationary");
const jxPrime = symbol("J'_x", "currentDensityMoving");
const jyPrime = symbol("J'_y", "currentDensityMoving");
const jzPrime = symbol("J'_z", "currentDensityMoving");

const glyphs: Readonly<Record<string, string>> = {
  chargeDensityStationary: "ρ", chargeDensityMoving: "ρ'",
  currentDensityStationary: "J_x", currentDensityMoving: "J'_x",
  frameSpeed: "v", lorentzFactor: "γ", speedOfLight: "c",
};
const canonical = (record: { readonly tree: unknown }) => projectDerivationSymbols(
  record.tree as Expression, (value) => glyphs[value.quantityId] ?? value.termId,
) as Relation;
export const srChargeDensity = canonical(densityRecord);
export const srLongitudinalCurrent = canonical(currentRecord);

const bracket = sum(one, negative(quotient(product(velocity, ux), lightSquared)));
export const srChargeCurrentPremises = {
  density: equation(rhoPrime, product(gamma, bracket, rho)),
  velocityX: equation(uxPrime, quotient(sum(ux, negative(velocity)), bracket)),
  velocityY: equation(uyPrime, quotient(uy, product(gamma, bracket))),
  velocityZ: equation(uzPrime, quotient(uz, product(gamma, bracket))),
} as const;
export const srChargeCurrentDefinitions = {
  x: equation(jx, product(rho, ux)),
  y: equation(jy, product(rho, uy)),
  z: equation(jz, product(rho, uz)),
  movingX: equation(jxPrime, product(rhoPrime, uxPrime)),
  movingY: equation(jyPrime, product(rhoPrime, uyPrime)),
  movingZ: equation(jzPrime, product(rhoPrime, uzPrime)),
} as const;
export const srTransverseCurrents = {
  y: equation(jyPrime, jy), z: equation(jzPrime, jz),
} as const;

const reconstruction = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
export const srChargeCurrentAssumptions = [
  {
    id: "sr-current-source-density-velocity-laws",
    label: "The density and velocity laws already obtained in §9",
    explanation: "Admit the printed density law ρ′ = γ(1 − vuₓ/c²)ρ and the three velocity transformations. Einstein obtains the density law with the transformed Maxwell–Hertz equations and their sources. Multiplying density by velocity below does not independently derive that law.",
  },
  {
    id: "sr-current-single-species-current-definition",
    label: "Current means charge crossing unit area each second",
    explanation: "For one local species moving with velocity u, define J = ρu in each frame. The charge density is signed, so the same definition covers positive and negative carriers. It also allows zero species density; no step divides by ρ.",
  },
  {
    id: "sr-current-subluminal-domain",
    label: "A common subluminal boost, with finite carrier velocities",
    explanation: "c > 0, |v| < c, |uₓ| < c and γ = 1/√(1 − v²/c²) > 0. Thus 1 − vuₓ/c² > 0 and the velocity denominators are nonzero. All densities and currents describe the same event and consistently normalized units.",
  },
  {
    id: "sr-current-species-superposition",
    label: "Add the charges and currents of the species at the same event",
    explanation: "Total density is the sum of species densities; total current is the sum of their separate ρu products. Every species uses the same frame change. A neutral mixture can carry current: its total density may vanish while its total current does not.",
  },
] as const;

const entryAssumptions = srChargeCurrentAssumptions.map((item) => reconstruction(item.id));
const draft = {
  historicalStatus: "pedagogical-reconstruction", modelStatus: "charge-current-subluminal-boost",
  verification: { status: "authored-unverified" }, isMove: false,
} as const;

function substitution(id: string, from: Expression, targetId: string, replacement: Expression,
  citedEquality: string, reasons: StepReadings, refs: readonly string[], sourceAnchor = "sr-current-source-laws"): DerivationStep {
  return { ...draft, id, from, to: substituteNode(from, targetId, replacement),
    rule: { kind: "substitute", params: { targetId, replacement, citedEquality } },
    changedSubexpressionIds: [targetId], reasonKind: "definition", reasons,
    premiseRefs: refs.map(reconstruction), tool: "foundation:bridge-equals-sign-relationship", sourceAnchor };
}
function collection(id: string, from: Expression, to: Expression, reasons: StepReadings,
  refs: readonly string[], moveLabel?: string, sourceAnchor = "sr-current-source-laws"): DerivationStep {
  return { ...draft, id, from, to, rule: { kind: "collect", params: { exact: true } },
    changedSubexpressionIds: ["ρ", "u_x", "v"], reasonKind: "algebra", reasons,
    premiseRefs: refs.map(reconstruction), tool: "foundation:bridge-mathematical-punctuation", sourceAnchor,
    ...(moveLabel ? { isMove: true, moveLabel } : {}) };
}
function chain(id: string, target: string, steps: readonly DerivationStep[]): DerivationChain {
  return { id: "chain-sr-current-" + id, proofRouteId: "route-sr-current-" + id,
    routeKind: "pedagogical-reconstruction", entryAssumptions, target,
    targetStepId: steps.at(-1)?.id, essentialForPrint: true, steps };
}

const densityCollected = equation(rhoPrime, product(gamma, sum(rho,
  negative(quotient(product(velocity, identified(product(rho, ux), "species-current-x")), lightSquared)))));
const densityExpand = collection("sr-current-expand-density", srChargeCurrentPremises.density,
  densityCollected, {
    r0: "Open the density bracket so its carried-charge term is visible.",
    r1: "Distribute ρ through 1 − vuₓ/c² and collect ρuₓ together. The result is γ[ρ − v(ρuₓ)/c²].",
    r2: "The same signed species density multiplies both terms. This is exact distributive algebra on the source density law; it requires no nonzero charge density and introduces no approximation in v/c.",
  }, [srChargeCurrentAssumptions[0].id], "Recognize transported charge as current before adding different carriers.");
const densityName = substitution("sr-current-name-current-in-density", densityCollected,
  "sr-current.op.species-current-x", jx, "For this species Jₓ = ρuₓ.", {
    r0: "Name charge density times velocity as the current.",
    r1: "Replace the product ρuₓ by Jₓ. This gives ρ′ = γ(ρ − vJₓ/c²), the reader's canonical density equation.",
    r2: "This replacement names a product. It never solves uₓ = Jₓ/ρ, which would be undefined for a neutral mixture. Once expressed in ρ and Jₓ, the equation is linear and can be added species by species.",
  }, [densityExpand.id, srChargeCurrentAssumptions[1].id]);
export const srChargeDensityChain = chain("density", densityRecord.id, [densityExpand, {
  ...densityName, to: srChargeDensity,
}]);

function currentChain(axis: "x" | "y" | "z", definition: Relation, speed: Relation, conclusion: Relation) {
  const start = substitution("sr-current-" + axis + "-insert-density", definition, "ρ'",
    srChargeCurrentPremises.density.right, "Use the source density transformation for the same charge species.", {
      r0: "Begin with the moving current: moving density times moving velocity.",
      r1: "Replace the moving density by γ(1 − vuₓ/c²)ρ. The velocity still belongs to the moving frame.",
      r2: "The current definition is applied to one species at one event. Its transformed density and velocity must come from the same frame change; mixing one transformed quantity with an untransformed one would give a different current.",
    }, [srChargeCurrentAssumptions[0].id, srChargeCurrentAssumptions[1].id]);
  const speedId = axis === "x" ? "u'_x" : axis === "y" ? "u'_y" : "u'_z";
  const insertSpeed = substitution("sr-current-" + axis + "-insert-velocity", start.to, speedId,
    speed.right, "Use the printed transformation of the " + axis + " component of velocity.", {
      r0: "Use that same carrier's velocity in the moving frame.",
      r1: axis === "x" ? "Insert (uₓ − v)/(1 − vuₓ/c²). The density and velocity contain the same bracket."
        : "Insert the transverse velocity divided by γ(1 − vuₓ/c²). Both the bracket and γ occur in the density factor as well.",
      r2: "For subluminal frame and carrier velocities, |vuₓ/c²| < 1, so the denominator is strictly positive. The cancellation is valid at v = 0, at uₓ = 0, and for either sign of the charge. It does not divide by current or density.",
    }, [start.id, srChargeCurrentAssumptions[0].id, srChargeCurrentAssumptions[2].id]);
  const localVelocity = axis === "x" ? ux : axis === "y" ? uy : uz;
  const localCurrent = axis === "x" ? jx : axis === "y" ? jy : jz;
  const carried = identified(product(rho, localVelocity), "species-current-" + axis);
  const collected = equation(definition.left,
    axis === "x" ? product(gamma, sum(carried, negative(product(velocity, rho)))) : carried);
  const cancel = collection("sr-current-" + axis + "-cancel-common-factors", insertSpeed.to, collected, {
    r0: axis === "x" ? "The common bracket cancels; the frame carries an additional current."
      : "Density and sideways speed change by inverse factors, so their product stays the same.",
    r1: axis === "x" ? "The two factors 1 − vuₓ/c² cancel. Expand the remaining ρ(uₓ − v), giving γ(ρuₓ − vρ)."
      : "Cancel γ and 1 − vuₓ/c² between the density factor and the transverse velocity denominator. Only the original product ρu remains.",
    r2: axis === "x" ? "The cancellation retains the positive-denominator domain stated above. The term −vρ has units of current density: a charge distribution stationary in K flows in the negative x direction when described from a frame moving in the positive x direction."
      : "The equality concerns transverse current density at the same event. It does not say that transverse carrier velocity or charge density is individually invariant; their inverse transformation factors cancel in the product. The same reasoning applies separately to y and z.",
  }, [insertSpeed.id, srChargeCurrentAssumptions[2].id],
  axis === "x" ? "Transform density and carrier velocity together before multiplying." : undefined);
  const name = substitution("sr-current-" + axis + "-name-current", collected,
    "sr-current.op.species-current-" + axis, localCurrent, "In K, the current is the product of species density and its " + axis + " velocity.", {
      r0: "Name the original charge-flow product as current.",
      r1: axis === "x" ? "Replace ρuₓ by Jₓ, yielding J′ₓ = γ(Jₓ − vρ)."
        : "Replace the original density-velocity product by its current component. The transformed transverse component equals that original component.",
      r2: "This is the definition already used for the starting frame. It introduces no new force law, light-quantum premise or magnetic model. The resulting relation is linear in density and current, so separate charge species may be added without inventing one velocity for their mixture.",
    }, [cancel.id, srChargeCurrentAssumptions[1].id]);
  return chain("current-" + axis, axis === "x" ? currentRecord.id : "sr-current-transverse-" + axis,
    [start, insertSpeed, cancel, { ...name, to: conclusion }]);
}
export const srCurrentXChain = currentChain("x", srChargeCurrentDefinitions.movingX,
  srChargeCurrentPremises.velocityX, srLongitudinalCurrent);
export const srCurrentYChain = currentChain("y", srChargeCurrentDefinitions.movingY,
  srChargeCurrentPremises.velocityY, srTransverseCurrents.y);
export const srCurrentZChain = currentChain("z", srChargeCurrentDefinitions.movingZ,
  srChargeCurrentPremises.velocityZ, srTransverseCurrents.z);

/** Two arbitrary species suffice to show the additive step; repeat it for any finite set. */
export function srChargeCurrentSpecies(tree: Expression, species: "a" | "b"): Expression {
  return projectDerivationSymbols(tree, (node) => {
    const names: Readonly<Record<string, string>> = {
      chargeDensityStationary: "ρ_" + species, chargeDensityMoving: "ρ'_" + species,
      currentDensityStationary: "J_" + species, currentDensityMoving: "J'_" + species,
    };
    return names[node.quantityId] ?? node.termId;
  });
}
export function srChargeCurrentSumPremise(conclusion: Relation): Relation {
  const a = srChargeCurrentSpecies(conclusion, "a") as Relation;
  const b = srChargeCurrentSpecies(conclusion, "b") as Relation;
  return equation(identified(sum(a.left, b.left), "moving-total"), sum(a.right, b.right));
}

function superposition(id: "density" | "current", conclusion: Relation, producer: DerivationChain) {
  const densitySum = identified(sum(symbol("ρ_a", "chargeDensityStationary"), symbol("ρ_b", "chargeDensityStationary")), "density-total");
  const currentSum = identified(sum(symbol("J_a", "currentDensityStationary"), symbol("J_b", "currentDensityStationary")), "current-total");
  const start = srChargeCurrentSumPremise(conclusion);
  const grouped = equation(start.left, product(gamma, id === "density"
    ? sum(densitySum, negative(quotient(product(velocity, currentSum), lightSquared)))
    : sum(currentSum, negative(product(velocity, densitySum)))));
  const collect = collection("sr-current-total-" + id + "-collect", start, grouped, {
    r0: "Add two carriers' contributions before trying to describe their mixture.",
    r1: "Both species use the same γ, v and c. Collect their densities together and their longitudinal currents together.",
    r2: "The starting equality adds two instances of the already established species law. Exact distributive algebra shows that the transform of their sum is the sum of their transforms. Repeating this additive step covers any finite number of species; no common carrier velocity is required.",
  }, [producer.targetStepId!, srChargeCurrentAssumptions[3].id],
    "Add charge and current separately; a neutral mixture can still carry current.", "sr-current-source-mixture");
  const nameDensity = substitution("sr-current-total-" + id + "-density", grouped,
    "sr-current.op.density-total", rho, "The total signed density is ρ = ρa + ρb.", {
      r0: "Name the sum of the signed charge densities.",
      r1: "ρ is the sum of the two densities, including their signs. Opposite densities may sum to zero.",
      r2: "These contributions refer to the same event in K. Defining their sum requires neither equal species velocities nor a nonzero total. In particular, neutral matter remains admitted at this step.",
    }, [collect.id, srChargeCurrentAssumptions[3].id], "sr-current-source-mixture");
  const nameCurrent = substitution("sr-current-total-" + id + "-current", nameDensity.to,
    "sr-current.op.current-total", jx, "The total longitudinal current is Jₓ = Ja + Jb.", {
      r0: "Name the sum of the charge flows independently of the total charge.",
      r1: "Jₓ is the sum of each species' density times its own longitudinal velocity. It may remain nonzero when ρ is zero.",
      r2: "A positive stationary species and a moving negative species are a simple example. Their charge densities can cancel while their charge flows do not. Replacing the mixture by a single velocity Jₓ/ρ would lose precisely this case; the additive calculation never makes that replacement.",
    }, [nameDensity.id, srChargeCurrentAssumptions[3].id], "sr-current-source-mixture");
  const nameMoving = substitution("sr-current-total-" + id + "-moving", nameCurrent.to,
    "sr-current.op.moving-total", conclusion.left, "Define the moving total by adding the transformed species contributions.", {
      r0: "Add the transformed contributions to obtain the total seen in the moving frame.",
      r1: "The totals obey the same linear density and current relations as the individual carriers.",
      r2: "This conclusion follows from species additivity and the species laws. It does not assign a velocity to a neutral mixture. Net ρ = 0 and nonzero Jₓ are valid inputs, giving ρ′ = −γvJₓ/c² and J′ₓ = γJₓ.",
    }, [nameCurrent.id, srChargeCurrentAssumptions[3].id], "sr-current-source-mixture");
  return chain("total-" + id, id === "density" ? "sr-current-total-density" : "sr-current-total-longitudinal",
    [collect, nameDensity, nameCurrent, { ...nameMoving, to: conclusion }]);
}
export const srTotalChargeChain = superposition("density", srChargeDensity, srChargeDensityChain);
export const srTotalCurrentChain = superposition("current", srLongitudinalCurrent, srCurrentXChain);
export const srChargeCurrentChains = [srChargeDensityChain, srCurrentXChain, srCurrentYChain,
  srCurrentZChain, srTotalChargeChain, srTotalCurrentChain] as const;
export const srChargeCurrentSourceLinks = [
  { id: "sr-current-source-laws", anchor: "eq-s9-d4", label: "The printed velocity and density transformations in §9" },
  { id: "sr-current-source-mixture", anchor: "s9-p1", label: "The convection-current premise at the start of §9" },
] as const;
