import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { type DomainDisplay, withinDeclaredDomain } from "../controls/declaredDomain.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Bm03Model, Bm03Notation, Bm03Parameters, Bm03Step } from "./definition.ts";

function validateBm03Fields(input: unknown): Computation<Bm03Parameters> {
  const bad = (requirements: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "bm03.parameters" },
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

  const obj = input as Partial<Record<keyof Bm03Parameters, unknown>>;

  const Np = obj.Np;
  if (typeof Np !== "number" || !Number.isSafeInteger(Np)) {
    return bad("Enter the particle count Np as a whole number.");
  }

  const volumeRatio = obj.volumeRatio;
  if (typeof volumeRatio !== "number" || !Number.isFinite(volumeRatio)) {
    return bad("Enter the volume ratio V/V₀ as a number.");
  }

  const V0 = obj.V0;
  if (typeof V0 !== "number" || !Number.isFinite(V0)) {
    return bad("Enter the reference volume V₀ as a number, in μm³.");
  }

  const T = obj.T;
  if (typeof T !== "number" || !Number.isFinite(T)) {
    return bad("Enter the temperature T as a number, in K.");
  }

  const model = obj.model as Bm03Model | undefined;
  if (model !== "independent" && model !== "locked-cluster") {
    return bad("Choose the independent-particle model or the locked cluster.");
  }

  const step = obj.step as Bm03Step | undefined;
  if (
    step !== "one-particle" &&
    step !== "two-particles" &&
    step !== "many-particles" &&
    step !== "derivative"
  ) {
    return bad(
      "Choose one of the four steps: one particle, two particles, many particles, or the derivative.",
    );
  }

  const notation = obj.notation as Bm03Notation | undefined;
  if (notation !== "printed" && notation !== "modern") {
    return bad("Choose printed or modern notation.");
  }

  return {
    kind: "accepted",
    data: Object.freeze({
      Np,
      volumeRatio,
      V0,
      T,
      model,
      step,
      notation,
    }),
  };
}

/** How the form names each setting, so a range sentence reads as the field the reader typed in. */
const DISPLAY: Readonly<Record<string, DomainDisplay>> = {
  Np: { label: "Particle count Np", unit: "" },
  volumeRatio: { label: "Volume ratio V/V₀", unit: "" },
  V0: { label: "Reference volume V₀", unit: "μm³" },
  T: { label: "Temperature T", unit: "K" },
};

/**
 * The fields above, then every range content/experiments/bm-03.yaml declares (am-lab-domains-
 * silently-clamped-pzj5). The field checks refuse what is not a number; a number outside its
 * declared range gets the manifest's range and reason, never a second, contradicting sentence.
 */
export function validateBm03Parameters(input: unknown): Computation<Bm03Parameters> {
  return withinDeclaredDomain("bm-03", validateBm03Fields(input), DISPLAY);
}
