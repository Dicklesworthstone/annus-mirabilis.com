/** Runs declared tests through the numerical owners. Cases supply inputs, never verdicts. */

import type { ScientificResult } from "../../experiments/results/types.ts";
import type { OutputContract } from "../../experiments/store/instanceStore.ts";
import {
  countermodelEventMap,
  galileanCompose,
  lorentzCompositionResidual,
  mappedClockRate,
  mappedRodLength,
  mappedWorldlineSpeed,
} from "../../physics/reference/countermodels.ts";
import {
  type Event,
  type KinematicResult,
  speedOfLightMetresPerSecond,
} from "../../physics/reference/kinematics.ts";
import {
  type CountermodelCase,
  type CountermodelTest,
  parseCountermodelCase,
  testUnit,
} from "./caseSchema.ts";

export const OUTPUT_PARTS = ["Values", "Reference", "Residual"] as const;
export function cellQuantity(
  candidate: number,
  test: number,
  part: (typeof OUTPUT_PARTS)[number],
): string {
  return `candidate${candidate}Test${test}${part}`;
}
export function caseOutputs(spec: CountermodelCase): Readonly<Record<string, OutputContract>> {
  const entries: [string, OutputContract][] = [];
  spec.candidates.forEach((candidate, i) => {
    spec.tests.forEach((test, j) => {
      OUTPUT_PARTS.forEach((part) => {
        entries.push([
          cellQuantity(i, j, part),
          {
            unit: testUnit(test.test),
            semanticKind: `countermodel-${part.toLowerCase()}`,
            ownerId: `countermodels.${candidate.id}.${test.test}`,
            statuses: ["value", "outside-domain"],
          },
        ]);
      });
    });
  });
  return Object.freeze(Object.fromEntries(entries));
}
export function cellSampleLabels(test: CountermodelTest): readonly string[] {
  return test.inputs.events
    ? test.inputs.events.flatMap((event) =>
        ["ct", "x", "y", "z"].map((axis) => `${event.id}: ${axis}`),
      )
    : [test.label];
}
class UnavailablePrediction extends Error {
  readonly result: Extract<KinematicResult<never>, { status: "outside-domain" }>;
  constructor(result: Extract<KinematicResult<never>, { status: "outside-domain" }>) {
    super(result.reason);
    this.result = result;
  }
}
function value<T>(result: KinematicResult<T>): T {
  if (result.status !== "value") throw new UnavailablePrediction(result);
  return result.value;
}
const components = (event: Event, c: number): number[] => [event.t * c, event.x, event.y, event.z];

function predictions(
  spec: CountermodelCase,
  i: number,
  test: CountermodelTest,
  beta: number,
  c: number,
): number[] {
  const candidate = spec.candidates[i];
  if (!candidate) throw new TypeError("Unknown candidate index.");
  const map = (event: Event, b: number, light: number) =>
    countermodelEventMap(candidate.id, event, b, light);
  const p = test.inputs;
  switch (test.test) {
    case "low-speed":
      return [
        candidate.id === "galilean"
          ? value(galileanCompose(p.u as number, p.v as number, c))
          : value(mappedWorldlineSpeed(map, p.u as number, -(p.v as number) / c, c)),
      ];
    case "light-speed":
      return [value(mappedWorldlineSpeed(map, c, beta, c))];
    case "inverse":
      return (p.events ?? []).flatMap((event) =>
        components(value(map(value(map(event, beta, c)), -beta, c)), c),
      );
    case "events":
      return (p.events ?? []).flatMap((event) => components(value(map(event, beta, c)), c));
    case "rod":
      return [value(mappedRodLength(map, p.properLength as number, beta, c))];
    case "clock":
      return [value(mappedClockRate(map, beta, c))];
    case "composition":
      return [value(mappedWorldlineSpeed(map, (p.worldlineBeta as number) * c, -beta, c))];
  }
}
export type CountermodelEvaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: 0;
  simulationTime: 0;
}>;
export function evaluateCountermodelCase(
  input: CountermodelCase,
  beta: number,
): CountermodelEvaluation {
  const spec = parseCountermodelCase(input);
  if (!Number.isFinite(beta) || Math.abs(beta) > 0.95)
    throw new RangeError(
      "Use an observer speed v/c between -0.95 and 0.95 for this bounded comparison.",
    );
  const c = speedOfLightMetresPerSecond();
  const contracts = caseOutputs(spec),
    outputs: ScientificResult[] = [];
  spec.tests.forEach((test, j) => {
    // Each candidate is evaluated separately, exactly once per test.
    const calculated = spec.candidates.map((_, i) => {
      try {
        return { values: predictions(spec, i, test, beta, c) };
      } catch (error) {
        if (error instanceof UnavailablePrediction) return { failure: error.result };
        throw error;
      }
    });
    spec.candidates.forEach((candidate, i) => {
      const actual = calculated[i],
        other = calculated[1 - i];
      let reference: number[];
      if (test.kind === "observation") reference = other?.values ?? [];
      else if (test.test === "low-speed")
        reference = [value(galileanCompose(test.inputs.u as number, test.inputs.v as number, c))];
      else if (test.test === "light-speed") reference = [c];
      else reference = (test.inputs.events ?? []).flatMap((event) => components(event, c));
      const failure = actual?.failure ?? (test.kind === "observation" ? other?.failure : undefined);
      const values = actual?.values ?? [];
      const residuals = values.map((n, k) => n - (reference[k] ?? NaN));
      if (test.test === "low-speed" && candidate.id === "lorentz") {
        residuals[0] = -value(
          lorentzCompositionResidual(test.inputs.u as number, test.inputs.v as number, c),
        );
      }
      OUTPUT_PARTS.forEach((part, k) => {
        const quantityId = cellQuantity(i, j, part),
          contract = contracts[quantityId];
        if (!contract) throw new TypeError("Missing countermodel output contract.");
        const common = {
          quantityId,
          unit: contract.unit,
          semanticKind: contract.semanticKind,
          ownerId: contract.ownerId,
        };
        if (failure)
          outputs.push({
            ...common,
            ...failure,
            boundary: { alternativeModel: "Choose inputs within the stated numerical domain." },
          });
        else {
          const data = [values, reference, residuals][k];
          if (
            !data ||
            data.length !== cellSampleLabels(test).length ||
            !data.every(Number.isFinite)
          )
            throw new RangeError(
              "Countermodel outputs must be finite and have the declared sample layout.",
            );
          outputs.push({ ...common, status: "value", value: Float64Array.from(data) });
        }
      });
    });
  });
  return { outputs, stepIndex: 0, simulationTime: 0 };
}
