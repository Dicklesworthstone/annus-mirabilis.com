import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  type DomainDisplay,
  declaredDomains,
  domainRequirement,
  withinDeclaredDomain,
} from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import {
  LQ08_DEFAULTS,
  LQ08_DISTRIBUTIONS,
  type Lq08Distribution,
  type Lq08Parameters,
} from "./definition.ts";

/** What each typed field is called on the page, with the unit it is entered in. */
const LQ08_FIELD_NAMES: Partial<Record<keyof Lq08Parameters, string>> = {
  incidentPower: "the lamp power, in mW,",
  frequency: "the frequency ν, in THz,",
  workFunction: "the work function Φ, in eV,",
  quantumEfficiency: "the quantum efficiency",
  collectorPotential: "the collector potential, in volts,",
};

function validateLq08Fields(input: unknown): Computation<Lq08Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq08.parameters" },
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

  const keys = Object.keys(LQ08_DEFAULTS);
  const numericKeys = keys.filter((key) => key !== "distributionModel");
  // A complete old five-field record means exactly the model the old owner used: none.
  // Unknown fields and malformed explicitly supplied model choices still fail closed.
  const required = Object.hasOwn(input, "distributionModel") ? keys : numericKeys;
  if (
    Reflect.ownKeys(input).length !== required.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    required.some((k) => {
      const d = Object.getOwnPropertyDescriptor(input, k);
      return !d?.enumerable || !Object.hasOwn(d, "value");
    })
  ) {
    return bad("Use complete, known parameter data fields.");
  }

  const p = input as Lq08Parameters;

  for (const key of numericKeys as (keyof Lq08Parameters)[]) {
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return bad(`Enter ${LQ08_FIELD_NAMES[key] ?? "this value"} as a number.`);
    }
  }

  const distributionModel = Object.hasOwn(input, "distributionModel")
    ? p.distributionModel
    : "none";
  if (!LQ08_DISTRIBUTIONS.includes(distributionModel as Lq08Distribution)) {
    return bad(
      "Choose no electron distribution, all electrons at the largest energy, or a uniform energy distribution.",
    );
  }

  // Every range is the manifest's, checked once by withinDeclaredDomain below. These checks named
  // other ranges (a collector potential to ±100 V where the manifest declares ±10 V), so a value
  // between the two was refused with a range it had already met.

  return { kind: "accepted", data: Object.freeze({ ...p, distributionModel }) };
}

/** Each declared setting as the form names it, in the form's units. */
const LQ08_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  incidentPower: { label: "lamp power", unit: "mW", scale: 1e3 },
  frequency: { label: "frequency ν", unit: "THz", scale: 1e-12 },
  workFunction: { label: "work function Φ" },
  quantumEfficiency: { label: "quantum efficiency" },
  collectorPotential: { label: "collector potential" },
};

/** The fields above, then every range content/experiments/lq-08.yaml declares (dispatch 134). */
export function validateLq08Parameters(input: unknown): Computation<Lq08Parameters> {
  return withinDeclaredDomain("lq-08", validateLq08Fields(input), LQ08_DOMAIN_DISPLAY);
}

/** The declared-range sentence for one field, for a typed value too large to convert to its unit. */
export function lq08RangeSentence(key: keyof typeof LQ08_FIELD_NAMES): string {
  const domain = declaredDomains("lq-08")[key];
  return domain
    ? domainRequirement(domain, LQ08_DOMAIN_DISPLAY[key])
    : `Enter ${LQ08_FIELD_NAMES[key] ?? "this value"} as a smaller number.`;
}
