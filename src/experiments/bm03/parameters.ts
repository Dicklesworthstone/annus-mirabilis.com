import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Bm03Model, Bm03Notation, Bm03Parameters, Bm03Step } from "./definition.ts";

export function validateBm03Parameters(input: unknown): Computation<Bm03Parameters> {
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
  if (typeof Np !== "number" || !Number.isSafeInteger(Np) || Np < 1) {
    return bad("Enter a whole number of particles Np, at least 1.");
  }

  const volumeRatio = obj.volumeRatio;
  if (typeof volumeRatio !== "number" || !Number.isFinite(volumeRatio) || volumeRatio <= 0) {
    return bad("Enter a volume ratio V/V₀ greater than zero.");
  }

  const V0 = obj.V0;
  if (typeof V0 !== "number" || !Number.isFinite(V0) || V0 <= 0) {
    return bad("Enter a reference volume V₀ greater than zero, in μm³.");
  }

  const T = obj.T;
  if (typeof T !== "number" || !Number.isFinite(T) || T <= 0) {
    return bad("Enter a temperature T above 0 K.");
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
