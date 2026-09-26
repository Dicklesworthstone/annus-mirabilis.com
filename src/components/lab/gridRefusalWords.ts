import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import { display } from "./presentation.ts";

/**
 * A grid stability refusal in words: the diffusion number the requested step would have and the
 * limit it breaks, both read from the refusal the stepper returned, and which stepper refused.
 * Empty for any other refusal.
 */
export function gridRefusalSentences(refusal: RequestRefusal): string[] {
  if (refusal.code !== "ftcs-unstable") return [];
  const details = (refusal.details ?? {}) as Record<string, unknown>;
  const { ratio, limit } = details;
  const sentences: string[] = [];
  if (typeof ratio === "number" && Number.isFinite(ratio) && typeof limit === "number")
    sentences.push(
      `This step gives a diffusion number D·Δt/Δx² of ${display(ratio)}, and the explicit scheme stays stable only up to ${display(limit)}.`,
    );
  sentences.push(
    details.upstreamCode === "ftcs-unstable"
      ? "FrankenSim's diffusion1d_frames refused the step before computing anything."
      : "The site's reference stepper refused the step before computing anything.",
  );
  return sentences;
}
