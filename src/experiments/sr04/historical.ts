/** SR-04's bounded Galilean exercise. The numerical owner never reads a light-speed constant. */
import { withMode1904Guard } from "../../physics/reference/constants.ts";
import { galileanVelocity, type KinematicResult } from "../../physics/reference/kinematics.ts";
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { makeRefusal, type RequestRefusal } from "../results/refusals.ts";

export const SR04_HISTORICAL_MODE = "sr-04:1904";
export const SR04_HISTORICAL_PRESET = "sr-04-galilean-1904";
export const SR04_HISTORICAL_PATH = "/lab/sr-04/1904/";
export const SR04_HISTORICAL_SPEED_LIMIT = 10_000;
export const SR04_HISTORICAL_FRACTION_LIMIT = 0.95;
export type HistoricalSr04Inputs = Readonly<{
  objectSpeed: number;
  observerSpeed: number;
  vOverC: number;
}>;
export const SR04_HISTORICAL_DEFAULTS: HistoricalSr04Inputs = Object.freeze({
  objectSpeed: 10,
  observerSpeed: 30,
  vOverC: 0.6,
});
export type HistoricalSr04Check =
  | Readonly<{ kind: "accepted"; data: HistoricalSr04Inputs }>
  | Readonly<{ kind: "refused"; refusal: RequestRefusal }>;

const FIELD_LABELS: Readonly<Record<keyof HistoricalSr04Inputs, string>> = Object.freeze({
  objectSpeed: "the object's speed",
  observerSpeed: "the slow-case observer's speed",
  vOverC: "the light-comparison observer's speed as a fraction of c",
});
const KEYS = Object.keys(SR04_HISTORICAL_DEFAULTS) as (keyof HistoricalSr04Inputs)[];

export function validateHistoricalSr04(input: unknown): HistoricalSr04Check {
  const refuse = (parameterIds: readonly string[], requirements: string): HistoricalSr04Check => ({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { parameterIds },
      {
        details: { requirements },
        rankedRepairs: [{ label: requirements }],
      },
    ),
  });
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return refuse(KEYS, "Supply the three Galilean comparison settings.");
  const data = input as Record<string, unknown>;
  if (
    Reflect.ownKeys(data).length !== KEYS.length ||
    KEYS.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(data, key);
      return !descriptor?.enumerable || !Object.hasOwn(descriptor, "value");
    })
  )
    return refuse(KEYS, "Use only the object speed, observer speed and light-speed fraction.");
  for (const key of KEYS) {
    const value = data[key];
    if (typeof value !== "number" || !Number.isFinite(value))
      return refuse([key], `Enter ${FIELD_LABELS[key]} as a finite number.`);
    if (key !== "vOverC" && Math.abs(value) > SR04_HISTORICAL_SPEED_LIMIT)
      return refuse(
        [key],
        `Keep ${FIELD_LABELS[key]} between −10,000 and +10,000 m/s for this slow-object example. Larger entries are not clamped.`,
      );
  }
  const parameters = data as HistoricalSr04Inputs;
  if (Math.abs(parameters.vOverC) >= 1)
    return refuse(
      ["vOverC"],
      "This ether-frame comparison admits an observer speed strictly below light speed. Use a fraction between −0.95 and +0.95 for this calculation.",
    );
  if (Math.abs(parameters.vOverC) > SR04_HISTORICAL_FRACTION_LIMIT)
    return refuse(
      ["vOverC"],
      "This calculation's stated range is −0.95 to +0.95 of c. Enter a value in that range; it is never clamped.",
    );
  return { kind: "accepted", data: Object.freeze({ ...parameters }) };
}

export type HistoricalSr04Snapshot = Readonly<{
  parameters: HistoricalSr04Inputs;
  modeId: typeof SR04_HISTORICAL_MODE;
  slowCaseGalilean: KinematicResult<number>;
  rightRayFraction: KinematicResult<number>;
  leftRayFraction: KinematicResult<number>;
}>;

/** The 1 and -1 are dimensionless ray directions, never a numeric value of c in physical units. */
export function evaluateHistoricalSr04(parameters: HistoricalSr04Inputs): HistoricalSr04Snapshot {
  return withMode1904Guard(() =>
    Object.freeze({
      parameters: Object.freeze({ ...parameters }),
      modeId: SR04_HISTORICAL_MODE,
      slowCaseGalilean: galileanVelocity(parameters.objectSpeed, parameters.observerSpeed),
      rightRayFraction: galileanVelocity(1, parameters.vOverC),
      leftRayFraction: galileanVelocity(-1, parameters.vOverC),
    }),
  );
}

export const SR04_HISTORICAL_EXAMPLE = evaluateHistoricalSr04(SR04_HISTORICAL_DEFAULTS);
export const SR04_HISTORICAL_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-04",
    mode: SR04_HISTORICAL_MODE,
    modelId: "sr-04",
    modelVersion: 1,
    constantSetId: "1904-symbolic-light-speed",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR04_HISTORICAL_DEFAULTS,
  validate: validateHistoricalSr04,
});
