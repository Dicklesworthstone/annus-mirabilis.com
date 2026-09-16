import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { type Lq06Parameters, LQ06_DEFAULTS } from "./definition.ts";

export type Lq06ParameterCheck = Computation<Lq06Parameters>;

export function validateLq06Parameters(input: unknown): Lq06ParameterCheck {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq06.parameters" },
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

  const keys = Object.keys(LQ06_DEFAULTS);
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

  const p = input as Lq06Parameters;

  const numericKeys: (keyof Lq06Parameters)[] = [
    "radiationEnergy",
    "frequency",
    "gasParticles",
    "volumeRatio",
    "temperature",
  ];

  for (const key of numericKeys) {
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return bad(`Parameter "${key}" must be a finite number.`);
    }
  }

  if (p.radiationEnergy <= 0) {
    return bad("Radiation energy must be strictly positive.");
  }

  if (p.frequency <= 0) {
    return bad("Frequency must be strictly positive.");
  }

  if (p.gasParticles <= 0 || !Number.isInteger(p.gasParticles)) {
    return bad("Gas particle count must be a positive integer.");
  }

  if (p.volumeRatio <= 0 || p.volumeRatio > 100) {
    return bad("Volume ratio V/V0 must be positive and not exceed 100.");
  }

  if (p.temperature <= 0 || p.temperature > 50000) {
    return bad("Temperature must be positive and under 50,000 K.");
  }

  const validSubexpressions = [
    "none",
    "E",
    "nu",
    "E_over_beta_nu",
    "N_E_over_R_beta_nu",
    "V",
  ];
  if (!validSubexpressions.includes(p.selectedSubexpression)) {
    return bad("Invalid subexpression choice.");
  }

  const validProposed = [
    "none",
    "E",
    "h_nu",
    "R_beta_nu_over_N",
    "k_B_T",
    "arbitrary",
  ];
  if (!validProposed.includes(p.proposedEnergyElement)) {
    return bad("Invalid proposed energy element.");
  }

  const validForks = ["none", "coincidence", "independent-quanta"];
  if (!validForks.includes(p.forkAChoice)) {
    return bad("Invalid Fork A choice.");
  }

  return {
    kind: "accepted",
    data: Object.freeze({ ...p }),
  };
}
