import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ08_DEFAULTS, type Lq08Parameters } from "./definition.ts";

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
      return bad(`Parameter "${key}" must be a finite number.`);
    }
  }

  if (p.incidentPower < 0) {
    return bad("Incident optical power cannot be negative.");
  }
  if (p.frequency <= 0) {
    return bad("Frequency must be strictly positive.");
  }
  if (p.workFunction < 0) {
    return bad("Work function cannot be negative.");
  }
  if (p.quantumEfficiency < 0 || p.quantumEfficiency > 1) {
    return bad("Quantum efficiency must be in [0, 1].");
  }
  if (p.collectorPotential < -100 || p.collectorPotential > 100) {
    return bad("Collector potential must be in [-100, 100] V.");
  }

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
