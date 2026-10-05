import { AVOGADRO_FIELDS, type AvogadroKey, type AvogadroParameters, validateAvogadroParameters } from "./definition.ts";
import type { ScientificResult } from "../results/types.ts";

export const AVOGADRO_STUDY_ROUTES = Object.freeze([
  Object.freeze({ id: "radiationNumber", label: "Radiation" }),
  Object.freeze({ id: "brownianNumber", label: "Brownian displacement" }),
  Object.freeze({ id: "molecularNumber", label: "Viscosity and solute diffusion" }),
] as const);
export const MAX_SENSITIVITY_POINTS = 7;

type Calculation = Readonly<
  | { kind: "accepted"; parameters: AvogadroParameters; outputs: readonly ScientificResult[] }
  | { kind: "refused"; reason: string }
>;
export type AvogadroStudyOwner = (parameters: AvogadroParameters) => Calculation;
export type SensitivityReading = Readonly<{
  result: ScientificResult;
  ratio: number | null;
  ratioReason: string;
}>;
export type SensitivityPoint = Readonly<{
  parameterValue: number;
  parameters: AvogadroParameters;
  readings: readonly SensitivityReading[];
}>;
export type AvogadroSensitivityStudy = Readonly<{
  parameter: AvogadroKey;
  baseline: SensitivityPoint;
  points: readonly SensitivityPoint[];
}>;
export type SensitivityDecision = Readonly<
  | { kind: "accepted"; study: AvogadroSensitivityStudy }
  | { kind: "refused"; reason: string }
>;
const refuse = (reason: string): SensitivityDecision => Object.freeze({ kind: "refused", reason });
const sameParameters = (a: AvogadroParameters, b: AvogadroParameters) =>
  Object.keys(AVOGADRO_FIELDS).every((key) => Object.is(a[key as AvogadroKey], b[key as AvogadroKey]));

/** Results come from a trusted numerical owner, never from URL data. Detach its mutable storage. */
function freezeData<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * A bounded controlled experiment: only one declared parameter changes in each trial.
 * The caller supplies the existing evaluator. This module owns no physical law, fitting rule,
 * invented data, or propagated uncertainty. A refused trial never becomes a zero-valued row.
 */
export function studyAvogadroSensitivity(
  input: unknown,
  parameter: string,
  values: readonly number[],
  evaluate: AvogadroStudyOwner,
): SensitivityDecision {
  const base = validateAvogadroParameters(input);
  if (base.kind !== "accepted") return base;
  if (!Object.hasOwn(AVOGADRO_FIELDS, parameter)) return refuse("Choose a declared input to vary.");
  const key = parameter as AvogadroKey;
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_SENSITIVITY_POINTS)
    return refuse(`Choose between one and ${MAX_SENSITIVITY_POINTS} trial values.`);
  if (values.some((value) => !Number.isFinite(value)) || new Set(values).size !== values.length)
    return refuse("Trial values must be finite and distinct.");

  // Validate every trial BEFORE numerical work; a bad last entry cannot leave a partial study.
  const trials: AvogadroParameters[] = [];
  for (const value of values) {
    const checked = validateAvogadroParameters({ ...base.parameters, [key]: value });
    if (checked.kind !== "accepted") return checked;
    trials.push(checked.parameters);
  }
  if (trials.every((trial) => Object.is(trial[key], base.parameters[key])))
    return refuse("Include a trial that changes the selected input.");

  const evaluatePoint = (parameters: AvogadroParameters) => {
    const calculated = evaluate(parameters);
    if (calculated.kind !== "accepted") return calculated;
    const returned = validateAvogadroParameters(calculated.parameters);
    if (returned.kind !== "accepted" || !sameParameters(returned.parameters, parameters))
      return { kind: "refused" as const, reason: "The calculation returned settings different from the requested trial." };
    const readings: SensitivityReading[] = [];
    for (const route of AVOGADRO_STUDY_ROUTES) {
      const matches = calculated.outputs.filter((output) => output.quantityId === route.id);
      const result = matches[0];
      if (matches.length !== 1 || !result)
        return { kind: "refused" as const, reason: "The calculation did not return each route exactly once." };
      if (result.status === "value" && (typeof result.value !== "number" || !Number.isFinite(result.value)))
        return { kind: "refused" as const, reason: "A comparison reading must be a finite scalar." };
      const detached = freezeData(structuredClone(result));
      readings.push(Object.freeze({ result: detached, ratio: null, ratioReason: "No comparison has been made." }));
    }
    return {
      kind: "accepted" as const,
      point: Object.freeze({ parameterValue: parameters[key], parameters, readings: Object.freeze(readings) }),
    };
  };
  try {
    const baseline = evaluatePoint(base.parameters);
    if (baseline.kind !== "accepted") return baseline;
    const points: SensitivityPoint[] = [];
    for (const parameters of trials) {
      const trial = sameParameters(parameters, base.parameters) ? baseline : evaluatePoint(parameters);
      if (trial.kind !== "accepted") return trial;
      const readings: SensitivityReading[] = [];
      for (let index = 0; index < AVOGADRO_STUDY_ROUTES.length; index++) {
        const a = baseline.point.readings[index]?.result;
        const b = trial.point.readings[index]?.result;
        if (!a || !b || a.ownerId !== b.ownerId || a.unit !== b.unit || a.semanticKind !== b.semanticKind)
          return refuse("The calculation changed a route's scientific owner, units, or meaning.");
        let ratio: number | null = null;
        let ratioReason = "Both results must be numerical values to form a ratio.";
        if (a.status === "value" && b.status === "value" && typeof a.value === "number" && typeof b.value === "number") {
          if (a.value === 0) ratioReason = "The baseline is zero, so a ratio is not defined.";
          else {
            const quotient = b.value / a.value;
            if (Number.isFinite(quotient) && (quotient !== 0 || b.value === 0)) {
              ratio = quotient;
              ratioReason = "";
            } else ratioReason = "The nonzero ratio lies outside the numerical range.";
          }
        }
        readings.push(Object.freeze({ result: b, ratio, ratioReason }));
      }
      points.push(Object.freeze({ ...trial.point, readings: Object.freeze(readings) }));
    }
    return Object.freeze({
      kind: "accepted",
      study: Object.freeze({ parameter: key, baseline: baseline.point, points: Object.freeze(points) }),
    });
  } catch {
    return refuse("The calculation could not complete the study. No partial study was accepted.");
  }
}

/** A short explicit list of decimals, not expressions, JSON, or coerced empty fields. */
export function parseSensitivityValues(text: string): Readonly<
  { kind: "accepted"; values: readonly number[] } | { kind: "refused"; reason: string }
> {
  if (text.length > 512) return { kind: "refused", reason: "The trial-value list is too long." };
  const parts = text.split(",").map((part) => part.trim());
  if (parts.length < 1 || parts.length > MAX_SENSITIVITY_POINTS || parts.some((part) =>
    part.length > 64 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part)
  )) return { kind: "refused", reason: `Enter one to ${MAX_SENSITIVITY_POINTS} decimal numbers separated by commas.` };
  const values = parts.map(Number);
  if (values.some((value) => !Number.isFinite(value)) || new Set(values).size !== values.length)
    return { kind: "refused", reason: "Trial values must be finite and distinct." };
  return Object.freeze({ kind: "accepted", values: Object.freeze(values) });
}
