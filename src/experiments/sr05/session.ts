import { parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR05_CLASSES, SR05_OUTPUTS, type Sr05Parameters } from "./definition.ts";
import { validateSr05Parameters } from "./parameters.ts";
import {
  dilationLossPerSecond,
  equatorNote,
  lightClockTicks,
  properTimeAlongLegs,
  reciprocalRates,
  reunionComparison,
  speedForDailyLoss,
  type WorldlineLeg,
} from "./worldline.ts";

export type PreparedSr05Example = Readonly<{
  sourceDigest: string;
  parameters: Sr05Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

const CLOSED_WORLDLINES = new Set(["out-and-back", "circle"]);

function legsFor(p: Sr05Parameters): readonly WorldlineLeg[] {
  if (p.worldlinePreset === "out-and-back") {
    const half = p.coordinateDuration / 2;
    return [
      { beta: p.speed, duration: half },
      { beta: p.speed, duration: half },
    ];
  }
  // "inertial" and "circle" share the same proper-time arithmetic: a single interval of
  // constant speed. A circle closes on itself in space, which is what makes its reunion
  // comparison meaningful; an inertial worldline never returns, so its reunion outputs are
  // reported not-applicable below, not computed as if it had reunited with anything.
  return [{ beta: p.speed, duration: p.coordinateDuration }];
}

export function evaluateSr05(p: Sr05Parameters): ScientificResult[] {
  // worldlinePreset is a categorical choice, not a numeric quantity: it is carried on the
  // accepted snapshot's own `parameters` record (Parameters allows string values), never coerced
  // into a ScientificResult, whose "value" status is numbers/Float64Array only.
  const outputs: ScientificResult[] = [
    {
      quantityId: "speed",
      unit: "1",
      semanticKind: "signed-frame-speed",
      ownerId: "sr05.acceptedInputs",
      status: "value",
      value: p.speed,
    },
    {
      quantityId: "coordinateDuration",
      unit: "s",
      semanticKind: "coordinate-time",
      ownerId: "sr05.acceptedInputs",
      status: "value",
      value: p.coordinateDuration,
    },
    {
      quantityId: "lightClockArm",
      unit: "ls",
      semanticKind: "length",
      ownerId: "sr05.acceptedInputs",
      status: "value",
      value: p.lightClockArm,
    },
    {
      quantityId: "frameOfDescription",
      unit: "1",
      semanticKind: "signed-frame-speed",
      ownerId: "sr05.acceptedInputs",
      status: "value",
      value: p.frameOfDescription,
    },
  ];

  const legs = legsFor(p);
  const worldline = properTimeAlongLegs(legs);
  if (worldline.status === "value") {
    outputs.push(
      {
        quantityId: "properTime",
        unit: "s",
        semanticKind: "proper-time",
        ownerId: "sr05.worldline.properTimeAlongLegs",
        status: "value",
        value: worldline.value.properTime,
      },
      {
        quantityId: "coordinateTime",
        unit: "s",
        semanticKind: "coordinate-time",
        ownerId: "sr05.worldline.properTimeAlongLegs",
        status: "value",
        value: worldline.value.coordinateTime,
      },
    );
  } else {
    for (const id of ["properTime", "coordinateTime"] as const) {
      outputs.push({
        quantityId: id,
        unit: "s",
        semanticKind: id === "properTime" ? "proper-time" : "coordinate-time",
        ownerId: "sr05.worldline.properTimeAlongLegs",
        status: "outside-domain",
        condition: worldline.condition,
        domainKind: worldline.domainKind,
        reason: worldline.reason,
        boundary: { parameterId: "speed", value: p.speed },
      });
    }
  }

  const loss = dilationLossPerSecond(p.speed);
  if (loss.status === "value") {
    outputs.push(
      {
        quantityId: "dilationLossExact",
        unit: "1",
        semanticKind: "dilation-loss-per-second",
        ownerId: "kinematics.dilationLossPerSecond",
        status: "value",
        value: loss.value.exact,
      },
      {
        quantityId: "dilationLossPrintedSecondOrder",
        unit: "1",
        semanticKind: "dilation-loss-per-second-printed",
        ownerId: "kinematics.dilationLossPerSecond",
        status: "value",
        value: loss.value.printedSecondOrder,
      },
      {
        quantityId: "dilationLossDifference",
        unit: "1",
        semanticKind: "dilation-loss-difference",
        ownerId: "sr05.session.evaluateSr05",
        status: "value",
        value: loss.value.exact - loss.value.printedSecondOrder,
      },
    );
  } else {
    for (const [id, semanticKind] of [
      ["dilationLossExact", "dilation-loss-per-second"],
      ["dilationLossPrintedSecondOrder", "dilation-loss-per-second-printed"],
      ["dilationLossDifference", "dilation-loss-difference"],
    ] as const) {
      outputs.push({
        quantityId: id,
        unit: "1",
        semanticKind,
        ownerId: "kinematics.dilationLossPerSecond",
        status: "outside-domain",
        condition: loss.condition,
        domainKind: loss.domainKind,
        reason: loss.reason,
        boundary: { parameterId: "speed", value: p.speed },
      });
    }
  }

  if (CLOSED_WORLDLINES.has(p.worldlinePreset)) {
    const reunion = reunionComparison(legs);
    if (reunion.status === "value") {
      outputs.push(
        {
          quantityId: "reunionExactLag",
          unit: "s",
          semanticKind: "reunion-lag",
          ownerId: "sr05.worldline.reunionComparison",
          status: "value",
          value: reunion.value.exactLag,
        },
        {
          quantityId: "reunionPrintedApproxLag",
          unit: "s",
          semanticKind: "reunion-lag-printed",
          ownerId: "sr05.worldline.reunionComparison",
          status: "value",
          value: reunion.value.printedApproxLag,
        },
      );
    } else {
      for (const [id, semanticKind] of [
        ["reunionExactLag", "reunion-lag"],
        ["reunionPrintedApproxLag", "reunion-lag-printed"],
      ] as const) {
        outputs.push({
          quantityId: id,
          unit: "s",
          semanticKind,
          ownerId: "sr05.worldline.reunionComparison",
          status: "outside-domain",
          condition: reunion.condition,
          domainKind: reunion.domainKind,
          reason: reunion.reason,
          boundary: { parameterId: "speed", value: p.speed },
        });
      }
    }
  } else {
    outputs.push(
      {
        quantityId: "reunionExactLag",
        unit: "s",
        semanticKind: "reunion-lag",
        ownerId: "sr05.worldline.reunionComparison",
        status: "not-applicable",
        reason: "An inertial (non-closed) worldline never reunites with the stationary clock.",
      },
      {
        quantityId: "reunionPrintedApproxLag",
        unit: "s",
        semanticKind: "reunion-lag-printed",
        ownerId: "sr05.worldline.reunionComparison",
        status: "not-applicable",
        reason: "An inertial (non-closed) worldline never reunites with the stationary clock.",
      },
    );
  }

  const reciprocal = reciprocalRates(p.speed);
  if (reciprocal.status === "value") {
    outputs.push({
      quantityId: "reciprocalDilationFactor",
      unit: "1",
      semanticKind: "reciprocal-dilation-factor",
      ownerId: "sr05.worldline.reciprocalRates",
      status: "value",
      value: reciprocal.value.dilationFactor,
    });
  } else {
    outputs.push({
      quantityId: "reciprocalDilationFactor",
      unit: "1",
      semanticKind: "reciprocal-dilation-factor",
      ownerId: "sr05.worldline.reciprocalRates",
      status: "outside-domain",
      condition: reciprocal.condition,
      domainKind: reciprocal.domainKind,
      reason: reciprocal.reason,
      boundary: { parameterId: "speed", value: p.speed },
    });
  }

  const light = lightClockTicks(p.lightClockArm, p.speed);
  if (light.status === "value") {
    outputs.push(
      {
        quantityId: "lightClockProperTick",
        unit: "s",
        semanticKind: "light-clock-proper-tick",
        ownerId: "sr05.worldline.lightClockTicks",
        status: "value",
        value: light.value.properTick,
      },
      {
        quantityId: "lightClockCoordinateTick",
        unit: "s",
        semanticKind: "light-clock-coordinate-tick",
        ownerId: "sr05.worldline.lightClockTicks",
        status: "value",
        value: light.value.coordinateTick,
      },
    );
  } else {
    for (const [id, semanticKind] of [
      ["lightClockProperTick", "light-clock-proper-tick"],
      ["lightClockCoordinateTick", "light-clock-coordinate-tick"],
    ] as const) {
      outputs.push({
        quantityId: id,
        unit: "s",
        semanticKind,
        ownerId: "sr05.worldline.lightClockTicks",
        status: "outside-domain",
        condition: light.condition,
        domainKind: light.domainKind,
        reason: light.reason,
        boundary: { parameterId: "speed", value: p.speed },
      });
    }
  }

  const equator = equatorNote();
  outputs.push(
    {
      quantityId: "equatorFractionalRate",
      unit: "1",
      semanticKind: "equator-illustrative-rate",
      ownerId: "sr05.worldline.equatorNote",
      status: "value",
      value: equator.fractionalRate,
    },
    {
      quantityId: "equatorApproxNanosecondsPerDay",
      unit: "ns",
      semanticKind: "equator-illustrative-ns-per-day",
      ownerId: "sr05.worldline.equatorNote",
      status: "value",
      value: equator.approxNanosecondsPerDay,
    },
  );

  const dailySpeed = speedForDailyLoss(1);
  if (dailySpeed.status === "value") {
    outputs.push({
      quantityId: "dailyLossSpeedBeta",
      unit: "1",
      semanticKind: "daily-loss-speed",
      ownerId: "kinematics.speedForDailyLoss",
      status: "value",
      value: dailySpeed.value,
    });
  } else {
    outputs.push({
      quantityId: "dailyLossSpeedBeta",
      unit: "1",
      semanticKind: "daily-loss-speed",
      ownerId: "kinematics.speedForDailyLoss",
      status: "outside-domain",
      condition: dailySpeed.condition,
      domainKind: dailySpeed.domainKind,
      reason: dailySpeed.reason,
      boundary: { alternativeModel: "none" },
    });
  }

  return outputs;
}

export function createSr05Session(instanceId: string, example?: PreparedSr05Example) {
  const initialParams = example?.parameters ?? {
    speed: 0.6,
    worldlinePreset: "out-and-back" as const,
    coordinateDuration: 10,
    lightClockArm: 1,
    frameOfDescription: 0,
    showPrintedSecondOrder: true,
    equatorMode: false,
  };

  const store = createInstanceStore({
    experimentId: "sr-05",
    instanceId,
    initialParameters: initialParams,
    parameterClasses: SR05_CLASSES,
    outputs: SR05_OUTPUTS,
    allowPartial: true,
  });

  const initialOutputs = example?.results
    ? example.results.map(parseResult)
    : evaluateSr05(initialParams);

  const token = store.issue("setup-change");
  store.publish({
    ...token,
    outputs: initialOutputs,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
  });

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const current = (store.getSnapshot().accepted?.parameters ??
        initialParams) as Parameters as Sr05Parameters;
      const merged = input && typeof input === "object" ? { ...current, ...input } : input;
      const validated = validateSr05Parameters(merged);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = (store.getSnapshot().requested?.parameters ??
        initialParams) as Parameters as Sr05Parameters;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};

      for (const key of Object.keys(parameters) as (keyof Sr05Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        if (key === "frameOfDescription") observer[key] = parameters[key];
        else if (key === "showPrintedSecondOrder" || key === "equatorMode")
          presentation[key] = parameters[key];
        else setup[key] = parameters[key];
      }

      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) request = store.issue("observer-change", observer);
      if (Object.keys(presentation).length)
        request = store.issue("presentation-change", presentation);
      request ??= store.issue("continue");

      const computedOutputs = evaluateSr05(parameters);
      store.publish({
        ...request,
        outputs: computedOutputs,
        stepIndex: (store.getSnapshot().accepted?.stepIndex ?? 0) + 1,
        simulationTime: 0,
        final: true,
      });

      return { kind: "accepted" as const, data: request };
    },
    stop() {
      // Closed-form host evaluator has no background workers to stop
    },
    disconnect() {
      // Closed-form host evaluator has no resources to dispose
    },
    acceptedParameters: () => {
      const accepted = store.getSnapshot().accepted;
      return (accepted?.parameters ?? initialParams) as Parameters as Sr05Parameters;
    },
  });
}
