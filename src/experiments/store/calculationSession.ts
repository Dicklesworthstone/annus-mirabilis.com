import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import type { ScientificResult } from "../results/types.ts";
import {
  type Command,
  createInstanceStore,
  type OutputContract,
  type ParameterClass,
  type Parameters,
  type RequestToken,
} from "./instanceStore.ts";

const commands: Readonly<Record<ParameterClass, Command>> = Object.freeze({
  input: "setup-change",
  observer: "observer-change",
  measurement: "measurement-change",
  estimator: "estimator-change",
  presentation: "presentation-change",
});

/** A broken evaluator or prepared example is an execution failure, never a scientific result. */
export class CalculationContractError extends TypeError {
  readonly code = "malformed-response";
  constructor(message: string) {
    super(message);
    this.name = "CalculationContractError";
  }
}
export function rejectCalculation(message: string): never {
  throw new CalculationContractError(message);
}

/** These calculations expose scalar records, never mutable scientific buffers. */
function immutable<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    if (ArrayBuffer.isView(value))
      rejectCalculation("A scalar calculation cannot expose a mutable numeric buffer.");
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * One owner for a small, synchronous calculation. React reads a cached accepted calculation;
 * editing a form, changing explanation detail, and subscribing never evaluate its physics.
 * The result projection and the detailed readout are produced by the same owner call.
 */
export function createCalculationSession<P extends Parameters, D>(options: {
  experimentId: string;
  instanceId: string;
  initialParameters: P;
  parameterClasses: Readonly<Record<keyof P & string, ParameterClass>>;
  outputs: Readonly<Record<string, OutputContract>>;
  validate(input: unknown): Computation<P>;
  evaluate(parameters: P): D;
  results(calculation: D): readonly ScientificResult[];
}) {
  const checked = options.validate(options.initialParameters);
  if (checked.kind !== "accepted")
    rejectCalculation(`${options.experimentId}: the initial example is not admissible.`);
  const initialParameters = checked.data;
  const store = createInstanceStore({
    experimentId: options.experimentId,
    instanceId: options.instanceId,
    initialParameters,
    parameterClasses: options.parameterClasses,
    outputs: options.outputs,
    allowPartial: true,
  });
  // A restored checkpoint has another immutable parameter record. It is evaluated at most once
  // by this owner, when a readout first needs it; an ordinary render reuses the identical record.
  const calculations = new WeakMap<Parameters, D>();
  const initial = immutable(options.evaluate(initialParameters));
  const first = store.issue("setup-change");
  calculations.set(first.parameters, initial);
  const admitted = store.publish({
    ...first,
    outputs: options.results(initial),
    stepIndex: 0,
    simulationTime: 0,
    final: true,
  });
  if (!admitted.accepted)
    rejectCalculation(`${options.experimentId}: initial publication failed: ${admitted.reason}`);
  const serverSnapshot = store.getSnapshot();

  function acceptedParameters(): P {
    return (store.getSnapshot().accepted?.parameters ?? initialParameters) as P;
  }
  function getCalculation(): D {
    const parameters = acceptedParameters();
    const cached = calculations.get(parameters);
    if (cached !== undefined) return cached;
    const calculation = immutable(options.evaluate(parameters));
    calculations.set(parameters, calculation);
    return calculation;
  }
  function apply(input: unknown, forceNewRun: boolean): Computation<RequestToken> {
    const current = acceptedParameters();
    const merged =
      input !== null && typeof input === "object" && !Array.isArray(input)
        ? { ...current, ...input }
        : input;
    const validation = options.validate(merged);
    if (validation.kind !== "accepted") return validation;
    const parameters = validation.data;
    const acceptedChanged = Object.keys(parameters).some(
      (key) => !Object.is(current[key], parameters[key]),
    );
    // A failed evaluator keeps the accepted point, but its requested parameters may be ahead.
    // Reconcile every command against that request so recovery cannot publish old-input results
    // under a failed setup's identity when the reader next changes only a measurement.
    const requested = store.getSnapshot().requested?.parameters ?? current;
    const changes = new Map<ParameterClass, Record<string, number | string | boolean>>();
    for (const key of Object.keys(parameters) as (keyof P & string)[]) {
      if (Object.is(requested[key], parameters[key])) continue;
      const value = parameters[key];
      if (value === undefined) rejectCalculation(`Missing validated parameter: ${key}.`);
      const category = options.parameterClasses[key];
      const patch = changes.get(category) ?? {};
      patch[key] = value;
      changes.set(category, patch);
    }
    let request: RequestToken | null = null;
    const superseded = () => ({
      kind: "outcome" as const,
      outcome: { outcome: "superseded" as const, ...executionOutcomeRegistry.superseded },
    });
    // An explicit new run forks even when only a measurement changed or all inputs are equal.
    // Other command classes retain their own revisions and never become physical input patches.
    for (const category of Object.keys(commands) as ParameterClass[]) {
      const patch = changes.get(category);
      if (patch || (category === "input" && forceNewRun)) {
        request = store.issue(commands[category], patch ?? {});
        // Store subscribers may issue a newer calculation synchronously. An old invocation must
        // stop before another command class could attach its controls to that newer run.
        if (store.getSnapshot().requested !== request) return superseded();
      }
    }
    request ??= store.issue("continue");
    if (store.getSnapshot().requested !== request) return superseded();
    let calculation: D;
    let outputs: readonly ScientificResult[];
    try {
      calculation =
        acceptedChanged || forceNewRun ? immutable(options.evaluate(parameters)) : getCalculation();
      outputs = options.results(calculation);
    } catch (error) {
      if (store.getSnapshot().requested !== request) return superseded();
      const outcome = {
        outcome: "malformed-response" as const,
        ...executionOutcomeRegistry["malformed-response"],
        details: { reason: error instanceof Error ? error.message : String(error) },
      };
      store.fail(request, outcome);
      return { kind: "outcome", outcome };
    }
    if (store.getSnapshot().requested !== request) return superseded();
    calculations.set(request.parameters, calculation);
    const publication = store.publish({
      ...request,
      outputs,
      // This is an algebraic evaluation, not a simulated time step or a count of UI events.
      stepIndex: 0,
      simulationTime: 0,
      final: true,
    });
    if (!publication.accepted) {
      const outcome = {
        outcome: "invariant-violation" as const,
        ...executionOutcomeRegistry["invariant-violation"],
        details: { reason: publication.reason },
      };
      store.fail(request, outcome);
      return { kind: "outcome", outcome };
    }
    return { kind: "accepted", data: request };
  }
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    exportCheckpoint: store.exportCheckpoint,
    restoreCheckpoint: store.restoreCheckpoint,
    getCalculation,
    acceptedParameters,
    apply: (input: unknown) => apply(input, false),
    startNewRun: (input: unknown) => apply(input, true),
    stop() {},
    disconnect() {},
  });
}
