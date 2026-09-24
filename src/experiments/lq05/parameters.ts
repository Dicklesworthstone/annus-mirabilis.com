import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Lq05Parameters, Lq05View } from "./definition.ts";

const VALID_VIEWS = new Set<Lq05View>(["enumeration", "sampling", "logarithmic"]);
/** The upper ends of the manifest's model domains (content/experiments/lq-05.yaml). */
export const LQ05_MAX_POINTS = 60;
export const LQ05_MAX_TRIALS = 1_000_000;

export function validateLq05Parameters(input: unknown): Computation<Lq05Parameters> {
  const bad = (requirements: string, code?: string): Computation<never> => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "lq05.parameters" },
      { details: { requirements, ...(code ? { code } : {}) } },
    ),
  });

  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return bad("Use a complete parameter record.");
  }

  const obj = input as Partial<Record<keyof Lq05Parameters, unknown>>;

  const n = obj.n;
  // The manifest's model domain for n is 1 to 60. Above it the exact count's BigInt arithmetic
  // grows without bound (n = 1000 took 4.3 s; n = 1e6 ran out of memory), so the bound is enforced
  // here and not only by the form's max attribute, which a permalink bypasses.
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1 || n > LQ05_MAX_POINTS) {
    return bad(`Enter a whole number of points from 1 to ${LQ05_MAX_POINTS}.`);
  }

  const f = obj.f;
  if (typeof f !== "number" || !Number.isFinite(f)) {
    return bad("Enter a subvolume fraction f greater than 0 and at most 1.");
  }
  if (f === 0) {
    return bad(
      "Enter a subvolume fraction f greater than 0: no point can lie in an empty region, so the entropy difference is undefined.",
      "empty-subvolume",
    );
  }
  if (f < 0 || f > 1.0000000001) {
    return bad("Enter a subvolume fraction f greater than 0 and at most 1.");
  }

  const view = obj.view;
  if (typeof view !== "string" || !VALID_VIEWS.has(view as Lq05View)) {
    return bad("View must be 'enumeration', 'sampling', or 'logarithmic'.");
  }

  const locked = obj.locked;
  if (typeof locked !== "boolean") {
    return bad("Locked positions flag must be true or false.");
  }

  const seed = obj.seed;
  if (typeof seed !== "string" || seed.trim().length === 0) {
    return bad("Seed must be a valid unsigned decimal string.");
  }
  try {
    const bigSeed = BigInt(seed.trim());
    if (bigSeed < 0n || bigSeed > 18446744073709551615n) {
      return bad("Seed must be an unsigned 64-bit integer (0 <= seed <= 2^64-1).");
    }
  } catch {
    return bad("Seed must be a valid decimal representation of an unsigned integer.");
  }

  const trials = obj.trials;
  if (
    typeof trials !== "number" ||
    !Number.isSafeInteger(trials) ||
    trials < 1 ||
    trials > LQ05_MAX_TRIALS
  ) {
    return bad("Enter a whole number of trials from 1 to 1 000 000.");
  }

  return {
    kind: "accepted",
    data: Object.freeze({
      n,
      f: Math.min(1, Math.max(1e-12, f)),
      view: view as Lq05View,
      locked,
      seed: seed.trim(),
      trials,
    }),
  };
}
