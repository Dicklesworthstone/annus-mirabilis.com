import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { BM04_DEFAULTS, type Bm04Parameters } from "./definition.ts";

const keys = Object.keys(BM04_DEFAULTS);

/** What each numeric control is called on the page (bm04/controls.ts), with its unit. */
const BM04_FIELD_NAMES: Partial<Record<string, string>> = {
  F: "the external force, in fN,",
  m: "the kick strength multiplier",
  T: "the temperature, in K,",
  eta: "the viscosity, in mPa·s,",
  a: "the particle radius, in μm,",
  W: "the box width, in μm,",
  cells: "the number of spatial cells",
  dt: "the time step, in ms,",
  steps: "the number of simulation steps",
};
function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

/** Strict full-request validation of each field's type, also used before accepting URL settings. */
function validateBm04Fields(input: unknown): Computation<Bm04Parameters> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return refused(keys, "Provide a plain settings record.");
  }
  const record = input as Record<string, unknown>;
  if (
    Reflect.ownKeys(record).length !== keys.length ||
    Reflect.ownKeys(record).some((k) => typeof k !== "string" || !keys.includes(k))
  ) {
    return refused(
      keys,
      "Every declared setting must occur exactly once; unknown settings are not supported.",
    );
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      return refused([key], "Settings must be data, not accessors.");
    }
    if (key === "profile") {
      const val = record[key];
      if (typeof val !== "string" || !["uniform", "step", "equilibrium", "spike"].includes(val)) {
        return refused([key], "Profile must be uniform, step, equilibrium, or spike.");
      }
    } else if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      return {
        kind: "refused",
        refusal: makeRefusal(
          "nonfinite-input",
          { parameterIds: [key] },
          {
            details: {
              requirements: `Enter ${BM04_FIELD_NAMES[key] ?? "this value"} as a number.`,
            },
          },
        ),
      };
    }
  }
  const p = record as unknown as Bm04Parameters;
  // Ranges are the manifest's (below); only what is not a whole number is refused here, so a
  // value outside its range gets one sentence, the declared range and its reason.
  if (!Number.isSafeInteger(p.cells))
    return refused(["cells"], "Enter the number of spatial cells as a whole number.");
  if (!Number.isSafeInteger(p.steps))
    return refused(["steps"], "Enter the number of simulation steps as a whole number.");
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}

/** The form's units: the record stores SI, the page shows fN, mPa·s, μm and ms. */
const BM04_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  F: { scale: 1e15 },
  eta: { scale: 1e3 },
  a: { scale: 1e6 },
  W: { scale: 1e6 },
  dt: { scale: 1e3 },
  cells: { label: "Number of spatial cells" },
  steps: { label: "Number of simulation steps" },
};

/**
 * The fields above, then every range content/experiments/bm-04.yaml declares
 * (am-lab-domains-silently-clamped-pzj5). Never clamps.
 */
export function validateBm04Parameters(input: unknown): Computation<Bm04Parameters> {
  return withinDeclaredDomain("bm-04", validateBm04Fields(input), BM04_DOMAIN_DISPLAY);
}
