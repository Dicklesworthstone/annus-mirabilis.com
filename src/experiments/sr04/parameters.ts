import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import { ALL_CONSTRAINTS, SR04_DEFAULTS, splitConstraints, type Sr04Parameters } from "./definition.ts";

/** Out-of-domain input explains, never silently clamps (am-sr-04-lorentz-map-px1k). */
export function validateSr04Parameters(input: unknown): Computation<Sr04Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "sr04.parameters" },
      { details: { requirements } },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return bad("Use a complete parameter record.");
  const keys = Object.keys(SR04_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k))
  )
    return bad("Parameter fields must be complete, known data fields.");
  const p = input as Sr04Parameters;

  if (!Number.isFinite(p.vOverC) || Math.abs(p.vOverC) > 0.95)
    return bad("The frame speed must be a fraction of c with magnitude at most 0.95.");
  if (typeof p.enabledConstraints !== "string")
    return bad("Enabled constraints must be a comma-joined list of construction constraint ids.");
  const requestedConstraints = splitConstraints(p.enabledConstraints);
  if (requestedConstraints.some((cid) => !(ALL_CONSTRAINTS as readonly string[]).includes(cid)))
    return bad("Enabled constraints must be a subset of the six named construction constraints.");
  for (const field of ["candidateA", "candidateB", "candidateD", "candidateTransverseScale"] as const) {
    if (!Number.isFinite(p[field]) || Math.abs(p[field]) > 1e6)
      return bad(`Candidate coefficient ${field} must be a finite number with magnitude at most 1e6.`);
  }
  if (typeof p.testCandidate !== "boolean") return bad("testCandidate must be true or false.");
  if (typeof p.showLaterAids !== "boolean") return bad("showLaterAids must be true or false.");
  // The slow case needs a slow observer and object (SR-06 owns faster composition).
  if (!Number.isFinite(p.observerSpeed) || Math.abs(p.observerSpeed) > 1e4)
    return bad("The slow case's observer speed must be at most 1e4 m/s in magnitude; faster composition belongs to SR-06.");
  if (!Number.isFinite(p.objectSpeed) || Math.abs(p.objectSpeed) > 1e4)
    return bad("The slow case's object speed must be at most 1e4 m/s in magnitude; faster composition belongs to SR-06.");

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
