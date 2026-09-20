/** Admission of optional physical-input boxes. Numerical propagation stays with
 * the reference owner; this adapter only interprets validated classroom units.
 */
import { constantValue, type ConstantSet } from "../../../physics/reference/constants.ts";
import type { Assessment } from "../../../physics/reference/inference.ts";
import type { MolecularInputBox, PositiveRange } from "../../../physics/reference/inference/physicalUncertainty.ts";
import { intervalMetadata, type KitchenDocument } from "./schema.ts";
const missing = (reason: string): Assessment<never> => ({ kind: "no-value", status: "not-applicable", reason });
export function kitchenInputBox(document: KitchenDocument, axis: "x" | "y",
  scaleSource: "measured" | "derived" | "unknown", nominalScale: number, set: ConstantSet): Assessment<MolecularInputBox> {
  const m = document.metadata;
  if (scaleSource !== "measured") return missing("Use an independently calibrated axis. Uncertainty of a derived-axis aspect ratio is not supplied by this input box.");
  if (m.radius_provenance !== "independent") return missing("Radius must be established independently of these displacements. A range cannot remove circularity.");
  if (!m.radius_scale_axis) return missing("Declare whether radius is an independent length or shares the selected image-axis calibration.");
  const shared = m.radius_scale_axis !== "independent";
  if (shared && (m.radius_scale_axis !== axis || m.calibration_axes !== "both" || !m.pixel_aspect_ratio))
    return missing("A same-image radius requires both axes calibrated, a declared pixel aspect ratio and the same radius/analysis axis. Cross-axis calibration uncertainty is not inferred.");
  if (!m.radius_um || !m.temperature_k || !m.viscosity_mpa_s)
    return missing("Declare independent radius, temperature and viscosity point inputs before propagating their ranges.");
  const scales = intervalMetadata(m[`pixels_per_um_${axis}_interval`], "axis scale range");
  const radius = intervalMetadata(m.radius_interval_um, "radius range");
  const temperature = intervalMetadata(m.temperature_interval_k, "temperature range");
  const viscosity = intervalMetadata(m.viscosity_interval_mpa_s, "viscosity range");
  const R = constantValue(set, "molarGasConstant").value;
  const exactR = set.entries.find(e => e.quantityId === "molarGasConstant")?.kind === "exact-defined";
  const declaredR = intervalMetadata(m.gas_constant_interval, "gas constant range");
  if (exactR && declaredR && (declaredR[0] !== R || declaredR[1] !== R))
    return missing("The selected modern SI gas constant is exact. Leave its range blank; a range edit cannot change this constant set or make it an independent count.");
  const gasConstant: PositiveRange | null = declaredR ?? (exactR ? [R, R] : null);
  if (!scales || !radius || !temperature || !viscosity || !gasConstant)
    return missing("Supply explicit ranges for the selected-axis pixels-per-micrometre scale, radius, temperature, viscosity and any non-exact gas constant. Click standard errors and a hair-width range are not automatically converted to coverage intervals.");
  if (!(gasConstant[0] <= R && R <= gasConstant[1]))
    return missing("The gas-constant range must include the value from the selected source. It is not an override of the gas constant.");
  return { kind: "accepted", data: Object.freeze({ nominalScale,
    scale: Object.freeze([1e-6 / scales[1], 1e-6 / scales[0]]) as PositiveRange,
    radius: Object.freeze([radius[0] * 1e-6, radius[1] * 1e-6]) as PositiveRange,
    temperature, viscosity: Object.freeze([viscosity[0] * .001, viscosity[1] * .001]) as PositiveRange,
    gasConstant, radiusCalibration: shared ? "same-axis" : "independent-length" }) };
}
