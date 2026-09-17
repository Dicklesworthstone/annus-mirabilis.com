import type { Sr08Parameters } from "./definition.ts";

export const SR08_NUMBER_FIELDS = [
  "boost",
  "electricFieldX",
  "electricFieldY",
  "electricFieldZ",
  "magneticFieldX",
  "magneticFieldY",
  "magneticFieldZ",
  "testCharge",
  "chargeVelocityX",
  "chargeVelocityY",
  "chargeVelocityZ",
] as const;
export type Sr08NumberField = (typeof SR08_NUMBER_FIELDS)[number];
export type Sr08NumericDraft = Record<Sr08NumberField, string>;
const SPEED_FIELDS: readonly Sr08NumberField[] = [
  "boost",
  "chargeVelocityX",
  "chargeVelocityY",
  "chargeVelocityZ",
];

/** c is an explicit display conversion supplied by the same SI constant set. */
export function sr08Draft(p: Sr08Parameters, c: number): Sr08NumericDraft {
  return Object.fromEntries(
    SR08_NUMBER_FIELDS.map((key) => [key, String(p[key] / (SPEED_FIELDS.includes(key) ? c : 1))]),
  ) as Sr08NumericDraft;
}
export function parseSr08Draft(
  draft: Sr08NumericDraft,
  base: Sr08Parameters,
  c: number,
): { kind: "accepted"; data: Sr08Parameters } | { kind: "refused"; message: string } {
  if (!Number.isFinite(c) || c <= 0)
    return { kind: "refused", message: "The display speed unit is unavailable." };
  const values: Partial<Record<Sr08NumberField, number>> = {};
  for (const key of SR08_NUMBER_FIELDS) {
    const text = draft[key]?.trim();
    if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))
      return {
        kind: "refused",
        message: `Enter a complete decimal number for ${key}; an empty field is not zero.`,
      };
    const value = Number(text) * (SPEED_FIELDS.includes(key) ? c : 1);
    if (!Number.isFinite(value))
      return { kind: "refused", message: `${key} is outside the finite numerical range.` };
    values[key] = value;
  }
  return { kind: "accepted", data: Object.freeze({ ...base, ...values }) };
}
