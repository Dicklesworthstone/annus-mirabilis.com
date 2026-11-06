/** LQ-02's isolated 1904 composition, shared by the desk, standalone lab and static preview. */
import {
  constantValue,
  getConstantSet,
  withMode1904Guard,
} from "../../physics/reference/constants.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  classicalModeAllocation,
  classicalTotalEnergy,
} from "../../physics/reference/radiation/classical.ts";
import {
  type ClassicalRelativeResult,
  classicalCutoffGrowth,
  classicalRelativeEnergy,
  classicalShareAboveProbe,
} from "../../physics/reference/radiation/classicalRelative.ts";
import type { RadiationResult } from "../../physics/reference/radiation/types.ts";
import { makeRefusal } from "../results/refusals.ts";

export const HISTORICAL_LQ02_MODE = "lq-02:1904";
export const HISTORICAL_LQ02_PRESET = "lq-02-classical-1904";
export const HISTORICAL_LQ02_CONSTANT_SET = "planck-1900-1901-printed";
export const HISTORICAL_LQ02_PATH = "/lab/lq-02/1904/";

export type HistoricalLq02Inputs = Readonly<{
  T: number;
  nuCutoff: number;
  probeFrequency: number;
  constantSetId: typeof HISTORICAL_LQ02_CONSTANT_SET;
}>;

export const DEFAULT_HISTORICAL_LQ02_INPUTS: HistoricalLq02Inputs = Object.freeze({
  T: 1500,
  nuCutoff: 1e14,
  probeFrequency: 1e13,
  constantSetId: HISTORICAL_LQ02_CONSTANT_SET,
});

const FIELD_NAMES = {
  T: "Temperature, in K",
  nuCutoff: "Upper frequency, in Hz",
  probeFrequency: "Probe frequency, in Hz",
} as const;

function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

/** No accessors, extra settings, coercion, clamping or constants from another mode. */
export function validateHistoricalLq02Parameters(
  input: unknown,
): Computation<HistoricalLq02Inputs> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return refused([], "Use a complete settings record.");
  const record = input as Record<string, unknown>;
  const keys = Object.keys(DEFAULT_HISTORICAL_LQ02_INPUTS);
  if (
    Reflect.ownKeys(record).length !== keys.length ||
    Reflect.ownKeys(record).some((key) => typeof key !== "string" || !keys.includes(key)) ||
    keys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      return !descriptor?.enumerable || !Object.hasOwn(descriptor, "value");
    })
  )
    return refused(keys, "Use every setting exactly once, as data.");
  for (const key of Object.keys(FIELD_NAMES) as (keyof typeof FIELD_NAMES)[]) {
    const inputValue = record[key];
    if (typeof inputValue !== "number" || !Number.isFinite(inputValue) || inputValue <= 0)
      return refused([key], `${FIELD_NAMES[key]}: enter a positive, finite number.`);
  }
  if (record.constantSetId !== HISTORICAL_LQ02_CONSTANT_SET)
    return refused(
      ["constantSetId"],
      "This reconstruction uses Planck's printed 1901 constant set.",
    );
  return { kind: "accepted", data: Object.freeze({ ...(record as HistoricalLq02Inputs) }) };
}

export type HistoricalLq02Snapshot = Readonly<{
  mode: typeof HISTORICAL_LQ02_MODE;
  inputs: HistoricalLq02Inputs;
  reference: HistoricalLq02Inputs;
  energyUpToCutoff: RadiationResult<number>;
  relativeEnergy: ClassicalRelativeResult;
  shareAboveProbe: ClassicalRelativeResult;
  tenfoldGrowth: ClassicalRelativeResult;
  totalWithoutCutoff: RadiationResult<number>;
  planckNumber: Readonly<{ value: number; source: string; year: 1901 }>;
}>;

function snapshotFor(inputs: HistoricalLq02Inputs): HistoricalLq02Snapshot {
  return withMode1904Guard(() => {
    const set = getConstantSet(inputs.constantSetId);
    // Read only Planck's printed molecular number. The 1905 matching function also returns
    // comparisons with later constants, so none of its payload enters this composition.
    const number = constantValue(set, "avogadroConstant");
    const source = set.entries.find((entry) => entry.quantityId === "avogadroConstant");
    if (!source)
      throw new Error("The registered Planck set is missing its printed molecular number.");
    return Object.freeze({
      mode: HISTORICAL_LQ02_MODE,
      inputs,
      reference: DEFAULT_HISTORICAL_LQ02_INPUTS,
      energyUpToCutoff: classicalModeAllocation(
        HISTORICAL_LQ02_MODE,
        inputs.nuCutoff,
        inputs.T,
        set,
      ),
      relativeEnergy: classicalRelativeEnergy(
        inputs.T,
        inputs.nuCutoff,
        DEFAULT_HISTORICAL_LQ02_INPUTS.T,
        DEFAULT_HISTORICAL_LQ02_INPUTS.nuCutoff,
      ),
      shareAboveProbe: classicalShareAboveProbe(inputs.nuCutoff, inputs.probeFrequency),
      tenfoldGrowth: classicalCutoffGrowth(10),
      totalWithoutCutoff: classicalTotalEnergy(inputs.T, set),
      planckNumber: Object.freeze({ value: number.value, source: source.provenance, year: 1901 }),
    });
  });
}

/** The same validation boundary serves typed edits and restored settings. */
export function evaluateHistoricalLq02(input: unknown): Computation<HistoricalLq02Snapshot> {
  const checked = validateHistoricalLq02Parameters(input);
  if (checked.kind !== "accepted") return checked;
  return { kind: "accepted", data: snapshotFor(checked.data) };
}

/** Real owner output; importing it does not require generated content or a browser. */
export const DEFAULT_HISTORICAL_LQ02_SNAPSHOT = snapshotFor(DEFAULT_HISTORICAL_LQ02_INPUTS);
