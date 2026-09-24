import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import { enterNumberSentence } from "../results/refusalSentence.ts";
import type { Bm06Parameters } from "./definition.ts";
/** The four copiedDiffusivity* fields are never free-typed; they round-trip through the draft
 * unchanged except when the explicit copy action (BrownianLab's "Copy D from BM-01") sets them. */
export type NumericKey = Exclude<
  keyof Bm06Parameters,
  | "gridEnabled"
  | "copiedDiffusivityInstanceId"
  | "copiedDiffusivityRunId"
  | "copiedDiffusivitySnapshotVersion"
  | "copiedDiffusivityValue"
>;
export const BM06_FIELDS: readonly {
  key: NumericKey;
  label: string;
  unit: string;
  power: number;
}[] = [
  { key: "T", label: "Temperature", unit: "K", power: 0 },
  { key: "eta", label: "Viscosity", unit: "mPa·s", power: 3 },
  { key: "a", label: "Particle radius", unit: "μm", power: 6 },
  { key: "t", label: "Elapsed time", unit: "s", power: 0 },
  { key: "lower", label: "Lower interval endpoint", unit: "μm", power: 6 },
  { key: "upper", label: "Upper interval endpoint", unit: "μm", power: 6 },
  { key: "n", label: "Grid cells", unit: "count", power: 0 },
  { key: "dx", label: "Cell width", unit: "μm", power: 6 },
  { key: "steps", label: "Time steps", unit: "count", power: 0 },
];
export type Bm06Draft = Record<NumericKey, string> & {
  gridEnabled: boolean;
  copiedDiffusivityInstanceId: string;
  copiedDiffusivityRunId: string;
  copiedDiffusivitySnapshotVersion: number;
  copiedDiffusivityValue: number;
};
export function toBm06Draft(p: Bm06Parameters): Bm06Draft {
  const values = Object.fromEntries(
    BM06_FIELDS.map((f) => [f.key, formatScaledDecimal(p[f.key], f.power)]),
  ) as Record<NumericKey, string>;
  return {
    ...values,
    gridEnabled: p.gridEnabled,
    copiedDiffusivityInstanceId: p.copiedDiffusivityInstanceId,
    copiedDiffusivityRunId: p.copiedDiffusivityRunId,
    copiedDiffusivitySnapshotVersion: p.copiedDiffusivitySnapshotVersion,
    copiedDiffusivityValue: p.copiedDiffusivityValue,
  };
}
export function fromBm06Draft(draft: Bm06Draft): Bm06Parameters {
  const entries = BM06_FIELDS.map((f) => {
    try {
      return [f.key, parseScaledDecimal(draft[f.key], f.power)];
    } catch {
      throw new Error(enterNumberSentence(f.label, f.unit));
    }
  });
  return {
    ...Object.fromEntries(entries),
    gridEnabled: draft.gridEnabled,
    copiedDiffusivityInstanceId: draft.copiedDiffusivityInstanceId,
    copiedDiffusivityRunId: draft.copiedDiffusivityRunId,
    copiedDiffusivitySnapshotVersion: draft.copiedDiffusivitySnapshotVersion,
    copiedDiffusivityValue: draft.copiedDiffusivityValue,
  } as Bm06Parameters;
}
