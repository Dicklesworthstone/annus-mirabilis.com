import { computeBm02Snapshot, DEFAULT_BM02_INPUTS, PHI_MAX } from "../experiments/bm02/session.ts";
import { readTransportNumber } from "./transportNumber.ts";

export const OSMOTIC_FIELDS = [
  { key: "count", label: "Particles behind the partition", min: 0, max: 1e12 },
  { key: "volume", label: "Accessible volume (μm³)", min: 1000, max: 1e12 },
  { key: "temperature", label: "Temperature (K)", min: 273, max: 330 },
  { key: "radius", label: "Particle radius (μm)", min: 0.0005, max: 100 },
] as const;
export type OsmoticField = (typeof OSMOTIC_FIELDS)[number]["key"];
export type OsmoticSettings = Readonly<Record<OsmoticField, number>>;
export type OsmoticDraft = Readonly<Record<OsmoticField, string>>;
export const OSMOTIC_DEFAULTS: OsmoticSettings = Object.freeze({
  count: 1000,
  volume: 1000000,
  temperature: 293,
  radius: 0.5,
});
export const OSMOTIC_DILUTE_LIMIT = PHI_MAX;
export type OsmoticRefusal = Readonly<{
  kind: "refused";
  field: OsmoticField | "calculation";
  message: string;
}>;
export type OsmoticSnapshot = Readonly<{
  settings: OsmoticSettings;
  numberDensityM3: number;
  volumeFraction: number;
  pressurePa: number | null;
  pressureReason: string | null;
  maximumDiluteCount: number;
  minimumDiluteVolumeUm3: number;
  constantSetId: "modern-si-2019";
  ownerId: "diffusion.osmoticPressure";
}>;
export type OsmoticResult =
  | Readonly<{ kind: "accepted"; snapshot: OsmoticSnapshot }>
  | OsmoticRefusal;

/**
 * The lesson is a smaller face of BM-02's accepted calculation, not another osmotic law.
 * Valid crowded settings retain their density and occupancy, but never a dilute pressure.
 */
export function osmoticPartition(input: OsmoticSettings): OsmoticResult {
  for (const field of OSMOTIC_FIELDS) {
    const value = input[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max)
      return {
        kind: "refused",
        field: field.key,
        message: `Use ${field.label.toLowerCase()} from ${field.min} to ${field.max}.`,
      };
  }
  if (!Number.isSafeInteger(input.count))
    return {
      kind: "refused",
      field: "count",
      message: "Use a whole number of particles, including zero.",
    };
  const settings = Object.freeze({ ...input });
  const calculated = computeBm02Snapshot({
    ...DEFAULT_BM02_INPUTS,
    Np: settings.count,
    V_um3: settings.volume,
    T: settings.temperature,
    a_um: settings.radius,
    model: "molecular-kinetic",
    constantSetId: "modern-si-2019",
  });
  const density = calculated.numberDensity;
  const fraction = calculated.volumeFraction;
  const domain = calculated.domain;
  const pressure = calculated.osmoticPressure.result;
  if (
    density.status !== "value" ||
    typeof density.value !== "number" ||
    fraction.status !== "value" ||
    typeof fraction.value !== "number" ||
    !("phi" in domain)
  )
    return {
      kind: "refused",
      field: "calculation",
      message: "The partition calculation could not produce a finite density and volume fraction.",
    };
  if (pressure.status !== "value" && pressure.status !== "outside-domain")
    return {
      kind: "refused",
      field: "calculation",
      message: "The partition calculation did not return a pressure or its model limit.",
    };
  return {
    kind: "accepted",
    snapshot: Object.freeze({
      settings,
      numberDensityM3: density.value,
      volumeFraction: fraction.value,
      pressurePa:
        pressure.status === "value" && typeof pressure.value === "number" ? pressure.value : null,
      pressureReason:
        pressure.status === "outside-domain"
          ? "The particles fill more than 1% of the volume. Their interactions and excluded volume are outside this lesson's ideal dilute law; no pressure is calculated."
          : null,
      maximumDiluteCount: domain.maxAdmittedCount,
      minimumDiluteVolumeUm3: domain.minAdmittedVolume * 1e18,
      constantSetId: "modern-si-2019",
      ownerId: "diffusion.osmoticPressure",
    }),
  };
}

export function osmoticDraft(settings: OsmoticSettings): OsmoticDraft {
  return {
    count: String(settings.count),
    volume: String(settings.volume),
    temperature: String(settings.temperature),
    radius: String(settings.radius),
  };
}

export function readOsmoticPartition(draft: OsmoticDraft): OsmoticResult {
  const values = { ...OSMOTIC_DEFAULTS };
  for (const field of OSMOTIC_FIELDS) {
    const parsed = readTransportNumber(draft[field.key]);
    if (parsed.kind === "refused") return { ...parsed, field: field.key };
    values[field.key] = parsed.value;
  }
  return osmoticPartition(values);
}

export const INITIAL_OSMOTIC_PARTITION = osmoticPartition(OSMOTIC_DEFAULTS);
