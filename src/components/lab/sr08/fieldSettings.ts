import {
  declaredDomains,
  domainRequirement,
} from "../../../experiments/controls/declaredDomain.ts";
import { readTypedNumber } from "../../../experiments/controls/typedNumber.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import type { Sr08Parameters } from "../../../experiments/sr08/definition.ts";
import { validateSr08Parameters } from "../../../experiments/sr08/parameters.ts";
import { C_SI } from "../../../physics/reference/fields.ts";

/** Canonical parameter ids join every typed field to the same owner and tape. */
export const SR08_NUMBER_FIELDS = [
  { key: "boost", name: "boost", label: "Boost v/c", scale: C_SI, step: "0.05", group: "observer" },
  {
    key: "electricFieldX",
    name: "ex",
    label: "Electric Ex (V/m)",
    scale: 1,
    step: "any",
    group: "electric",
  },
  {
    key: "electricFieldY",
    name: "ey",
    label: "Electric Ey (V/m)",
    scale: 1,
    step: "any",
    group: "electric",
  },
  {
    key: "electricFieldZ",
    name: "ez",
    label: "Electric Ez (V/m)",
    scale: 1,
    step: "any",
    group: "electric",
  },
  {
    key: "magneticFieldX",
    name: "bx",
    label: "Magnetic Bx (T)",
    scale: 1,
    step: "any",
    group: "magnetic",
  },
  {
    key: "magneticFieldY",
    name: "by",
    label: "Magnetic By (T)",
    scale: 1,
    step: "any",
    group: "magnetic",
  },
  {
    key: "magneticFieldZ",
    name: "bz",
    label: "Magnetic Bz (T)",
    scale: 1,
    step: "any",
    group: "magnetic",
  },
  {
    key: "testCharge",
    name: "testCharge",
    label: "Test charge q (C)",
    scale: 1,
    step: "any",
    group: "charge",
  },
  {
    key: "chargeVelocityX",
    name: "chargeVelocityX",
    label: "Charge velocity ux/c",
    scale: C_SI,
    step: "any",
    group: "velocity",
  },
  {
    key: "chargeVelocityY",
    name: "chargeVelocityY",
    label: "Charge velocity uy/c",
    scale: C_SI,
    step: "any",
    group: "velocity",
  },
  {
    key: "chargeVelocityZ",
    name: "chargeVelocityZ",
    label: "Charge velocity uz/c",
    scale: C_SI,
    step: "any",
    group: "velocity",
  },
] as const;

export type Sr08NumberField = (typeof SR08_NUMBER_FIELDS)[number];
export type Sr08TypedSettings = Readonly<Record<Sr08NumberField["key"], string>>;

export function typedSr08Settings(parameters: Sr08Parameters): Sr08TypedSettings {
  return Object.fromEntries(
    SR08_NUMBER_FIELDS.map((field) => [field.key, String(parameters[field.key] / field.scale)]),
  ) as Record<Sr08NumberField["key"], string>;
}

/** Empty text is refused before any command; it is never silently converted into a zero. */
export function readSr08Settings(draft: Sr08Parameters, typed: Sr08TypedSettings) {
  const numbers: Partial<Record<Sr08NumberField["key"], number>> = {};
  const domains = declaredDomains("sr-08");
  for (const field of SR08_NUMBER_FIELDS) {
    const domain = domains[field.key];
    const parsed = readTypedNumber(
      typed[field.key],
      field.key === "boost" ? "the boost speed" : field.label.toLowerCase(),
      (value) => value * field.scale,
      domain
        ? domainRequirement(domain, {
            label: field.label,
            scale: 1 / field.scale,
            ...(field.scale === C_SI ? { unit: "c" } : {}),
          })
        : undefined,
    );
    if (parsed.kind === "refused")
      return {
        kind: "refused" as const,
        refusal: parsed.refusal,
        requirement: parsed.requirement,
      };
    // A shared state carries the exact SI number. Dividing by c for its control and multiplying
    // it back can change the last bit, so unchanged text must retain that accepted number.
    numbers[field.key] =
      typed[field.key] === String(draft[field.key] / field.scale) ? draft[field.key] : parsed.value;
  }
  const checked = validateSr08Parameters({ ...draft, ...numbers });
  return checked.kind === "accepted"
    ? checked
    : { ...checked, requirement: refusalSentence(checked.refusal) };
}
