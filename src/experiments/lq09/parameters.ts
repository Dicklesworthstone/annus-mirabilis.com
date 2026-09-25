import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  type DomainDisplay,
  declaredDomains,
  domainRequirement,
  withinDeclaredDomain,
} from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ09_DEFAULTS, type Lq09Parameters } from "./definition.ts";

/** What each typed field is called on the page (IonizationLab FIELDS), with the unit it is entered in. */
const LQ09_FIELD_NAMES: Partial<Record<keyof Lq09Parameters, string>> = {
  frequency: "the frequency ν, in THz,",
  incidentPower: "the light power, in μW,",
  ionizationEnergyEv: "the ionization energy per molecule J, in eV,",
  absorptionEfficiency: "the share of the light absorbed",
  duration: "the exposure, in seconds,",
  declaredFraction: "the share of absorbed quanta that ionize, a,",
};

function validateLq09Fields(input: unknown): Computation<Lq09Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq09.parameters" },
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

  const keys = Object.keys(LQ09_DEFAULTS);
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

  const p = input as Lq09Parameters;

  const numericKeys: (keyof Lq09Parameters)[] = [
    "frequency",
    "ionizationEnergyEv",
    "incidentPower",
    "absorptionEfficiency",
    "duration",
    "declaredFraction",
  ];

  for (const key of numericKeys) {
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return bad(`Enter ${LQ09_FIELD_NAMES[key] ?? "this value"} as a number.`);
    }
  }

  // Every range is the manifest's, checked once by withinDeclaredDomain below. These checks named
  // wider ones (any power or exposure of zero or more), so a value between the two was refused
  // with a range it had already met.

  const validModes = ["all-absorbed-ionizes", "declared-fraction", "unknown"];
  if (!validModes.includes(p.absorptionMode)) {
    return bad(
      "Choose whether every absorbed quantum ionizes, a declared share does, or the share is unknown.",
    );
  }

  if (typeof p.gasName !== "string" || typeof p.gasCitation !== "string") {
    return bad("Give the gas a name and a citation, both as text.");
  }
  // A named gas brings a measured ionization energy, so it needs a source. Refused here, before
  // evaluation, so the owner's zero-filled refusal record never reaches a view as values.
  if (p.gasName.trim().length > 0 && p.gasCitation.trim().length === 0) {
    return bad(`Cite a source for the gas "${p.gasName.trim()}": a named gas needs one.`);
  }

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}

/** Each declared setting as the form names it, in the form's units. */
const LQ09_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  frequency: { label: "frequency ν", unit: "THz", scale: 1e-12 },
  incidentPower: { label: "light power", unit: "μW", scale: 1e6 },
  ionizationEnergyEv: { label: "ionization energy per molecule J" },
  absorptionEfficiency: { label: "share of the light absorbed" },
  duration: { label: "exposure" },
  declaredFraction: { label: "share of absorbed quanta that ionize, a" },
};

/** The fields above, then every range content/experiments/lq-09.yaml declares (dispatch 134). */
export function validateLq09Parameters(input: unknown): Computation<Lq09Parameters> {
  return withinDeclaredDomain("lq-09", validateLq09Fields(input), LQ09_DOMAIN_DISPLAY);
}

/** The declared-range sentence for one field, for a typed value too large to convert to its unit. */
export function lq09RangeSentence(key: keyof typeof LQ09_FIELD_NAMES): string {
  const domain = declaredDomains("lq-09")[key];
  return domain
    ? domainRequirement(domain, LQ09_DOMAIN_DISPLAY[key])
    : `Enter ${LQ09_FIELD_NAMES[key] ?? "this value"} as a smaller number.`;
}
