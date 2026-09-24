import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ08_DEFAULTS, type Lq08Parameters } from "./definition.ts";

/** What each typed field is called on the page, with the unit it is entered in. */
const LQ08_FIELD_NAMES: Partial<Record<keyof Lq08Parameters, string>> = {
  incidentPower: "the lamp power, in mW,",
  frequency: "the frequency ν, in THz,",
  workFunction: "the work function Φ, in eV,",
  quantumEfficiency: "the quantum efficiency",
  collectorPotential: "the collector potential, in volts,",
};

export function validateLq08Parameters(input: unknown): Computation<Lq08Parameters> {
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

  const p = input as Lq08Parameters;

  for (const key of keys as (keyof Lq08Parameters)[]) {
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return bad(`Enter ${LQ08_FIELD_NAMES[key] ?? "this value"} as a number.`);
    }
  }

  if (p.incidentPower < 0) {
    return bad("Enter a lamp power of zero or more, in mW.");
  }
  if (p.frequency <= 0) {
    return bad("Enter a frequency ν greater than zero, in THz.");
  }
  if (p.workFunction < 0) {
    return bad("Enter a work function Φ of zero or more, in eV.");
  }
  if (p.quantumEfficiency < 0 || p.quantumEfficiency > 1) {
    return bad("Enter a quantum efficiency from 0 to 1.");
  }
  if (p.collectorPotential < -100 || p.collectorPotential > 100) {
    return bad("Enter a collector potential from −100 to 100 V.");
  }

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
