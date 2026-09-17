import { parseResult } from "../../experiments/results/codec.ts";
import { createInstanceStore, type ExperimentView } from "../../experiments/store/instanceStore.ts";
import { type CountermodelCase, parseCountermodelCase } from "./caseSchema.ts";
import { caseOutputs, evaluateCountermodelCase } from "./cellEvaluator.ts";

export type PreparedCountermodelCase = Readonly<{
  case: CountermodelCase;
  sourceDigest: string;
  caseRevision: string;
  results: readonly string[];
}>;
export type CountermodelState = Readonly<{
  view: ExperimentView;
  active: readonly string[];
  live: boolean;
  message: string;
  lastCommand: "worked-example" | "observer-change" | "presentation-change";
}>;
/** Bounded closed-form host calculations, like SR-04; the real instance store owns publication. */
export function createCountermodelSession(instanceId: string, example: PreparedCountermodelCase) {
  const spec = parseCountermodelCase(example.case);
  if (
    !/^source:sha256:[a-f0-9]{64}$/u.test(example.sourceDigest) ||
    !/^[a-f0-9]{64}$/u.test(example.caseRevision)
  )
    throw new TypeError("The prepared case must identify its evaluator and content revision.");
  const store = createInstanceStore({
    experimentId: spec.id,
    instanceId,
    initialParameters: { beta: spec.defaultBeta },
    parameterClasses: { beta: "observer" },
    outputs: caseOutputs(spec),
  });
  const token = store.issue("setup-change");
  if (
    !store.publish({
      ...token,
      outputs: example.results.map(parseResult),
      stepIndex: 0,
      simulationTime: 0,
      final: true,
    }).accepted
  )
    throw new TypeError("Invalid prepared countermodel outputs.");
  let evaluations = 0;
  let state: CountermodelState = Object.freeze({
    view: store.getSnapshot(),
    active: Object.freeze(spec.tests.map((test) => test.id)),
    live: false,
    message: "Static worked example. The numbers were computed at build time.",
    lastCommand: "worked-example",
  });
  const serverState = state;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<CountermodelState>) => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  };
  return Object.freeze({
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getEvaluationCount: () => evaluations,
    apply(beta: unknown) {
      if (typeof beta !== "number" || !Number.isFinite(beta) || Math.abs(beta) > 0.95)
        return {
          ok: false as const,
          message:
            "Enter a finite observer speed v/c between -0.95 and 0.95. The accepted result is unchanged.",
        };
      // Compute before issuing so a failed evaluation never replaces accepted labels or values.
      let evaluated;
      try {
        evaluations++;
        evaluated = evaluateCountermodelCase(spec, beta);
      } catch {
        return {
          ok: false as const,
          message:
            "This calculation could not be completed. The previous accepted result is unchanged.",
        };
      }
      const request = store.issue("observer-change", { beta });
      const published = store.publish({ ...request, ...evaluated, final: true });
      if (!published.accepted)
        throw new Error("The countermodel publication did not match its request.");
      emit({
        view: store.getSnapshot(),
        live: true,
        lastCommand: "observer-change",
        message: `Accepted host calculation at v/c = ${beta}. The authored event list and test definitions are unchanged.`,
      });
      return { ok: true as const };
    },
    toggle(testId: string, enabled: boolean) {
      if (!spec.tests.some((test) => test.id === testId) || typeof enabled !== "boolean")
        throw new TypeError("Unknown presentation selection.");
      const active = spec.tests
        .filter((test) => (test.id === testId ? enabled : state.active.includes(test.id)))
        .map((test) => test.id);
      emit({
        active: Object.freeze(active),
        lastCommand: "presentation-change",
        message: active.length
          ? "Only the view changed. The selected requirements changed; every computed prediction and accepted identity is retained."
          : "No requirements are selected. Nothing is excluded by this empty selection; the computed predictions are unchanged.",
      });
    },
  });
}
