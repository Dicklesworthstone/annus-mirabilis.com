import { zeroFluxEvolution } from "../physics/reference/diffusion/zeroFlux.ts";
import { profileHeight } from "./bridgeFigures.ts";

/** A closed, 18 mm tube divided into equal cells; density is in arbitrary dye units per mm. */
export const DIFFUSION_PROFILE_LIMITS = Object.freeze({
  cells: 18,
  cellWidth: 1,
  maximumDiffusivity: 4,
  maximumMinutes: 60,
  minimumNonzero: 0.000001,
  textLength: 32,
});
export const DIFFUSION_PROFILE_SHAPES = [
  { id: "peak-dip", label: "A peak and a dip" },
  { id: "step", label: "Thick on the left, thin on the right" },
  { id: "uniform", label: "Equally thick everywhere" },
] as const;
export type DiffusionProfileShape = (typeof DIFFUSION_PROFILE_SHAPES)[number]["id"];
export type DiffusionProfileField = "diffusivity" | "minutes" | "shape" | "calculation";
export type DiffusionProfileRefusal = Readonly<{
  kind: "refused";
  field: DiffusionProfileField;
  message: string;
}>;
export type DiffusionProfileCell = Readonly<{
  left: number;
  right: number;
  centre: number;
  initial: number;
  current: number;
}>;
export type DiffusionProfile = Readonly<{
  shape: DiffusionProfileShape;
  diffusivity: number;
  minutes: number;
  tubeLength: number;
  cellWidth: number;
  cells: readonly DiffusionProfileCell[];
  initialTotal: number;
  total: number;
  retainedPercent: number;
  initialMinimum: number;
  initialMaximum: number;
  minimum: number;
  maximum: number;
  ownerId: "diffusion.zeroFluxEvolution";
  boundary: "zero-flux";
  referenceModel: "continuous-time finite-volume grid";
}>;
export type DiffusionProfileResult =
  | Readonly<{ kind: "accepted"; profile: DiffusionProfile }>
  | DiffusionProfileRefusal;

const refused = (field: DiffusionProfileField, message: string): DiffusionProfileRefusal => ({
  kind: "refused",
  field,
  message,
});

/**
 * The reference owner evolves cell averages with reflecting ends. This adapter selects an
 * illustrative initial profile and converts D and time to its dimensionless grid time; it
 * introduces no second diffusion solver. Each shape has the same total amount of dye.
 */
export function diffusionProfile(
  diffusivity: number,
  minutes: number,
  shape: string,
): DiffusionProfileResult {
  for (const [field, value, maximum, units] of [
    [
      "diffusivity",
      diffusivity,
      DIFFUSION_PROFILE_LIMITS.maximumDiffusivity,
      "square mm per minute",
    ],
    ["minutes", minutes, DIFFUSION_PROFILE_LIMITS.maximumMinutes, "minutes"],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > maximum)
      return refused(field, `Use a value from 0 to ${maximum} ${units}.`);
    if (value !== 0 && value < DIFFUSION_PROFILE_LIMITS.minimumNonzero)
      return refused(field, "Use zero, or a value of at least 0.000001.");
  }
  if (shape !== "peak-dip" && shape !== "step" && shape !== "uniform")
    return refused("shape", "Choose one of the three starting profiles.");

  const { cells: count, cellWidth } = DIFFUSION_PROFILE_LIMITS;
  const initial = Float64Array.from({ length: count }, (_, index) => {
    if (shape === "uniform") return 1;
    if (shape === "step") return index < count / 2 ? 1.6 : 0.4;
    return profileHeight((index + 0.5) / count);
  });
  const evolved = zeroFluxEvolution(initial, (diffusivity * minutes) / (cellWidth * cellWidth));
  if (evolved.kind !== "accepted")
    return refused(
      "calculation",
      "The diffusion calculation could not finish. Keep the previous profile and try again.",
    );

  const cells = Array.from(initial, (density, index) =>
    Object.freeze({
      left: index * cellWidth,
      right: (index + 1) * cellWidth,
      centre: (index + 0.5) * cellWidth,
      initial: density,
      current: evolved.data.values[index] ?? Number.NaN,
    }),
  );
  const initialTotal = cells.reduce((total, cell) => total + cell.initial * cellWidth, 0);
  const total = cells.reduce((amount, cell) => amount + cell.current * cellWidth, 0);
  const initialMinimum = Math.min(...initial);
  const initialMaximum = Math.max(...initial);
  const minimum = Math.min(...evolved.data.values);
  const maximum = Math.max(...evolved.data.values);
  if (
    ![total, minimum, maximum].every(Number.isFinite) ||
    minimum < 0 ||
    Math.abs(total - initialTotal) > 1e-10 * initialTotal
  )
    return refused(
      "calculation",
      "The calculated profile did not preserve the dye. Keep the previous example.",
    );

  return {
    kind: "accepted",
    profile: Object.freeze({
      shape,
      diffusivity: Object.is(diffusivity, -0) ? 0 : diffusivity,
      minutes: Object.is(minutes, -0) ? 0 : minutes,
      tubeLength: count * cellWidth,
      cellWidth,
      cells: Object.freeze(cells),
      initialTotal,
      total,
      retainedPercent: (100 * total) / initialTotal,
      initialMinimum,
      initialMaximum,
      minimum,
      maximum,
      ownerId: evolved.data.ownerId,
      boundary: evolved.data.boundary,
      referenceModel: evolved.data.referenceModel,
    }),
  };
}

function readNumber(
  text: string,
  field: "diffusivity" | "minutes",
): Readonly<{ kind: "accepted"; value: number }> | DiffusionProfileRefusal {
  const token = text.trim().replaceAll("−", "-");
  if (
    text.length > DIFFUSION_PROFILE_LIMITS.textLength ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token) ||
    !Number.isFinite(Number(token))
  )
    return refused(field, "Enter a finite number without units or expressions.");
  const value = Number(token);
  if (value === 0 && /[1-9]/u.test(token.split(/[eE]/u)[0] ?? ""))
    return refused(field, "That nonzero number is too small to represent. Enter a larger value.");
  return { kind: "accepted", value };
}

export function readDiffusionProfile(
  diffusivity: string,
  minutes: string,
  shape: string,
): DiffusionProfileResult {
  const d = readNumber(diffusivity, "diffusivity");
  if (d.kind === "refused") return d;
  const t = readNumber(minutes, "minutes");
  if (t.kind === "refused") return t;
  return diffusionProfile(d.value, t.value, shape);
}

/** Buttons operate on the accepted profile, so an unfinished draft never changes half a trial. */
export function doubleDiffusionProfile(
  profile: DiffusionProfile,
  field: "diffusivity" | "minutes",
): DiffusionProfileResult {
  return diffusionProfile(
    field === "diffusivity" ? 2 * profile.diffusivity : profile.diffusivity,
    field === "minutes" ? 2 * profile.minutes : profile.minutes,
    profile.shape,
  );
}

export const INITIAL_DIFFUSION_PROFILE = diffusionProfile(1, 4, "peak-dip");
