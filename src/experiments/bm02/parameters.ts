import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { type Bm02Inputs, DEFAULT_BM02_INPUTS } from "./session.ts";

/**
 * BM-02's validator, taken out of OsmoticPartitionLab.apply so the laboratory and the domain sweep
 * (src/testing/labDomainSweep.test.ts) read one rule (dispatch 184). The page's own check asked
 * only for finite numbers and a whole count, so a volume, temperature, radius or area of zero or
 * less was accepted and computed.
 */

/** The defaults under the name every laboratory exports them by. */
export const BM02_DEFAULTS: Bm02Inputs = DEFAULT_BM02_INPUTS;

const MODELS: readonly Bm02Inputs["model"][] = [
  "molecular-kinetic",
  "classical-thermodynamics-suspended-bodies",
];

/** What each typed field is called on the page, with the unit it is entered in. */
const BM02_FIELD_NAMES = {
  Np: "the particle count",
  V_um3: "the accessible volume, in μm³,",
  T: "the temperature, in K,",
  a_um: "the particle radius, in μm,",
  A_um2: "the partition area, in μm²,",
} as const;

function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

function validateBm02Fields(input: unknown): Computation<Bm02Inputs> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return refused([], "Use a complete settings record.");
  const keys = Object.keys(BM02_DEFAULTS);
  const record = input as Record<string, unknown>;
  if (
    Reflect.ownKeys(record).length !== keys.length ||
    Reflect.ownKeys(record).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    keys.some((k) => {
      const d = Object.getOwnPropertyDescriptor(record, k);
      return !d?.enumerable || !Object.hasOwn(d, "value");
    })
  )
    return refused(keys, "Use every setting exactly once, as data.");
  for (const key of Object.keys(BM02_FIELD_NAMES) as (keyof typeof BM02_FIELD_NAMES)[]) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value))
      return refused([key], `Enter ${BM02_FIELD_NAMES[key]} as a number.`);
  }
  const p = record as Bm02Inputs;
  if (!Number.isInteger(p.Np))
    return refused(
      ["Np"],
      `Enter a whole number of particles. The nearest whole numbers are ${Math.floor(p.Np)} and ${Math.ceil(p.Np)}.`,
    );
  if (!MODELS.includes(p.model))
    return refused(["model"], "Choose the molecular-kinetic or the classical model.");
  if (p.constantSetId !== "modern-si-2019")
    return refused(["constantSetId"], "Use the modern SI constant set.");
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}

/** Each declared setting as the form names it; the manifest writes the units as um^3 and um^2. */
const BM02_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  Np: { label: "particle count" },
  V_um3: { label: "accessible volume", unit: "μm³" },
  T: { label: "temperature" },
  a_um: { label: "particle radius", unit: "μm" },
  A_um2: { label: "partition area", unit: "μm²" },
};

/** The fields above, then every range content/experiments/bm-02.yaml declares. Never clamps. */
export function validateBm02Parameters(input: unknown): Computation<Bm02Inputs> {
  return withinDeclaredDomain("bm-02", validateBm02Fields(input), BM02_DOMAIN_DISPLAY);
}
