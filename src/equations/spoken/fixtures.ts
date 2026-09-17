/**
 * Authored spoken forms and term-and-operation metadata fixtures (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f.
 */

import type { SpokenForms, TermSpokenDetails } from "./types.ts";

export interface EquationAccessibilityFixture {
  readonly id: string;
  readonly paper: string;
  readonly title: string;
  readonly plainLatexPrinted: string;
  readonly plainLatexModern: string;
  readonly spokenForms: SpokenForms;
  readonly terms: readonly TermSpokenDetails[];
  readonly boundTerms: readonly string[];
}

export const EINSTEIN_RELATION_FIXTURE: EquationAccessibilityFixture = {
  id: "eq-bm-einstein-relation",
  paper: "brownian-motion",
  title: "Einstein Relation for the Diffusion Coefficient",
  plainLatexPrinted: "D = \\frac{R T}{6 \\pi k N a}",
  plainLatexModern: "D = \\frac{k_B T}{6 \\pi \\eta a}",
  spokenForms: {
    printed:
      "D, the diffusion coefficient, equals the gas constant R times absolute temperature T, divided by the quantity 6 times pi times viscosity k times Avogadro's number N times particle radius a.",
    modern:
      "D, the diffusion coefficient, equals Boltzmann's constant k sub B times absolute temperature T, divided by the quantity 6 times pi times dynamic viscosity eta times particle radius a.",
    alternate:
      "The rate of diffusion of microscopic suspended spheres is proportional to thermal energy and inversely proportional to Stokes hydrodynamic drag.",
    shortName: "Einstein relation for diffusion coefficient",
  },
  boundTerms: [
    "diffusion coefficient",
    "Boltzmann's constant",
    "temperature",
    "viscosity",
    "radius",
  ],
  terms: [
    {
      nodeId: "D",
      name: "Diffusion coefficient",
      role: "model-result",
      unit: "meters squared per second",
      status: "derived",
      fixedOrChanging: "changing",
      speechText: "D: Diffusion coefficient, a model result in meters squared per second.",
    },
    {
      nodeId: "kB",
      name: "Boltzmann's constant",
      role: "constant",
      unit: "Joules per Kelvin",
      value: "1.380649 times 10 to the minus 23",
      status: "numeric",
      fixedOrChanging: "fixed",
      speechText: "k sub B: Boltzmann's constant, exact fixed constant in Joules per Kelvin.",
    },
    {
      nodeId: "T",
      name: "Absolute temperature",
      role: "input",
      unit: "Kelvin",
      value: "293.15",
      status: "numeric",
      fixedOrChanging: "parameter",
      speechText: "T: Absolute temperature, an adjustable laboratory input in Kelvin.",
    },
    {
      nodeId: "eta",
      name: "Dynamic viscosity",
      role: "input",
      unit: "Pascal seconds",
      value: "1.002 times 10 to the minus 3",
      status: "numeric",
      fixedOrChanging: "parameter",
      speechText: "eta: Fluid dynamic viscosity, an input in Pascal seconds.",
    },
    {
      nodeId: "a",
      name: "Particle radius",
      role: "input",
      unit: "meters",
      value: "0.5 times 10 to the minus 6",
      status: "numeric",
      fixedOrChanging: "parameter",
      speechText: "a: Spherical particle radius, an input in meters.",
    },
    {
      nodeId: "op-divide",
      name: "Division (ratio of thermal energy to hydrodynamic drag)",
      role: "operation",
      status: "symbolic",
      speechText: "Division: thermal energy numerator divided by Stokes drag denominator.",
    },
    {
      nodeId: "op-stokes-drag",
      name: "Stokes drag coefficient factor (6 pi eta a)",
      role: "operation",
      unit: "Newton seconds per meter",
      status: "derived",
      speechText: "6 pi eta a: Stokes hydrodynamic friction factor in Newton seconds per meter.",
    },
  ],
};

export const BROWNIAN_DISPLACEMENT_FIXTURE: EquationAccessibilityFixture = {
  id: "eq-bm-displacement",
  paper: "brownian-motion",
  title: "Mean Square Displacement Formula",
  plainLatexPrinted: "\\lambda_x = \\sqrt{\\frac{R T}{N} \\frac{1}{3 \\pi k a} \\tau}",
  plainLatexModern: "\\sqrt{\\langle x^2 \\rangle} = \\sqrt{\\frac{k_B T}{3 \\pi \\eta a} \\tau}",
  spokenForms: {
    printed:
      "lambda sub x, the root mean square displacement, equals the square root of the quantity: R times T over N, times 1 over 3 pi k a, times elapsed time tau.",
    modern:
      "Root mean square displacement along the x-axis equals the square root of the quantity: Boltzmann's constant k sub B times absolute temperature T times elapsed time tau, divided by 3 pi times viscosity eta times particle radius a.",
    alternate:
      "The typical distance a Brownian particle wanders grows as the square root of elapsed time, with amplitude governed by thermal energy and fluid drag.",
    shortName: "Brownian root mean square displacement",
  },
  boundTerms: ["displacement", "Boltzmann's constant", "temperature", "viscosity", "radius", "tau"],
  terms: [
    {
      nodeId: "rms-displacement",
      name: "Root mean square displacement",
      role: "model-result",
      unit: "meters",
      status: "derived",
      fixedOrChanging: "changing",
      speechText: "Root mean square displacement in meters along one spatial dimension.",
    },
    {
      nodeId: "tau",
      name: "Observation time interval",
      role: "input",
      unit: "seconds",
      value: "60",
      status: "numeric",
      fixedOrChanging: "parameter",
      speechText: "tau: Time interval between observations in seconds.",
    },
    {
      nodeId: "op-sqrt",
      name: "Square root scaling",
      role: "operation",
      status: "symbolic",
      speechText: "Square root operation reflecting diffusion random walk scaling.",
    },
  ],
};

export const DIFFUSION_PDE_FIXTURE: EquationAccessibilityFixture = {
  id: "eq-bm-diffusion",
  paper: "brownian-motion",
  title: "One-Dimensional Diffusion Partial Differential Equation",
  plainLatexPrinted: "\\frac{\\partial f}{\\partial t} = D \\frac{\\partial^2 f}{\\partial x^2}",
  plainLatexModern: "\\frac{\\partial f}{\\partial t} = D \\frac{\\partial^2 f}{\\partial x^2}",
  spokenForms: {
    printed:
      "Partial derivative of particle density f with respect to time t equals the diffusion coefficient D times the second partial derivative of f with respect to position x.",
    modern:
      "Partial derivative of probability density f with respect to time t equals diffusion coefficient D times the second partial derivative of f with respect to position x.",
    alternate:
      "The rate of change of particle concentration at any point equals the diffusion constant times the spatial curvature of the concentration profile.",
    shortName: "1D Diffusion equation",
  },
  boundTerms: ["partial derivative", "density", "time", "diffusion coefficient", "position"],
  terms: [
    {
      nodeId: "df_dt",
      name: "Time rate of change of density",
      role: "operation",
      unit: "per meter cubed second",
      status: "symbolic",
      speechText: "Partial derivative of concentration with respect to time.",
    },
    {
      nodeId: "D",
      name: "Diffusion coefficient",
      role: "constant",
      unit: "meters squared per second",
      status: "numeric",
      speechText: "D: Diffusion coefficient constant in meters squared per second.",
    },
    {
      nodeId: "d2f_dx2",
      name: "Spatial curvature of density",
      role: "operation",
      unit: "per meter to the fifth",
      status: "symbolic",
      speechText: "Second spatial derivative of concentration profile.",
    },
  ],
};

export const LORENTZ_FACTOR_FIXTURE: EquationAccessibilityFixture = {
  id: "eq-sr-lorentz-factor",
  paper: "special-relativity",
  title: "Lorentz Factor Transformation Coefficient",
  plainLatexPrinted: "\\beta = \\frac{1}{\\sqrt{1 - v^2/V^2}}",
  plainLatexModern: "\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}",
  spokenForms: {
    printed:
      "beta, the Lorentz factor, equals 1 divided by the square root of the quantity 1 minus v squared over V squared, where V is the speed of light.",
    modern:
      "gamma, the Lorentz factor, equals 1 divided by the square root of the quantity 1 minus v squared over c squared, where c is the speed of light.",
    alternate:
      "Relativistic dilation factor scaling time intervals and lengths as relative speed approaches the speed of light.",
    shortName: "Lorentz factor relation",
  },
  boundTerms: ["Lorentz factor", "speed", "speed of light"],
  terms: [
    {
      nodeId: "gamma",
      name: "Lorentz factor",
      role: "model-result",
      unit: "dimensionless ratio",
      status: "derived",
      speechText: "gamma: Dimensionless relativistic Lorentz factor.",
    },
    {
      nodeId: "v",
      name: "Frame relative speed",
      role: "input",
      unit: "meters per second",
      status: "numeric",
      speechText: "v: Relative speed between inertial frames in meters per second.",
    },
    {
      nodeId: "c",
      name: "Speed of light",
      role: "constant",
      unit: "meters per second",
      value: "299792458",
      status: "numeric",
      speechText: "c: Vacuum speed of light constant.",
    },
  ],
};

export const MASS_ENERGY_KINETIC_FIXTURE: EquationAccessibilityFixture = {
  id: "eq-me-kinetic-diff",
  paper: "mass-energy",
  title: "Second-Order Kinetic Energy Difference",
  plainLatexPrinted: "K_0 - K_1 = \\frac{1}{2} \\frac{L}{V^2} v^2",
  plainLatexModern: "\\Delta K = \\frac{1}{2} \\frac{L}{c^2} v^2",
  spokenForms: {
    printed:
      "K sub 0 minus K sub 1, the decrease in kinetic energy, equals 1 half times emitted light energy L divided by light speed V squared, times velocity v squared.",
    modern:
      "Delta K, the decrease in kinetic energy, equals 1 half times emitted radiation energy L divided by light speed c squared, times velocity v squared.",
    alternate:
      "Emitting radiation of energy L decreases a moving body's kinetic energy by exactly the amount expected if its mass decreased by L over c squared.",
    shortName: "Kinetic energy loss from radiation emission",
  },
  boundTerms: ["kinetic energy", "emitted", "energy", "velocity", "light speed"],
  terms: [
    {
      nodeId: "Delta_K",
      name: "Kinetic energy difference",
      role: "model-result",
      unit: "Joules",
      status: "derived",
      speechText:
        "Delta K: Difference in kinetic energy before and after radiation emission in Joules.",
    },
    {
      nodeId: "L",
      name: "Emitted radiation energy",
      role: "input",
      unit: "Joules",
      status: "numeric",
      speechText: "L: Total energy emitted in the body's rest frame in Joules.",
    },
    {
      nodeId: "L_over_c2",
      name: "Inertial mass decrease",
      role: "model-result",
      unit: "kilograms",
      status: "derived",
      speechText: "L over c squared: Inertial mass loss of the body in kilograms.",
    },
  ],
};

export const ALL_SPOKEN_FIXTURES: readonly EquationAccessibilityFixture[] = [
  EINSTEIN_RELATION_FIXTURE,
  BROWNIAN_DISPLACEMENT_FIXTURE,
  DIFFUSION_PDE_FIXTURE,
  LORENTZ_FACTOR_FIXTURE,
  MASS_ENERGY_KINETIC_FIXTURE,
];
