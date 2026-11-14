import type { ResultPayload, ScientificResult } from "../../experiments/results/types.ts";

/** The same dilute-sphere inverse, when the two independently inferred products are given. */
export type MolecularProductInputs = Readonly<{
  /** N a in m/mol, determined by diffusion. */
  radiusTimesNumber: number;
  /** b N a³ in m³/mol, determined by the viscosity increment. */
  viscosityProduct: number;
  viscosityCoefficient: 1 | 2.5;
}>;

export type MolecularProductSolution = Readonly<{
  radius: ScientificResult;
  molecularNumber: ScientificResult;
}>;

/** Shared by the direct observation inverse and the printed-product reconstruction. */
export function molecularProductValuesFromLogs(logA: number, logB: number) {
  const logRadius = (logB - logA) / 2;
  const radius = Math.exp(logRadius);
  const molecularNumber = Math.exp(logA - logRadius);
  return Object.freeze({ radius, molecularNumber });
}

function result(quantity: "radius" | "molecularNumber", payload: ResultPayload): ScientificResult {
  return Object.freeze({
    ...payload,
    ...(quantity === "radius"
      ? { quantityId: "molecularRadius", unit: "m", semanticKind: "length" }
      : { quantityId: "molecularNumber", unit: "mol^-1", semanticKind: "molecular-number" }),
    ownerId: "molecular-dimensions",
  });
}

function refused(
  condition: string,
  reason: string,
  domainKind: "input" | "numerical",
): MolecularProductSolution {
  const payload = {
    status: "outside-domain" as const,
    condition,
    domainKind,
    reason,
    boundary: { alternativeModel: "positive finite molecular products and coefficient 1 or 2.5" },
  };
  return Object.freeze({
    radius: result("radius", payload),
    molecularNumber: result("molecularNumber", payload),
  });
}

function solution(logA: number, logB: number): MolecularProductSolution {
  const values = molecularProductValuesFromLogs(logA, logB);
  if (!Object.values(values).every((value) => Number.isFinite(value) && value > 0))
    return refused(
      "nonrepresentable-molecular-products",
      "These products do not give a positive finite radius and molecular number at this numerical precision.",
      "numerical",
    );
  return Object.freeze({
    radius: result("radius", { status: "value", value: values.radius }),
    molecularNumber: result("molecularNumber", { status: "value", value: values.molecularNumber }),
  });
}

/**
 * N a = A and b N a³ = C imply a² = C/(b A), then N = A/a. No target N, k_B,
 * gas constant or modern reference value enters this inverse. Supplying the two products
 * does not certify the measurements or the dilute-sphere premises that produced them.
 */
export function inferMolecularProducts(p: MolecularProductInputs): MolecularProductSolution {
  if (
    ![p.radiusTimesNumber, p.viscosityProduct].every((value) => Number.isFinite(value) && value > 0) ||
    (p.viscosityCoefficient !== 1 && p.viscosityCoefficient !== 2.5)
  )
    return refused(
      "invalid-molecular-products",
      "Supply positive finite diffusion and viscosity products, and coefficient 1 or 2.5.",
      "input",
    );
  return solution(
    Math.log(p.radiusTimesNumber),
    Math.log(p.viscosityProduct) - Math.log(p.viscosityCoefficient),
  );
}

/**
 * Re-describe an already inferred pair after correcting the viscosity coefficient,
 * holding its implicit diffusion and viscosity products fixed. This is a correction of
 * a supplied result, not an independent determination from new observations.
 */
export function correctMolecularCoefficient(p: Readonly<{
  radius: number;
  molecularNumber: number;
  fromCoefficient: 1 | 2.5;
  toCoefficient: 1 | 2.5;
}>): MolecularProductSolution {
  if (
    ![p.radius, p.molecularNumber].every((value) => Number.isFinite(value) && value > 0) ||
    ![1, 2.5].includes(p.fromCoefficient) ||
    ![1, 2.5].includes(p.toCoefficient)
  )
    return refused(
      "invalid-molecular-correction",
      "Supply a positive finite radius and molecular number, and original and revised coefficients of 1 or 2.5.",
      "input",
    );
  const logRadius = Math.log(p.radius);
  const logNumber = Math.log(p.molecularNumber);
  return solution(
    logNumber + logRadius,
    logNumber + 3 * logRadius + Math.log(p.fromCoefficient) - Math.log(p.toCoefficient),
  );
}
