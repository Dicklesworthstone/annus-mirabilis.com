/** Classroom observation contract. No video bytes or inferred physical constants live here. */
export const KITCHEN_SCHEMA_VERSION = "2";
export const KITCHEN_COLUMNS = Object.freeze([
  "schema_version",
  "kind",
  "object_id",
  "frame_time_s",
  "x_px",
  "y_px",
  "lost",
  "loss_reason",
  "point_status",
  "exclusion_reason",
  "calibration_id",
  "identity_decision",
] as const);
export const KITCHEN_READER_COLUMNS = Object.freeze(KITCHEN_COLUMNS.slice(1));
/** Optional, explicit joint input-box declarations. Legacy CSVs remain valid. */
export const KITCHEN_UNCERTAINTY_KEYS = Object.freeze([
  "pixels_per_um_x_interval", "pixels_per_um_y_interval", "viscosity_interval_mpa_s",
  "gas_constant_interval", "radius_scale_axis", "physical_input_coverage", "physical_input_provenance",
] as const);
export const KITCHEN_METADATA_KEYS = Object.freeze([
  ...KITCHEN_UNCERTAINTY_KEYS,
  "source_width_px",
  "source_height_px",
  "working_scale",
  "rotation_degrees",
  "pixel_aspect_ratio",
  "pixels_per_um_x",
  "pixels_per_um_y",
  "pixels_per_um_x_uncertainty",
  "pixels_per_um_y_uncertainty",
  "calibration_axes",
  "calibration_method",
  "calibration_interval_um",
  "declared_interval_s",
  "frame_rate_hz",
  "timing_source",
  "temperature_k",
  "temperature_interval_k",
  "viscosity_mpa_s",
  "viscosity_source",
  "radius_um",
  "radius_interval_um",
  "radius_interval_coverage",
  "exposure_s",
  "drift_source",
  "constant_set_id",
  "sample",
  "data_origin",
  "radius_provenance",
] as const);
/** Optional acquisition columns. Legacy twelve-column observations remain valid. */
export const KITCHEN_FRAME_COLUMNS = Object.freeze([
  "requested_time_s", "timing_source", "presented_frames", "frame_id",
] as const);
export type KitchenFrameStamp = Readonly<{
  requestedTime: number;
  timingSource: "frame-callback" | "frame-callback-adjusted" | "declared-rate";
  presentedFrames: number | null;
  frameId: number;
}>;
export type MetadataKey = (typeof KITCHEN_METADATA_KEYS)[number];
export type KitchenMetadata = Readonly<Record<MetadataKey, string>>;
export type PointStatus = "measured" | "interpolated" | "excluded" | "lost";
export type KitchenPoint = Readonly<{
  kind: "particle" | "stationary" | "calibration";
  objectId: string;
  time: number;
  x: number | null;
  y: number | null;
  status: PointStatus;
  lossReason: "" | "edge" | "focus" | "occluded";
  exclusionReason: string;
  calibrationId: string;
  identityDecision: "" | "reacquired-same" | "new-object";
  capture?: KitchenFrameStamp;
}>;
export type KitchenDocument = Readonly<{
  schemaVersion: 2;
  metadata: KitchenMetadata;
  points: readonly KitchenPoint[];
  notes: readonly string[];
}>;
export const KITCHEN_LIMITS = Object.freeze({
  bytes: 2 * 1024 * 1024,
  rows: 20000,
  cell: 2048,
  duration: 600,
  coordinates: 100000,
  edgeLossShare: 0.2,
  anisotropy: 0.02,
  stationaryClicks: 10,
});
export class KitchenInputError extends TypeError {
  readonly row: number;
  readonly field: string;
  constructor(row: number, field: string, message: string) {
    super(`${row ? `Row ${row}: ` : ""}${field}: ${message}`);
    this.name = "KitchenInputError";
    this.row = row;
    this.field = field;
  }
}
export function kitchenNumber(raw: string, field: string, row = 0): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
    throw new KitchenInputError(row, field, "enter a finite decimal number, not a formula.");
  const n = Number(raw);
  const mantissa = raw.split(/[eE]/)[0] ?? "";
  if (!Number.isFinite(n) || (n === 0 && /[1-9]/.test(mantissa)))
    throw new KitchenInputError(row, field, "the number is outside the supported range.");
  return n;
}
export function intervalMetadata(raw: string, field: string): readonly [number, number] | null {
  if (!raw) return null;
  const m = /^\[([^,]+),([^,]+)\]$/.exec(raw);
  if (!m) throw new KitchenInputError(0, field, "use [lower,upper] or leave it blank.");
  const [_, rawA, rawB] = m;
  if (!rawA || !rawB) throw new KitchenInputError(0, field, "use [lower,upper] or leave it blank.");
  const a = kitchenNumber(rawA.trim(), field),
    b = kitchenNumber(rawB.trim(), field);
  if (!(a > 0 && b >= a))
    throw new KitchenInputError(0, field, "bounds must be positive and ordered.");
  return Object.freeze([a, b]);
}
export function validateKitchenMetadata(input: Record<string, string>): KitchenMetadata {
  const optional = new Set<string>(["exposure_s", "data_origin", "radius_provenance", ...KITCHEN_UNCERTAINTY_KEYS]);
  for (const key of KITCHEN_METADATA_KEYS)
    if (!(key in input) && !optional.has(key))
      throw new KitchenInputError(
        0,
        key,
        "the metadata declaration is missing (a blank value is allowed for an unknown optional measurement).",
      );
  const m = {
    ...Object.fromEntries(KITCHEN_UNCERTAINTY_KEYS.map(key => [key, ""])),
    ...input,
    exposure_s: input.exposure_s ?? "",
    data_origin: input.data_origin ?? "reader-supplied",
    radius_provenance: input.radius_provenance ?? "unknown",
  } as Record<MetadataKey, string>;
  const numeric = (key: MetadataKey, min: number, max: number, nullable = false) => {
    if (!m[key] && nullable) return;
    const n = kitchenNumber(m[key], key);
    if (n < min || n > max)
      throw new KitchenInputError(0, key, `use a number from ${min} to ${max}.`);
    m[key] = String(n);
  };
  numeric("source_width_px", 1, 4096);
  numeric("source_height_px", 1, 4096);
  for (const k of ["source_width_px", "source_height_px"] as const)
    if (!Number.isInteger(Number(m[k])))
      throw new KitchenInputError(0, k, "use a whole number of pixels.");
  numeric("working_scale", 1e-6, 1);
  numeric("pixel_aspect_ratio", 0.01, 100, true);
  for (const k of ["pixels_per_um_x", "pixels_per_um_y"] as const) numeric(k, 1e-6, 1e6, true);
  for (const k of ["pixels_per_um_x_uncertainty", "pixels_per_um_y_uncertainty"] as const)
    numeric(k, 0, 1e6, true);
  numeric("frame_rate_hz", 0.1, 10000);
  numeric("temperature_k", 1, 2000, true);
  numeric("viscosity_mpa_s", 1e-6, 1e9, true);
  numeric("radius_um", 1e-6, 1e6, true);
  numeric("radius_interval_coverage", 0.001, 1, true);
  numeric("physical_input_coverage", 0.001, 1, true);
  numeric("exposure_s", 0, 2, true);
  const choice = (k: MetadataKey, values: readonly string[]) => {
    if (!values.includes(m[k])) throw new KitchenInputError(0, k, `choose ${values.join(", ")}.`);
  };
  choice("rotation_degrees", ["0", "90", "180", "270"]);
  choice("calibration_axes", ["x", "y", "both"]);
  choice("calibration_method", ["micrometer", "hair", "other"]);
  choice("declared_interval_s", ["0.5", "1", "2"]);
  choice("timing_source", ["frame-callback", "declared-rate"]);
  choice("drift_source", ["stage", "fluid", "unknown", "none"]);
  choice("constant_set_id", [
    "scenario-gas-constant-measured",
    "einstein-1905-brownian-printed",
    "modern-si-2019",
  ]);
  choice("data_origin", ["reader-supplied", "synthetic"]);
  choice("radius_provenance", ["independent", "same-displacements", "unknown"]);
  choice("radius_scale_axis", ["", "independent", "x", "y"]);
  if (m.physical_input_coverage && !m.physical_input_provenance.trim())
    throw new KitchenInputError(0, "physical_input_provenance", "describe the source and simultaneous-coverage basis of the complete input box; marginal coverage or click scatter alone is insufficient.");
  for (const axis of ["x", "y"] as const)
    if (
      (m.calibration_axes === axis || m.calibration_axes === "both") &&
      !m[`pixels_per_um_${axis}`]
    )
      throw new KitchenInputError(
        0,
        `pixels_per_um_${axis}`,
        "the declared calibrated axis needs a scale.",
      );
  for (const [k, point] of [
    ["temperature_interval_k", "temperature_k"],
    ["radius_interval_um", "radius_um"],
    ["calibration_interval_um", ""],
    ["pixels_per_um_x_interval", "pixels_per_um_x"],
    ["pixels_per_um_y_interval", "pixels_per_um_y"],
    ["viscosity_interval_mpa_s", "viscosity_mpa_s"],
    ["gas_constant_interval", ""],
  ] as const) {
    const range = intervalMetadata(m[k], k);
    if (
      range &&
      point &&
      m[point] &&
      !(range[0] <= Number(m[point]) && Number(m[point]) <= range[1])
    )
      throw new KitchenInputError(0, k, "the range must contain the declared point value.");
    if (range) m[k] = `[${range.join(",")}]`;
  }
  if (m.exposure_s && Number(m.exposure_s) > Number(m.declared_interval_s))
    throw new KitchenInputError(0, "exposure_s", "overlapping exposures are not supported.");
  if (m.viscosity_mpa_s && !m.viscosity_source.trim())
    throw new KitchenInputError(
      0,
      "viscosity_source",
      "name the source or the approximation you chose.",
    );
  return Object.freeze(m);
}
