import { checkClockSynchronization } from "../physics/reference/events.ts";
import { FAST_READING, SYNC } from "./bridgeFigures.ts";

export const CLOCK_READING_LIMITS = Object.freeze({ absoluteSeconds: 1_000_000, textLength: 32 });
export type ClockReadingField = "leaves" | "reflection" | "returns";
export type ClockReadings = Readonly<Record<ClockReadingField, number>>;
export type ClockReadingsDraft = Readonly<Record<ClockReadingField, string>>;
export type ClockSynchronizationRefusal = Readonly<{
  kind: "refused";
  field: ClockReadingField;
  message: string;
}>;
export type ClockSynchronization = Readonly<{
  /** The owner evaluates this record; a common origin shift never recomputes its differences. */
  referenceReadings: ClockReadings;
  referenceAssignedReflection: number;
  originOffset: number;
  readings: ClockReadings;
  assignedReflection: number;
  roundTrip: number;
  /** These compare two different clocks. Before synchronization they are not travel times. */
  outwardReadingDifference: number;
  returnReadingDifference: number;
  assignedOutwardDuration: number;
  assignedReturnDuration: number;
  offset: number;
  correction: number;
  discrepancy: number;
  synchronized: boolean;
  ownerId: "events.checkClockSynchronization";
}>;
export type ClockSynchronizationResult =
  | Readonly<{ kind: "accepted"; synchronization: ClockSynchronization }>
  | ClockSynchronizationRefusal;

const refused = (field: ClockReadingField, message: string): ClockSynchronizationRefusal => ({
  kind: "refused",
  field,
  message,
});
const positiveZero = (value: number) => (value === 0 ? 0 : value);

/**
 * The existing event owner supplies the midpoint rule and its verdict. The adapter bounds the
 * lesson's input and labels the clock differences. In particular B's local reading is allowed
 * outside A's departure/return interval: disallowing that would assume synchronization before
 * the reader has applied the rule that supplies it.
 */
export function clockSynchronization(readings: ClockReadings): ClockSynchronizationResult {
  for (const field of ["leaves", "reflection", "returns"] as const) {
    const value = readings[field];
    if (!Number.isFinite(value) || Math.abs(value) > CLOCK_READING_LIMITS.absoluteSeconds)
      return refused(field, "Use a finite clock reading between −1000000 and 1000000 seconds.");
  }

  const checked = checkClockSynchronization(readings.leaves, readings.reflection, readings.returns);
  if (checked.status !== "value")
    return refused(
      "returns",
      "A's return reading must be later than its departure reading. Keep the same order of events.",
    );
  if (!(readings.leaves < checked.value.expectedTB && checked.value.expectedTB < readings.returns))
    return refused(
      "returns",
      "These readings are too close together to place the midpoint reliably. Use a wider round trip.",
    );
  const values = Object.freeze({
    leaves: positiveZero(readings.leaves),
    reflection: positiveZero(readings.reflection),
    returns: positiveZero(readings.returns),
  });
  const assignedReflection = positiveZero(checked.value.expectedTB);
  const offset = positiveZero(values.reflection - assignedReflection);
  const roundTrip = values.returns - values.leaves;
  return {
    kind: "accepted",
    synchronization: Object.freeze({
      referenceReadings: values,
      referenceAssignedReflection: assignedReflection,
      originOffset: 0,
      readings: values,
      assignedReflection,
      roundTrip,
      outwardReadingDifference: positiveZero(values.reflection - values.leaves),
      returnReadingDifference: positiveZero(values.returns - values.reflection),
      assignedOutwardDuration: roundTrip / 2,
      assignedReturnDuration: roundTrip / 2,
      offset,
      correction: positiveZero(-offset),
      discrepancy: checked.value.discrepancy,
      synchronized: checked.value.synchronized,
      ownerId: "events.checkClockSynchronization",
    }),
  };
}

export function clockReadingsDraft(value: ClockSynchronization): ClockReadingsDraft {
  return {
    leaves: String(value.readings.leaves),
    reflection: String(value.readings.reflection),
    returns: String(value.readings.returns),
  };
}

export function readClockSynchronization(
  draft: ClockReadingsDraft,
  previous?: ClockSynchronization,
): ClockSynchronizationResult {
  const values: Record<ClockReadingField, number> = { leaves: 0, reflection: 0, returns: 0 };
  for (const field of ["leaves", "reflection", "returns"] as const) {
    const text = draft[field];
    const token = text.trim().replaceAll("−", "-");
    if (
      text.length > CLOCK_READING_LIMITS.textLength ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token) ||
      !Number.isFinite(Number(token))
    )
      return refused(field, "Enter a finite clock reading without units or expressions.");
    values[field] = Number(token);
    if (values[field] === 0 && /[1-9]/u.test(token.split(/[eE]/u)[0] ?? ""))
      return refused(field, "That nonzero reading is too small to represent. Use a larger value.");
  }
  // Reapplying an unchanged display keeps its canonical account. Rebasing its rounded numbers
  // would otherwise turn an origin change into a new (and potentially different) owner verdict.
  if (
    previous &&
    (["leaves", "reflection", "returns"] as const).every(
      (field) => values[field] === previous.readings[field],
    )
  )
    return { kind: "accepted", synchronization: previous };
  return clockSynchronization(values);
}

/** Correct B's display at the reflection while retaining A's two readings of the same signal. */
export function setClockByMidpoint(value: ClockSynchronization): ClockSynchronizationResult {
  const corrected = clockSynchronization({
    ...value.referenceReadings,
    reflection: value.referenceAssignedReflection,
  });
  if (corrected.kind !== "accepted") return corrected;
  return shiftClockReadings(corrected.synchronization, value.originOffset);
}

/** Relabel every clock by the same offset; no duration or synchronization offset changes. */
export function shiftClockReadings(
  value: ClockSynchronization,
  shift = 10,
): ClockSynchronizationResult {
  const originOffset = positiveZero(value.originOffset + shift);
  const readings = Object.freeze({
    leaves: positiveZero(value.referenceReadings.leaves + originOffset),
    reflection: positiveZero(value.referenceReadings.reflection + originOffset),
    returns: positiveZero(value.referenceReadings.returns + originOffset),
  });
  for (const field of ["leaves", "reflection", "returns"] as const) {
    if (
      !Number.isFinite(readings[field]) ||
      Math.abs(readings[field]) > CLOCK_READING_LIMITS.absoluteSeconds
    )
      return refused(
        field,
        "That origin change would put a reading outside −1000000 to 1000000 seconds.",
      );
  }
  const assignedReflection = positiveZero(value.referenceAssignedReflection + originOffset);
  if (!(readings.leaves < assignedReflection && assignedReflection < readings.returns))
    return refused(
      "returns",
      "That origin change would merge separate event readings at the available precision. Keep the current origin.",
    );
  if (Math.sign(readings.reflection - assignedReflection) !== Math.sign(value.offset))
    return refused(
      "reflection",
      "That origin change would hide B's nonzero offset at the available precision. Keep the current origin or set B by the rule first.",
    );
  return {
    kind: "accepted",
    synchronization: Object.freeze({ ...value, readings, assignedReflection, originOffset }),
  };
}

export const INITIAL_CLOCK_SYNCHRONIZATION = clockSynchronization({
  leaves: SYNC.leaves,
  reflection: FAST_READING,
  returns: SYNC.returns,
});
