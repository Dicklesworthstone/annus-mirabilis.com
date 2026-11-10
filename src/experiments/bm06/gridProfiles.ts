/** Reader-facing initial conditions and the pinned diffusion owner's profile codes. */
export const BM06_GRID_PROFILES = Object.freeze({
  spike: Object.freeze({ code: 0 as const, label: "One central spike" }),
  step: Object.freeze({ code: 1 as const, label: "Uniform over the left half" }),
  "two-spikes": Object.freeze({ code: 2 as const, label: "Two equal spikes" }),
});

export type Bm06GridProfile = keyof typeof BM06_GRID_PROFILES;

export function isBm06GridProfile(value: unknown): value is Bm06GridProfile {
  return typeof value === "string" && Object.hasOwn(BM06_GRID_PROFILES, value);
}

export const BM06_STEP_COMPARISON_NOTE =
  "The left-half step starts with equal probability in the left half of the cells and none in the right half. It already reaches the left reflecting wall. This calculation has no unbounded analytic comparison for that initial condition; the point-start Gaussian above is a separate experiment.";
