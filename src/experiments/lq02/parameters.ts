import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { DEFAULT_LQ02_INPUTS, type Lq02Inputs } from "./session.ts";

/**
 * LQ-02's validator, taken out of ModeAllocationLab.apply so the laboratory and the domain sweep
 * (src/testing/labDomainSweep.test.ts) read one rule (dispatch 184). A probe frequency above the
 * cutoff is not refused here: the session answers it with a typed outside-domain result.
 */

/** The defaults under the name every laboratory exports them by. */
export const LQ02_DEFAULTS: Lq02Inputs = DEFAULT_LQ02_INPUTS;

/** What each typed field is called on the page, with the unit it is entered in. */
const LQ02_FIELD_NAMES = {
  T: "the temperature, in K,",
  nuCutoff: "the highest resonator frequency, in Hz,",
  probeFrequency: "the probe frequency, in Hz,",
} as const;

function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

function validateLq02Fields(input: unknown): Computation<Lq02Inputs> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return refused([], "Use a complete settings record.");
  const keys = Object.keys(LQ02_DEFAULTS);
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
  for (const key of Object.keys(LQ02_FIELD_NAMES) as (keyof typeof LQ02_FIELD_NAMES)[]) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value))
      return refused([key], `Enter ${LQ02_FIELD_NAMES[key]} as a number.`);
  }
  if (record.constantSetId !== "modern-si-2019")
    return refused(["constantSetId"], "Use the modern SI constant set.");
  return { kind: "accepted", data: Object.freeze({ ...(record as Lq02Inputs) }) };
}

/** Each declared setting as the form names it. */
const LQ02_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  T: { label: "temperature" },
  nuCutoff: { label: "highest resonator frequency" },
  probeFrequency: { label: "probe frequency" },
};

/** The fields above, then every range content/experiments/lq-02.yaml declares. Never clamps. */
export function validateLq02Parameters(input: unknown): Computation<Lq02Inputs> {
  return withinDeclaredDomain("lq-02", validateLq02Fields(input), LQ02_DOMAIN_DISPLAY);
}
