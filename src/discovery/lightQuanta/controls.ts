import { ExperimentRuntimeError } from "../../experiments/refusal.ts";
import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import {
  type LightInvestigationKey,
  type LightInvestigationParameters,
  validateLightInvestigation,
} from "./investigation.ts";

export const LIGHT_INVESTIGATION_FIELDS: readonly Readonly<{
  key: LightInvestigationKey;
  label: string;
  unit: string;
  power: number;
  group: "radiation" | "counting" | "emission";
}>[] = [
  { key: "frequency", label: "Frequency", unit: "THz", power: -12, group: "radiation" },
  {
    key: "referenceTemperature",
    label: "Reference temperature",
    unit: "K",
    power: 0,
    group: "radiation",
  },
  { key: "bandwidth", label: "Band width", unit: "THz", power: -12, group: "radiation" },
  {
    key: "referenceVolume",
    label: "Reference volume",
    unit: "litres",
    power: 3,
    group: "radiation",
  },
  { key: "volumeRatio", label: "Volume fraction V/V₀", unit: "1", power: 0, group: "radiation" },
  { key: "pointCount", label: "Independent points", unit: "count", power: 0, group: "counting" },
  {
    key: "incidentPower",
    label: "Incident optical power",
    unit: "mW",
    power: 3,
    group: "emission",
  },
  { key: "workFunction", label: "Exit cost", unit: "eV", power: 0, group: "emission" },
  {
    key: "quantumEfficiency",
    label: "Declared quantum efficiency",
    unit: "fraction",
    power: 0,
    group: "emission",
  },
  {
    key: "collectorPotential",
    label: "Collector potential",
    unit: "V",
    power: 0,
    group: "emission",
  },
];
export type LightInvestigationDraft = Readonly<Record<LightInvestigationKey, string>>;
export function lightInvestigationDraft(p: LightInvestigationParameters): LightInvestigationDraft {
  return Object.fromEntries(
    LIGHT_INVESTIGATION_FIELDS.map((f) => [f.key, formatScaledDecimal(p[f.key], f.power)]),
  ) as LightInvestigationDraft;
}
export function parseLightInvestigationDraft(
  draft: LightInvestigationDraft,
): LightInvestigationParameters {
  return validateLightInvestigation(
    Object.fromEntries(
      LIGHT_INVESTIGATION_FIELDS.map((f) => {
        try {
          return [f.key, parseScaledDecimal(draft[f.key], f.power)];
        } catch {
          throw new ExperimentRuntimeError(
            "control-value-not-numeric",
            `Enter a finite decimal number for ${f.label.toLowerCase()}.`,
            "light-quanta",
          );
        }
      }),
    ),
  );
}
