/**
 * Mass-energy entrance scenario evaluation.
 *
 * Sits behind the experiments seam to evaluate reference physics owners (ME-01 and ME-02)
 * for entrance reader scenarios without violating the architectural import boundary.
 */
import type { ScientificResult } from "../results/types.ts";
import { evaluateMe01, evaluateMe02 } from "../../physics/reference/massEnergy.ts";

export type EntranceScalar = Readonly<{
  value: number;
  text: string;
  ownerId: string;
  quantityId: string;
}>;

export type MassEnergyEntranceScenario = Readonly<{
  id: "fast" | "slow";
  speedLabel: string;
  beta: number;
  restPulse: EntranceScalar;
  restLight: EntranceScalar;
  movingPulse1: EntranceScalar;
  movingPulse2: EntranceScalar;
  movingLight: EntranceScalar;
  subtraction: EntranceScalar;
  kinetic: EntranceScalar;
  relaxedKinetic: Extract<ScientificResult, { status: "underdetermined" }>;
  quadratic: EntranceScalar;
  discrepancy: EntranceScalar;
  bodyEnergies: readonly Extract<ScientificResult, { status: "symbolic" }>[];
  me01Href: string;
  me02Href: string;
}>;

export function scalar(result: ScientificResult): EntranceScalar {
  if (result.status !== "value" || typeof result.value !== "number" || !Number.isFinite(result.value)) {
    throw new Error(`Entrance requires a finite ${result.quantityId}; owner returned ${result.status}.`);
  }
  return Object.freeze({
    value: result.value,
    text: Number(result.value.toPrecision(10)).toString(),
    ownerId: result.ownerId,
    quantityId: result.quantityId,
  });
}

export function prepareMassEnergyScenario(id: "fast" | "slow"): MassEnergyEntranceScenario {
  if (id !== "fast" && id !== "slow") throw new Error("Unknown mass-energy entrance scenario.");
  const beta = id === "fast" ? 0.6 : 0.01;
  const inputs = Object.freeze({
    emittedEnergyRestFrame: 10,
    frameSpeed: beta,
    emissionAngle: 0,
    offsetDisplay: "symbolic" as const,
    notation: "modern" as const,
  });
  const ledger = evaluateMe01({ ...inputs, premise: "unchanged" });
  const relaxed = evaluateMe01({ ...inputs, premise: "relaxed" });
  const atRest = evaluateMe01({ ...inputs, frameSpeed: 0, premise: "unchanged" });
  const coefficient = evaluateMe02({ beta, emittedEnergy: inputs.emittedEnergyRestFrame });
  const bodyEnergies = [
    ledger.restBodyBefore,
    ledger.restBodyAfter,
    ledger.movingBodyBefore,
    ledger.movingBodyAfter,
  ].map((result) => {
    if (result.status !== "symbolic") throw new Error("An entrance body energy must remain unspecified.");
    return result;
  });
  if (relaxed.kineticEnergyDifference.status !== "underdetermined") {
    throw new Error("Relaxing the offset premise must withhold the kinetic interpretation.");
  }
  return Object.freeze({
    id,
    beta,
    speedLabel: id === "fast" ? "60 percent of light speed" : "1 percent of light speed",
    restPulse: scalar(atRest.pulse1Moving),
    restLight: scalar(ledger.restBalanceLight),
    movingPulse1: scalar(ledger.pulse1Moving),
    movingPulse2: scalar(ledger.pulse2Moving),
    movingLight: scalar(ledger.movingBalanceLight),
    subtraction: scalar(ledger.subtractionDifference),
    kinetic: scalar(ledger.kineticEnergyDifference),
    relaxedKinetic: relaxed.kineticEnergyDifference,
    quadratic: scalar(coefficient.quadraticApproximation),
    discrepancy: scalar(coefficient.quadraticDiscrepancy),
    bodyEnergies: Object.freeze(bodyEnergies),
    me01Href: `/lab/me-01/?v=${beta}&L=10&notation=modern`,
    me02Href: `/lab/me-02/?beta=${beta}&L=10&unit=joule&notation=modern`,
  });
}
