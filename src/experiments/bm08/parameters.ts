import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM08_DEFAULTS, type Bm08Parameters } from "./definition.ts";
export function validateBm08Parameters(input: unknown): Computation<Bm08Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "diffusion.inference" },
      { details: { requirements } },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return bad("Use a complete parameter record.");
  const keys = Object.keys(BM08_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    keys.some((k) => {
      const d = Object.getOwnPropertyDescriptor(input, k);
      return !d?.enumerable || !Object.hasOwn(d, "value");
    })
  )
    return bad("Use complete known data fields, not accessors.");
  const p = input as Bm08Parameters;
  for (const k of ["seed", "noiseSeed", "clickSeed"] as const)
    try {
      if (typeof p[k] !== "string") throw new Error();
      parseU64(p[k]);
    } catch {
      return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: [k] }) };
    }
  for (const k of keys as (keyof Bm08Parameters)[])
    if (
      typeof BM08_DEFAULTS[k] === "number" &&
      (typeof p[k] !== "number" || !Number.isFinite(p[k]))
    )
      return bad("Use finite numbers in the stated units.");
  if (
    !["known", "stationary"].includes(p.noiseMethod) ||
    p.coverage < 0.5 ||
    p.coverage > 0.999 ||
    !Number.isSafeInteger(p.coverageTrials) ||
    p.coverageTrials < 0 ||
    p.coverageTrials > 100
  )
    return bad(
      "Choose a registered noise procedure, 50–99.9% coverage, and at most 100 hypothetical trials.",
    );
  if (
    p.D < 1e-18 ||
    p.D > 1e-8 ||
    Math.abs(p.flowDrift) > 0.001 ||
    Math.abs(p.stageDrift) > 0.001 ||
    p.sigma < 0 ||
    p.sigma > 0.001
  )
    return bad(
      "Use diffusivity between 10⁻¹⁸ and 10⁻⁸ m²/s and noise/drift magnitudes at most 1 mm or 1 mm/s.",
    );
  if (
    ![1, 2, 3, 4].includes(p.dt) ||
    ![1, 2].includes(p.d) ||
    !Number.isSafeInteger(p.M) ||
    p.M < 3 ||
    p.M > 1000 ||
    !Number.isSafeInteger(p.clicks) ||
    p.clicks < 5 ||
    p.clicks > 200 ||
    p.exposure < 0 ||
    p.exposure > p.dt
  )
    return bad(
      "Use 3–1000 increments, 1–4 second frame spacing, one or two coordinates, 5–200 stationary clicks and exposure between zero and frame spacing.",
    );
  const exposureSteps = p.exposure / 0.25;
  if (!Number.isInteger(exposureSteps))
    return {
      kind: "refused",
      refusal: makeRefusal(
        "off-replay-grid",
        { parameterIds: ["exposure"], capabilityId: "diffusion.inference" },
        {
          details: {
            requirements: "Exposure must be a multiple of the recorded quarter-second grid.",
          },
          rankedRepairs: [
            {
              action: {
                parameterId: "exposure",
                value: Math.floor(exposureSteps) * 0.25,
              },
              label: "Use the preceding recorded exposure",
            },
          ],
        },
      ),
    };
  // The worker checks the replay-grid and recording horizon; a refusal preserves accepted state.
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
