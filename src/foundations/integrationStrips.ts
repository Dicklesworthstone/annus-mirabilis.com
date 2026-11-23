import { RAMP, rampArea, rampDensity } from "./bridgeFigures.ts";

export const INTEGRATION_STRIP_LIMIT = 128;
export type StripRule = "left" | "midpoint" | "right";
export type StripSample = Readonly<{
  position: number;
  height: number;
  area: number;
}>;
export type IntegrationStrip = Readonly<{
  index: number;
  left: number;
  right: number;
  width: number;
  samples: Readonly<Record<StripRule, StripSample>>;
}>;
export type RampPartition = Readonly<{
  count: number;
  width: number;
  strips: readonly IntegrationStrip[];
  leftTotal: number;
  midpointTotal: number;
  rightTotal: number;
  exactArea: number;
  bracketWidth: number;
}>;
export type PartitionResult =
  | Readonly<{ kind: "accepted"; partition: RampPartition }>
  | Readonly<{ kind: "refused"; message: string }>;

/** Countable rectangles over the lesson's existing density, not a new physical model. */
function buildPartition(count: number): RampPartition {
  const width = RAMP.micrometres / count;
  const sample = (position: number): StripSample => {
    const height = rampDensity(position);
    return Object.freeze({ position, height, area: height * width });
  };
  const strips = Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({
        index,
        left: index * width,
        right: (index + 1) * width,
        width,
        samples: Object.freeze({
          left: sample(index * width),
          midpoint: sample((index + 0.5) * width),
          right: sample((index + 1) * width),
        }),
      }),
    ),
  );
  const total = (rule: StripRule) =>
    strips.reduce((value, strip) => value + strip.samples[rule].area, 0);
  const leftTotal = total("left");
  const rightTotal = total("right");
  return Object.freeze({
    count,
    width,
    strips,
    leftTotal,
    midpointTotal: total("midpoint"),
    rightTotal,
    exactArea: rampArea(),
    bracketWidth: rightTotal - leftTotal,
  });
}

/** Bound the work before allocating any rectangles, including nonfinite or fractional counts. */
export function partitionRamp(count: number): PartitionResult {
  if (!Number.isInteger(count) || count < 1 || count > INTEGRATION_STRIP_LIMIT)
    return {
      kind: "refused",
      message: `Choose a whole number of strips from 1 to ${INTEGRATION_STRIP_LIMIT}.`,
    };
  return { kind: "accepted", partition: buildPartition(count) };
}

export function readRampPartition(text: string): PartitionResult {
  const trimmed = text.trim();
  if (trimmed.length > 16 || !/^\d+$/.test(trimmed))
    return {
      kind: "refused",
      message: `Enter a whole number of strips from 1 to ${INTEGRATION_STRIP_LIMIT}, such as 4 or 8.`,
    };
  return partitionRamp(Number(trimmed));
}

export const REFERENCE_RAMP_PARTITION = buildPartition(4);
export const INITIAL_RAMP_PARTITION = buildPartition(8);
