/** Compare real shelf-optics owners through one accepted instance snapshot; never compute in a view. */
import { withMode1904Guard } from "../../physics/reference/constants.ts";
import {
  fizeauFringeShift,
  michelsonMorleyFringeShift,
  relativisticDraggedSpeed,
  waveEquationResidual,
  type DragHypothesis,
} from "../../physics/reference/shelfOptics.ts";
import type { ScientificResult } from "../results/types.ts";
import {
  createInstanceStore,
  type OutputContract,
  type Parameters,
  type ParameterClass,
  type RequestToken,
} from "../store/instanceStore.ts";
import { shelfDefaults, shelfFields, validateShelfInput, type ShelfId, type ShelfMode } from "./definition.ts";

export type ShelfReading = Readonly<{
  id: string;
  model: string;
  label: string;
  unit: string;
  semanticKind: string;
}>;
export type ShelfEvaluation = Readonly<{
  readings: readonly ShelfReading[];
  outputs: readonly ScientificResult[];
}>;

/** Identity mapping is explicit: several owner properties intentionally reuse a base quantity id. */
function evaluate(id: ShelfId, mode: ShelfMode, p: Parameters): ShelfEvaluation {
  const readings: ShelfReading[] = [];
  const outputs: ScientificResult[] = [];
  const add = (key: string, model: string, label: string, item: ScientificResult, unit: string, semanticKind: string) => {
    const reading = Object.freeze({ id: key, model, label, unit, semanticKind });
    readings.push(reading);
    // Nonfinite results are a numerical refusal, never a zero or an accepted numeric value.
    const payload: ScientificResult = item.status === "value" &&
      (typeof item.value !== "number" || !Number.isFinite(item.value))
      ? { quantityId: key, unit, semanticKind, ownerId: "shelf-optics", status: "outside-domain", condition: "nonrepresentable-output", domainKind: "numerical",
          reason: "These settings exceed the finite numerical representation. Reduce their magnitudes.",
          boundary: { alternativeModel: "finite shelf-optics settings" } }
      : item;
    outputs.push(Object.freeze({ ...payload, quantityId: key, unit, semanticKind }));
  };
  const n = (key: string): number => {
    const value = p[key];
    if (typeof value !== "number") throw new TypeError(`Missing numeric setting ${key}.`);
    return value;
  };
  if (id === "shelf-michelson-morley") {
    for (const contraction of [false, true]) {
      const model = contraction ? "With contraction" : "Without contraction";
      const prefix = contraction ? "contracted" : "ether";
      const result = michelsonMorleyFringeShift(mode === "1904"
        ? { beta: n("beta"), pathInWavelengths: n("pathInWavelengths"), contraction }
        : { windSpeed: n("windSpeed"), length: n("length"), wavelength: n("wavelengthNm") * 1e-9,
            contraction, constantSet: "modern-si-2019" });
      // With c=1 and lengths in wavelengths, owner times are in wavelength/c, NOT seconds.
      const timeUnit = mode === "1904" ? "wavelength/c" : "s";
      add(`${prefix}Parallel`, model, "Parallel-arm round trip", result.timeParallel, timeUnit, "time");
      add(`${prefix}Perpendicular`, model, "Perpendicular-arm round trip", result.timePerpendicular, timeUnit, "time");
      add(`${prefix}Delay`, model, "Difference of arm times", result.timeDifference, timeUnit, "time");
      add(`${prefix}Shift`, model, "Shift on a quarter-turn", result.fringeShift, "dimensionless", "fringe-shift");
    }
  } else if (id === "shelf-fizeau") {
    const hypotheses: readonly DragHypothesis[] = ["no-drag", "full-drag", "fresnel-drag"];
    for (const hypothesis of hypotheses) {
      const result = fizeauFringeShift({
        waterPathPerBeam: n("waterPathPerBeam"), wavelength: n("wavelengthNm") * 1e-9,
        refractiveIndex: n("refractiveIndex"), dragHypothesis: hypothesis, reversal: p.reversal === true,
        ...(mode === "1904" ? { waterSpeedFractionOfC: n("waterSpeedFractionOfC") }
          : { waterSpeed: n("waterSpeed"), constantSet: "modern-si-2019" }),
      });
      const speedUnit = mode === "1904" ? "c" : "m/s";
      const canReturn = [result.speedAlongFlow, result.speedAgainstFlow].every((item) =>
        item.status !== "value" || (typeof item.value === "number" && item.value > 0));
      // The owner exposes signed beam speeds. A round trip ceases to exist if a return
      // speed is nonpositive; preserve the speed/drag readings, but never publish its
      // pole or negative travel time as an interference measurement.
      const returning = (item: ScientificResult): ScientificResult => !canReturn && item.status === "value"
        ? { quantityId: item.quantityId, unit: item.unit, semanticKind: item.semanticKind, ownerId: item.ownerId, status: "outside-domain", condition: "beam-cannot-return", domainKind: "model",
            reason: "A beam cannot return against this flow under this drag hypothesis. Reduce the flow magnitude.",
            boundary: { parameterId: mode === "1904" ? "waterSpeedFractionOfC" : "waterSpeed", value: 0 } }
        : item;
      add(`${hypothesis}-coefficient`, hypothesis, "Drag coefficient", result.dragCoefficient, "dimensionless", "coefficient");
      add(`${hypothesis}-shift`, hypothesis, "Predicted fringe shift", returning(result.fringeShift), "dimensionless", "fringe-shift");
      add(`${hypothesis}-leading`, hypothesis, "Small-flow approximation", returning(result.fringeShiftFirstOrder), "dimensionless", "fringe-shift");
      add(`${hypothesis}-delay`, hypothesis, "Difference of beam times", returning(result.timeDifference), mode === "1904" ? "m/c" : "s", "time");
      add(`${hypothesis}-along`, hypothesis, "Speed along the flow", result.speedAlongFlow, speedUnit, "speed");
      add(`${hypothesis}-against`, hypothesis, "Return speed against the flow", result.speedAgainstFlow, speedUnit, "speed");
    }
    // This branch is absent even from a 1904 snapshot, not merely hidden by CSS.
    if (mode === "full") {
      const later = relativisticDraggedSpeed({ waterSpeed: n("waterSpeed"), refractiveIndex: n("refractiveIndex"), constantSet: "modern-si-2019" });
      add("laterSpeed", "Later derivation (Laue 1907)", "Speed along the flow", later.draggedSpeed, "m/s", "speed");
      add("laterIncrement", "Later derivation (Laue 1907)", "Increment over still water", later.velocityIncrement, "m/s", "speed");
    }
  } else {
    for (const map of ["galilean", "lorentz"] as const) {
      for (const direction of ["forward", "backward"] as const) {
        // Reversing the axis maps the left-travelling wave to the owner's right-travelling case.
        const result = waveEquationResidual({ map, beta: direction === "forward" ? n("beta") : -n("beta"),
          wavenumber: n("wavenumber"), ...(mode === "full" ? { constantSet: "modern-si-2019" } : {}) });
        add(`${map}-${direction}`, map, `${direction === "forward" ? "Forward" : "Backward"} wave: normalised residual`, result.relativeResidual, "dimensionless", "residual");
        add(`${map}-${direction}-absolute`, map, `${direction === "forward" ? "Forward" : "Backward"} wave: maximum residual`, result.maxResidual, "1/m2", "operator-residual");
      }
    }
  }
  return Object.freeze({ readings: Object.freeze(readings), outputs: Object.freeze(outputs) });
}

export function evaluateShelf(id: ShelfId, mode: ShelfMode, parameters: Parameters): ShelfEvaluation {
  const checked = validateShelfInput(id, mode, parameters);
  if (checked.kind !== "accepted") throw new TypeError(checked.message);
  return mode === "1904" ? withMode1904Guard(() => evaluate(id, mode, checked.parameters))
    : evaluate(id, mode, checked.parameters);
}

export function createShelfSession(id: ShelfId, mode: ShelfMode, instanceId: string,
  initialParameters: Parameters = shelfDefaults(id, mode)) {
  const checked = validateShelfInput(id, mode, initialParameters);
  if (checked.kind !== "accepted") throw new TypeError(checked.message);
  const initial = evaluateShelf(id, mode, checked.parameters);
  const classes: Readonly<Record<string, ParameterClass>> = Object.freeze(Object.fromEntries(
    shelfFields(id, mode).map((field) => [field.id, field.parameterClass])));
  const contracts: Readonly<Record<string, OutputContract>> = Object.freeze(Object.fromEntries(
    initial.readings.map((reading) => [reading.id, Object.freeze({
      unit: reading.unit, semanticKind: reading.semanticKind, ownerId: "shelf-optics",
      statuses: Object.freeze(["value", "outside-domain"] as const),
    })])));
  const store = createInstanceStore({ experimentId: id, instanceId, initialParameters: checked.parameters,
    parameterClasses: classes, outputs: contracts, allowPartial: true });
  const publish = (token: RequestToken, outputs: readonly ScientificResult[]) => {
    const decision = store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs });
    if (!decision.accepted) throw new Error(`Shelf publication refused: ${decision.reason}`);
  };
  publish(store.issue("setup-change"), initial.outputs);
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    readings: initial.readings,
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const validation = validateShelfInput(id, mode, input);
      if (validation.kind !== "accepted") return validation;
      const next = validation.parameters;
      const previous = store.getSnapshot().accepted?.parameters ?? checked.parameters;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};
      for (const [key, value] of Object.entries(next)) {
        if (Object.is(value, previous[key])) continue;
        const target = classes[key] === "presentation" ? presentation : classes[key] === "observer" ? observer : setup;
        target[key] = value;
      }
      if (![setup, observer, presentation].some((patch) => Object.keys(patch).length)) return validation;
      // Evaluate BEFORE issuing requests. Exceptions cannot leave a pending partial update.
      const computed = evaluateShelf(id, mode, next);
      let token: RequestToken | null = null;
      if (Object.keys(setup).length) token = store.issue("setup-change", setup);
      if (Object.keys(observer).length) token = store.issue("observer-change", observer);
      if (Object.keys(presentation).length) token = store.issue("presentation-change", presentation);
      if (!token) throw new Error("Changed shelf settings produced no command.");
      publish(token, computed.outputs);
      return validation;
    },
  });
}
