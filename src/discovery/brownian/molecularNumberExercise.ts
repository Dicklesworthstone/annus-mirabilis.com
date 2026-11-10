import type { ExpressionExercisePart } from "../exercises/answer.ts";

/**
 * Invert the two relations in Brownian §5 without putting the unknown N into the inputs.
 * The checker tests conditional algebra; BM-07 remains the owner of statistical inference.
 */
export const MOLECULAR_NUMBER_EXERCISE: ExpressionExercisePart = {
  id: "bm-molecular-number-from-spread",
  prompt:
    "Turn the measurement into a molecular-number estimate. Let m2 be the average squared displacement along one axis over an interval t, with no drift and negligible measurement error. The model gives m2 = 2*D*t and D = R*T/(6*pi*eta*a*N). Here R is the molar gas constant, T the absolute temperature, eta the viscosity and a the particle radius, measured independently of these displacements. Solve for N using R, T, t, eta, a and m2. Use SI units and pi for π.",
  declaredNames: ["R", "T", "t", "eta", "a", "m2", "pi"],
  domains: {
    R: { min: 8.3, max: 8.32 },
    T: { min: 273, max: 330 },
    t: { min: 0.1, max: 100, scale: "log" },
    eta: { min: 0.5e-3, max: 20e-3, scale: "log" },
    a: { min: 0.1e-6, max: 5e-6, scale: "log" },
    m2: { min: 1e-14, max: 1e-10, scale: "log" },
  },
  referenceSource: "R*T*t/(3*pi*eta*a*m2)",
  tolerance: { absolute: 0, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount. N has dimension 1/mol.
  dimensions: {
    R: ["2", "1", "-2", "-1", "0", "-1"],
    T: ["0", "0", "0", "1", "0", "0"],
    t: ["0", "0", "1", "0", "0", "0"],
    eta: ["-1", "1", "-1", "0", "0", "0"],
    a: ["1", "0", "0", "0", "0", "0"],
    m2: ["2", "0", "0", "0", "0", "0"],
  },
  conditionNote:
    "This is a conditional point estimate for dilute spherical tracers with an independently known radius, no drift and negligible measurement error; it supplies no uncertainty interval.",
  workedExplanation:
    "First recover D = m2/(2*t). Substituting into the drag relation gives N = R*T/(6*pi*eta*a*D) = R*T*t/(3*pi*eta*a*m2). The 2 from the one-axis mean square changes 6 into 3. m2 is an average of squared displacements, not a squared average and not an RMS distance. A larger radius and a smaller N can give the same spread, so the radius must come from a separate measurement. R must also be established without using the same unknown N; inserting a modern exact Boltzmann constant would hide the count we are trying to infer. A finite sample makes this a point estimate, and inverting an unbiased diffusion estimate does not make the estimate of N unbiased. The inference laboratory handles sample size and uncertainty; this algebra alone supplies neither a confidence interval nor evidence that the model describes a real liquid. In modern SI, N is defined exactly, so a measurement with today's defined constants is a consistency check.",
};
