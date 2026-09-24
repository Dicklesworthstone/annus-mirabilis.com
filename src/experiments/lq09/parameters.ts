import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
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

export function validateLq09Parameters(input: unknown): Computation<Lq09Parameters> {
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

  if (p.frequency <= 0) {
    return bad("Enter a frequency ν greater than zero, in THz.");
  }
  if (p.ionizationEnergyEv < 0) {
    return bad("Enter an ionization energy per molecule J of zero or more, in eV.");
  }
  if (p.incidentPower < 0) {
    return bad("Enter a light power of zero or more, in μW.");
  }
  if (p.absorptionEfficiency < 0 || p.absorptionEfficiency > 1) {
    return bad("Enter a share of the light absorbed from 0 to 1.");
  }
  if (p.duration < 0) {
    return bad("Enter an exposure of zero seconds or more.");
  }
  if (p.declaredFraction < 0 || p.declaredFraction > 1) {
    return bad("Enter a share of absorbed quanta that ionize, a, from 0 to 1.");
  }

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
