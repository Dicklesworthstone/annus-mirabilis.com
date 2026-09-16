/**
 * A deliberately illegal import, planted to prove
 * `noPhysicsInComponents.test.ts`'s checker actually rejects the pattern it
 * exists to forbid (requirement 9). This file is never imported by product
 * code and is excluded from the real-tree scan by path; the checker is
 * pointed at it directly, on its own real repo-relative path.
 */
import { ftcs1d } from "../../../physics/reference/diffusion.ts";

export function PlantedViolation(): number {
  return ftcs1d({ D: 1, dx: 1, dt: 0.1, n: 1, frames: 1, stepsPerFrame: 1, profile: 0 }).kind
    .length;
}
