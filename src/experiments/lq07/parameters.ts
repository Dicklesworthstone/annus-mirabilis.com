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
    return bad("Enter an exciting frequency ν₁ greater than zero, in THz.");
  }

  const nu2 = obj.nu2;
  if (typeof nu2 !== "number" || !Number.isFinite(nu2) || nu2 <= 0) {
    return bad("Enter an emitted frequency ν₂ greater than zero, in THz.");
  }

  const regime = obj.regime;
  if (typeof regime !== "string" || !VALID_REGIMES.has(regime as Lq07Regime)) {
    return bad(
      "Choose the paper's assumption, deviation case 1 or 2, or the modern thermal allowance.",
    );
  }

  const multiQuantumK = obj.multiQuantumK;
  if (
    typeof multiQuantumK !== "number" ||
    !Number.isSafeInteger(multiQuantumK) ||
    multiQuantumK < 1
  ) {
    return bad("Enter a whole number of 1 or more for k, the quanta combining in one emission.");
  }

  const sourceTemperatureK = obj.sourceTemperatureK;
  if (
    typeof sourceTemperatureK !== "number" ||
    !Number.isFinite(sourceTemperatureK) ||
    sourceTemperatureK <= 0
  ) {
    return bad("Enter a source temperature above zero, in kelvin.");
  }

  const bodyTemperatureK = obj.bodyTemperatureK;
  if (
    typeof bodyTemperatureK !== "number" ||
    !Number.isFinite(bodyTemperatureK) ||
    bodyTemperatureK < 0
  ) {
    return bad("Enter a body temperature of zero or more, in kelvin.");
  }

  const absorbedPowerMicrowatts = obj.absorbedPowerMicrowatts;
  if (
    typeof absorbedPowerMicrowatts !== "number" ||
    !Number.isFinite(absorbedPowerMicrowatts) ||
    absorbedPowerMicrowatts <= 0
  ) {
    return bad("Enter an absorbed power greater than zero, in microwatts.");
  }

  const quantumYield = obj.quantumYield;
  if (
    typeof quantumYield !== "number" ||
    !Number.isFinite(quantumYield) ||
    quantumYield < 0 ||
    quantumYield > 1
  ) {
    return bad("Enter a quantum yield from 0 to 1, the fraction of absorbed quanta that emit.");
  }

  const channels = obj.channels;
  if (typeof channels !== "string" || !VALID_CHANNELS.has(channels as Lq07Channels)) {
    return bad("Choose light and heat, or light only, as the channels for the absorbed energy.");
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
