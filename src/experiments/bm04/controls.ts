import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import type { Bm04Parameters } from "./definition.ts";

export type NumericBm04Key = Exclude<keyof Bm04Parameters, "profile">;

export const BM04_FIELDS: readonly {
  key: NumericBm04Key;
  label: string;
  unit: string;
  power: number;
}[] = [
  { key: "F", label: "External force", unit: "fN", power: 15 },
  { key: "m", label: "Kick strength multiplier", unit: "×", power: 0 },
  { key: "T", label: "Temperature", unit: "K", power: 0 },
  { key: "eta", label: "Viscosity", unit: "mPa·s", power: 3 },
  { key: "a", label: "Particle radius", unit: "μm", power: 6 },
  { key: "W", label: "Box width", unit: "μm", power: 6 },
  { key: "cells", label: "Spatial cells", unit: "count", power: 0 },
  { key: "dt", label: "Time step", unit: "ms", power: 3 },
  { key: "steps", label: "Simulation steps", unit: "count", power: 0 },
];

export type Bm04Draft = Record<NumericBm04Key, string> & {
  profile: Bm04Parameters["profile"];
};

export function toBm04Draft(p: Bm04Parameters): Bm04Draft {
  const values = Object.fromEntries(
    BM04_FIELDS.map((f) => [f.key, formatScaledDecimal(p[f.key], f.power)]),
  ) as Record<NumericBm04Key, string>;
  return { ...values, profile: p.profile };
}

export function fromBm04Draft(draft: Bm04Draft): Bm04Parameters {
  const entries = BM04_FIELDS.map((f) => {
    try {
      return [f.key, parseScaledDecimal(draft[f.key], f.power)];
    } catch {
      throw new Error(`${f.label}: enter a representable finite decimal number in ${f.unit}.`);
    }
  });
  return {
    ...Object.fromEntries(entries),
    profile: draft.profile,
  } as Bm04Parameters;
}
