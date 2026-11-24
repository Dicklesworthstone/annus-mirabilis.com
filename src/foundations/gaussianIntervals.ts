import {
  type Evaluation,
  gaussianPropagator,
  intervalProbability,
} from "../physics/reference/diffusion/distributions.ts";

/** A bounded view of the existing zero-mean, one-coordinate Gaussian owner, in micrometres. */
export const GAUSSIAN_LIMITS = Object.freeze({
  minimumWidth: 0.5,
  maximumWidth: 2,
  minimumBound: -6,
  maximumBound: 6,
  minimumNonzeroBound: 0.000001,
  textLength: 32,
});
export const GAUSSIAN_WIDTH_COUNTS = [1, 2, 3] as const;
export type GaussianWidthCount = (typeof GAUSSIAN_WIDTH_COUNTS)[number];
export type GaussianField = "width" | "lower" | "upper" | "interval" | "calculation";
export type GaussianRefusal = Readonly<{
  kind: "refused";
  field: GaussianField;
  message: string;
}>;
export type GaussianSample = Readonly<{ position: number; density: number }>;
export type GaussianBand = Readonly<{
  widths: GaussianWidthCount;
  lower: number;
  upper: number;
  probability: number;
  samples: readonly GaussianSample[];
}>;
export type GaussianInterval = Readonly<{
  width: number;
  lower: number;
  upper: number;
  /** D at t=1 s is a parameterization of the chosen width, not an inferred diffusivity. */
  diffusivity: number;
  peakDensity: number;
  lowerDensity: number;
  upperDensity: number;
  below: number;
  inside: number;
  above: number;
  outside: number;
  total: number;
  samples: readonly GaussianSample[];
  intervalSamples: readonly GaussianSample[];
  bands: readonly GaussianBand[];
}>;
export type GaussianIntervalResult =
  | Readonly<{ kind: "accepted"; interval: GaussianInterval }>
  | GaussianRefusal;

const MICROMETRE = 0.000001;
const ELAPSED_SECONDS = 1;
const CURVE_STEPS = 192;
const INTERVAL_STEPS = 64;
/**
 * Beyond 40 standard deviations the omitted Gaussian tail is below the smallest positive
 * binary64 number. Finite endpoints let the existing interval owner evaluate tails directly,
 * without subtracting a near-one CDF and erasing a small but representable tail.
 */
const TAIL_WIDTHS = 40;

function finiteValue(evaluation: Evaluation): number | null {
  const result = evaluation.result;
  return result.status === "value" &&
    typeof result.value === "number" &&
    Number.isFinite(result.value)
    ? result.value
    : null;
}

function samples(
  diffusivity: number,
  lower: number,
  upper: number,
  steps: number,
): readonly GaussianSample[] | null {
  const rows: GaussianSample[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const position = lower + ((upper - lower) * index) / steps;
    const density = finiteValue(
      gaussianPropagator(position * MICROMETRE, ELAPSED_SECONDS, diffusivity),
    );
    if (density === null) return null;
    rows.push(Object.freeze({ position, density: density * MICROMETRE }));
  }
  return Object.freeze(rows);
}

const calculationRefusal = (): GaussianRefusal => ({
  kind: "refused",
  field: "calculation",
  message: "The Gaussian calculation did not return finite values. Keep the previous example.",
});

/** The curve, interval area, tails and table are calculated together from the same parameters. */
export function gaussianInterval(
  width: number,
  lower: number,
  upper: number,
): GaussianIntervalResult {
  if (
    !Number.isFinite(width) ||
    width < GAUSSIAN_LIMITS.minimumWidth ||
    width > GAUSSIAN_LIMITS.maximumWidth
  )
    return {
      kind: "refused",
      field: "width",
      message: "Use an RMS width from 0.5 to 2 micrometres.",
    };
  for (const [field, value] of [
    ["lower", lower],
    ["upper", upper],
  ] as const) {
    if (
      !Number.isFinite(value) ||
      value < GAUSSIAN_LIMITS.minimumBound ||
      value > GAUSSIAN_LIMITS.maximumBound
    )
      return { kind: "refused", field, message: "Use interval bounds from −6 to 6 micrometres." };
    if (value !== 0 && Math.abs(value) < GAUSSIAN_LIMITS.minimumNonzeroBound)
      return {
        kind: "refused",
        field,
        message: "Use zero or a displacement of at least 0.000001 micrometres in magnitude.",
      };
  }
  if (lower > upper)
    return {
      kind: "refused",
      field: "interval",
      message: "The lower bound must not be greater than the upper bound.",
    };

  // A Gaussian is fixed by its RMS width. Set t=1 and solve sigma²=2Dt only to call the SI owner.
  const sigma = width * MICROMETRE;
  const diffusivity = (sigma * sigma) / (2 * ELAPSED_SECONDS);
  const probability = (from: number, to: number) =>
    finiteValue(
      intervalProbability(from * MICROMETRE, to * MICROMETRE, ELAPSED_SECONDS, diffusivity),
    );
  const inside = probability(lower, upper);
  const below = probability(-TAIL_WIDTHS * width, lower);
  const above = probability(upper, TAIL_WIDTHS * width);
  const curve = samples(
    diffusivity,
    GAUSSIAN_LIMITS.minimumBound,
    GAUSSIAN_LIMITS.maximumBound,
    CURVE_STEPS,
  );
  const selected = samples(diffusivity, lower, upper, INTERVAL_STEPS);
  const peak = finiteValue(gaussianPropagator(0, ELAPSED_SECONDS, diffusivity));
  const lowerDensity = finiteValue(
    gaussianPropagator(lower * MICROMETRE, ELAPSED_SECONDS, diffusivity),
  );
  const upperDensity = finiteValue(
    gaussianPropagator(upper * MICROMETRE, ELAPSED_SECONDS, diffusivity),
  );
  if (
    inside === null ||
    below === null ||
    above === null ||
    curve === null ||
    selected === null ||
    peak === null ||
    lowerDensity === null ||
    upperDensity === null
  )
    return calculationRefusal();
  const total = below + inside + above;
  if (Math.abs(total - 1) > 0.000000000001) return calculationRefusal();

  const bands: GaussianBand[] = [];
  for (const widths of GAUSSIAN_WIDTH_COUNTS) {
    const bound = widths * width;
    const mass = probability(-bound, bound);
    const points = samples(diffusivity, -bound, bound, INTERVAL_STEPS);
    if (mass === null || points === null) return calculationRefusal();
    bands.push(
      Object.freeze({
        widths,
        lower: -bound,
        upper: bound,
        probability: mass,
        samples: points,
      }),
    );
  }
  return {
    kind: "accepted",
    interval: Object.freeze({
      width,
      lower: Object.is(lower, -0) ? 0 : lower,
      upper: Object.is(upper, -0) ? 0 : upper,
      diffusivity,
      peakDensity: peak * MICROMETRE,
      lowerDensity: lowerDensity * MICROMETRE,
      upperDensity: upperDensity * MICROMETRE,
      below,
      inside,
      above,
      outside: below + above,
      total,
      samples: curve,
      intervalSamples: selected,
      bands: Object.freeze(bands),
    }),
  };
}

function readNumber(
  text: string,
  field: "width" | "lower" | "upper",
): Readonly<{ kind: "accepted"; value: number }> | GaussianRefusal {
  const token = text.trim().replaceAll("−", "-");
  if (
    text.length > GAUSSIAN_LIMITS.textLength ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token) ||
    !Number.isFinite(Number(token))
  )
    return {
      kind: "refused",
      field,
      message: "Enter a finite number without units or expressions.",
    };
  const value = Number(token);
  if (value === 0 && /[1-9]/u.test(token.split(/[eE]/u)[0] ?? ""))
    return {
      kind: "refused",
      field,
      message: "That nonzero number is too small to represent. Enter a larger value.",
    };
  return { kind: "accepted", value };
}

export function readGaussianInterval(
  width: string,
  lower: string,
  upper: string,
): GaussianIntervalResult {
  const widthValue = readNumber(width, "width");
  if (widthValue.kind === "refused") return widthValue;
  const lowerValue = readNumber(lower, "lower");
  if (lowerValue.kind === "refused") return lowerValue;
  const upperValue = readNumber(upper, "upper");
  if (upperValue.kind === "refused") return upperValue;
  return gaussianInterval(widthValue.value, lowerValue.value, upperValue.value);
}

/** Apply the entered width and a symmetric interval in one accepted calculation. */
export function readGaussianBand(
  width: string,
  widths: GaussianWidthCount,
): GaussianIntervalResult {
  const parsed = readNumber(width, "width");
  if (parsed.kind === "refused") return parsed;
  return gaussianInterval(parsed.value, -widths * parsed.value, widths * parsed.value);
}

export const INITIAL_GAUSSIAN_INTERVAL = gaussianInterval(1, -1, 1);
