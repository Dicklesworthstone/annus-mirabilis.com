/**
 * Brownian §§3–4 in source order: equilibrium fixes D, then a symmetric jump law yields
 * the diffusion equation. The canonical equation records own the reusable mathematics.
 * The equilibrium route checks conditional algebra; thermodynamic/model premises remain admitted.
 * The jump-law calculus and its modern remainder qualification remain authored drafts.
 */

import diffusionRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusion-equation.json";
import molarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import momentRecord from "../../../content/equations/brownian-motion/eq-model-bm-jump-moment.json";
import nextRecord from "../../../content/equations/brownian-motion/eq-model-bm-next-density.json";
import spaceRecord from "../../../content/equations/brownian-motion/eq-model-bm-taylor-in-space.json";
import timeRecord from "../../../content/equations/brownian-motion/eq-model-bm-taylor-in-time.json";
import { type Expression, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef, StepReadings } from "./types.ts";

type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
type SumOrProduct = Extract<Expression, { kind: "sum" | "product" }>;
type Integral = Extract<Expression, { kind: "integral" }>;
type ImportedQuantity =
  | "molarGasConstant"
  | "temperature"
  | "avogadroConstant"
  | "viscosity"
  | "particleRadius"
  | "diffusionCoefficient"
  | "positionCoordinate1d"
  | "fieldTimeCoordinate"
  | "displacementIncrement"
  | "stepInterval";

/** Canonical term bindings retain arguments; only the display projection supplies glyphs. */
function bindingKey(symbol: SymbolExpression): string {
  const fields = [symbol.quantityId, symbol.index ?? "", symbol.at ?? null, symbol.args ?? null];
  return JSON.stringify(fields, (key, value) =>
    key === "termId" || key === "opId" ? undefined : value,
  );
}
function canonical(record: { readonly tree: unknown }): Relation {
  return projectDerivationSymbols(record.tree as Expression, bindingKey) as Relation;
}
const molar = canonical(molarRecord);
const next = canonical(nextRecord);
const timeTaylor = canonical(timeRecord);
const spaceTaylor = canonical(spaceRecord);
const jumpMoment = canonical(momentRecord);
const diffusion = canonical(diffusionRecord);
const imported = [molar, next, timeTaylor, spaceTaylor, jumpMoment, diffusion];
const symbolIndex = Object.fromEntries(
  imported.flatMap((tree) =>
    walk(tree)
      .filter((node) => node.kind === "symbol")
      .map((node) => [node.quantityId, node]),
  ),
) as Readonly<Record<ImportedQuantity, SymbolExpression>>;
const R = symbolIndex.molarGasConstant;
const T = symbolIndex.temperature;
const N = symbolIndex.avogadroConstant;
const eta = symbolIndex.viscosity;
const a = symbolIndex.particleRadius;
const D = symbolIndex.diffusionCoefficient;
const x = symbolIndex.positionCoordinate1d;
const time = symbolIndex.fieldTimeCoordinate;
const delta = symbolIndex.displacementIncrement;
const tau = symbolIndex.stepInterval;
const one: Expression = { kind: "number", value: "1" };
const zero: Expression = { kind: "number", value: "0" };
const two: Expression = { kind: "number", value: "2" };
const pi: Expression = { kind: "constant", name: "pi" };
const infinity: Expression = { kind: "constant", name: "infinity" };
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const negate = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const relation = (
  left: Expression,
  right: Expression,
  id: string,
  operator: Relation["operator"] = "=",
): Relation => ({ kind: "relation", opId: "bm-source.op." + id, operator, left, right });
const named = (quantityId: string, termId: string = quantityId): SymbolExpression => ({
  kind: "symbol",
  quantityId,
  termId,
});
const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const draft = {
  historicalStatus: "source-order-reconstruction",
  verification: { status: "authored-unverified" as const },
  isMove: false,
};
const n = named("numberDensity");
const force = named("externalForcePerParticle");
const mobility = named("mobility");
const drift = named("driftFlux");
const densityGradient: Expression = {
  kind: "derivative",
  opId: "bm-source.op.number-gradient",
  expression: n,
  variable: x,
  order: 1,
  partial: true,
  heldFixed: [T],
};
const thermal = quotient(product(R, T), N);
const stokesMobility = quotient(one, product({ kind: "number", value: "6" }, pi, eta, a));
const localBalance = relation(
  sum(negate(product(n, force)), product(thermal, densityGradient)),
  zero,
  "osmotic-balance",
);
const pressureBalance = relation(
  product(n, force),
  product(thermal, densityGradient),
  "pressure-balance",
);
const driftProduct: Expression = {
  kind: "product",
  opId: "bm-source.op.drift-product",
  args: [product(n, force), mobility],
};
const driftBalance = relation(
  driftProduct,
  product(product(thermal, densityGradient), mobility),
  "drift-balance",
);
const namedDrift = relation(drift, driftBalance.right, "named-drift");
const matchedFluxes = relation(product(D, densityGradient), driftBalance.right, "matched-fluxes");
const mobilityDiffusion = relation(D, product(mobility, thermal), "mobility-diffusion");
const withStokes = substituteNode(mobilityDiffusion, mobility.termId, stokesMobility) as Relation;

export const brownianEquilibriumDerivation: DerivationChain = {
  id: "chain-bm-source-equilibrium",
  proofRouteId: "route-bm-source-equilibrium",
  routeKind: "source-order",
  entryAssumptions: [
    historical("arg-bm-osmotic-suspended"),
    historical("bm-isothermal-osmotic-equilibrium"),
    historical("bm-stokes-drag-dilute-spheres"),
    historical("bm-fick-flux"),
    teaching("bm-nonzero-gradient-comparison"),
  ],
  target: molarRecord.id,
  targetStepId: "bm-equilibrium-collect-diffusivity",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "bm-equilibrium-read-pressure-balance",
      from: localBalance,
      to: pressureBalance,
      changedSubexpressionIds: [n.termId, force.termId, "bm-source.op.number-gradient"],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "add",
          quantity: product(n, force),
          simplify: true,
          swapSides: true,
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "At fixed temperature, the external force density balances the gradient of osmotic pressure.",
        r1: "Einstein's equilibrium condition is −nK + (RT/N) ∂n/∂x = 0. Move nK to the other side. The osmotic law Π = nRT/N makes the right side the pressure gradient when temperature is fixed.",
        r2: "For a dilute suspension in isothermal equilibrium, the paper obtains −nK + (RT/N) ∂n/∂x = 0 from the vanishing first variation of free energy. The same condition says that the external force density nK balances the osmotic-pressure gradient. Add nK to both sides to get nK = (RT/N) ∂n/∂x. Since R, T and N do not vary along x, differentiating Π = nRT/N leaves only the density derivative. The thermodynamic equilibrium construction is an admitted premise here; conservation of particles alone would not supply the osmotic law.",
      },
      tool: "foundation:free-energy-osmotic-pressure",
      premiseRefs: [
        historical("bm-isothermal-osmotic-equilibrium"),
        historical("arg-bm-osmotic-suspended"),
      ],
      sourceAnchor: "bm-equilibrium-source-pressure",
      modelStatus: "dilute-isothermal-equilibrium",
    },
    {
      ...draft,
      id: "bm-equilibrium-multiply-by-mobility",
      from: pressureBalance,
      to: driftBalance,
      changedSubexpressionIds: [mobility.termId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "multiply", quantity: mobility, simplify: true },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Multiply the force balance by mobility to turn a force into a mean drift.",
        r1: "Let b be mobility, so a weak force K produces steady drift bK. Multiply both sides of the pressure balance by b. The left now contains n times that drift speed, which is a particle flux.",
        r2: "Mobility is the ratio of steady drift velocity to the weak applied force: v = bK. Multiplying nK = (RT/N) ∂n/∂x by the same b on both sides gives (nK)b = [(RT/N) ∂n/∂x]b. The left has particles per volume times distance per time, so it counts particles crossing unit area per time. This steady response is the drift under an imposed force, not an instantaneous Brownian velocity inferred from a jagged trajectory.",
      },
      tool: "foundation:viscosity-stokes-drag",
      premiseRefs: [historical("bm-stokes-drag-dilute-spheres")],
      sourceAnchor: "bm-equilibrium-source-drift",
      modelStatus: "linear-stokes-mobility",
    },
    {
      ...draft,
      id: "bm-equilibrium-name-drift-flux",
      from: driftBalance,
      to: namedDrift,
      changedSubexpressionIds: [n.termId, force.termId, mobility.termId, drift.termId],
      rule: {
        kind: "substitute",
        params: {
          targetId: "bm-source.op.drift-product",
          replacement: drift,
          citedEquality:
            "The drift particle flux is J_drift = n b K; §3, eq-s3-d6 writes nK/(6πηa).",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Name the flow carried by the mean drift, counting particles rather than their mass.",
        r1: "Write the left-hand product as J_drift = nbK. This is the number of particles carried across unit area per second. It will be compared with Fick's particle flux in the same direction.",
        r2: "A slab of thickness bK in unit time carries n times that thickness particles across unit area, with its sign set by K. This defines J_drift = nbK. Einstein first writes a diffusive mass flow using the particle mass μ and then divides by that mass to compare particle counts. Our J_drift is already a particle flux, so it must be paired with −D ∂n/∂x, not with a mass flux. The density, mobility and force in this product are the same quantities as in the preceding equilibrium equation.",
      },
      tool: "foundation:flux-continuity",
      premiseRefs: [historical("bm-drift-particle-flux")],
      sourceAnchor: "bm-equilibrium-source-drift",
      modelStatus: "particle-number-flux",
    },
    {
      ...draft,
      id: "bm-equilibrium-match-opposing-fluxes",
      from: namedDrift,
      to: matchedFluxes,
      changedSubexpressionIds: [drift.termId, D.termId, "bm-source.op.number-gradient"],
      rule: {
        kind: "substitute",
        params: {
          targetId: drift.termId,
          replacement: product(D, densityGradient),
          citedEquality:
            "At zero net flux, J_drift + J_diff = 0 and J_diff = −D ∂n/∂x, so J_drift = D ∂n/∂x.",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Describe the same equilibrium as two opposing particle flows whose sum is zero.",
        r1: "Fick's diffusive flux is −D ∂n/∂x. At equilibrium it cancels the drift flux, so J_drift = D ∂n/∂x. Match this kinetic description to the osmotic balance already found.",
        r2: "Use Fick's law with its sign: J_diff = −D ∂n/∂x, so diffusion runs down the density gradient. In the equilibrium used by the thermodynamic argument, J_drift + J_diff = 0. Therefore J_drift = D ∂n/∂x. Substitute this value into the previous equality. Both sides now multiply the same density gradient, but one coefficient comes from diffusion and the other from mobility and osmotic pressure. Relating these two descriptions of the same state is the step that determines D without solving individual molecular collisions.",
      },
      tool: "foundation:flux-continuity",
      premiseRefs: [historical("bm-fick-flux"), historical("bm-isothermal-osmotic-equilibrium")],
      sourceAnchor: "bm-equilibrium-source-flux",
      modelStatus: "zero-net-flux",
      isMove: true,
      moveLabel: "Match osmotic balance and drift–diffusion balance for the same equilibrium.",
    },
    {
      ...draft,
      id: "bm-equilibrium-cancel-nonzero-gradient",
      from: matchedFluxes,
      to: mobilityDiffusion,
      changedSubexpressionIds: ["bm-source.op.number-gradient"],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: densityGradient,
          simplify: true,
          nonzeroCondition:
            "Use a nonzero density gradient in the weak-force equilibrium construction.",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Compare a state with a nonzero gradient, which cancels and leaves a force-independent diffusivity.",
        r1: "Divide by the common nonzero density gradient to obtain D = bRT/N. A uniform zero-force state gives 0 = 0 and does not determine D by division; the relation comes from the nontrivial equilibrium family.",
        r2: "The matched equation is D ∂n/∂x = b(RT/N) ∂n/∂x. Where the gradient is nonzero, divide both sides by it and collect the remaining factors: D = bRT/N. The magnitude and sign of the auxiliary force have disappeared. If K and the gradient both vanish, every D satisfies the zero-flux equation, so a formal 0/0 calculation would establish nothing. One determines the coefficient from nontrivial weak-force equilibria and then uses the resulting material relation in the zero-force limit.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [teaching("bm-nonzero-gradient-comparison")],
      sourceAnchor: "bm-equilibrium-source-result",
      modelStatus: "linear-response-coefficient",
    },
    {
      ...draft,
      id: "bm-equilibrium-insert-stokes-mobility",
      from: mobilityDiffusion,
      to: withStokes,
      changedSubexpressionIds: [mobility.termId, eta.termId, a.termId],
      rule: {
        kind: "substitute",
        params: {
          targetId: mobility.termId,
          replacement: stokesMobility,
          citedEquality:
            "Stokes drag K = 6πηav gives mobility b = v/K = 1/(6πηa) for a slowly drifting dilute sphere.",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Use Stokes's mobility for a small sphere in a viscous liquid.",
        r1: "For steady slow drift of a sphere, K = 6πηav, so b = 1/(6πηa). Substitute this independently supplied fluid law into D = bRT/N.",
        r2: "Stokes's drag on a sphere of radius a moving slowly through a Newtonian liquid of dynamic viscosity η is 6πηav. In steady forced drift this balances K, giving v/K = 1/(6πηa). Replace b by that expression. This step assumes the dilute, approximately spherical, low-Reynolds regime with the stated no-slip drag model; it does not infer those conditions from a rendered Brownian path. Particle inertia, nearby walls, interactions and slip corrections would require additional modeling.",
      },
      tool: "foundation:viscosity-stokes-drag",
      premiseRefs: [historical("bm-stokes-drag-dilute-spheres")],
      sourceAnchor: "bm-equilibrium-source-drift",
      modelStatus: "stokes-drag-approximation",
    },
    {
      ...draft,
      id: "bm-equilibrium-collect-diffusivity",
      from: withStokes,
      to: molar,
      changedSubexpressionIds: [molarRecord.id + ".op.quotient"],
      rule: { kind: "collect", params: { exact: true } },
      reasonKind: "algebra",
      reasons: {
        r0: "The final diffusivity rises with temperature and falls with viscosity and particle radius.",
        r1: "Combine the two fractions to obtain D = RT/(6πηaN). The result contains no applied force. Doubling viscosity halves D, while the later RMS displacement changes by the square root of that factor.",
        r2: "Multiply 1/(6πηa) by RT/N and collect the denominator to obtain RT/(6πηaN), the canonical modern form of the paper's D = (RT/N)/(6πkP). Here η is Einstein's k and a is his P; his k is viscosity, not Boltzmann's constant. R/N has units of energy per temperature, so multiplying by T and dividing by a drag coefficient yields length squared per time. Keeping R and N separate also preserves the historical inference problem: a modern k_B value derived from the desired N must not be used as independent evidence for it.",
      },
      tool: "foundation:bridge-scientific-notation-units",
      premiseRefs: [
        historical("bm-stokes-drag-dilute-spheres"),
        historical("bm-isothermal-osmotic-equilibrium"),
      ],
      sourceAnchor: "bm-equilibrium-source-result",
      modelStatus: "dilute-stokes-isothermal-equilibrium",
    },
  ],
};
const timeExpansion = timeTaylor.right as SumOrProduct;
const pNow = timeExpansion.args[0] as Expression;
const timeRate = (timeExpansion.args[1] as SumOrProduct).args[1] as Expression;
const spatialExpansion = spaceTaylor.right as SumOrProduct;
const firstSpatial = (
  (spatialExpansion.args[1] as Extract<Expression, { kind: "negate" | "average" | "group" }>)
    .argument as SumOrProduct
).args[1] as Expression;
const secondSpatial = (spatialExpansion.args[2] as SumOrProduct).args[1] as Expression;
const momentProduct = jumpMoment.right as SumOrProduct;
const secondMoment = momentProduct.args[1] as Integral;
const phi = (secondMoment.expression as SumOrProduct).args[1] as Expression;
const entireLine = (expression: Expression, id: string): Integral => ({
  kind: "integral",
  opId: "bm-source.op." + id,
  expression,
  variable: delta,
  lower: negate(infinity),
  upper: infinity,
});
const zeroMoment = entireLine(phi, "normalization-integral");
const firstMoment = entireLine(product(delta, phi), "first-moment-integral");
const originPlusBase = { ...spaceTaylor.left, args: [sum(x, delta), time] } as SymbolExpression;
const originPlus: SymbolExpression = { ...originPlusBase, termId: bindingKey(originPlusBase) };
const plusIntegral = {
  ...next.right,
  expression: product(originPlus, phi),
} as Integral;
const sourceTransition = relation(next.left, plusIntegral, "source-transition");
const expandedTime = relation(timeTaylor.right, plusIntegral, "expanded-time", "approx");
const expandedMoments = relation(
  timeTaylor.right,
  sum(
    product(pNow, zeroMoment),
    product(firstSpatial, firstMoment),
    product(quotient(secondSpatial, two), secondMoment),
  ),
  "expanded-moments",
  "approx",
);
const normalizedMoments = substituteNode(
  expandedMoments,
  "bm-source.op.normalization-integral",
  one,
) as Relation;
const symmetricMoments = substituteNode(
  normalizedMoments,
  "bm-source.op.first-moment-integral",
  zero,
) as Relation;
const canceledDensity = relation(
  product(tau, timeRate),
  product(quotient(secondSpatial, two), secondMoment),
  "canceled-density",
  "approx",
);
const dividedTime = relation(
  timeRate,
  product(jumpMoment.right, secondSpatial),
  "divided-time",
  "approx",
);
const namedDiffusion = substituteNode(dividedTime, momentRecord.id + ".op.product", D) as Relation;
const timeApproximation = {
  variable: "stepInterval",
  order: 1,
  domain:
    "The interval is short on the density-evolution scale but long enough for the independent-step model.",
  neglected:
    "The second and higher time terms; the leading remainder is of order τ² when the second time derivative is bounded.",
};
const spaceApproximation = {
  variable: "displacementIncrement",
  order: 2,
  domain:
    "Small displacements relative to the spatial variation scale; a smooth density and a symmetric kernel with controlled fourth moment.",
  neglected:
    "Higher spatial terms; symmetry removes the cubic contribution and the leading retained error is controlled by the fourth moment.",
};

export const brownianKernelDerivation: DerivationChain = {
  id: "chain-bm-source-kernel",
  proofRouteId: "route-bm-source-kernel",
  routeKind: "source-order",
  entryAssumptions: [
    historical("bm-normalized-transition-kernel"),
    historical("bm-symmetric-transition-kernel"),
    historical("bm-independent-coarse-intervals"),
    historical("bm-homogeneous-stationary-kernel"),
    teaching("bm-smooth-density-controlled-moments"),
  ],
  target: diffusionRecord.id,
  targetStepId: "bm-kernel-identify-continuum-equation",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "bm-kernel-expand-time",
      from: sourceTransition,
      to: expandedTime,
      changedSubexpressionIds: [timeRecord.id + ".op.series"],
      rule: { kind: "truncate-series", params: timeApproximation },
      approximation: timeApproximation,
      reasonKind: "approximation",
      reasons: {
        r0: "Over a short observation interval, retain the current density and its first change in time.",
        r1: "Expand p(x,t+τ) at fixed x as p(x,t) + τ ∂p/∂t, dropping the second and higher time terms. The interval must still be long enough for successive coarse steps to be treated as independent.",
        r2: "Begin with the transition average in the printed plus-sign convention: p(x,t+τ) = ∫p(x+Δ,t)φ(Δ)dΔ over the whole line. At fixed x, Taylor expansion gives p(x,t+τ) = p(x,t) + τ ∂p/∂t + O(τ²), provided the density changes smoothly on this time scale. The displayed approximation retains only the first two terms. Einstein requires τ to be short compared with observation times yet long enough that successive displacements can be treated as independent; this is not a claim that microscopic motion is independent at arbitrarily short times.",
      },
      tool: "foundation:taylor-expansion",
      premiseRefs: [
        historical("bm-independent-coarse-intervals"),
        teaching("bm-smooth-density-controlled-moments"),
      ],
      sourceAnchor: "bm-kernel-source-time",
      modelStatus: "coarse-time-expansion",
    },
    {
      ...draft,
      id: "bm-kernel-expand-space-and-average",
      from: expandedTime,
      to: expandedMoments,
      changedSubexpressionIds: ["bm-source.op.expanded-moments"],
      rule: { kind: "truncate-series", params: spaceApproximation },
      approximation: spaceApproximation,
      reasonKind: "approximation",
      reasons: {
        r0: "Expand in the small displacement, then average value, slope and curvature over the jump law.",
        r1: "At fixed t, write p(x+Δ,t) as p + Δ ∂p/∂x + (Δ²/2) ∂²p/∂x². Integrating each term against φ turns its displacement factor into a moment of the kernel.",
        r2: "The source prints the spatial Taylor series continuing indefinitely. Here its retained terms are displayed: p(x+Δ,t) = p(x,t) + Δ ∂p/∂x + (Δ²/2) ∂²p/∂x² plus higher orders. Insert them into the transition integral and use linearity. The density and its derivatives are evaluated at the fixed point (x,t), so they can be taken outside the Δ integrals. The three coefficients are ∫φ, ∫Δφ and ∫Δ²φ. This exchange needs a smooth density on the jump scale and controlled moments; a finite variance by itself does not bound every Taylor remainder.",
      },
      tool: "foundation:taylor-expansion",
      premiseRefs: [teaching("bm-smooth-density-controlled-moments")],
      sourceAnchor: "bm-kernel-source-space",
      modelStatus: "small-displacement-expansion",
    },
    {
      ...draft,
      id: "bm-kernel-use-normalization",
      from: expandedMoments,
      to: normalizedMoments,
      changedSubexpressionIds: ["bm-source.op.normalization-integral"],
      rule: {
        kind: "registered-identity",
        params: {
          identityId: "kernel-normalization",
          citedPremises: [
            "The transition probability density integrates to one over all displacements.",
          ],
        },
      },
      reasonKind: "probability",
      reasons: {
        r0: "Some displacement must occur, so the total weight of the kernel is one.",
        r1: "Normalization gives ∫φ(Δ)dΔ = 1. Replace only the zeroth moment by one, leaving the first and second moments visible. This preserves the present density term that will cancel from both sides.",
        r2: "The transition density is a probability density per unit displacement, so φ(Δ)dΔ is a probability and its integral over every possible Δ is one. The first term on the right is therefore p(x,t) times one. Substitute this normalization only into that integral; neither the signed first moment nor the squared second moment is fixed by normalization. Keeping those integrals separate distinguishes conservation of probability from absence of drift and from the strength of spreading.",
      },
      tool: "foundation:integration",
      premiseRefs: [historical("bm-normalized-transition-kernel")],
      sourceAnchor: "bm-kernel-source-normalization",
      modelStatus: "normalized-transition-law",
    },
    {
      ...draft,
      id: "bm-kernel-remove-odd-moment",
      from: normalizedMoments,
      to: symmetricMoments,
      changedSubexpressionIds: ["bm-source.op.first-moment-integral"],
      rule: {
        kind: "registered-identity",
        params: {
          identityId: "odd-moments-symmetric-kernel",
          citedPremises: [
            "φ(Δ) = φ(−Δ), with an integrable first moment on the symmetric whole line.",
          ],
        },
      },
      reasonKind: "symmetry",
      reasons: {
        r0: "Equal left and right weights cancel the signed first moment, while the squared moment remains.",
        r1: "For φ(Δ) = φ(−Δ), each contribution Δφ(Δ) has an equal opposite partner. Its integral is zero. Squaring removes the sign, so symmetry does not cancel ∫Δ²φ.",
        r2: "Assume the first moment exists; the controlled-moment hypotheses supply that condition here. Pair Δ and −Δ in ∫Δφ(Δ)dΔ. Symmetry gives the same kernel weight, while the displacement changes sign, so the pair sums to zero. Replace the first-moment integral by zero and retain the second-moment term. If the kernel were biased, this first moment would survive and create a transport term; normalization alone would not remove it. For Δ² the two partners have the same sign, so the second moment measures spreading even though the mean step vanishes.",
      },
      tool: "foundation:probability-independence",
      premiseRefs: [
        historical("bm-symmetric-transition-kernel"),
        teaching("bm-smooth-density-controlled-moments"),
      ],
      sourceAnchor: "bm-kernel-source-symmetry",
      modelStatus: "symmetric-transition-law",
      isMove: true,
      moveLabel: "Let symmetry remove drift while the second moment survives.",
    },
    {
      ...draft,
      id: "bm-kernel-cancel-current-density",
      from: symmetricMoments,
      to: canceledDensity,
      changedSubexpressionIds: [bindingKey(pNow as SymbolExpression)],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "subtract", quantity: pNow },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Cancel the same current density on both sides, leaving the change in time and the spreading term.",
        r1: "The normalized zeroth term is p and the odd-moment term is zero. Subtract p from both sides. The remaining relation is τ ∂p/∂t ≈ (1/2)(∂²p/∂x²)∫Δ²φ.",
        r2: "After the preceding identities, the equation reads p + τ ∂p/∂t ≈ p·1 + (∂p/∂x)·0 + (1/2)(∂²p/∂x²)∫Δ²φ. Multiplication by one leaves p, and multiplication by zero removes the first-derivative contribution. Subtract the same p(x,t) from both sides to isolate the retained time change. Normalization made this cancellation possible. The approximation sign remains because cancelling common terms does not restore the time and spatial terms dropped earlier.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [
        historical("bm-normalized-transition-kernel"),
        historical("bm-symmetric-transition-kernel"),
      ],
      sourceAnchor: "bm-kernel-source-moments",
      modelStatus: "retained-moment-equation",
    },
    {
      ...draft,
      id: "bm-kernel-divide-by-interval",
      from: canceledDensity,
      to: dividedTime,
      changedSubexpressionIds: [tau.termId, momentRecord.id + ".op.product"],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: tau,
          nonzeroCondition: "The coarse step interval τ is positive.",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Divide by the positive interval to turn the retained change into a rate.",
        r1: "Divide both sides by τ > 0. The coefficient of curvature becomes the mean-square displacement in one interval divided by 2τ, with dimensions of length squared per time.",
        r2: "Dividing τ ∂p/∂t ≈ (1/2)(∂²p/∂x²)∫Δ²φ by the positive interval τ gives the displayed coefficient [1/(2τ)]∫Δ²φ. All factors in that coefficient belong to the same transition interval; changing the interval while keeping an unrelated jump law would change the model. The integral has units of length squared because φ is a density per displacement. Dividing by time therefore produces the dimensions required for a diffusivity.",
      },
      tool: "foundation:bridge-scientific-notation-units",
      premiseRefs: [historical("bm-independent-coarse-intervals")],
      sourceAnchor: "bm-kernel-source-diffusivity",
      modelStatus: "retained-moment-equation",
    },
    {
      ...draft,
      id: "bm-kernel-name-diffusivity",
      from: dividedTime,
      to: namedDiffusion,
      changedSubexpressionIds: [momentRecord.id + ".op.product", D.termId],
      rule: {
        kind: "substitute",
        params: {
          targetId: momentRecord.id + ".op.product",
          replacement: D,
          citedEquality:
            "eq-model-bm-jump-moment: D = [1/(2τ)]∫Δ²φ(Δ)dΔ, corresponding to printed eq-s4-d9.",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Name the surviving second-moment coefficient D, linking random steps to the diffusion law.",
        r1: "Define D = ⟨Δ²⟩/(2τ). Substituting that coefficient gives ∂p/∂t ≈ D ∂²p/∂x² at the retained order, connecting the transition law to the diffusivity found in §3.",
        r2: "The normalized kernel gives ⟨Δ²⟩ = ∫Δ²φ(Δ)dΔ. Einstein names its half-per-interval coefficient D. Replace only that complete coefficient, leaving the curvature and time derivative intact. A homogeneous stationary jump law makes this D independent of x and t. This is the same coefficient that appears in the diffusion equation and in the drift–diffusion balance of §3, but naming it does not make a finite-step Taylor approximation exact. The remaining approximation is addressed in the next step.",
      },
      tool: "foundation:diffusion-equation",
      premiseRefs: [
        historical("bm-normalized-transition-kernel"),
        historical("bm-homogeneous-stationary-kernel"),
      ],
      sourceAnchor: "bm-kernel-source-diffusivity",
      modelStatus: "retained-moment-equation",
    },
    {
      ...draft,
      id: "bm-kernel-identify-continuum-equation",
      from: namedDiffusion,
      to: diffusion,
      changedSubexpressionIds: [diffusionRecord.id + ".op.relation"],
      rule: {
        kind: "take-limit",
        params: {
          variable: "stepInterval",
          approaches: 0,
          domain:
            "A mathematical small-jump family with ⟨Δ²⟩/(2τ) tending to finite D, ⟨Δ⁴⟩/τ tending to zero, and smooth bounded derivatives.",
        },
      },
      reasonKind: "limit",
      reasons: {
        r0: "The diffusion equation is the continuum law for the retained large-scale behavior, not a model of individual collisions.",
        r1: "In a controlled small-jump limit, keep ⟨Δ²⟩/(2τ) finite while the omitted terms vanish. The approximate retained relation becomes the diffusion equation. For physical tracers its use still requires time scales above the correlation time.",
        r2: "Einstein prints the equality after retaining the leading contributions. A modern justification considers a family with τ approaching zero, ⟨Δ²⟩/(2τ) approaching finite D, and ⟨Δ⁴⟩/τ approaching zero, with the relevant density derivatives bounded. After division by τ, the time remainder is of order τ and the symmetric spatial remainder is controlled by ⟨Δ⁴⟩/τ, so both vanish. The limiting equation is ∂p/∂t = D ∂²p/∂x². This mathematical limit identifies the continuum model; it does not assert that a liquid loses all microscopic time correlations. The physical application remains coarse grained.",
      },
      tool: "foundation:diffusion-equation",
      premiseRefs: [
        teaching("bm-smooth-density-controlled-moments"),
        historical("bm-independent-coarse-intervals"),
      ],
      sourceAnchor: "bm-kernel-source-equation",
      modelStatus: "diffusive-continuum-limit",
    },
  ],
};

export const brownianSourceEquations = {
  stokesMobility: relation(mobility, stokesMobility, "stokes-mobility"),
  pressureBalance,
  particleFluxBalance: relation(
    sum(drift, negate(product(D, densityGradient))),
    zero,
    "total-flux",
  ),
  jumpMoment,
  modernTransition: next,
  printedSignTransition: sourceTransition,
};

const glyphs: Readonly<Record<string, string>> = {
  diffusionCoefficient: "D",
  molarGasConstant: "R",
  temperature: "T",
  avogadroConstant: "N",
  viscosity: "η",
  particleRadius: "a",
  numberDensity: "n",
  externalForcePerParticle: "K",
  mobility: "b",
  driftFlux: "J_drift",
  probabilityDensity: "p",
  positionCoordinate1d: "x",
  fieldTimeCoordinate: "t",
  displacementIncrement: "Δ",
  stepInterval: "τ",
  transitionKernel: "φ",
};
export function brownianDisplayExpression(expression: Expression): Expression {
  return projectDerivationSymbols(
    expression,
    (symbol) => glyphs[symbol.quantityId] ?? symbol.quantityId,
  );
}
export function brownianDisplayChain(chain: DerivationChain): DerivationChain {
  const symbols = new Map(
    chain.steps
      .flatMap((step) => [step.from, step.to])
      .flatMap((tree) => walk(tree))
      .filter((node) => node.kind === "symbol")
      .map((node) => [node.termId, node]),
  );
  return {
    ...chain,
    steps: chain.steps.map((step) => ({
      ...step,
      from: brownianDisplayExpression(step.from),
      to: brownianDisplayExpression(step.to),
      changedSubexpressionIds: step.changedSubexpressionIds.map((id) => {
        const symbol = symbols.get(id);
        return symbol ? (glyphs[symbol.quantityId] ?? id) : id;
      }),
    })),
  };
}
export const brownianDerivationMetadata = {
  review: "draft",
  historicalStatus: "source-order-reconstruction",
  s3: {
    argument: "arg-bm-diffusivity",
    anchor: "bm-equilibrium-derivation",
    ownerBeadId: "am-bm-equations-s1-s3-u6j7",
  },
  s4: {
    argument: "arg-bm-diffusion-equation",
    anchor: "bm-source-diffusion-derivation",
    ownerBeadId: "am-bm-equations-s4-s5-6r81",
  },
} as const;
export const brownianHistoricalReadings: Readonly<Record<"s3" | "s4", string>> = {
  s3: "Section 3 of Einstein's 1905 Brownian paper derives the equilibrium condition by varying energy and entropy in a column of unit cross-section, then equates drift and diffusive particle flows. The paper writes ν for number density, k for viscosity, P for radius and μ for particle mass. This chain follows that order with n, η and a, and introduces b only as a name for the Stokes mobility. It retains R/N, preserving the distinction between the gas constant and the molecular number that later observations can constrain.",
  s4: "Section 4 first gives the normalized symmetric displacement law, then the transition integral, the time and spatial Taylor expansions, the moment cancellation and the definition of D. Einstein prints f(x+Δ) in the integral; the modern p(x−Δ) convention gives the same result for a symmetric kernel by changing the integration variable. This chain normalizes the particle distribution to p and keeps approximation signs visible until the continuum statement. The finite-moment remainder conditions are explanatory modern qualifications of the paper's small-displacement argument.",
};
export function brownianReadingSet(
  step: DerivationStep,
  section: "s3" | "s4",
): StepReadings & { readonly r3: string; readonly r3Citations: readonly string[] } {
  return {
    ...step.reasons,
    r3: brownianHistoricalReadings[section],
    r3Citations: [
      "Einstein, A. (1905). Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen. Annalen der Physik 17, 549–560 (" +
        (section === "s3" ? "§3, pp. 554–555" : "§4, pp. 556–559") +
        ").",
    ],
  };
}
