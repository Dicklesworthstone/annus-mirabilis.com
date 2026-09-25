import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  type DomainDisplay,
  declaredDomains,
  domainRequirement,
  withinDeclaredDomain,
} from "../controls/declaredDomain.ts";
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

function validateLq06Fields(input: unknown): Lq06ParameterCheck {
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
  // The ranges of E, ν, n, V/V₀ and T are the manifest's, checked once by withinDeclaredDomain
  // below. These fields used to carry their own, wider ranges (V/V₀ up to 100, T up to 50 000 K),
  // so a value between the two was refused with the declared range after being told the wider one.
  if (!Number.isInteger(p.gasParticles)) return bad("Enter a whole number of molecules n.");
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

/** The fields above, then every range content/experiments/lq-06.yaml declares (dispatch 134). */
const LQ06_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  radiationEnergy: { label: "radiation energy E", unit: "nJ", scale: 1e9 },
  frequency: { label: "frequency ν", unit: "THz", scale: 1e-12 },
  gasParticles: { label: "number of molecules n" },
  volumeRatio: { label: "volume ratio V/V₀" },
  temperature: { label: "temperature T" },
};

export function validateLq06Parameters(input: unknown): Lq06ParameterCheck {
  return withinDeclaredDomain("lq-06", validateLq06Fields(input), LQ06_DOMAIN_DISPLAY);
}

/** The declared-range sentence for one field, for a typed value too large to convert to its unit. */
export function lq06RangeSentence(key: keyof typeof LQ06_FIELD_NAMES): string {
  const domain = declaredDomains("lq-06")[key];
  return domain
    ? domainRequirement(domain, LQ06_DOMAIN_DISPLAY[key])
    : `Enter ${LQ06_FIELD_NAMES[key]} as a smaller number.`;
}

/** Partial controls and complete presets use the same validation without object spreading first. */
export function mergeLq06Parameters(current: Lq06Parameters, input: unknown): Lq06ParameterCheck {
  const fields = dataFields(input);
  if (!fields) return bad("Use a plain patch of known parameter data fields.");
  return validateLq06Parameters({ ...current, ...fields });
}
