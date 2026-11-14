import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { type LedgerEvent, redescribe } from "../../physics/reference/events.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { restoreTape, tapeForSettings } from "../permalink/sessionTape.ts";
import type { AcceptedSnapshot, PublishedResult } from "../store/instanceStore.ts";
import { SR05_DEFAULTS, type Sr05Parameters, WORLDLINE_PRESETS } from "./definition.ts";
import {
  clockEventRows,
  clockEvents,
  observerResults,
  SR05_CLOCK_EVENT_MARKERS,
  SR05_OBSERVER_OUTPUTS,
} from "./observer.ts";
import { createSr05Session } from "./session.ts";
import { SR05_TAPE } from "./tape.ts";

function accepted(session: ReturnType<typeof createSr05Session>): AcceptedSnapshot {
  const snapshot = session.getSnapshot().accepted;
  assert(snapshot, "The real clock owner must publish an accepted snapshot.");
  return snapshot;
}

function array(snapshot: AcceptedSnapshot, id: string): Float64Array {
  const output = snapshot.outputs.find((item) => item.quantityId === id);
  assert(output?.status === "value" && typeof output.value !== "number");
  return output.value.copy();
}

function events(patch: Partial<Sr05Parameters> = {}): readonly LedgerEvent[] {
  const source = clockEvents({ ...SR05_DEFAULTS, ...patch });
  assert(source.status === "value");
  return source.value;
}

function event(source: readonly LedgerEvent[], id: string): LedgerEvent {
  const found = source.find((item) => item.id === id);
  assert(found, `Missing fixed event ${id}.`);
  return found;
}

function close(actual: number, expected: number, tolerance = 3e-12): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)),
  );
}

describe("fixed SR-05 events and proper clock readings", () => {
  test("signed out-and-back trips reach the turn and reunion with accumulated local readings", () => {
    for (const speed of [-0.6, 0.6]) {
      const source = events({ speed });
      const turn = event(source, "sr05-traveller-half");
      const inbound = event(source, "sr05-traveller-three-quarter");
      const reunion = event(source, "sr05-traveller-end");
      expect(turn.coordinates.t).toBe(5);
      expect(turn.coordinates.x).toBe(speed * 5);
      expect(inbound.coordinates.x).toBe(speed * 2.5);
      expect(turn.ownClockReading).toBe(4);
      expect(inbound.ownClockReading).toBe(6);
      expect(reunion.ownClockReading).toBe(8);
      close(reunion.coordinates.x, 0);
      expect(event(source, "sr05-platform-end").ownClockReading).toBe(10);
    }
  });

  test("an inertial clock ends away from the origin, while zero-speed clocks stay together in every preset", () => {
    for (const speed of [-0.6, 0.6]) {
      const end = event(events({ worldlinePreset: "inertial", speed }), "sr05-traveller-end");
      expect(end.coordinates.x).toBe(speed * 10);
      expect(end.ownClockReading).toBe(8);
    }
    for (const worldlinePreset of WORLDLINE_PRESETS) {
      for (const marker of events({ worldlinePreset, speed: 0 })) {
        close(marker.coordinates.x, 0);
        close(marker.coordinates.y, 0);
        expect(marker.ownClockReading).toBe(marker.coordinates.t);
      }
    }
  });

  test("a complete circle retains its y separation where an x-time projection overlaps", () => {
    for (const speed of [-0.5, 0.5]) {
      const source = events({ worldlinePreset: "circle", coordinateDuration: 2 * Math.PI, speed });
      const quarter = event(source, "sr05-traveller-quarter");
      const half = event(source, "sr05-traveller-half");
      const platformHalf = event(source, "sr05-platform-half");
      const end = event(source, "sr05-traveller-end");
      close(quarter.coordinates.x, speed);
      close(quarter.coordinates.y, 0.5);
      expect(half.coordinates.x).toBe(platformHalf.coordinates.x);
      expect(half.coordinates.t).toBe(platformHalf.coordinates.t);
      close(half.coordinates.y, 1);
      expect(platformHalf.coordinates.y).toBe(0);
      expect(end.coordinates).toEqual(event(source, "sr05-platform-end").coordinates);
      close(end.ownClockReading, 2 * Math.PI * Math.sqrt(0.75));
      for (const marker of source.filter((item) => item.clockId === "sr05-traveller-clock")) {
        close(Math.hypot(marker.coordinates.x, marker.coordinates.y - 0.5), 0.5);
      }
    }
  });

  test("real Lorentz redescription preserves event identity and local readings and reverses cleanly", () => {
    for (const worldlinePreset of WORLDLINE_PRESETS) {
      for (const speed of [-0.95, 0, 0.95]) {
        const source = events({ worldlinePreset, speed });
        for (const beta of [-0.95, 0.6, 0.95]) {
          const changed = redescribe(source, beta);
          assert(changed.status === "value");
          const reversed = redescribe(changed.value, -beta);
          assert(reversed.status === "value");
          source.forEach((original, index) => {
            const transformed = changed.value[index];
            const restored = reversed.value[index];
            assert(transformed && restored);
            expect(transformed.id).toBe(original.id);
            expect(transformed.clockId).toBe(original.clockId);
            expect(transformed.ownClockReading).toBe(original.ownClockReading);
            expect(transformed.coordinates.y).toBe(original.coordinates.y);
            for (const key of ["t", "x", "y", "z"] as const) {
              close(restored.coordinates[key], original.coordinates[key]);
            }
          });
        }
      }
    }
  });

  test("the comoving outbound description assigns different times to the platform-time pair", () => {
    const session = createSr05Session("observer-simultaneity");
    expect(session.apply({ frameOfDescription: 0.6 }).kind).toBe("accepted");
    const rows = clockEventRows(accepted(session).outputs);
    assert(rows);
    const traveller = rows.find((row) => row.marker.id === "sr05-traveller-half");
    const platform = rows.find((row) => row.marker.id === "sr05-platform-half");
    const reunion = rows.filter((row) => row.marker.phase === "end");
    assert(traveller && platform);
    expect(traveller.platform.t).toBe(platform.platform.t);
    close(traveller.observer.t, 4);
    close(traveller.observer.x, 0);
    close(platform.observer.t, 6.25);
    close(platform.observer.x, -3.75);
    expect(traveller.reading).toBe(4);
    expect(platform.reading).toBe(5);
    for (const row of reunion) {
      close(row.observer.t, 12.5);
      close(row.observer.x, -7.5);
    }
  });
});

describe("accepted event arrays and observer-only session changes", () => {
  test("the presentation adapter reads real immutable NumericViews and exact output contracts", () => {
    const snapshot = accepted(createSr05Session("observer-numeric-views"));
    const vector = snapshot.outputs.find((output) => output.quantityId === "eventTimesK");
    assert(vector?.status === "value" && typeof vector.value !== "number");
    expect(vector.value).not.toBeInstanceOf(Float64Array);
    expect(typeof vector.value.copy).toBe("function");
    const rows = clockEventRows(snapshot.outputs);
    assert(rows, "The feature must read the accepted store, not only raw evaluator arrays.");
    expect(rows.map((row) => row.marker.id)).toEqual(SR05_CLOCK_EVENT_MARKERS.map((row) => row.id));
    expect(rows.find((row) => row.marker.id === "sr05-traveller-end")?.reading).toBe(8);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(rows.every((row) => Object.isFrozen(row) && Object.isFrozen(row.observer))).toBe(true);
    const copied = vector.value.copy();
    copied.fill(12345);
    expect(clockEventRows(snapshot.outputs)).toEqual(rows);
  });

  test("missing, duplicate, misidentified and nonfinite accepted arrays do not produce a partial view", () => {
    const outputs = accepted(createSr05Session("observer-contracts")).outputs;
    const target = outputs.find((output) => output.quantityId === "eventTimesK");
    assert(target?.status === "value" && typeof target.value !== "number");
    const replace = (replacement: PublishedResult) =>
      outputs.map((output) => (output.quantityId === target.quantityId ? replacement : output));
    expect(clockEventRows(outputs.filter((output) => output !== target))).toBeNull();
    expect(clockEventRows([...outputs, target])).toBeNull();
    expect(clockEventRows(replace({ ...target, ownerId: "unrelated-owner" }))).toBeNull();
    expect(clockEventRows(replace({ ...target, unit: "m" }))).toBeNull();
    expect(clockEventRows(replace({ ...target, semanticKind: "proper-time" }))).toBeNull();
    const nonfinite = target.value.copy();
    nonfinite[0] = Number.NaN;
    expect(
      clockEventRows(
        replace({
          ...target,
          value: {
            length: nonfinite.length,
            at: (index) => nonfinite[index] ?? 0,
            copy: () => nonfinite,
          },
        }),
      ),
    ).toBeNull();
    expect(clockEventRows(outputs)).not.toBeNull();
  });

  test("changing only the observer preserves the physical run, simulation step and own readings", () => {
    const session = createSr05Session("observer-same-run");
    const before = accepted(session);
    const sourceIds = ["eventTimesK", "eventPositionsK", "eventClockReadings"] as const;
    for (const frameOfDescription of [-0.6, 0.6, 0]) {
      expect(session.apply({ frameOfDescription }).kind).toBe("accepted");
      const after = accepted(session);
      expect(after.runId).toBe(before.runId);
      expect(after.stepIndex).toBe(before.stepIndex);
      expect(after.simulationTime).toBe(before.simulationTime);
      expect(after.revisions.input).toBe(before.revisions.input);
      expect(after.parameters.frameOfDescription).toBe(frameOfDescription);
      for (const id of sourceIds) expect(array(after, id)).toEqual(array(before, id));
      for (const id of ["properTime", "reunionExactLag"]) {
        expect(after.outputs.find((output) => output.quantityId === id)).toEqual(
          before.outputs.find((output) => output.quantityId === id),
        );
      }
      if (frameOfDescription !== 0) {
        expect(array(after, "eventTimesObserver")).not.toEqual(array(before, "eventTimesObserver"));
      }
    }
    expect(session.apply({ speed: -0.6 }).kind).toBe("accepted");
    expect(accepted(session).runId).not.toBe(before.runId);
  });

  test("refused observer inputs preserve the entire accepted session", () => {
    const session = createSr05Session("observer-refused-draft");
    const before = session.getSnapshot();
    for (const frameOfDescription of [1, -1, 0.96, Number.NaN, Number.POSITIVE_INFINITY, ""]) {
      expect(session.apply({ frameOfDescription }).kind).toBe("refused");
      expect(session.getSnapshot()).toBe(before);
    }
    expect(session.apply({ frameOfDescription: -0.95 }).kind).toBe("accepted");
    expect(accepted(session).runId).toBe(before.accepted?.runId);
  });

  test("an impossible direct observer is typed outside-domain without erasing valid source events", () => {
    const result = observerResults({ ...SR05_DEFAULTS, frameOfDescription: 1 });
    for (const id of Object.keys(SR05_OBSERVER_OUTPUTS)) {
      const output = result.find((item) => item.quantityId === id);
      expect(output?.status).toBe(id.endsWith("Observer") ? "outside-domain" : "value");
    }
    const unknown = clockEvents({ ...SR05_DEFAULTS, worldlinePreset: "unknown" as never });
    expect(unknown.status).toBe("outside-domain");
  });

  test("the existing permalink reopens the selected observer and the same physical event record", () => {
    const original = createSr05Session("observer-share-original");
    expect(
      original.apply({ worldlinePreset: "circle", speed: -0.6, frameOfDescription: 0.3 }).kind,
    ).toBe("accepted");
    const before = accepted(original);
    const tape = tapeForSettings(SR05_TAPE, before.parameters);
    assert(tape);
    const decoded = decodeTapePermalink(encodeTapePermalink(tape));
    assert(decoded.kind === "success");
    const reopened = createSr05Session("observer-share-reopened");
    expect(restoreTape(SR05_TAPE, reopened, decoded.tape).kind).toBe("restored");
    const after = accepted(reopened);
    expect(after.parameters).toEqual(before.parameters);
    expect(clockEventRows(after.outputs)).toEqual(clockEventRows(before.outputs));
  });
});
