import { driftVelocity, stokesMobility } from "../physics/reference/diffusion/routeA.ts";
import { SINKING } from "./sinkingSpheres.ts";
import { readTransportNumber } from "./transportNumber.ts";

export const STOKES_FIELDS = [
  { key: "radius", label: "Sphere radius (μm)", min: 0.1, max: 100 },
  { key: "viscosity", label: "Liquid viscosity (mPa·s)", min: 0.1, max: 20 },
  { key: "grainDensity", label: "Sphere density (kg/m³)", min: 100, max: 20000 },
] as const;
export type StokesField = (typeof STOKES_FIELDS)[number]["key"];
export type StokesSettings = Readonly<Record<StokesField, number>>;
export type StokesDraft = Readonly<Record<StokesField, string>>;
export const STOKES_DEFAULTS: StokesSettings = Object.freeze({
  radius: 0.5,
  viscosity: SINKING.viscosity * 1000,
  grainDensity: SINKING.grainDensity,
});
/** Diameter-based Reynolds number. This conservative lesson bound is not an error certificate. */
export const STOKES_MAX_REYNOLDS = 0.1;
export type StokesRefusal = Readonly<{
  kind: "refused";
  field: StokesField | "calculation";
  message: string;
}>;
export type StokesSnapshot = Readonly<{
  settings: StokesSettings;
  buoyantWeightN: number;
  mobilityMPerNs: number;
  dragAtOneMicronPerSecondN: number;
  velocityMPerSecond: number;
  reynolds: number;
  oneMillimetreSeconds: number | null;
  direction: "sinks" | "rises" | "balanced";
  ownerIds: readonly ["diffusion.stokesMobility", "diffusion.driftVelocity"];
}>;
export type StokesResult = Readonly<{ kind: "accepted"; snapshot: StokesSnapshot }> | StokesRefusal;

/**
 * Compose the existing Stokes mobility and drift owners with the sphere's buoyancy-adjusted
 * weight. The liquid density and gravity are the printed table's values; changing viscosity
 * does not silently change either. This predicts terminal drift, not a Brownian trajectory.
 */
export function stokesSettling(input: StokesSettings): StokesResult {
  for (const field of STOKES_FIELDS) {
    const value = input[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max)
      return {
        kind: "refused",
        field: field.key,
        message: `Use ${field.label.toLowerCase()} from ${field.min} to ${field.max}.`,
      };
  }
  const settings = Object.freeze({ ...input });
  const radiusM = settings.radius * 1e-6;
  const viscosityPaS = settings.viscosity * 1e-3;
  const mobility = stokesMobility(viscosityPaS, radiusM).result;
  if (mobility.status !== "value" || typeof mobility.value !== "number")
    return {
      kind: "refused",
      field: "calculation",
      message: "The Stokes mobility could not be calculated.",
    };
  const buoyantWeightN =
    (settings.grainDensity - SINKING.waterDensity) *
    SINKING.gravity *
    (4 / 3) *
    Math.PI *
    radiusM ** 3;
  const drift = driftVelocity(mobility.value, buoyantWeightN).result;
  if (drift.status !== "value" || typeof drift.value !== "number")
    return {
      kind: "refused",
      field: "calculation",
      message: "The terminal drift could not be calculated.",
    };
  const velocityMPerSecond = drift.value === 0 ? 0 : drift.value;
  const reynolds =
    (SINKING.waterDensity * Math.abs(velocityMPerSecond) * 2 * radiusM) / viscosityPaS;
  if (reynolds > STOKES_MAX_REYNOLDS)
    return {
      kind: "refused",
      field: "radius",
      message:
        "These settings give a diameter-based Reynolds number above 0.1. This lesson only uses slow Stokes flow: reduce the radius or density difference, or increase the viscosity.",
    };
  return {
    kind: "accepted",
    snapshot: Object.freeze({
      settings,
      buoyantWeightN,
      mobilityMPerNs: mobility.value,
      dragAtOneMicronPerSecondN: 1e-6 / mobility.value,
      velocityMPerSecond,
      reynolds,
      oneMillimetreSeconds: velocityMPerSecond === 0 ? null : 1e-3 / Math.abs(velocityMPerSecond),
      direction: velocityMPerSecond === 0 ? "balanced" : velocityMPerSecond > 0 ? "sinks" : "rises",
      ownerIds: Object.freeze(["diffusion.stokesMobility", "diffusion.driftVelocity"] as const),
    }),
  };
}

export function stokesDraft(settings: StokesSettings): StokesDraft {
  return {
    radius: String(settings.radius),
    viscosity: String(settings.viscosity),
    grainDensity: String(settings.grainDensity),
  };
}

export function readStokesSettling(draft: StokesDraft): StokesResult {
  const values = { ...STOKES_DEFAULTS };
  for (const field of STOKES_FIELDS) {
    const parsed = readTransportNumber(draft[field.key]);
    if (parsed.kind === "refused") return { ...parsed, field: field.key };
    values[field.key] = parsed.value;
  }
  return stokesSettling(values);
}

export const INITIAL_STOKES_SETTLING = stokesSettling(STOKES_DEFAULTS);
