/**
 * Classical Rayleigh-Jeans mode allocation, ultraviolet divergence, and mean resonator energy (LQ-02).
 * Specification: am-ref-radiation-15c.
 */

import { type ConstantSet, constantValue, thermalConstant } from "../constants.ts";
import type { CyclicFrequency, RadiationResult } from "./types.ts";

const JOULES_PER_EV = 1.602176634e-19;

/** Classical cutoff energy density U(nu_c) = (8 * pi * k_B * T / (3 * c^3)) * nu_c^3 in J m^-3. */
export function classicalCutoffEnergyDensity(
  nuCutoff: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
): RadiationResult<number> {
  const quantityId = "radiationEnergy";
  const unit = "J/m^3";
  if (!Number.isFinite(nuCutoff) || nuCutoff === Number.POSITIVE_INFINITY) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "classical-total-diverges",
      domainKind: "physical",
      reason:
        "The classical allocation assigns unbounded total energy; an infinite cutoff diverges.",
    };
  }
  if (nuCutoff <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-cutoff-frequency",
      domainKind: "physical",
      reason: `Cutoff frequency must be positive and finite (got ${nuCutoff}).`,
    };
  }
  if (!Number.isFinite(T) || T <= 0) {
    return {
      status: "outside-domain",
      quantityId,
      unit,
      condition: "nonpositive-temperature",
      domainKind: "physical",
      reason: `Temperature must be positive and finite (got ${T}).`,
    };
  }

  const c = constantValue(set, "speedOfLight").value;
  const kB = thermalConstant(set).value;

  // U(nu_c) = (8 * pi * k_B * T / (3 * c^3)) * nu_c^3
  const uCutoff = ((8 * Math.PI * kB * T) / (3 * c ** 3)) * nuCutoff ** 3;

  return {
    status: "value",
    quantityId,
    unit,
    value: uCutoff,
    linearRepresentable: true,
  };
}

/** Classical total energy integral over [0, infinity] diverges. */
export function classicalTotalEnergy(_T: number, _set: ConstantSet): RadiationResult<number> {
  return {
    status: "outside-domain",
    quantityId: "radiationEnergy",
    unit: "J/m^3",
    condition: "classical-total-diverges",
    domainKind: "physical",
    reason: "the classical allocation assigns unbounded total energy",
  };
}

/** Mean resonator energy E_bar = k_B * T = (R/N) * T. */
export function meanResonatorEnergy(
  T: number,
  set: ConstantSet,
): Readonly<{
  status: "value";
  quantityId: "meanResonatorEnergy";
  unit: "J";
  value: number;
  valueEv: number;
  linearRepresentable: true;
  ratioToFreeMoleculeKineticEnergy: number;
}> {
  const kB = thermalConstant(set).value;
  const energyJoules = kB * T;
  const energyEv = energyJoules / JOULES_PER_EV;

  return {
    status: "value",
    quantityId: "meanResonatorEnergy",
    unit: "J",
    value: energyJoules,
    valueEv: energyEv,
    linearRepresentable: true,
    ratioToFreeMoleculeKineticEnergy: 2 / 3, // E_bar / (3/2 * k_B * T) = 2/3
  };
}

/**
 * Classical mode allocation for LQ-02 modes.
 * Mode "lq-02:1904" is symbolic unless revealCoefficient is true.
 */
export function classicalModeAllocation(
  mode: string,
  nuCutoff: CyclicFrequency | number,
  T: number,
  set: ConstantSet,
  options: { revealCoefficient?: boolean } = {},
): RadiationResult<number> {
  const quantityId = "radiationEnergy";
  const unit = "J/m^3";

  if (mode === "lq-02:1904") {
    if (!options.revealCoefficient) {
      return {
        status: "symbolic",
        quantityId,
        unit,
        expressionRef: "eq-lq-02-1904-mode-allocation",
        unspecifiedSymbols: ["universalGasConstantPerMolecule", "boltzmannConstant"],
      };
    }
    const res = classicalCutoffEnergyDensity(nuCutoff, T, set);
    if (res.status !== "value") return res;
    return {
      ...res,
      historicalStatus: "parallel-work-1905",
    };
  }

  if (mode === "standard" || mode === "lq-02:1905") {
    return classicalCutoffEnergyDensity(nuCutoff, T, set);
  }

  return {
    status: "outside-domain",
    quantityId,
    unit,
    condition: "unknown-mode",
    domainKind: "input",
    reason: `Unknown mode "${mode}".`,
  };
}
