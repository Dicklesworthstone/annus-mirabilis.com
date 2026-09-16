import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import type { Lq01Parameters } from "./definition.ts";

export type NumericLq01Key =
  | "A1"
  | "A2"
  | "delta"
  | "wavelength"
  | "separation"
  | "screenDistance"
  | "t"
  | "P"
  | "r";

export const LQ01_FIELDS: readonly {
  key: NumericLq01Key;
  label: string;
  unit: string;
  power: number;
}[] = [
  { key: "A1", label: "Wave 1 amplitude", unit: "norm", power: 0 },
  { key: "A2", label: "Wave 2 amplitude", unit: "norm", power: 0 },
  { key: "delta", label: "Relative phase", unit: "rad", power: 0 },
  { key: "wavelength", label: "Wavelength", unit: "λ", power: 0 },
  { key: "separation", label: "Source separation", unit: "λ", power: 0 },
  { key: "screenDistance", label: "Screen distance", unit: "λ", power: 0 },
  { key: "t", label: "Time phase", unit: "rad", power: 0 },
  { key: "P", label: "Source power", unit: "W", power: 0 },
  { key: "r", label: "Observation radius", unit: "m", power: 0 },
];

export type Lq01Draft = Record<NumericLq01Key, string> & {
  readout: Lq01Parameters["readout"];
  mode: Lq01Parameters["mode"];
  screenPosition: Lq01Parameters["screenPosition"];
};

export function toLq01Draft(p: Lq01Parameters): Lq01Draft {
  const values = Object.fromEntries(
    LQ01_FIELDS.map((f) => [f.key, formatScaledDecimal(p[f.key], f.power)]),
  ) as Record<NumericLq01Key, string>;
  return {
    ...values,
    readout: p.readout,
    mode: p.mode,
    screenPosition: p.screenPosition,
  };
}

export function fromLq01Draft(draft: Lq01Draft): Lq01Parameters {
  const entries = LQ01_FIELDS.map((f) => {
    try {
      return [f.key, parseScaledDecimal(draft[f.key], f.power)];
    } catch {
      throw new Error(`${f.label}: enter a representable finite decimal number in ${f.unit}.`);
    }
  });
  return {
    ...Object.fromEntries(entries),
    readout: draft.readout,
    mode: draft.mode,
    screenPosition: draft.screenPosition,
  } as Lq01Parameters;
}
