import { exportKitchenCsv, parseKitchenCsv } from "./csv.ts";
import type { KitchenDocument, KitchenPoint } from "./schema.ts";

/** An exclusion is a reversible label, never deletion, interpolation or a coordinate edit. */
export function setKitchenExclusion(document: KitchenDocument, index: number, reason: string | null): KitchenDocument {
  if (!Number.isSafeInteger(index) || index < 0 || index >= document.points.length)
    throw new TypeError("Choose an existing observation row.");
  const point = document.points[index]!;
  if (point.kind !== "particle" || !["measured", "excluded"].includes(point.status))
    throw new TypeError("Only measured or already excluded particle rows can be relabeled here. Lost and interpolated rows retain their provenance.");
  if (reason !== null && !reason.trim()) throw new TypeError("Record why this observation is excluded.");
  const revised: KitchenPoint = { ...point, status: reason === null ? "measured" : "excluded", exclusionReason: reason?.trim() ?? "" };
  // Read/write through the same bounded contract as imports. No parallel validation grammar.
  return parseKitchenCsv(exportKitchenCsv({ ...document, points: document.points.map((p, i) => i === index ? revised : p) }));
}

export const KITCHEN_EDITABLE_INPUTS = Object.freeze([
  "pixels_per_um_x", "pixels_per_um_y", "pixels_per_um_x_uncertainty", "pixels_per_um_y_uncertainty",
  "calibration_axes", "pixel_aspect_ratio", "declared_interval_s", "exposure_s", "temperature_k",
  "temperature_interval_k", "viscosity_mpa_s", "viscosity_source", "radius_um", "radius_interval_um",
  "radius_interval_coverage", "radius_provenance",
] as const);
export type KitchenInputKey = (typeof KITCHEN_EDITABLE_INPUTS)[number];
export type KitchenInputDraft = Readonly<Record<KitchenInputKey, string>>;
export function kitchenInputDraft(document: KitchenDocument): KitchenInputDraft {
  return Object.freeze(Object.fromEntries(KITCHEN_EDITABLE_INPUTS.map(k => [k, document.metadata[k]]))) as KitchenInputDraft;
}
/** Observation origin, timestamps, pixel coordinates and identity decisions cannot be rewritten by this form. */
export function reviseKitchenInputs(document: KitchenDocument, input: KitchenInputDraft): KitchenDocument {
  const keys = Reflect.ownKeys(input);
  if (keys.length !== KITCHEN_EDITABLE_INPUTS.length || keys.some(k => typeof k !== "string" || !(KITCHEN_EDITABLE_INPUTS as readonly string[]).includes(k)))
    throw new TypeError("Use only the declared calibration and physical-input fields.");
  for (const k of KITCHEN_EDITABLE_INPUTS) {
    const descriptor = Object.getOwnPropertyDescriptor(input, k);
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" || descriptor.value.length > 512)
      throw new TypeError("Input declarations must be bounded text values.");
  }
  return parseKitchenCsv(exportKitchenCsv({ ...document, metadata: { ...document.metadata, ...input } }));
}
