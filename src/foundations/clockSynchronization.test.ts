import { describe, expect, test } from "bun:test";
import { checkClockSynchronization } from "../physics/reference/events.ts";
import {
  type ClockReadings,
  type ClockSynchronization,
  type ClockSynchronizationResult,
  clockReadingsDraft,
  clockSynchronization,
  INITIAL_CLOCK_SYNCHRONIZATION,
  readClockSynchronization,
  setClockByMidpoint,
  shiftClockReadings,
} from "./clockSynchronization.ts";

const READINGS = { leaves: 0, reflection: 7, returns: 10 } as const;

function accepted(result: ClockSynchronizationResult): ClockSynchronization {
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new Error(result.message);
  return result.synchronization;
}

describe("setting a distant clock by the existing event owner's midpoint rule", () => {
  test("the worked signal keeps measured duration separate from unsynchronised clock differences", () => {
    const value = accepted(INITIAL_CLOCK_SYNCHRONIZATION);
    expect(value.readings).toEqual(READINGS);
    expect(value.roundTrip).toBe(10);
    expect(value.assignedReflection).toBe(5);
    expect(value.outwardReadingDifference).toBe(7);
    expect(value.returnReadingDifference).toBe(3);
    expect(value.assignedOutwardDuration).toBe(5);
    expect(value.assignedReturnDuration).toBe(5);
    expect(value.offset).toBe(2);
    expect(value.correction).toBe(-2);
    expect(value.discrepancy).toBe(2);
    expect(value.synchronized).toBe(false);
    expect(value.ownerId).toBe("events.checkClockSynchronization");
  });

  test("correcting B preserves the same A readings and is a fixed point of the owner's rule", () => {
    const first = accepted(INITIAL_CLOCK_SYNCHRONIZATION);
    const value = accepted(setClockByMidpoint(first));
    expect(value.readings).toEqual({ leaves: 0, reflection: 5, returns: 10 });
    expect(value.roundTrip).toBe(first.roundTrip);
    expect(value.synchronized).toBe(true);
    expect(value.offset).toBe(0);
    expect(value.correction).toBe(0);
    expect(value.outwardReadingDifference).toBe(5);
    expect(value.returnReadingDifference).toBe(5);
    expect(accepted(setClockByMidpoint(value))).toEqual(value);
    expect(first.readings).toEqual(READINGS);
  });

  test("B's own unsynchronised reading can fall outside A's interval", () => {
    const behind = accepted(clockSynchronization({ ...READINGS, reflection: -20 }));
    expect(behind.outwardReadingDifference).toBe(-20);
    expect(behind.returnReadingDifference).toBe(30);
    expect(behind.offset).toBe(-25);
    expect(behind.correction).toBe(25);
    const ahead = accepted(clockSynchronization({ ...READINGS, reflection: 30 }));
    expect(ahead.outwardReadingDifference).toBe(30);
    expect(ahead.returnReadingDifference).toBe(-20);
    expect(ahead.correction).toBe(-25);
    expect(accepted(setClockByMidpoint(behind))).toEqual(accepted(setClockByMidpoint(ahead)));
  });

  test("a common change of clock origin preserves the account and moves only readings", () => {
    const first = accepted(INITIAL_CLOCK_SYNCHRONIZATION);
    for (const shift of [-100, -10, 0, 10, 100]) {
      const value = accepted(shiftClockReadings(first, shift));
      expect(value.readings).toEqual({ leaves: shift, reflection: 7 + shift, returns: 10 + shift });
      expect(value.assignedReflection).toBe(first.assignedReflection + shift);
      for (const field of [
        "roundTrip",
        "outwardReadingDifference",
        "returnReadingDifference",
        "assignedOutwardDuration",
        "assignedReturnDuration",
        "offset",
        "correction",
        "discrepancy",
        "synchronized",
      ] as const)
        expect(value[field]).toBe(first[field]);
    }
    const synchronized = accepted(setClockByMidpoint(first));
    expect(accepted(shiftClockReadings(synchronized)).synchronized).toBe(true);
  });

  test("decimal readings retain their synchronization verdict and intervals through an origin change", () => {
    const first = accepted(clockSynchronization({ leaves: 0.1, reflection: 0.15, returns: 0.2 }));
    const corrected = accepted(setClockByMidpoint(first));
    const shifted = accepted(shiftClockReadings(corrected));
    expect(shifted.readings).toEqual({ leaves: 10.1, reflection: 10.15, returns: 10.2 });
    expect(shifted.originOffset).toBe(10);
    expect(shifted.referenceReadings).toBe(corrected.referenceReadings);
    expect(shifted.referenceAssignedReflection).toBe(corrected.referenceAssignedReflection);
    expect(shifted.synchronized).toBe(true);
    expect(shifted.offset).toBe(0);
    expect(shifted.correction).toBe(0);
    expect(shifted.roundTrip).toBe(corrected.roundTrip);
    expect(shifted.outwardReadingDifference).toBe(corrected.outwardReadingDifference);
    expect(shifted.returnReadingDifference).toBe(corrected.returnReadingDifference);
    expect(shifted.assignedOutwardDuration).toBe(corrected.assignedOutwardDuration);
    // Subtraction of shifted display numbers loses precision. It cannot own this same account.
    expect(shifted.readings.returns - shifted.readings.leaves).not.toBe(shifted.roundTrip);
    expect(accepted(readClockSynchronization(clockReadingsDraft(shifted), shifted))).toBe(shifted);
    expect(
      accepted(
        readClockSynchronization({ ...clockReadingsDraft(shifted), leaves: " 10.1 " }, shifted),
      ),
    ).toBe(shifted);
  });

  test("correction after a decimal origin shift still uses the reference owner and survives further shifts", () => {
    const first = accepted(clockSynchronization({ leaves: 0.1, reflection: 0.17, returns: 0.2 }));
    const shifted = accepted(shiftClockReadings(first));
    expect(shifted.offset).toBe(first.offset);
    const corrected = accepted(setClockByMidpoint(shifted));
    const twiceShifted = accepted(shiftClockReadings(corrected));
    expect(corrected.originOffset).toBe(10);
    expect(twiceShifted.originOffset).toBe(20);
    expect(twiceShifted.readings).toEqual({ leaves: 20.1, reflection: 20.15, returns: 20.2 });
    expect(twiceShifted.synchronized).toBe(true);
    expect(twiceShifted.offset).toBe(0);
    expect(twiceShifted.roundTrip).toBe(first.roundTrip);
    const changed = accepted(
      readClockSynchronization(
        { ...clockReadingsDraft(twiceShifted), reflection: "20.16" },
        twiceShifted,
      ),
    );
    expect(changed.originOffset).toBe(0);
    expect(changed.referenceReadings).toBe(changed.readings);
    expect(changed.synchronized).toBe(false);
    expect(twiceShifted.synchronized).toBe(true);
  });

  test("an origin shift refuses to merge distinct events or conceal a nonzero clock offset", () => {
    const tiny = accepted(clockSynchronization({ leaves: 0, reflection: 1e-20, returns: 2e-20 }));
    expect(shiftClockReadings(tiny)).toMatchObject({ kind: "refused", field: "returns" });
    const rounded = accepted(clockSynchronization({ leaves: 0.1, reflection: 0.15, returns: 0.2 }));
    expect(rounded.offset).not.toBe(0);
    expect(shiftClockReadings(rounded)).toMatchObject({ kind: "refused", field: "reflection" });
    expect(accepted(shiftClockReadings(accepted(setClockByMidpoint(rounded)))).synchronized).toBe(
      true,
    );
  });

  test("the owner supplies the assigned reading and verdict across origins, durations and offsets", () => {
    let cases = 0;
    for (const leaves of [-200, -0.5, 0, 17.25, 1000]) {
      for (const duration of [0.25, 2, 10, 100]) {
        for (const offset of [-30, 0, 2]) {
          const readings = {
            leaves,
            reflection: leaves + duration / 2 + offset,
            returns: leaves + duration,
          };
          const expected = checkClockSynchronization(
            readings.leaves,
            readings.reflection,
            readings.returns,
          );
          const actual = accepted(clockSynchronization(readings));
          expect(expected.status).toBe("value");
          if (expected.status !== "value") throw new Error(expected.reason);
          expect(actual.assignedReflection).toBe(expected.value.expectedTB);
          expect(actual.synchronized).toBe(expected.value.synchronized);
          expect(actual.discrepancy).toBe(expected.value.discrepancy);
          expect(actual.assignedOutwardDuration).toBe(actual.assignedReturnDuration);
          expect(actual.assignedOutwardDuration + actual.assignedReturnDuration).toBe(
            actual.roundTrip,
          );
          cases += 1;
        }
      }
    }
    expect(cases).toBe(60);
  });

  test("only A establishes round-trip ordering; too-close or out-of-budget readings are refused", () => {
    for (const returns of [-1, 0, Number.MIN_VALUE])
      expect(clockSynchronization({ ...READINGS, returns })).toMatchObject({
        kind: "refused",
        field: "returns",
      });
    expect(
      clockSynchronization({ leaves: 1, reflection: 1, returns: 1 + Number.EPSILON }),
    ).toMatchObject({ kind: "refused", field: "returns" });
    for (const field of ["leaves", "reflection", "returns"] as const) {
      for (const bad of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        -1_000_001,
        1_000_001,
      ])
        expect(clockSynchronization({ ...READINGS, [field]: bad })).toMatchObject({
          kind: "refused",
          field,
        });
    }
    const edge = accepted(
      clockSynchronization({ leaves: 999_990, reflection: 999_995, returns: 1_000_000 }),
    );
    expect(shiftClockReadings(edge)).toMatchObject({ kind: "refused", field: "reflection" });
    expect(
      accepted(clockSynchronization({ leaves: -1_000_000, reflection: 0, returns: 1_000_000 }))
        .synchronized,
    ).toBe(true);
  });

  test("typed readings accept finite decimals and signed origins, but never unfinished expressions or underflow", () => {
    const draft = clockReadingsDraft(accepted(INITIAL_CLOCK_SYNCHRONIZATION));
    const parsed = accepted(
      readClockSynchronization({ leaves: " −2 ", reflection: " .5 ", returns: "2e0" }),
    );
    expect(parsed.readings).toEqual({ leaves: -2, reflection: 0.5, returns: 2 });
    for (const text of [
      "",
      " ",
      "-",
      "1e",
      "NaN",
      "Infinity",
      "1+1",
      "0x10",
      "3 seconds",
      "1e999",
      "1e-999",
      "1".repeat(33),
    ])
      expect(readClockSynchronization({ ...draft, reflection: text })).toMatchObject({
        kind: "refused",
        field: "reflection",
      });
    expect(
      accepted(readClockSynchronization({ ...draft, reflection: "0e-999" })).readings.reflection,
    ).toBe(0);
  });

  test("accepted readings are copied and frozen, including a canonical zero", () => {
    const input: { -readonly [Key in keyof ClockReadings]: ClockReadings[Key] } = {
      ...READINGS,
      leaves: -0,
    };
    const value = accepted(clockSynchronization(input));
    input.reflection = 99;
    expect(value.readings.reflection).toBe(7);
    expect(value.readings.leaves).toBe(0);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.readings)).toBe(true);
    expect(Object.isFrozen(value.referenceReadings)).toBe(true);
  });
});
