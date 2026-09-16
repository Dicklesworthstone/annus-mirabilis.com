/**
 * Type-level proof (am-lq-03-spectrum-08vz Technical Approach: "Branded quantity types
 * distinguish cyclic frequency nu, angular frequency omega, and wavelength; passing omega to a
 * nu function is a type error"). Checked by `bun run typecheck`: an unused `@ts-expect-error`
 * is itself a type error, so this file fails the repository-wide gate if the branding stops
 * working, not just at runtime.
 *
 * FINDING (not a defect in scope to fix here): the owner's public functions
 * (src/physics/reference/radiation/spectra.ts) accept `CyclicFrequency | number`, not
 * `CyclicFrequency` alone. Since AngularFrequency is structurally a `number` (an optional
 * brand field, per src/physics/reference/radiation/types.ts), it satisfies the `number` arm of
 * that union, so passing an AngularFrequency to planckFrequencyEnergyDensity does NOT fail
 * compilation today, contrary to the bead's own stated claim. The branding mechanism itself
 * does work -- proven below against a strictly-`CyclicFrequency`-typed local wrapper -- so this
 * is a narrow gap in the owner's public signatures, reported rather than patched (not this
 * bead's file).
 */
import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  asAngularFrequency,
  asCyclicFrequency,
  type CyclicFrequency,
  planckFrequencyEnergyDensity,
} from "../../physics/reference/radiation.ts";

const SET = getConstantSet("modern-si-2019");

function densityAtCyclicFrequency(nu: CyclicFrequency, T: number) {
  return planckFrequencyEnergyDensity(nu, T, SET);
}

describe("frequency branding: the mechanism works against a strictly-typed signature", () => {
  test("a properly branded AngularFrequency is not assignable where CyclicFrequency alone is required", () => {
    const omega = asAngularFrequency(2 * Math.PI * 5e14);
    // @ts-expect-error omega is AngularFrequency, not CyclicFrequency: passing it here is
    // exactly the mistake this branding exists to catch at compile time.
    expect(() => densityAtCyclicFrequency(omega, 5000)).not.toThrow();
  });

  test("a properly branded CyclicFrequency is accepted", () => {
    const nu = asCyclicFrequency(5e14);
    const result = densityAtCyclicFrequency(nu, 5000);
    expect(result.status).toBe("value");
  });

  test("the owner's own public signature accepts CyclicFrequency | number, so a raw AngularFrequency number reaches it without a type error today", () => {
    const omega = asAngularFrequency(2 * Math.PI * 5e14);
    const result = planckFrequencyEnergyDensity(omega, 5000, SET);
    expect(result.status).toBe("value");
  });
});
