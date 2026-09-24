import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR05_DEFAULTS, type Sr05Parameters, WORLDLINE_PRESETS } from "./definition.ts";

const NUMERICAL_SPEED_BOUND = 0.95;

export function validateSr05Parameters(input: unknown): Computation<Sr05Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "sr05.parameters" },
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

  const keys = Object.keys(SR05_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    keys.some((k) => {
      const d = Object.getOwnPropertyDescriptor(input, k);
      return !d?.enumerable || !Object.hasOwn(d, "value");
    })
  ) {
    return bad("Use complete, known parameter data fields.");
  }

  const p = input as Sr05Parameters;

  if (typeof p.speed !== "number" || !Number.isFinite(p.speed)) {
    return bad("Enter the clock's speed v/c as a number.");
  }
  if (Math.abs(p.speed) > NUMERICAL_SPEED_BOUND) {
    return bad(
      `Enter a clock speed v/c from −${NUMERICAL_SPEED_BOUND} to ${NUMERICAL_SPEED_BOUND}.`,
    );
  }
  if (typeof p.worldlinePreset !== "string" || !WORLDLINE_PRESETS.includes(p.worldlinePreset)) {
    return bad(`"worldlinePreset" must be one of: ${WORLDLINE_PRESETS.join(", ")}.`);
  }
  if (
    typeof p.coordinateDuration !== "number" ||
    !Number.isFinite(p.coordinateDuration) ||
    p.coordinateDuration < 1e-9 ||
    p.coordinateDuration > 1e9
  ) {
    return bad("Enter a coordinate duration from 10⁻⁹ to 10⁹ seconds.");
  }
  if (
    typeof p.lightClockArm !== "number" ||
    !Number.isFinite(p.lightClockArm) ||
    p.lightClockArm < 1e-9 ||
    p.lightClockArm > 1e3
  ) {
    return bad("Enter a light-clock arm from 10⁻⁹ to 1000 light-seconds.");
  }
  if (typeof p.frameOfDescription !== "number" || !Number.isFinite(p.frameOfDescription)) {
    return bad("Enter the frame of description v/c as a number.");
  }
  if (Math.abs(p.frameOfDescription) > NUMERICAL_SPEED_BOUND) {
    return bad(
      `Enter a frame of description v/c from −${NUMERICAL_SPEED_BOUND} to ${NUMERICAL_SPEED_BOUND}.`,
    );
  }
  if (typeof p.showPrintedSecondOrder !== "boolean") {
    return bad('"showPrintedSecondOrder" must be a boolean.');
  }
  if (typeof p.equatorMode !== "boolean") {
    return bad('"equatorMode" must be a boolean.');
  }

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
