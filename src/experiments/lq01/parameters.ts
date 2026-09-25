import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ01_DEFAULTS, type Lq01Parameters } from "./definition.ts";

const keys = Object.keys(LQ01_DEFAULTS);

/** What each numeric control is called on the page (lq01/controls.ts), with its unit. */
const LQ01_FIELD_NAMES: Partial<Record<string, string>> = {
  A1: "the wave 1 amplitude",
  A2: "the wave 2 amplitude",
  delta: "the relative phase, in radians,",
  wavelength: "the wavelength",
  separation: "the source separation, in wavelengths,",
  screenDistance: "the screen distance, in wavelengths,",
  t: "the time phase, in radians,",
  P: "the source power, in W,",
  r: "the observation radius, in m,",
};
function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

/** Strict full-request validation, also used before accepting URL settings. Never clamps. */
function validateLq01Fields(input: unknown): Computation<Lq01Parameters> {
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
    if (key === "readout") {
      const val = record[key];
      if (typeof val !== "string" || !["time-average", "instantaneous"].includes(val)) {
        return refused([key], "Readout must be time-average or instantaneous.");
      }
    } else if (key === "mode") {
      const val = record[key];
      if (typeof val !== "string" || !["interference", "spreading"].includes(val)) {
        return refused([key], "Mode must be interference or spreading.");
      }
    } else if (key === "screenPosition") {
      const val = record[key];
      if (typeof val !== "string" || !["center", "first-min", "first-max"].includes(val)) {
        return refused([key], "Screen position must be center, first-min, or first-max.");
      }
    } else if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      return {
        kind: "refused",
        refusal: makeRefusal(
          "nonfinite-input",
          { parameterIds: [key] },
          {
            details: {
              requirements: `Enter ${LQ01_FIELD_NAMES[key] ?? "this value"} as a number.`,
            },
          },
        ),
      };
    }
  }
  const p = record as unknown as Lq01Parameters;
  if (p.A1 < 0) return refused(["A1"], "Enter a wave 1 amplitude of zero or more.");
  if (p.A2 < 0) return refused(["A2"], "Enter a wave 2 amplitude of zero or more.");
  if (p.wavelength <= 0) {
    return refused(["wavelength"], "Enter a wavelength greater than zero.");
  }
  if (p.separation < 0) {
    return refused(["separation"], "Enter a source separation of zero or more, in wavelengths.");
  }
  if (p.screenDistance <= 0) {
    return refused(
      ["screenDistance"],
      "Enter a screen distance greater than zero, in wavelengths.",
    );
  }
  if (p.P <= 0) {
    return refused(["P"], "Enter a source power greater than zero, in W.");
  }
  if (p.r <= 0) {
    return refused(
      ["r"],
      "Enter an observation radius greater than zero, in m: an ideal point source has no finite intensity at the source itself.",
    );
  }
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}

/** Each declared setting as the form names it (src/experiments/lq01/controls.ts LQ01_FIELDS). */
const LQ01_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  A1: { label: "wave 1 amplitude" },
  A2: { label: "wave 2 amplitude" },
  delta: { label: "relative phase" },
  wavelength: { label: "wavelength" },
  separation: { label: "source separation", unit: "wavelengths" },
  screenDistance: { label: "screen distance", unit: "wavelengths" },
  t: { label: "time phase" },
  P: { label: "source power" },
  r: { label: "observation radius" },
};

/** The fields above, then every range content/experiments/lq-01.yaml declares (dispatch 134). */
export function validateLq01Parameters(input: unknown): Computation<Lq01Parameters> {
  return withinDeclaredDomain("lq-01", validateLq01Fields(input), LQ01_DOMAIN_DISPLAY);
}
