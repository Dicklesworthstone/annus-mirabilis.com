import { evaluateSr02 } from "../../physics/reference/fields.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import { refuseNonFiniteValues } from "../results/numberRange.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR02_CLASSES, SR02_DEFAULTS, SR02_OUTPUTS, type Sr02Parameters } from "./definition.ts";
import { sr02InputFromParameters, validateSr02Parameters } from "./parameters.ts";

export type PreparedSr02Example = Readonly<{
  sourceDigest: string;
  parameters: Sr02Parameters;
  results: readonly string[];
  comparisonResults: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Sr02Parameters): ScientificResult[] {
  const snap = evaluateSr02(sr02InputFromParameters(p));
  const outputs = [
    snap.magneticFieldMagnet,
    snap.electricFieldMagnet,
    snap.magneticFieldConductor,
    snap.electricFieldConductor,
    snap.forceMagnet,
    snap.forceConductor,
    snap.emfMagnet,
    snap.emfConductor,
    snap.emfExcess,
    snap.invariantDot,
    snap.invariantDifference,
    snap.lorentzFactor,
    snap.pathParallel,
    snap.endpointOffset,
    snap.circuitCurrent,
  ];
  // E² − c²B² overflows once a field passes about 10^146 T; say so per output instead of letting the
  // store refuse the whole publication, which no caller catches (see numberRange.ts).
  return refuseNonFiniteValues(outputs, [
    {
      parameterId: "magneticField",
      value: p.magneticField,
      admissible: SR02_DEFAULTS.magneticField,
    },
    { parameterId: "dipoleMoment", value: p.dipoleMoment, admissible: SR02_DEFAULTS.dipoleMoment },
    { parameterId: "testCharge", value: p.testCharge, admissible: SR02_DEFAULTS.testCharge },
    {
      parameterId: "segmentLength",
      value: p.segmentLength,
      admissible: SR02_DEFAULTS.segmentLength,
    },
  ]);
}

const AT_06C: Sr02Parameters = Object.freeze({
  ...SR02_DEFAULTS,
  speed: 0.6 * 299792458,
});

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr02Example = Object.freeze({
  sourceDigest: "source:sha256:default",
  parameters: SR02_DEFAULTS,
  results: snapshotOutputs(SR02_DEFAULTS).map(encodeResult),
  comparisonResults: snapshotOutputs(AT_06C).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr02Session(
  instanceId = "sr02-session",
  example: PreparedSr02Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-02",
    instanceId,
    initialParameters: example.parameters as Parameters,
    parameterClasses: SR02_CLASSES,
    outputs: SR02_OUTPUTS,
    allowPartial: true,
  });
  const initialOutputs = example.results.map(parseResult);
  const token = store.issue("setup-change");
  const published = store.publish({
    ...token,
    stepIndex: example.stepIndex,
    simulationTime: example.simulationTime,
    final: true,
    outputs: initialOutputs,
  });
  if (!published.accepted) {
    throw new Error(`Invalid prepared SR-02 example: ${published.reason}`);
  }
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr02,
    acceptedParameters(): Sr02Parameters {
      return (store.getSnapshot().accepted?.parameters ?? example.parameters) as Sr02Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr02Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const snapshot = store.getSnapshot();
      const previous = (snapshot.requested?.parameters ??
        snapshot.accepted?.parameters ??
        example.parameters) as Sr02Parameters;
      const next = checked.data;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const measurement: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};
      (Object.keys(next) as (keyof Sr02Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        if (SR02_CLASSES[key] === "input") setup[key] = next[key];
        else if (SR02_CLASSES[key] === "observer") observer[key] = next[key];
        else if (SR02_CLASSES[key] === "measurement") measurement[key] = next[key];
        else presentation[key] = next[key];
      });
      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) request = store.issue("observer-change", observer);
      if (Object.keys(measurement).length) request = store.issue("measurement-change", measurement);
      if (Object.keys(presentation).length) {
        request = store.issue("presentation-change", presentation);
      }
      request ??= store.issue("continue");
      const outputs = snapshotOutputs(request.parameters as Sr02Parameters);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });
      if (!decision.accepted) throw new Error(`SR-02 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}
