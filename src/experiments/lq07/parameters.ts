import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Lq07Channels, Lq07Parameters, Lq07Regime } from "./definition.ts";

const VALID_REGIMES = new Set<Lq07Regime>([
  "standard-stokes",
  "deviation-multi-quantum",
  "deviation-non-wien",
  "modern-thermal",
]);

const VALID_CHANNELS = new Set<Lq07Channels>(["light-plus-heat", "light-only"]);

export function validateLq07Parameters(input: unknown): Computation<Lq07Parameters> {
  const bad = (requirements: string, code?: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq07.parameters" },
      { details: { requirements, ...(code ? { code } : {}) } },
    ),
  });

  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return bad("Use a complete parameter record.");
  }

  const obj = input as Partial<Record<keyof Lq07Parameters, unknown>>;

  const nu1 = obj.nu1;
  if (typeof nu1 !== "number" || !Number.isFinite(nu1) || nu1 <= 0) {
    return bad("Exciting frequency nu1 must be a positive finite number (nu1 > 0).");
  }

  const nu2 = obj.nu2;
  if (typeof nu2 !== "number" || !Number.isFinite(nu2) || nu2 <= 0) {
    return bad("Emitted frequency nu2 must be a positive finite number (nu2 > 0).");
  }

  const regime = obj.regime;
  if (typeof regime !== "string" || !VALID_REGIMES.has(regime as Lq07Regime)) {
    return bad(
      "Regime must be standard-stokes, deviation-multi-quantum, deviation-non-wien, or modern-thermal.",
    );
  }

  const multiQuantumK = obj.multiQuantumK;
  if (
    typeof multiQuantumK !== "number" ||
    !Number.isSafeInteger(multiQuantumK) ||
    multiQuantumK < 1
  ) {
    return bad("Multi-quantum order k must be a positive integer (k >= 1).");
  }

  const sourceTemperatureK = obj.sourceTemperatureK;
  if (
    typeof sourceTemperatureK !== "number" ||
    !Number.isFinite(sourceTemperatureK) ||
    sourceTemperatureK <= 0
  ) {
    return bad("Source temperature must be a positive finite number in Kelvin.");
  }

  const bodyTemperatureK = obj.bodyTemperatureK;
  if (
    typeof bodyTemperatureK !== "number" ||
    !Number.isFinite(bodyTemperatureK) ||
    bodyTemperatureK < 0
  ) {
    return bad("Body temperature must be a non-negative finite number in Kelvin.");
  }

  const absorbedPowerMicrowatts = obj.absorbedPowerMicrowatts;
  if (
    typeof absorbedPowerMicrowatts !== "number" ||
    !Number.isFinite(absorbedPowerMicrowatts) ||
    absorbedPowerMicrowatts <= 0
  ) {
    return bad("Absorbed optical power must be a positive finite number.");
  }

  const quantumYield = obj.quantumYield;
  if (
    typeof quantumYield !== "number" ||
    !Number.isFinite(quantumYield) ||
    quantumYield < 0 ||
    quantumYield > 1
  ) {
    return bad("Quantum yield Y must be a number between 0 and 1 (0 <= Y <= 1).");
  }

  const channels = obj.channels;
  if (typeof channels !== "string" || !VALID_CHANNELS.has(channels as Lq07Channels)) {
    return bad("Energy channels must be 'light-plus-heat' or 'light-only'.");
  }

  return {
    kind: "accepted",
    data: Object.freeze({
      nu1,
      nu2,
      regime: regime as Lq07Regime,
      multiQuantumK,
      sourceTemperatureK,
      bodyTemperatureK,
      absorbedPowerMicrowatts,
      quantumYield,
      channels: channels as Lq07Channels,
    }),
  };
}
