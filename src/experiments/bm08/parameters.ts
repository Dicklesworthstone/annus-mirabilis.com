import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM08_DEFAULTS, type Bm08Parameters } from "./definition.ts";

/** What each numeric control is called on the page, for the sentence a refused value shows. */
const FIELD_NAMES: Partial<Record<keyof Bm08Parameters, string>> = {
  D: "the generating diffusivity in μm²/s",
  flowDrift: "the fluid drift in μm/s",
  stageDrift: "the stage drift in μm/s",
  sigma: "the localization standard deviation in μm",
  exposure: "the exposure in seconds",
  dt: "the frame spacing in seconds",
  d: "the number of observed coordinates",
  M: "the number of displacements",
  clicks: "the number of stationary clicks",
  coverage: "the target coverage in percent",
  coverageTrials: "the number of hypothetical trials",
};

function validateBm08Fields(input: unknown): Computation<Bm08Parameters> {
  const bad = (requirements: string, parameterId?: keyof Bm08Parameters): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      {
        capabilityId: "diffusion.inference",
        ...(parameterId === undefined ? {} : { parameterIds: [parameterId] }),
      },
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
  // One sentence per control, naming it as the page does and in the page's units (μm, μm/s,
  // μm²/s, percent), so a reader who typed one wrong value is told which one and what to enter.
  for (const k of keys as (keyof Bm08Parameters)[])
    if (
      typeof BM08_DEFAULTS[k] === "number" &&
      (typeof p[k] !== "number" || !Number.isFinite(p[k]))
    )
      return bad(`Enter ${FIELD_NAMES[k] ?? "this value"} as a number.`, k);
  if (!["known", "stationary"].includes(p.noiseMethod))
    return bad(
      "Choose one of the two noise procedures: a known variance, or one estimated from stationary clicks.",
      "noiseMethod",
    );
  if (p.coverage < 0.5 || p.coverage > 0.999)
    return bad("Enter a target interval coverage from 50 to 99.9 percent.", "coverage");
  if (!Number.isSafeInteger(p.coverageTrials) || p.coverageTrials < 0 || p.coverageTrials > 100)
    return bad("Enter a whole number of hypothetical trials from 0 to 100.", "coverageTrials");
  // D, both drifts, σ and the click count keep to the manifest's ranges, checked once by
  // withinDeclaredDomain below. These checks named far wider ranges (1000 μm/s, 1000 μm, 10⁴
  // μm²/s), so a value between the two was refused with a range it had already met.
  if (![1, 2, 3, 4].includes(p.dt)) return bad("Choose a frame spacing of 1, 2, 3 or 4 s.", "dt");
  if (![1, 2].includes(p.d)) return bad("Choose one or two observed coordinates.", "d");
  if (!Number.isSafeInteger(p.M) || p.M < 3 || p.M > 1000)
    return bad("Enter a whole number of displacements from 3 to 1000.", "M");
  if (!Number.isInteger(p.clicks))
    return bad("Enter a whole number of stationary clicks.", "clicks");
  if (p.exposure < 0 || p.exposure > p.dt)
    return bad(`Enter an exposure from 0 s up to the frame spacing, ${p.dt} s.`, "exposure");
  const exposureSteps = p.exposure / 0.25;
  if (!Number.isInteger(exposureSteps))
    return {
      kind: "refused",
      refusal: makeRefusal(
        "off-replay-grid",
        { parameterIds: ["exposure"], capabilityId: "diffusion.inference" },
        {
          details: {
            requirements: "Enter an exposure in steps of 0.25 s, such as 0.25, 0.5 or 0.75 s.",
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

/** Each declared setting as the form names it, in the form's units. */
const BM08_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  sigma: { label: "localization standard deviation", unit: "μm", scale: 1e6 },
  stageDrift: { label: "stage drift in x", unit: "μm/s", scale: 1e6 },
  flowDrift: { label: "fluid drift in x", unit: "μm/s", scale: 1e6 },
  D: { label: "generating diffusivity", unit: "μm²/s", scale: 1e12 },
  clicks: { label: "number of stationary clicks" },
};

/** The fields above, then every range content/experiments/bm-08.yaml declares (dispatch 134). */
export function validateBm08Parameters(input: unknown): Computation<Bm08Parameters> {
  return withinDeclaredDomain("bm-08", validateBm08Fields(input), BM08_DOMAIN_DISPLAY);
}
