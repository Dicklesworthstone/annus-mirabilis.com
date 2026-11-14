import { average, meanDistance, meanSquare, PARTICLE_ENDS } from "./bridgeFigures.ts";

/** Small, entered teaching samples in micrometres, never a stochastic model or an estimator. */
export const OBSERVATION_LIMITS = {
  observations: 32,
  bins: 12,
  magnitude: 1000,
  minimumNonzero: 0.000001,
  minimumBinWidth: 0.000001,
  textLength: 4096,
} as const;

export type ObservationField = "observations" | "boundaries";
export interface ObservationRefusal {
  readonly kind: "invalid";
  readonly field: ObservationField;
  readonly reason: string;
}
type ParsedNumbers =
  | { readonly kind: "accepted"; readonly values: readonly number[] }
  | ObservationRefusal;

function numbers(
  text: string,
  field: ObservationField,
  minimum: number,
  maximum: number,
): ParsedNumbers {
  const normalized = text.trim().replaceAll("−", "-");
  if (normalized.length === 0)
    return { kind: "invalid", field, reason: "Enter numbers separated by commas or spaces." };
  if (normalized.length > OBSERVATION_LIMITS.textLength)
    return {
      kind: "invalid",
      field,
      reason: "This entry is too long. Use a small teaching sample.",
    };
  if (/^,|,$|,\s*,/u.test(normalized))
    return { kind: "invalid", field, reason: "A comma has a missing number beside it." };
  const tokens = normalized.split(/[\s,]+/u);
  if (tokens.length < minimum || tokens.length > maximum)
    return { kind: "invalid", field, reason: `Enter between ${minimum} and ${maximum} numbers.` };
  const values: number[] = [];
  for (const token of tokens) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token))
      return {
        kind: "invalid",
        field,
        reason: "Use finite numbers, without units or expressions.",
      };
    const value = Number(token);
    if (!Number.isFinite(value) || Math.abs(value) > OBSERVATION_LIMITS.magnitude)
      return { kind: "invalid", field, reason: "Every number must be between −1000 and 1000 µm." };
    // Refuse underflow too: a written nonzero value must never become an apparent exact zero.
    const writtenNonzero = /[1-9]/u.test(token.split(/[eE]/u)[0] ?? "");
    if (writtenNonzero && Math.abs(value) < OBSERVATION_LIMITS.minimumNonzero)
      return { kind: "invalid", field, reason: "Use zero or a magnitude of at least 0.000001 µm." };
    values.push(Object.is(value, -0) ? 0 : value);
  }
  return { kind: "accepted", values };
}

export interface ObservationRow {
  readonly index: number;
  readonly value: number;
  readonly square: number;
  readonly deviation: number;
  readonly squaredDeviation: number;
}
export interface ObservationSummary {
  readonly values: readonly number[];
  readonly rows: readonly ObservationRow[];
  readonly count: number;
  readonly mean: number;
  readonly meanAbsolute: number;
  readonly meanSquare: number;
  readonly squaredMean: number;
  readonly rms: number;
  readonly variance: number;
  readonly standardDeviation: number;
}

function describe(values: readonly number[]): ObservationSummary {
  const mean = average(values);
  const rows = values.map((value, index) => {
    const deviation = value - mean;
    return {
      index,
      value,
      square: value * value,
      deviation,
      squaredDeviation: deviation * deviation,
    };
  });
  const squares = meanSquare(values);
  // Direct centred differences preserve a small spread around a large mean. The cancellation-
  // prone identity mean(x²) − mean(x)² is displayed as an identity, never used to calculate it.
  const variance = average(rows.map((row) => row.squaredDeviation));
  return {
    values: [...values],
    rows,
    count: values.length,
    mean,
    meanAbsolute: meanDistance(values),
    meanSquare: squares,
    squaredMean: mean * mean,
    rms: Math.sqrt(squares),
    variance,
    standardDeviation: Math.sqrt(variance),
  };
}

export const DEFAULT_OBSERVATIONS = PARTICLE_ENDS.join(", ");
export const INITIAL_OBSERVATION_SUMMARY = describe(PARTICLE_ENDS);

export function readObservations(
  text: string,
): { readonly kind: "accepted"; readonly summary: ObservationSummary } | ObservationRefusal {
  const parsed = numbers(text, "observations", 1, OBSERVATION_LIMITS.observations);
  return parsed.kind === "invalid"
    ? parsed
    : { kind: "accepted", summary: describe(parsed.values) };
}

export interface HistogramBin {
  readonly index: number;
  readonly lower: number;
  readonly upper: number;
  readonly width: number;
  readonly count: number;
  readonly probability: number;
  readonly density: number;
  readonly area: number;
  readonly includesUpper: boolean;
}
export interface ObservationHistogram {
  readonly values: readonly number[];
  readonly boundaries: readonly number[];
  readonly bins: readonly HistogramBin[];
  readonly count: number;
  readonly totalProbability: number;
  readonly tallestBin: number;
  readonly largestShareBin: number;
}

function histogram(values: readonly number[], boundaries: readonly number[]): ObservationHistogram {
  const bins: HistogramBin[] = [];
  let previous: number | undefined;
  for (const upper of boundaries) {
    if (previous === undefined) {
      previous = upper;
      continue;
    }
    const lower = previous;
    previous = upper;
    const index = bins.length;
    const includesUpper = index === boundaries.length - 2;
    const count = values.filter(
      (value) => value >= lower && (value < upper || (includesUpper && value === upper)),
    ).length;
    const width = upper - lower;
    const probability = count / values.length;
    const density = probability / width;
    bins.push({
      index,
      lower,
      upper,
      width,
      count,
      probability,
      density,
      area: density * width,
      includesUpper,
    });
  }
  const largestIndex = (key: "density" | "probability") =>
    bins.reduce(
      (largest, bin) => (bin[key] > (bins[largest]?.[key] ?? -1) ? bin.index : largest),
      0,
    );
  return {
    values: [...values],
    boundaries: [...boundaries],
    bins,
    count: values.length,
    totalProbability: bins.reduce((total, bin) => total + bin.probability, 0),
    tallestBin: largestIndex("density"),
    largestShareBin: largestIndex("probability"),
  };
}

const INITIAL_HISTOGRAM_VALUES = [0.5, 1, 1.5, 2.5, 3, 3.5, 4, 5, 6, 7] as const;
const INITIAL_HISTOGRAM_BOUNDARIES = [0, 2, 4, 6, 8] as const;
export const DEFAULT_HISTOGRAM_OBSERVATIONS = INITIAL_HISTOGRAM_VALUES.join(", ");
export const DEFAULT_HISTOGRAM_BOUNDARIES = INITIAL_HISTOGRAM_BOUNDARIES.join(", ");
export const INITIAL_HISTOGRAM = histogram(INITIAL_HISTOGRAM_VALUES, INITIAL_HISTOGRAM_BOUNDARIES);

export function readHistogram(
  observationText: string,
  boundaryText: string,
): { readonly kind: "accepted"; readonly histogram: ObservationHistogram } | ObservationRefusal {
  const observations = numbers(observationText, "observations", 1, OBSERVATION_LIMITS.observations);
  if (observations.kind === "invalid") return observations;
  const boundaries = numbers(boundaryText, "boundaries", 2, OBSERVATION_LIMITS.bins + 1);
  if (boundaries.kind === "invalid") return boundaries;
  let previous: number | undefined;
  for (const boundary of boundaries.values) {
    if (previous === undefined) {
      previous = boundary;
      continue;
    }
    const width = boundary - previous;
    // A decimal interval such as 1 to 1.000001 has subtraction roundoff at its endpoints.
    const roundoff = Number.EPSILON * Math.max(1, Math.abs(previous), Math.abs(boundary)) * 4;
    if (width <= 0 || width < OBSERVATION_LIMITS.minimumBinWidth - roundoff)
      return {
        kind: "invalid",
        field: "boundaries",
        reason: "Boundaries must increase, with at least 0.000001 µm between neighbours.",
      };
    previous = boundary;
  }
  const first = boundaries.values[0];
  const last = boundaries.values[boundaries.values.length - 1];
  if (first === undefined || last === undefined)
    return { kind: "invalid", field: "boundaries", reason: "Enter at least two bin boundaries." };
  if (observations.values.some((value) => value < first || value > last))
    return {
      kind: "invalid",
      field: "boundaries",
      reason:
        "The first and last boundaries must include every observation. No observations have been discarded.",
    };
  return { kind: "accepted", histogram: histogram(observations.values, boundaries.values) };
}

export type HistogramUnit = "micrometre" | "metre";
export interface HistogramProjection {
  readonly unit: HistogramUnit;
  readonly symbol: "µm" | "m";
  readonly bins: readonly HistogramBin[];
}

/** A change of ruler: widths scale, density scales inversely, counts and shares stay fixed. */
export function projectHistogram(
  value: ObservationHistogram,
  unit: HistogramUnit,
): HistogramProjection {
  const scale = unit === "metre" ? 0.000001 : 1;
  return {
    unit,
    symbol: unit === "metre" ? "m" : "µm",
    bins: value.bins.map((bin) => ({
      ...bin,
      lower: bin.lower * scale,
      upper: bin.upper * scale,
      width: bin.width * scale,
      density: bin.density / scale,
      area: (bin.density / scale) * (bin.width * scale),
    })),
  };
}
