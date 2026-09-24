import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ06_DEFAULTS, type Lq06Parameters } from "./definition.ts";

export type Lq06ParameterCheck = Computation<Lq06Parameters>;

/** What each typed field is called on the page, with the unit it is entered in. */
const LQ06_FIELD_NAMES = {
  radiationEnergy: "the radiation energy E, in nJ,",
  frequency: "the frequency ν, in THz,",
  gasParticles: "the number of molecules n",
  volumeRatio: "the volume ratio V/V₀",
  temperature: "the temperature T, in kelvin,",
} as const;

function bad(requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq06.parameters" },
      { details: { requirements } },
    ),
  };
}

/** Read only known, enumerable data fields; never invoke an imported getter. */
function dataFields(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  try {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
    const fields: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== "string" || !Object.hasOwn(LQ06_DEFAULTS, key)) return null;
      const d = Object.getOwnPropertyDescriptor(input, key);
      if (!d?.enumerable || !Object.hasOwn(d, "value")) return null;
      fields[key] = d.value;
    }
    return fields;
  } catch {
    return null;
  }
}

export function validateLq06Parameters(input: unknown): Lq06ParameterCheck {
  const fields = dataFields(input);
  if (!fields || Object.keys(fields).length !== Object.keys(LQ06_DEFAULTS).length) {
    return bad("Use complete, known parameter data fields.");
  }
  const p = fields as Lq06Parameters;
  for (const key of [
    "radiationEnergy",
    "frequency",
    "gasParticles",
    "volumeRatio",
    "temperature",
  ] as const) {
    if (typeof p[key] !== "number" || !Number.isFinite(p[key])) {
      return bad(`Enter ${LQ06_FIELD_NAMES[key]} as a number.`);
    }
  }
  if (p.radiationEnergy <= 0) return bad("Enter a radiation energy E greater than zero, in nJ.");
  if (p.frequency <= 0) return bad("Enter a frequency ν greater than zero, in THz.");
  if (p.gasParticles <= 0 || !Number.isSafeInteger(p.gasParticles)) {
    return bad("Enter a whole number of molecules n, at least 1.");
  }
  if (p.volumeRatio <= 0 || p.volumeRatio > 100) {
    return bad("Enter a volume ratio V/V₀ greater than 0 and at most 100.");
  }
  if (p.temperature <= 0 || p.temperature > 50000) {
    return bad("Enter a temperature T greater than 0 and at most 50 000 K.");
  }
  if (
    !["none", "E", "nu", "E_over_beta_nu", "N_E_over_R_beta_nu", "V"].includes(
      p.selectedSubexpression,
    )
  ) {
    return bad("Invalid subexpression choice.");
  }
  if (
    !["none", "E", "h_nu", "R_beta_nu_over_N", "k_B_T", "arbitrary"].includes(
      p.proposedEnergyElement,
    )
  ) {
    return bad("Invalid proposed energy element.");
  }
  if (!["none", "coincidence", "independent-quanta"].includes(p.forkAChoice)) {
    return bad("Invalid Fork A choice.");
  }
  if (!["modern-si-2019", "einstein-1905-light-quanta-printed"].includes(p.constantSetId)) {
    return bad("Choose the modern SI or printed 1905 light-quanta constant set.");
  }
  return { kind: "accepted", data: Object.freeze(p) };
}

/** Partial controls and complete presets use the same validation without object spreading first. */
export function mergeLq06Parameters(current: Lq06Parameters, input: unknown): Lq06ParameterCheck {
  const fields = dataFields(input);
  if (!fields) return bad("Use a plain patch of known parameter data fields.");
  return validateLq06Parameters({ ...current, ...fields });
}
