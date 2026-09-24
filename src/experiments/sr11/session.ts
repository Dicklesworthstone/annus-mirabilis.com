import { evaluateSr11, type Sr11Input } from "../../physics/reference/waves.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import { refuseNonFiniteValues } from "../results/numberRange.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR11_CLASSES, SR11_DEFAULTS, SR11_OUTPUTS, type Sr11Parameters } from "./definition.ts";
import { validateSr11Parameters } from "./parameters.ts";

export type PreparedSr11Example = Readonly<{
  sourceDigest: string;
  parameters: Sr11Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function sr11InputFromParameters(p: Sr11Parameters): Sr11Input {
  return {
    beta: p.beta,
    incidentAngleDeg: p.incidentAngleDeg,
    incidentEnergyDensity: p.incidentEnergyDensity,
    mirrorArea: p.mirrorArea,
    frame: p.frame,
    unitLayer: p.unitLayer,
  };
}

export function snapshotOutputs(p: Sr11Parameters): ScientificResult[] {
  const snap = evaluateSr11(sr11InputFromParameters(p));
  // An energy density or mirror area near 10^300 carries the pressure, force and powers past the
  // largest number a double can hold. Say so per output instead of letting the store refuse the
  // whole publication, which no caller catches: the lab sat on "A new calculation is in progress"
  // and threw an uncaught page error (see numberRange.ts, and sr09/session.ts for the same case).
  return refuseNonFiniteValues(snap.results, [
    {
      parameterId: "incidentEnergyDensity",
      value: p.incidentEnergyDensity,
      admissible: SR11_DEFAULTS.incidentEnergyDensity,
    },
    { parameterId: "mirrorArea", value: p.mirrorArea, admissible: SR11_DEFAULTS.mirrorArea },
  ]);
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr11Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr11",
  parameters: SR11_DEFAULTS,
  results: snapshotOutputs(SR11_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr11Session(
  instanceId = "sr11-session",
  example: PreparedSr11Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-11",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR11_CLASSES,
    outputs: SR11_OUTPUTS,
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
    throw new Error(`Invalid prepared SR-11 example: ${published.reason}`);
  }

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr11,
    acceptedParameters(): Sr11Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr11Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr11Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr11Parameters;
      const next = checked.data;

      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};

      (Object.keys(next) as (keyof Sr11Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        const cls = SR11_CLASSES[key];
        if (cls === "observer") {
          observer[key] = next[key];
        } else if (cls === "presentation") {
          presentation[key] = next[key];
        } else {
          setup[key] = next[key];
        }
      });

      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) {
        request = store.issue("observer-change", observer);
      }
      if (Object.keys(presentation).length) {
        request = store.issue("presentation-change", presentation);
      }
      request ??= store.issue("continue");

      const outputs = snapshotOutputs(next);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });

      if (!decision.accepted) {
        throw new Error(`SR-11 publication refused: ${decision.reason}`);
      }

      return { kind: "accepted" as const, data: request };
    },
  });
}
