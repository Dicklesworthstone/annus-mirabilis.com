import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM05_DEFAULTS, type Bm05Parameters } from "./definition.ts";

function validateBm05Fields(input: unknown): Computation<Bm05Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "bm05.parameters" },
      { details: { requirements } },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return bad("Use a complete parameter record.");
  const keys = Object.keys(BM05_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k)) ||
    keys.some((k) => {
      const d = Object.getOwnPropertyDescriptor(input, k);
      return !d?.enumerable || !Object.hasOwn(d, "value");
    })
  )
    return bad("Use complete, known parameter data fields.");
  const p = input as Bm05Parameters;
  try {
    if (typeof p.seed !== "string") throw new Error();
    parseU64(p.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  if (!["coin", "uniform", "gaussian"].includes(p.kernel))
    return {
      kind: "refused",
      refusal: makeRefusal("unsupported-kernel", { parameterIds: ["kernel"] }),
    };
  // One sentence per control, named as the page labels it and in the unit it is entered in.
  const names = {
    stepRms: "the step RMS size, in μm,",
    tau: "the time between steps, in seconds,",
    walkers: "the number of walkers",
    runSteps: "the number of recorded steps per walker",
    n: "the observation step",
    bias: "the right-step probability",
  } as const;
  for (const key of Object.keys(names) as (keyof typeof names)[]) {
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v))
      return bad(`Enter ${names[key]} as a number.`);
  }
  if (!Number.isSafeInteger(p.walkers) || p.walkers < 1 || p.walkers > 10000)
    return bad("Enter a whole number of walkers from 1 to 10 000.");
  if (!Number.isSafeInteger(p.runSteps) || p.runSteps < 1 || p.runSteps > 10000)
    return bad("Enter a whole number of recorded steps per walker from 1 to 10 000.");
  if (!Number.isSafeInteger(p.n) || p.n < 0 || p.n > p.runSteps)
    return bad(
      `Enter an observation step that is a whole number from 0 to the recorded steps, ${p.runSteps}.`,
    );
  if (p.bias < 0 || p.bias > 1) return bad("Enter a right-step probability from 0 to 1.");
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}

/** The page's names and units; the record stores the step size in metres, the form in μm. */
const BM05_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  stepRms: { label: "Step RMS size", scale: 1e6, unit: "μm" },
  tau: { label: "Time between steps", unit: "s" },
};

/**
 * The fields above, then every range content/experiments/bm-05.yaml declares
 * (am-lab-domains-silently-clamped-pzj5). The field checks already hold the counts and the
 * probability to their declared ranges; the step size and the interval were only "greater than
 * zero" and are now held to theirs.
 */
export function validateBm05Parameters(input: unknown): Computation<Bm05Parameters> {
  return withinDeclaredDomain("bm-05", validateBm05Fields(input), BM05_DOMAIN_DISPLAY);
}
