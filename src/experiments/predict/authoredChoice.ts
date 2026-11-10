/** One prompt contract for the panel, local record and shared prediction. */
import type { GeneratedPredictPrompt } from "../../generated/predict-prompts.ts";
import type { TapePredictionEvent } from "../permalink/types.ts";
import {
  type PredictionPromptSpec,
  type SketchPoint,
  TapeValidationError,
  validatePredictionPayload,
} from "../tapes/schema.ts";
import type { PredictionChoice } from "./predictState.ts";

export function predictionSpec(prompt: GeneratedPredictPrompt): PredictionPromptSpec {
  const curve = prompt.curvePrediction;
  return {
    promptId: prompt.promptId,
    candidateIds: prompt.candidates.map((candidate) => candidate.id),
    verbalChoices: {
      directionIds: curve?.verbalChoices?.directionChoices.map((choice) => choice.id) ?? [],
      shapeIds: curve?.verbalChoices?.shapeChoices.map((choice) => choice.id) ?? [],
    },
    valueTargetIds: curve?.valueTargets.map((target) => target.targetId) ?? [],
    ...(curve
      ? {
          sketchAxisRanges: {
            x: [curve.x.min, curve.x.max] as const,
            y: [curve.y.min, curve.y.max] as const,
          },
        }
      : {}),
  };
}

/** A saved or incoming choice is untrusted. Refuse it without inventing missing points or values. */
export function checkedPredictionChoice(
  raw: unknown,
  prompt: GeneratedPredictPrompt,
): PredictionChoice | null {
  try {
    const choice = validatePredictionPayload(raw, predictionSpec(prompt), prompt.promptId);
    const curve = prompt.curvePrediction;
    if (choice.form === "candidate") return choice;
    if (!curve) return null;
    if (choice.form === "sketch") {
      // The canonical validator quantizes. Check the original coordinates as well so an invalid
      // point just outside an axis cannot round back into the authored domain.
      const original = (raw as { points: readonly SketchPoint[] }).points;
      if (
        choice.points.length === 0 ||
        [...original, ...choice.points].some(
          ([x, y]) =>
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            x < curve.x.min ||
            x > curve.x.max ||
            y < curve.y.min ||
            y > curve.y.max,
        )
      )
        return null;
    } else if (choice.form === "values") {
      if (choice.targets.length !== curve.valueTargets.length) return null;
      const seen = new Set<string>();
      for (const target of choice.targets) {
        const authored = curve.valueTargets.find((entry) => entry.targetId === target.targetId);
        if (
          !authored ||
          seen.has(target.targetId) ||
          target.value < (authored.min ?? curve.y.min) ||
          target.value > (authored.max ?? curve.y.max)
        )
          return null;
        seen.add(target.targetId);
      }
    }
    return choice;
  } catch (error) {
    if (error instanceof TapeValidationError) return null;
    throw error;
  }
}

export function predictionForLink(promptId: string, choice: PredictionChoice): TapePredictionEvent {
  const { form, ...payload } = choice;
  return { promptId, form, payload };
}

/** Indexed legacy forms have no named counterpart; never guess which target an old index means. */
export function predictionFromLink(
  event: TapePredictionEvent,
  prompt: GeneratedPredictPrompt,
): PredictionChoice | null {
  if (event.promptId !== prompt.promptId) return null;
  return checkedPredictionChoice({ ...event.payload, form: event.form }, prompt);
}
