import { evaluateMe02, printedMassConversion } from "../../physics/reference/massEnergy.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { ME02_CLASSES, ME02_DEFAULTS, ME02_OUTPUTS, type Me02Parameters } from "./definition.ts";
import { me02InputFromParameters, validateMe02Parameters } from "./parameters.ts";

export type PreparedPrintedConversion = Readonly<{
  emittedEnergyErg: number;
  printedGrams: number;
  printedConstantSetId: string;
  modernGrams: number;
  modernConstantSetId: string;
  wording: string;
}>;

export type PreparedMe02Example = Readonly<{
  sourceDigest: string;
  parameters: Me02Parameters;
  results: readonly string[];
  comparisonResults: readonly string[];
  stepIndex: number;
  simulationTime: number;
  printedConversion: PreparedPrintedConversion;
}>;

export function packPrintedConversion(
  conversion: ReturnType<typeof printedMassConversion>,
): PreparedPrintedConversion {
  return Object.freeze({
    emittedEnergyErg: conversion.emittedEnergyErg,
    printedGrams: conversion.printed.value,
    printedConstantSetId: conversion.printed.constantSetId,
    modernGrams: conversion.modern.value,
    modernConstantSetId: conversion.modern.constantSetId,
    wording: conversion.comparison.wording,
  });
}

export function snapshotOutputs(p: Me02Parameters): ScientificResult[] {
  const snap = evaluateMe02(me02InputFromParameters(p));
  return [
    snap.exactDifference,
    snap.quadraticApproximation,
    snap.quadraticDiscrepancy,
    snap.finiteSpeedProxy,
    snap.limitingCoefficient,
    snap.proxyExcess,
    snap.massChangeSigned,
    snap.naive,
  ];
}

const AT_LOW_SPEED: Me02Parameters = Object.freeze({ ...ME02_DEFAULTS, beta: 0.01 });

export const DEFAULT_PREPARED_EXAMPLE: PreparedMe02Example = Object.freeze({
  sourceDigest: "source:sha256:default",
  parameters: ME02_DEFAULTS,
  results: snapshotOutputs(ME02_DEFAULTS).map(encodeResult),
  comparisonResults: snapshotOutputs(AT_LOW_SPEED).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
  printedConversion: packPrintedConversion(printedMassConversion({ emittedEnergyErg: 9e20 })),
});

export function createMe02Session(
  instanceId = "me02-session",
  example: PreparedMe02Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "me-02",
    instanceId,
    initialParameters: example.parameters as Parameters,
    parameterClasses: ME02_CLASSES,
    outputs: ME02_OUTPUTS,
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
    throw new Error(`Invalid prepared ME-02 example: ${published.reason}`);
  }
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateMe02,
    convertPrintedMass: (erg: number) => printedMassConversion({ emittedEnergyErg: erg }),
    acceptedParameters(): Me02Parameters {
      return (store.getSnapshot().accepted?.parameters ?? example.parameters) as Me02Parameters;
    },
    apply(input: unknown) {
      const checked = validateMe02Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const snapshot = store.getSnapshot();
      const previous = (snapshot.requested?.parameters ??
        snapshot.accepted?.parameters ??
        example.parameters) as Me02Parameters;
      const next = checked.data;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};
      (Object.keys(next) as (keyof Me02Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        if (ME02_CLASSES[key] === "input") setup[key] = next[key];
        else if (ME02_CLASSES[key] === "observer") observer[key] = next[key];
        else presentation[key] = next[key];
      });
      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) request = store.issue("observer-change", observer);
      if (Object.keys(presentation).length)
        request = store.issue("presentation-change", presentation);
      request ??= store.issue("continue");
      const outputs = snapshotOutputs(request.parameters as Me02Parameters);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });
      if (!decision.accepted) throw new Error(`ME-02 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}
