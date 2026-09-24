import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { powerOfTenText } from "../../units/scientific.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ04_DEFAULTS, type Lq04Parameters } from "./definition.ts";

/**
 * Widget-range and shape validation only. Whether a given state is dilute, whether the band is
 * narrow, and whether a state has a positive Wien temperature are physical-domain refusals the
 * owner (src/physics/reference/radiation.ts, am-ref-radiation-15c) decides, not this validator.
 */
export function validateLq04Parameters(input: unknown): Computation<Lq04Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq04.parameters" },
      { details: { requirements } },
    ),
  });

  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return bad("Use a complete parameter record.");
  }

  const keys = Object.keys(LQ04_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k))
  ) {
    return bad("Parameter fields must be complete, known data fields.");
  }

  const p = input as Lq04Parameters;

  if (!Number.isFinite(p.frequency) || p.frequency < 1e13 || p.frequency > 1e16) {
    return bad(`Enter a frequency from ${powerOfTenText(1e13)} to ${powerOfTenText(1e16)} Hz.`);
  }
  if (!Number.isFinite(p.bandwidth) || p.bandwidth < 1e9 || p.bandwidth > 1e14) {
    return bad(`Enter a band width from ${powerOfTenText(1e9)} to ${powerOfTenText(1e14)} Hz.`);
  }
  if (!Number.isFinite(p.referenceVolume) || p.referenceVolume < 1e-6 || p.referenceVolume > 1) {
    return bad(`Enter a reference volume from ${powerOfTenText(1e-6)} to 1 m³.`);
  }
  if (
    !Number.isFinite(p.referenceTemperature) ||
    p.referenceTemperature < 500 ||
    p.referenceTemperature > 10000
  ) {
    return bad("Enter a reference temperature from 500 to 10 000 K.");
  }
  if (!Number.isFinite(p.volumeRatio) || p.volumeRatio < 1e-4 || p.volumeRatio > 1e4) {
    return bad(`Enter a volume ratio from ${powerOfTenText(1e-4)} to ${powerOfTenText(1e4)}.`);
  }
  if (!Number.isFinite(p.diluteThresholdX) || p.diluteThresholdX < 3 || p.diluteThresholdX > 10) {
    return bad("Enter a dilute threshold from 3 to 10.");
  }
  if (typeof p.showUnfixedConstantPanel !== "boolean") {
    return bad("The C(ν) teaching panel toggle must be true or false.");
  }
  if (!Number.isFinite(p.illustrativeC)) {
    return bad("Enter the illustrative constant C(ν) as a number.");
  }

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
