/** Deliberate violation: view importing reference physics evaluator. */
import { ftcs1d } from "../../../physics/reference/diffusion.ts";

export function PlantedRefEvaluator() {
  return (
    <div
      data-len={
        ftcs1d({ D: 1, dx: 1, dt: 0.1, n: 1, frames: 1, stepsPerFrame: 1, profile: 0 }).kind.length
      }
    />
  );
}
