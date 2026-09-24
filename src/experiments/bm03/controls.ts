import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import { enterNumberSentence } from "../results/refusalSentence.ts";
import type { Bm03Model, Bm03Notation, Bm03Parameters, Bm03Step } from "./definition.ts";

export type Bm03NumericKey = "Np" | "volumeRatio" | "V0" | "T";

export const BM03_NUMERIC_FIELDS: readonly {
  key: Bm03NumericKey;
  label: string;
  unit: string;
  power: number;
}[] = [
  { key: "Np", label: "Particle count Np", unit: "count", power: 0 },
  { key: "volumeRatio", label: "Volume ratio V/V0", unit: "ratio", power: 0 },
  { key: "V0", label: "Reference volume V0", unit: "μm³", power: 0 },
  { key: "T", label: "Temperature T", unit: "K", power: 0 },
];

export type Bm03Draft = Record<Bm03NumericKey, string> & {
  model: Bm03Model;
  step: Bm03Step;
  notation: Bm03Notation;
};

export function toBm03Draft(p: Bm03Parameters): Bm03Draft {
  const values = Object.fromEntries(
    BM03_NUMERIC_FIELDS.map((f) => [f.key, formatScaledDecimal(p[f.key], f.power)]),
  ) as Record<Bm03NumericKey, string>;
  return {
    ...values,
    model: p.model,
    step: p.step,
    notation: p.notation,
  };
}

export function fromBm03Draft(draft: Bm03Draft): Bm03Parameters {
  const entries = BM03_NUMERIC_FIELDS.map((f) => {
    try {
      return [f.key, parseScaledDecimal(draft[f.key], f.power)];
    } catch {
      throw new Error(enterNumberSentence(f.label, f.unit));
    }
  });
  return {
    ...Object.fromEntries(entries),
    model: draft.model,
    step: draft.step,
    notation: draft.notation,
  } as Bm03Parameters;
}
