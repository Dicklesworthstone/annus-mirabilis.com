import {
  classifySimultaneity,
  desynchronizationObserved,
  type DesynchronizationVerdict,
  type LedgerEvent,
  movingRodLegs,
  redescribe,
  synchronizationRound,
  synchronizationTransitivity,
  type TransitivityResult,
} from "../../physics/reference/events.ts";
import type { KinematicResult } from "../../physics/reference/kinematics/types.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR01_CLASSES, SR01_DEFAULTS, SR01_OUTPUTS, type Sr01Parameters } from "./definition.ts";
import { validateSr01Parameters } from "./parameters.ts";

function identity(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
): Pick<ScientificResult, "quantityId" | "unit" | "semanticKind" | "ownerId"> {
  return { quantityId, unit, semanticKind, ownerId };
}

function asValue(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  value: number,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "value" as const,
    value,
  });
}

function asOutside(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  parameterId: string,
  from: Extract<KinematicResult<unknown>, { status: "outside-domain" }>,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "outside-domain" as const,
    condition: from.condition,
    domainKind: from.domainKind,
    reason: from.reason,
    boundary: Object.freeze({ parameterId, value: 1 }),
  });
}

/** 2*AB / (t'_A - t_A) at c: the round trip's reception is derived from the postulate, never
 * an independent input -- there is no control for it in the manifest. */
function derivedReceptionTimeA(p: Sr01Parameters): number {
  return p.emissionTimeA + 2 * p.stationSeparationLs;
}

export function snapshotOutputs(p: Sr01Parameters): ScientificResult[] {
  const receptionTimeA = derivedReceptionTimeA(p);
  const round = synchronizationRound({
    emissionTimeA: p.emissionTimeA,
    receptionTimeA,
    separationLs: p.stationSeparationLs,
  });
  const chase = movingRodLegs({ separationLs: p.stationSeparationLs, beta: p.rodBeta });
  const desync = desynchronizationObserved({
    properSeparationLs: p.pairSeparationLs,
    beta: p.pairBeta,
  });

  const outputs: ScientificResult[] = [];

  if (round.status === "value") {
    outputs.push(
      asValue(
        "assignedRemoteTime",
        "s",
        "assigned-remote-time",
        "events.synchronizationRound",
        round.value.assignedRemoteTime,
      ),
      asValue(
        "roundTripSpeed",
        "ls/s",
        "round-trip-speed",
        "events.synchronizationRound",
        round.value.roundTripSpeedLsPerS,
      ),
      // The criterion check the reader actually probes: B's own independently-declared clock
      // (clockOffsetB) against the procedure's assignment. Zero exactly when clockOffsetB is
      // zero ("synchronized by definition"); the degenerate criterionOffset the owner itself
      // returns is always zero by construction and is not what a reader adjusting the offset
      // control needs to see.
      asValue(
        "criterionOffset",
        "s",
        "criterion-offset",
        "events.synchronizationRound",
        2 * p.clockOffsetB,
      ),
    );
  } else {
    outputs.push(
      asOutside(
        "assignedRemoteTime",
        "s",
        "assigned-remote-time",
        "events.synchronizationRound",
        "stationSeparationLs",
        round,
      ),
      asOutside(
        "roundTripSpeed",
        "ls/s",
        "round-trip-speed",
        "events.synchronizationRound",
        "stationSeparationLs",
        round,
      ),
      asOutside(
        "criterionOffset",
        "s",
        "criterion-offset",
        "events.synchronizationRound",
        "stationSeparationLs",
        round,
      ),
    );
  }

  if (chase.status === "value") {
    outputs.push(
      asValue(
        "chaseOutboundLeg",
        "s",
        "rod-chase-outbound-leg",
        "events.movingRodLegs",
        chase.value.outboundLegS,
      ),
      asValue(
        "chaseReturnLeg",
        "s",
        "rod-chase-return-leg",
        "events.movingRodLegs",
        chase.value.returnLegS,
      ),
    );
  } else {
    outputs.push(
      asOutside(
        "chaseOutboundLeg",
        "s",
        "rod-chase-outbound-leg",
        "events.movingRodLegs",
        "rodBeta",
        chase,
      ),
      asOutside(
        "chaseReturnLeg",
        "s",
        "rod-chase-return-leg",
        "events.movingRodLegs",
        "rodBeta",
        chase,
      ),
    );
  }

  if (desync.status === "value") {
    outputs.push(
      asValue(
        "desynchronization",
        "s",
        "desynchronization-magnitude",
        "events.desynchronizationObserved",
        desync.value.desyncMagnitudeS,
      ),
    );
  } else {
    outputs.push(
      asOutside(
        "desynchronization",
        "s",
        "desynchronization-magnitude",
        "events.desynchronizationObserved",
        "pairBeta",
        desync,
      ),
    );
  }

  outputs.push(
    Object.freeze({
      ...identity("oneWayLightSpeed", "ls/s", "one-way-light-speed", "events.byConvention"),
      status: "not-applicable" as const,
      reason:
        "The model defines the one-way light speed by convention (Einstein's synchronization procedure), rather than measuring it independently.",
    }),
  );

  return outputs;
}

/** The predict prompt's answer, read from the accepted snapshot's own output, never authored text. */
export function predictAnswerFor(p: Sr01Parameters): DesynchronizationVerdict | null {
  const result = desynchronizationObserved({
    properSeparationLs: p.pairSeparationLs,
    beta: p.pairBeta,
  });
  return result.status === "value" ? result.value.verdict : null;
}

export interface Sr01LedgerRow {
  readonly id: string;
  readonly kind: LedgerEvent["kind"];
  readonly clockId: string;
  readonly ownClockReading: number;
  readonly t: number;
  readonly x: number;
}

export interface Sr01Ledger {
  readonly rows: readonly Sr01LedgerRow[];
  readonly transitivity: TransitivityResult | null;
}

function toRows(events: readonly LedgerEvent[]): readonly Sr01LedgerRow[] {
  return events.map((e) => ({
    id: e.id,
    kind: e.kind,
    clockId: e.clockId,
    ownClockReading: e.ownClockReading,
    t: e.coordinates.t,
    x: e.coordinates.x,
  }));
}

/**
 * The full ledger (emission/reflection/reception rows, redescribed to the chosen frame of
 * description) plus the three-station transitivity check. Composed here, not published on the
 * strict `outputs: ScientificResult[]` array, because a ledger row is a composite record, not a
 * named scalar quantity the store's publication contract can carry -- the same reason ME-01's
 * `evaluateMe01` is called directly from its component using the accepted parameters, never an
 * independent draft copy.
 */
export function computeSr01Ledger(p: Sr01Parameters): Sr01Ledger {
  const receptionTimeA = derivedReceptionTimeA(p);
  const reflectionTime = (p.emissionTimeA + receptionTimeA) / 2;
  const events: readonly LedgerEvent[] = Object.freeze([
    Object.freeze({
      id: "emission-a",
      kind: "emission" as const,
      clockId: "A",
      ownClockReading: p.emissionTimeA,
      coordinates: Object.freeze({ t: p.emissionTimeA, x: 0, y: 0, z: 0 }),
    }),
    Object.freeze({
      id: "reflection-b",
      kind: "reflection" as const,
      clockId: "B",
      ownClockReading: reflectionTime + p.clockOffsetB,
      coordinates: Object.freeze({ t: reflectionTime, x: p.stationSeparationLs, y: 0, z: 0 }),
    }),
    Object.freeze({
      id: "reception-a",
      kind: "reception" as const,
      clockId: "A",
      ownClockReading: receptionTimeA,
      coordinates: Object.freeze({ t: receptionTimeA, x: 0, y: 0, z: 0 }),
    }),
  ]);

  const described =
    p.frameBeta === 0
      ? { status: "value" as const, value: events }
      : redescribe(events, p.frameBeta);
  const rows = described.status === "value" ? toRows(described.value) : toRows(events);

  const transitivity = synchronizationTransitivity([
    { stationA: "A", stationB: "B", relativeVelocityBeta: 0 },
    { stationA: "B", stationB: "C", relativeVelocityBeta: 0 },
    { stationA: "A", stationB: "C", relativeVelocityBeta: 0 },
  ]);

  return {
    rows,
    transitivity: transitivity.status === "value" ? transitivity.value : null,
  };
}

export { classifySimultaneity };

export type PreparedSr01Example = Readonly<{
  sourceDigest: string;
  parameters: Sr01Parameters;
  results: readonly string[];
}>;

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr01Example = Object.freeze({
  sourceDigest: "src/physics/reference/events.ts",
  parameters: SR01_DEFAULTS,
  results: snapshotOutputs(SR01_DEFAULTS).map(encodeResult),
});

export function createSr01Session(
  instanceId = "sr01-session",
  initialParameters: Sr01Parameters = SR01_DEFAULTS,
) {
  const initialOutputsEncoded = snapshotOutputs(initialParameters).map(encodeResult);

  const store = createInstanceStore({
    experimentId: "sr-01",
    instanceId,
    initialParameters: initialParameters as unknown as Parameters,
    parameterClasses: SR01_CLASSES,
    outputs: SR01_OUTPUTS,
    allowPartial: true,
  });

  const initialOutputs = initialOutputsEncoded.map(parseResult);
  const token = store.issue("setup-change");
  const published = store.publish({
    ...token,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: initialOutputs,
  });
  if (!published.accepted) throw new Error("Invalid prepared SR-01 example.");
  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    acceptedParameters(): Sr01Parameters {
      const accepted = store.getSnapshot().accepted;
      return (accepted?.parameters ?? initialParameters) as Sr01Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr01Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const snap = store.getSnapshot();
      const previous = (snap.requested?.parameters ??
        snap.accepted?.parameters ??
        initialParameters) as Sr01Parameters;
      const next = checked.data;

      const setup: Record<string, unknown> = {};
      const observer: Record<string, unknown> = {};

      (Object.keys(next) as (keyof Sr01Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        if (SR01_CLASSES[key] === "observer") observer[key] = next[key];
        else setup[key] = next[key];
      });

      let request = Object.keys(setup).length
        ? store.issue("setup-change", setup as Parameters)
        : null;
      if (Object.keys(observer).length)
        request = store.issue("observer-change", observer as Parameters);
      request ??= store.issue("continue");

      const outputs = snapshotOutputs(request.parameters as unknown as Sr01Parameters);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });
      if (!decision.accepted) throw new Error(`SR-01 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}
