import { netChange } from "./bridgeFigures.ts";

/** A counting construction, with no diffusion law or invented particle trajectories. */
export const FLUX_BALANCE_LIMITS = Object.freeze({
  initialCountPerStretch: 10,
  stretchLength: 1,
  maximumCrossings: 100,
  maximumSeconds: 60,
  maximumArea: 100,
  minimumPositive: 0.000001,
  textLength: 32,
});

export const FLUX_REGIONS = [
  { id: "left", label: "Left stretch" },
  { id: "right", label: "Right stretch" },
  { id: "whole", label: "Both stretches together" },
] as const;
export type FluxRegionId = (typeof FLUX_REGIONS)[number]["id"];
export type FluxBalanceField = "entering" | "between" | "leaving" | "seconds" | "area";
export type FluxBalanceInputs = Readonly<Record<FluxBalanceField, number>>;
export type FluxBalanceDraft = Readonly<Record<FluxBalanceField, string>>;
export type FluxBalanceRefusal = Readonly<{
  kind: "refused";
  field: FluxBalanceField;
  message: string;
}>;
export type FluxRegion = Readonly<{
  id: FluxRegionId;
  length: number;
  volume: number;
  initialCount: number;
  entered: number;
  left: number;
  change: number;
  finalCount: number;
  initialConcentration: number;
  finalConcentration: number;
  leftFlux: number;
  rightFlux: number;
  concentrationRate: number;
  negativeFluxGradient: number;
}>;
export type FluxBalance = Readonly<{
  inputs: FluxBalanceInputs;
  regions: Readonly<Record<FluxRegionId, FluxRegion>>;
  boundaryFluxes: readonly [number, number, number];
}>;
export type FluxBalanceResult =
  | Readonly<{ kind: "accepted"; balance: FluxBalance }>
  | FluxBalanceRefusal;

const refused = (field: FluxBalanceField, message: string): FluxBalanceRefusal => ({
  kind: "refused",
  field,
  message,
});

/**
 * Finite-region continuity is the lesson's existing entered-minus-left bookkeeping. The three
 * crossing counts describe ONE interval, with rightward crossings at every boundary. Selecting
 * a different region later only reads another row of this same record. In particular the middle
 * count is internal to the whole region and can never change its final total.
 *
 * Fluxes and rates are interval averages, and concentrations are region averages. No instantaneous
 * local derivative, spatial distribution, or time ordering is inferred from these counts.
 */
export function fluxBalance(input: FluxBalanceInputs): FluxBalanceResult {
  for (const field of ["entering", "between", "leaving"] as const) {
    const value = input[field];
    if (!Number.isInteger(value) || value < 0 || value > FLUX_BALANCE_LIMITS.maximumCrossings)
      return refused(field, "Use a whole number of crossings from 0 to 100.");
  }
  for (const [field, maximum, unit] of [
    ["seconds", FLUX_BALANCE_LIMITS.maximumSeconds, "seconds"],
    ["area", FLUX_BALANCE_LIMITS.maximumArea, "square millimetres"],
  ] as const) {
    const value = input[field];
    if (!Number.isFinite(value) || value < FLUX_BALANCE_LIMITS.minimumPositive || value > maximum)
      return refused(field, `Use a value from 0.000001 to ${maximum} ${unit}.`);
  }

  const initial = FLUX_BALANCE_LIMITS.initialCountPerStretch;
  if (input.between > initial + input.entering)
    return refused(
      "between",
      "The left stretch cannot send more particles than its starting count plus those entering. Reduce the middle crossings or increase the entering count.",
    );
  if (input.leaving > initial + input.between)
    return refused(
      "leaving",
      "The right stretch cannot send more particles than its starting count plus those crossing the middle. Reduce the leaving count or increase the middle crossings.",
    );

  const inputs = Object.freeze({
    entering: input.entering === 0 ? 0 : input.entering,
    between: input.between === 0 ? 0 : input.between,
    leaving: input.leaving === 0 ? 0 : input.leaving,
    seconds: input.seconds,
    area: input.area,
  });
  const boundaryFluxes = Object.freeze([
    inputs.entering / (inputs.area * inputs.seconds),
    inputs.between / (inputs.area * inputs.seconds),
    inputs.leaving / (inputs.area * inputs.seconds),
  ] as const);

  function region(id: FluxRegionId, start: 0 | 1, end: 1 | 2): FluxRegion {
    const length = (end - start) * FLUX_BALANCE_LIMITS.stretchLength;
    const volume = length * inputs.area;
    const initialCount = (end - start) * initial;
    const counts = [inputs.entering, inputs.between, inputs.leaving] as const;
    const entered = counts[start];
    const left = counts[end];
    const change = netChange({ entered, left });
    const finalCount = initialCount + change;
    const leftFlux = boundaryFluxes[start];
    const rightFlux = boundaryFluxes[end];
    return Object.freeze({
      id,
      length,
      volume,
      initialCount,
      entered,
      left,
      change,
      finalCount,
      initialConcentration: initialCount / volume,
      finalConcentration: finalCount / volume,
      leftFlux,
      rightFlux,
      concentrationRate: change / (volume * inputs.seconds),
      negativeFluxGradient: (leftFlux - rightFlux) / length,
    });
  }

  return {
    kind: "accepted",
    balance: Object.freeze({
      inputs,
      boundaryFluxes,
      regions: Object.freeze({
        left: region("left", 0, 1),
        right: region("right", 1, 2),
        whole: region("whole", 0, 2),
      }),
    }),
  };
}

export function fluxBalanceDraft(balance: FluxBalance): FluxBalanceDraft {
  return Object.fromEntries(
    Object.entries(balance.inputs).map(([field, value]) => [field, String(value)]),
  ) as FluxBalanceDraft;
}

export function readFluxBalance(draft: FluxBalanceDraft): FluxBalanceResult {
  const values: Record<FluxBalanceField, number> = {
    entering: 0,
    between: 0,
    leaving: 0,
    seconds: 0,
    area: 0,
  };
  for (const field of ["entering", "between", "leaving", "seconds", "area"] as const) {
    const text = draft[field];
    const token = text.trim().replaceAll("−", "-");
    if (
      text.length > FLUX_BALANCE_LIMITS.textLength ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token) ||
      !Number.isFinite(Number(token))
    )
      return refused(field, "Enter a finite number without units or expressions.");
    values[field] = Number(token);
    if (values[field] === 0 && /[1-9]/u.test(token.split(/[eE]/u)[0] ?? ""))
      return refused(field, "That nonzero number is too small to represent. Use a larger value.");
  }
  return fluxBalance(values);
}

export const FLUX_BALANCE_PRESETS = [
  { label: "More enter than leave", entering: 7, between: 4, leaving: 5 },
  { label: "A steady stream", entering: 5, between: 5, leaving: 5 },
  { label: "More leave than enter", entering: 3, between: 5, leaving: 7 },
  { label: "No crossings", entering: 0, between: 0, leaving: 0 },
] as const;

export const INITIAL_FLUX_BALANCE = fluxBalance({
  entering: 7,
  between: 4,
  leaving: 5,
  seconds: 1,
  area: 1,
});
