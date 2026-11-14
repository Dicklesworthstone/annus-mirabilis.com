import { type LedgerEvent, redescribe } from "../../physics/reference/events.ts";
import {
  type KinematicResult,
  ok,
  outsideDomain,
} from "../../physics/reference/kinematics/types.ts";
import type { ScientificResult } from "../results/types.ts";
import type { OutputContract, PublishedResult } from "../store/instanceStore.ts";
import type { Sr05Parameters, WorldlinePreset } from "./definition.ts";
import { properTimeAlongLegs } from "./worldline.ts";

const PHASES = [
  { id: "departure", fraction: 0 },
  { id: "quarter", fraction: 0.25 },
  { id: "half", fraction: 0.5 },
  { id: "three-quarter", fraction: 0.75 },
  { id: "end", fraction: 1 },
] as const;

export type ClockEventMarker = Readonly<{
  id: string;
  clockId: "sr05-platform-clock" | "sr05-traveller-clock";
  phase: (typeof PHASES)[number]["id"];
  fraction: number;
}>;

/** Ordering is part of the numeric-array contract; identities never depend on the observer. */
export const SR05_CLOCK_EVENT_MARKERS: readonly ClockEventMarker[] = Object.freeze(
  PHASES.flatMap((phase) =>
    (["platform", "traveller"] as const).map((clock) =>
      Object.freeze({
        id: `sr05-${clock}-${phase.id}`,
        clockId: `sr05-${clock}-clock` as ClockEventMarker["clockId"],
        phase: phase.id,
        fraction: phase.fraction,
      }),
    ),
  ),
);

const PHASE_NAMES: Readonly<
  Record<WorldlinePreset, Readonly<Record<ClockEventMarker["phase"], string>>>
> = {
  inertial: {
    departure: "Departure",
    quarter: "Quarter interval",
    half: "Half interval",
    "three-quarter": "Three-quarter interval",
    end: "End of interval",
  },
  "out-and-back": {
    departure: "Departure",
    quarter: "Outbound midpoint",
    half: "Turnaround",
    "three-quarter": "Inbound midpoint",
    end: "Reunion",
  },
  circle: {
    departure: "Departure",
    quarter: "Quarter turn",
    half: "Half turn",
    "three-quarter": "Three-quarter turn",
    end: "Reunion",
  },
};

/** Labels name the fixed platform-time sample, including the platform event at that time. */
export function clockEventName(marker: ClockEventMarker, preset: WorldlinePreset): string {
  return PHASE_NAMES[preset][marker.phase];
}

type ClockEventSetup = Pick<Sr05Parameters, "speed" | "coordinateDuration" | "worldlinePreset">;

/**
 * Construct the prescribed trip in K, in seconds and light-seconds. A circle completes one
 * revolution, starts at the origin and has initial tangent signed along x. Its quarter-turn
 * coordinates are exact geometric markers, not a polygonal approximation to its proper time.
 * All elapsed clock readings call the existing constant-speed owner, including for the circle.
 */
export function clockEvents(parameters: ClockEventSetup): KinematicResult<readonly LedgerEvent[]> {
  const { speed, coordinateDuration, worldlinePreset } = parameters;
  if (!Object.hasOwn(PHASE_NAMES, worldlinePreset))
    return outsideDomain(
      "unknown-clock-worldline",
      "Choose an inertial, out-and-back or circular trip.",
    );
  const whole = properTimeAlongLegs([{ beta: speed, duration: coordinateDuration }]);
  if (whole.status !== "value") return whole;
  const radius = (Math.abs(speed) * coordinateDuration) / (2 * Math.PI);
  const direction = Math.sign(speed);
  const circleX: Readonly<Record<ClockEventMarker["phase"], number>> = {
    departure: 0,
    quarter: direction * radius,
    half: 0,
    "three-quarter": -direction * radius,
    end: 0,
  };
  const circleY: Readonly<Record<ClockEventMarker["phase"], number>> = {
    departure: 0,
    quarter: radius,
    half: 2 * radius,
    "three-quarter": radius,
    end: 0,
  };
  const events: LedgerEvent[] = [];
  for (const marker of SR05_CLOCK_EVENT_MARKERS) {
    const t = coordinateDuration * marker.fraction;
    const platform = marker.clockId === "sr05-platform-clock";
    let reading = t;
    if (!platform) {
      if (marker.fraction === 0) reading = 0;
      else if (marker.fraction === 1) reading = whole.value.properTime;
      else {
        const elapsed = properTimeAlongLegs([{ beta: speed, duration: t }]);
        if (elapsed.status !== "value") return elapsed;
        reading = elapsed.value.properTime;
      }
    }
    const x = platform
      ? 0
      : worldlinePreset === "circle"
        ? circleX[marker.phase]
        : worldlinePreset === "out-and-back"
          ? speed * Math.min(t, coordinateDuration - t)
          : speed * t;
    const y = !platform && worldlinePreset === "circle" ? circleY[marker.phase] : 0;
    events.push(
      Object.freeze({
        id: marker.id,
        kind: "marker",
        clockId: marker.clockId,
        ownClockReading: reading,
        coordinates: Object.freeze({ t, x, y, z: 0 }),
      }),
    );
  }
  return ok(Object.freeze(events));
}

const contract = (unit: string, semanticKind: string, ownerId: string): OutputContract =>
  Object.freeze({
    unit,
    semanticKind,
    ownerId,
    statuses: Object.freeze(["value", "outside-domain"] as const),
  });

export const SR05_OBSERVER_OUTPUTS = Object.freeze({
  eventTimesK: contract("s", "event-coordinate-times", "sr05.observer.clockEvents"),
  eventPositionsK: contract("ls", "event-coordinate-positions", "sr05.observer.clockEvents"),
  eventClockReadings: contract("s", "event-own-clock-readings", "sr05.observer.clockEvents"),
  eventTimesObserver: contract("s", "event-coordinate-times", "events.redescribe"),
  eventPositionsObserver: contract("ls", "event-coordinate-positions", "events.redescribe"),
});

type EventOutputId = keyof typeof SR05_OBSERVER_OUTPUTS;

/** Position vectors are packed x,y,z per marker; time and clock-reading arrays use one per marker. */
export function observerResults(parameters: Sr05Parameters): readonly ScientificResult[] {
  const source = clockEvents(parameters);
  const observed =
    source.status === "value" ? redescribe(source.value, parameters.frameOfDescription) : source;
  return (Object.keys(SR05_OBSERVER_OUTPUTS) as EventOutputId[]).map(
    (quantityId): ScientificResult => {
      const { statuses: _statuses, ...identity } = SR05_OBSERVER_OUTPUTS[quantityId];
      const owner = quantityId.endsWith("Observer") ? observed : source;
      if (owner.status !== "value")
        return {
          ...identity,
          quantityId,
          status: "outside-domain",
          condition: owner.condition,
          domainKind: owner.domainKind,
          reason: owner.reason,
          boundary: {
            parameterId: quantityId.endsWith("Observer") ? "frameOfDescription" : "speed",
            value: quantityId.endsWith("Observer")
              ? parameters.frameOfDescription
              : parameters.speed,
          },
        };
      const values =
        quantityId === "eventClockReadings"
          ? owner.value.map((event) => event.ownClockReading)
          : quantityId.startsWith("eventPositions")
            ? owner.value.flatMap((event) => [
                event.coordinates.x,
                event.coordinates.y,
                event.coordinates.z,
              ])
            : owner.value.map((event) => event.coordinates.t);
      return { ...identity, quantityId, status: "value", value: new Float64Array(values) };
    },
  );
}

export type ClockEventRow = Readonly<{
  marker: ClockEventMarker;
  reading: number;
  platform: LedgerEvent["coordinates"];
  observer: LedgerEvent["coordinates"];
}>;

/** Read complete accepted NumericViews with their exact identities; copying is not recalculation. */
export function clockEventRows(
  outputs: readonly PublishedResult[],
): readonly ClockEventRow[] | null {
  const values = {} as Record<EventOutputId, Float64Array>;
  for (const id of Object.keys(SR05_OBSERVER_OUTPUTS) as EventOutputId[]) {
    const matches = outputs.filter((item) => item.quantityId === id);
    const output = matches[0];
    const expected = SR05_OBSERVER_OUTPUTS[id];
    const length = SR05_CLOCK_EVENT_MARKERS.length * (id.startsWith("eventPositions") ? 3 : 1);
    if (
      matches.length !== 1 ||
      !output ||
      output.status !== "value" ||
      typeof output.value === "number" ||
      output.ownerId !== expected.ownerId ||
      output.unit !== expected.unit ||
      output.semanticKind !== expected.semanticKind ||
      output.value.length !== length ||
      typeof output.value.copy !== "function"
    )
      return null;
    const copied = output.value.copy();
    if (
      !(copied instanceof Float64Array) ||
      copied.length !== length ||
      !copied.every(Number.isFinite)
    )
      return null;
    values[id] = copied;
  }
  return Object.freeze(
    SR05_CLOCK_EVENT_MARKERS.map((marker, index) =>
      Object.freeze({
        marker,
        reading: values.eventClockReadings[index] as number,
        platform: Object.freeze({
          t: values.eventTimesK[index] as number,
          x: values.eventPositionsK[index * 3] as number,
          y: values.eventPositionsK[index * 3 + 1] as number,
          z: values.eventPositionsK[index * 3 + 2] as number,
        }),
        observer: Object.freeze({
          t: values.eventTimesObserver[index] as number,
          x: values.eventPositionsObserver[index * 3] as number,
          y: values.eventPositionsObserver[index * 3 + 1] as number,
          z: values.eventPositionsObserver[index * 3 + 2] as number,
        }),
      }),
    ),
  );
}
