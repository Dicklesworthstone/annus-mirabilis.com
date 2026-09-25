import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { exponentialParts } from "../../units/scientific.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import { LQ03_DEFAULTS, type Lq03Parameters } from "./definition.ts";

const COORDINATES = ["frequency", "wavelength"] as const;
const AXIS_SCALES = ["linear", "logarithmic"] as const;
const CONVENTIONS = ["per-hz", "per-m", "per-log", "per-decade"] as const;

/**
 * Out-of-domain input is explained, never silently clamped (am-lq-03-spectrum-08vz
 * acceptance criteria). An inverted or empty band is refused here, at the schema
 * boundary, before it ever reaches the owner's band integral.
 */
/** A frequency in Hz as the refusal sentence shows it, typeset by the lab: "6 × 10^{14} Hz". */
function hz(value: number): string {
  const parts = exponentialParts(value);
  return parts.kind === "plain"
    ? `${parts.text} Hz`
    : `${parts.mantissa} × 10^{${parts.exponent}} Hz`;
}

function validateLq03Fields(input: unknown): Computation<Lq03Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq03.parameters" },
      { details: { requirements } },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return bad("Use a complete parameter record.");
  const keys = Object.keys(LQ03_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k))
  )
    return bad("Parameter fields must be complete, known data fields.");
  const p = input as Lq03Parameters;

  // The bead's own numeric domain is 500-10000 K. Enforcing it here also protects every value
  // reachable through this instrument from a real defect found in the owner: planckBandEnergyDensity's
  // adaptive quadrature (src/physics/reference/radiation/bandIntegration.ts, am-ref-radiation-15c)
  // becomes visibly slow (~1s) at T=10000K with the default 400-600 THz band and does not
  // terminate by T=1e5K -- reported to BoldHarbor, not patched here (not this bead's file).
  if (!Number.isFinite(p.T) || p.T < 500 || p.T > 10000)
    return bad("Enter a temperature from 500 to 10 000 K.");
  if (!(COORDINATES as readonly string[]).includes(p.coordinate))
    return bad("Choose frequency or wavelength as the horizontal coordinate.");
  if (!(AXIS_SCALES as readonly string[]).includes(p.axisScale))
    return bad("Choose a linear or logarithmic axis scale.");
  if (!(CONVENTIONS as readonly string[]).includes(p.convention))
    return bad("Choose per-Hz, per-m, per natural-log interval, or per-decade density.");
  if (
    !Number.isFinite(p.nu1) ||
    p.nu1 < 1e11 ||
    p.nu1 > 1e16 ||
    !Number.isFinite(p.nu2) ||
    p.nu2 < 1e11 ||
    p.nu2 > 1e16
  )
    return bad("Enter band edges from 10¹¹ to 10¹⁶ Hz.");
  if (p.nu2 <= p.nu1)
    return bad(
      `Enter an upper band edge above the lower one: ${hz(p.nu2)} is not above ${hz(p.nu1)}, so this band is inverted or empty, not a smaller region.`,
    );
  if (
    typeof p.showPlanck !== "boolean" ||
    typeof p.showWien !== "boolean" ||
    typeof p.showClassical !== "boolean"
  )
    return bad("Choose which laws are shown as true or false.");
  // The ranges of ε and the probe frequency are the manifest's, checked once by
  // withinDeclaredDomain below; these checks ask only for a number.
  if (!Number.isFinite(p.epsilon))
    return bad("Enter the regime tolerance ε as a number, in percent.");
  if (!Number.isFinite(p.probeNu)) return bad("Enter the probe frequency as a number, in Hz.");

  return { kind: "accepted", data: Object.freeze({ ...p }) };
}

/** Each declared setting as the form names it; ε is entered in percent. */
const LQ03_DOMAIN_DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  T: { label: "temperature" },
  nu1: { label: "lower band edge" },
  nu2: { label: "upper band edge" },
  probeNu: { label: "probe frequency" },
  epsilon: { label: "regime tolerance ε", unit: "%", scale: 100 },
};

/** The fields above, then every range content/experiments/lq-03.yaml declares (dispatch 134). */
export function validateLq03Parameters(input: unknown): Computation<Lq03Parameters> {
  return withinDeclaredDomain("lq-03", validateLq03Fields(input), LQ03_DOMAIN_DISPLAY);
}
