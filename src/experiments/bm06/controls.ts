import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import type { Bm06Parameters } from "./definition.ts";
export type NumericKey = Exclude<keyof Bm06Parameters, "gridEnabled">;
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
export type Bm06Draft = Record<NumericKey, string> & { gridEnabled: boolean };
export function toBm06Draft(p: Bm06Parameters): Bm06Draft {
  const values = Object.fromEntries(
    BM06_FIELDS.map((f) => [f.key, formatScaledDecimal(p[f.key], f.power)]),
  ) as Record<NumericKey, string>;
  return { ...values, gridEnabled: p.gridEnabled };
}
export function fromBm06Draft(draft: Bm06Draft): Bm06Parameters {
  const entries = BM06_FIELDS.map((f) => {
    try {
      return [f.key, parseScaledDecimal(draft[f.key], f.power)];
    } catch {
      throw new Error(`${f.label}: enter a representable finite decimal number in ${f.unit}.`);
    }
  });
  return { ...Object.fromEntries(entries), gridEnabled: draft.gridEnabled } as Bm06Parameters;
}
