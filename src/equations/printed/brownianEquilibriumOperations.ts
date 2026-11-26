/**
 * The printed sections 2–3 argument connecting osmotic pressure, force balance and particle flux.
 * These readings retain the source signs and the distinction between a density, its gradient
 * and a flux. Numerical evaluations remain owned by the audited diffusion reference functions.
 */
import type { BrownianOperationGuide } from "./brownianOperations.ts";

type Reading = BrownianOperationGuide["primary"][string];

const PRESSURE = ["-1", "1", "-2", "0", "0", "0"];
const FORCE_DENSITY = ["-2", "1", "-2", "0", "0", "0"];
const NUMBER_FLUX = ["-2", "0", "-1", "0", "0", "0"];

const DENSITY_GRADIENT: Reading = {
  kind: "derivative",
  derivativeOrder: 1,
  variableQuantity: "positionCoordinate1d",
  quantities: ["numberDensity", "positionCoordinate1d"],
  title: "Measure the spatial change in particle density",
  does: "Differentiate the number of particles per unit volume, nu, with respect to the position x.",
  why: "A positive gradient means that density increases toward positive x. It has dimension inverse length to the fourth power: it is neither a particle velocity nor the quotient nu divided by x.",
  foundation: "partial-derivatives",
};

const THERMAL_ENERGY: Reading = {
  kind: "quotient",
  quantities: ["molarGasConstant", "temperature", "avogadroConstant"],
  title: "Obtain the thermal energy per particle",
  does: "Divide the molar energy R T by the molecular number per mole N.",
  why: "The amount units cancel, leaving an energy per particle. R and N remain separate source quantities; the printed k elsewhere in section 3 denotes viscosity, not the Boltzmann constant.",
  foundation: "unit-system-1905",
};

const EQUILIBRIUM_NEXT = {
  href: "/papers/brownian-motion/s3/#bm-equilibrium-derivation",
  label: "Compare the two equilibrium equations and see how the force drops out",
};

const FORCE_PREMISE =
  "The suspension is dilute and has uniform absolute temperature T. Nu is particle number per unit volume and K is the signed external force on one particle along x. The osmotic law is p = (R T / N) nu, with N positive. The equations describe local stationary balance; they do not say that individual particles stop moving.";
const FLUX_PREMISE =
  "The dilute particles are spheres of positive radius P in a liquid of positive viscosity k. A weak force K produces the steady Stokes drift K/(6 pi k P); inertia, walls and particle interactions are neglected. D is a positive, spatially constant diffusivity. Multiplying number density by drift velocity gives particles crossing unit area per unit time.";

export const BROWNIAN_EQUILIBRIUM_GUIDES: Readonly<Record<string, BrownianOperationGuide>> = {
  "eq-s2-d12": {
    expectedDimension: PRESSURE,
    symbolIndices: {},
    allowCalculus: true,
    allowChainedRelations: true,
    context: "Changing the accessible volume turns the configurational free energy into pressure.",
    premise:
      "Differentiate at fixed temperature T and fixed particle count n. Independently positioned particles supply the factor J times V star to the power n, with J independent of that volume in the dilute homogeneous model. The result does not assert the same pressure law for a concentrated or interacting suspension.",
    next: {
      href: "/lab/bm-03/",
      label: "Connect the configuration integral, accessible volume and osmotic pressure",
    },
    primary: {
      row1: {
        kind: "relation",
        quantities: ["osmoticPressure", "freeEnergy", "volume"],
        literalNumbers: [],
        constantNames: [],
        title: "Read pressure from the volume dependence of free energy",
        does: "The osmotic pressure p is minus the partial derivative of F with respect to V star.",
        why: "At fixed temperature and particle count, an increase in accessible volume lowers the configurational free energy. Energy divided by volume has pressure dimensions; the minus sign makes the pressure positive in this dilute model.",
        foundation: "work-energy",
      },
      "row1.right": {
        kind: "negate",
        quantities: ["freeEnergy", "volume"],
        title: "Reverse the free-energy slope",
        does: "Apply the minus sign to the whole volume derivative of F.",
        why: "The negative free-energy slope gives positive osmotic pressure. The sign does not negate the volume or change which quantity is differentiated.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row1.right.argument": {
        kind: "derivative",
        derivativeOrder: 1,
        variableQuantity: "volume",
        quantities: ["freeEnergy", "volume"],
        title: "Differentiate at fixed temperature and particle count",
        does: "Take the first partial derivative of the free energy F with respect to the accessible volume V star, keeping T and n fixed.",
        why: "The volume-dependent term contains n times the logarithm of V star, whose derivative is n divided by V star. The unknown volume-independent factor drops out; its numerical value is not required to obtain pressure.",
        foundation: "partial-derivatives",
      },
      row2: {
        kind: "relation",
        quantities: [
          "osmoticPressure",
          "molarGasConstant",
          "temperature",
          "volume",
          "particleCount",
          "avogadroConstant",
        ],
        literalNumbers: [],
        constantNames: [],
        title: "Count independently positioned particles in the pressure",
        does: "The same pressure equals R T divided by V star, multiplied by n divided by N.",
        why: "Each independently positioned particle contributes one volume factor to the configuration integral. The derivative counts those n factors; it does not treat a locked cluster of n particles as n independent positions.",
        foundation: "probability-independence",
      },
      "row2.right.args.0": {
        kind: "quotient",
        quantities: ["molarGasConstant", "temperature", "volume"],
        title: "Divide the molar thermal energy by the accessible volume",
        does: "Divide R T by V star, the region accessible to the suspended particles.",
        why: "This factor has energy per mole per volume. Multiplication by n/N supplies the amount and produces pressure; this quotient alone is not yet the suspension's pressure.",
        foundation: "quantities-units",
      },
      "row2.right.args.1": {
        kind: "quotient",
        quantities: ["particleCount", "avogadroConstant"],
        title: "Convert the particle count into an amount",
        does: "Divide the particle count n by N, the number of molecules per mole.",
        why: "N carries inverse-amount dimensions, so n/N is an amount in moles. It is not a ratio of two arbitrary particle counts.",
        foundation: "quantities-units",
      },
      row3: {
        kind: "relation",
        quantities: [
          "osmoticPressure",
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "numberDensity",
        ],
        literalNumbers: [],
        constantNames: [],
        title: "Express pressure through the local number density",
        does: "Write the same pressure as the thermal energy per particle R T/N multiplied by nu, where nu equals n/V star.",
        why: "The density counts particles per volume. This last equality changes how the same result is expressed; it introduces no assumption about a diffusion coefficient or a particle trajectory.",
        foundation: "quantities-units",
      },
      "row3.right.args.0": THERMAL_ENERGY,
    },
  },
  "eq-s3-1": {
    expectedDimension: FORCE_DENSITY,
    symbolIndices: {},
    allowCalculus: true,
    context: "The free-energy variation gives the local equilibrium condition for a suspension.",
    premise: FORCE_PREMISE,
    next: EQUILIBRIUM_NEXT,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "externalForcePerParticle",
          "numberDensity",
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "positionCoordinate1d",
        ],
        literalNumbers: ["0"],
        constantNames: [],
        title: "Set the local free-energy variation to zero",
        does: "The negative external force density plus the thermal energy per particle times the density gradient equals zero.",
        why: "Equilibrium requires the coefficient of an arbitrary small displacement to vanish. Each term has force per volume dimensions; zero here expresses a local balance, not the absence of microscopic motion.",
        foundation: "work-energy",
      },
      "row1.left": {
        kind: "sum",
        quantities: [
          "externalForcePerParticle",
          "numberDensity",
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "positionCoordinate1d",
        ],
        title: "Combine the two contributions to the variation",
        does: "Add the negative external-force term and the positive thermal density-gradient term.",
        why: "Only contributions with the same force per volume dimensions can balance in this local equation. Their relative signs determine which density gradient can support equilibrium.",
        foundation: "work-energy",
      },
      "row1.left.args.0": {
        kind: "product",
        quantities: ["externalForcePerParticle", "numberDensity"],
        title: "Form the external-force contribution",
        does: "Multiply the negative force on one particle, minus K, by the number of particles per unit volume nu.",
        why: "This gives minus K nu, the external contribution to the free-energy variation. The later mechanical balance reverses the sign of the complete equation, not just this one term.",
        foundation: "work-energy",
      },
      "row1.left.args.0.args.0": {
        kind: "negate",
        quantities: ["externalForcePerParticle"],
        title: "Keep the sign of the external contribution",
        does: "Reverse the signed force K before multiplying by nu.",
        why: "Dropping this sign would require the density to increase in the opposite direction for the same applied force. Equal dimensions would not detect that physical error.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row1.left.args.1": {
        kind: "product",
        quantities: [
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "numberDensity",
          "positionCoordinate1d",
        ],
        title: "Convert the density gradient into a pressure gradient",
        does: "Multiply the spatial derivative of nu by the thermal energy per particle R T/N.",
        why: "Because T is uniform, differentiating p = (R T/N) nu leaves R T/N outside the derivative. The result has force per volume dimensions.",
        foundation: "partial-derivatives",
      },
      "row1.left.args.1.args.0": THERMAL_ENERGY,
      "row1.left.args.1.args.1": DENSITY_GRADIENT,
    },
  },
  "eq-s3-d4": {
    expectedDimension: FORCE_DENSITY,
    symbolIndices: {},
    allowCalculus: true,
    context: "Mechanical force balance states the same equilibrium in pressure language.",
    premise: FORCE_PREMISE,
    next: EQUILIBRIUM_NEXT,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "externalForcePerParticle",
          "numberDensity",
          "osmoticPressure",
          "positionCoordinate1d",
        ],
        literalNumbers: ["0"],
        constantNames: [],
        title: "Balance external force density against the pressure gradient",
        does: "K nu minus the spatial derivative of p equals zero.",
        why: "Substitute the dilute osmotic law at uniform T and reverse the sign of the whole thermodynamic equation to obtain this mechanical form. Both descriptions refer to the same stationary state.",
        foundation: "work-energy",
      },
      "row1.left": {
        kind: "sum",
        quantities: [
          "externalForcePerParticle",
          "numberDensity",
          "osmoticPressure",
          "positionCoordinate1d",
        ],
        title: "Add the external and pressure forces",
        does: "Combine the applied force per volume K nu with the pressure force per volume, minus the pressure gradient.",
        why: "A stationary suspension has zero total force density. The pressure force points down the pressure gradient, so a positive external force is balanced by pressure increasing toward positive x.",
        foundation: "work-energy",
      },
      "row1.left.args.0": {
        kind: "product",
        quantities: ["externalForcePerParticle", "numberDensity"],
        title: "Convert force on one particle into force per volume",
        does: "Multiply the signed force K on each particle by the number density nu.",
        why: "The result is a force density, not the force on a single particle or on an unspecified total sample. It can be compared with a pressure gradient because their dimensions match.",
        foundation: "quantities-units",
      },
      "row1.left.args.1": {
        kind: "negate",
        quantities: ["osmoticPressure", "positionCoordinate1d"],
        title: "Let the pressure force point down the pressure gradient",
        does: "Negate the whole derivative of pressure with respect to x.",
        why: "Pressure that rises toward positive x produces a force toward negative x. Reversing this sign changes the physical balance even though the dimensions remain unchanged.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row1.left.args.1.argument": {
        kind: "derivative",
        derivativeOrder: 1,
        variableQuantity: "positionCoordinate1d",
        quantities: ["osmoticPressure", "positionCoordinate1d"],
        title: "Measure the pressure change along the suspension",
        does: "Take the first partial derivative of osmotic pressure p with respect to position x.",
        why: "Pressure divided by length has force per volume dimensions. This is a spatial gradient, not a time derivative and not the quotient p divided by x.",
        foundation: "partial-derivatives",
      },
    },
  },
  "eq-s3-d8": {
    expectedDimension: NUMBER_FLUX,
    symbolIndices: {},
    relationOperator: null,
    allowCalculus: true,
    context: "Diffusion gives the signed number of particles crossing unit area per unit time.",
    premise:
      "D is positive and spatially constant, and nu is a smooth number density in the continuum description. This expression is the diffusive number flux. It excludes the drift term and differs from the preceding mass-flux expression by the particle mass.",
    next: {
      href: "/lab/bm-04/",
      label: "Compare the signs of directed drift and diffusive particle flux",
    },
    primary: {
      row1: {
        kind: "product",
        quantities: ["diffusionCoefficient", "numberDensity", "positionCoordinate1d"],
        literalNumbers: [],
        constantNames: [],
        title: "Read the diffusive number flux",
        does: "Multiply minus D by the spatial gradient of the number density nu.",
        why: "A diffusivity has dimensions length squared per time. Multiplying it by a number-density gradient gives particles per area per time. The printed expression does not by itself assert an equality or say this current vanishes.",
        foundation: "diffusion-equation",
      },
      "row1.args.0": {
        kind: "negate",
        quantities: ["diffusionCoefficient"],
        title: "Make diffusion flow toward lower density",
        does: "Use minus D as the multiplier of the signed density gradient.",
        why: "For a positive gradient, the diffusive flux is negative; for a negative gradient, it is positive. The leading minus sign does not mean that the physical diffusion coefficient D is negative.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row1.args.1": DENSITY_GRADIENT,
    },
  },
  "eq-2": {
    expectedDimension: NUMBER_FLUX,
    symbolIndices: {},
    allowCalculus: true,
    context: "At equilibrium the directed drift and diffusion currents cancel.",
    premise:
      FLUX_PREMISE +
      " This zero-flux condition is compared with the thermodynamic equilibrium to determine D. If K is zero and the density is uniform, the equation is only 0 = 0; dividing two vanishing terms cannot determine D.",
    next: EQUILIBRIUM_NEXT,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "numberDensity",
          "externalForcePerParticle",
          "viscosity",
          "particleRadius",
          "diffusionCoefficient",
          "positionCoordinate1d",
        ],
        literalNumbers: ["6", "0"],
        constantNames: ["pi"],
        title: "Set the total particle flux to zero",
        does: "The drift flux nu K/(6 pi k P) plus the diffusive flux minus D times the density gradient equals zero.",
        why: "The two signed currents can cancel while particles continue moving. Zero net flux is not the claim that either current, the applied force, or the diffusion coefficient separately vanishes.",
        foundation: "diffusion-equation",
      },
      "row1.left": {
        kind: "sum",
        quantities: [
          "numberDensity",
          "externalForcePerParticle",
          "viscosity",
          "particleRadius",
          "diffusionCoefficient",
          "positionCoordinate1d",
        ],
        title: "Add drift and diffusion in the same direction convention",
        does: "Add the drift contribution and the negative density-gradient contribution, both measured as particles crossing unit area per unit time.",
        why: "A positive force gives positive drift. At equilibrium the density rises in that direction, so diffusion carries particles back and the two fluxes cancel.",
        foundation: "diffusion-equation",
      },
      "row1.left.args.0": {
        kind: "quotient",
        quantities: ["numberDensity", "externalForcePerParticle", "viscosity", "particleRadius"],
        literalNumbers: ["6"],
        constantNames: ["pi"],
        title: "Multiply Stokes drift by the number density",
        does: "Divide nu times the force K by the complete Stokes drag coefficient 6 pi k P.",
        why: "K divided by the drag coefficient is a drift velocity. Multiplying by particles per volume gives a number flux; this is not the acceleration or displacement of one particle.",
        foundation: "viscosity-stokes-drag",
      },
      "row1.left.args.0.denominator": {
        kind: "product",
        quantities: ["viscosity", "particleRadius"],
        literalNumbers: ["6"],
        constantNames: ["pi"],
        title: "Retain the spherical Stokes drag coefficient",
        does: "Multiply six, pi, the liquid viscosity k and the particle radius P.",
        why: "The result has force divided by velocity dimensions. P is a radius, not a diameter: replacing it by a diameter would halve the inferred mobility and diffusivity.",
        foundation: "viscosity-stokes-drag",
      },
      "row1.left.args.1": {
        kind: "negate",
        quantities: ["diffusionCoefficient", "numberDensity", "positionCoordinate1d"],
        title: "Subtract the complete diffusive contribution",
        does: "Apply the minus sign to D times the whole density gradient.",
        why: "When density increases in the direction of the force, diffusion points against drift. Keeping this relative sign is necessary for equilibrium cancellation.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row1.left.args.1.argument": {
        kind: "product",
        quantities: ["diffusionCoefficient", "numberDensity", "positionCoordinate1d"],
        title: "Give the density gradient the units of particle flux",
        does: "Multiply the first spatial derivative of nu by D.",
        why: "Length squared per time multiplied by inverse length to the fourth power gives inverse area per time. The outer minus sign supplies the direction of the diffusive flux.",
        foundation: "diffusion-equation",
      },
      "row1.left.args.1.argument.args.1": DENSITY_GRADIENT,
    },
  },
};
