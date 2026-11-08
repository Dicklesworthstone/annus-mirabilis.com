import { expect, test } from "bun:test";
import { BM02_CLASSES, BM02_OUTPUTS } from "../bm02/owner.ts";
import { validateBm02Parameters } from "../bm02/parameters.ts";
import {
  type Bm02Inputs,
  type Bm02Snapshot,
  computeBm02Snapshot,
  DEFAULT_BM02_INPUTS,
} from "../bm02/session.ts";
import { createLq02Session, LQ02_CLASSES, LQ02_OUTPUTS } from "../lq02/owner.ts";
import { validateLq02Parameters } from "../lq02/parameters.ts";
import { computeLq02Snapshot, DEFAULT_LQ02_INPUTS } from "../lq02/session.ts";
import { CalculationContractError, createCalculationSession } from "./calculationSession.ts";

function options(evaluate = computeBm02Snapshot) {
  return {
    experimentId: "bm-02",
    instanceId: "cached-calculation",
    initialParameters: DEFAULT_BM02_INPUTS,
    parameterClasses: BM02_CLASSES,
    outputs: { numberDensity: BM02_OUTPUTS.numberDensity },
    validate: validateBm02Parameters,
    evaluate,
    results: (snapshot: Bm02Snapshot) => [snapshot.numberDensity],
  };
}

test("subscribers and repeated reads never rerun the physical calculation", () => {
  let evaluations = 0;
  const session = createCalculationSession(
    options((parameters) => {
      evaluations++;
      return computeBm02Snapshot(parameters);
    }),
  );
  const unsubscribe = session.subscribe(() => {
    for (let i = 0; i < 10; i++) {
      session.getSnapshot();
      session.getCalculation();
    }
  });
  expect(evaluations).toBe(1);
  for (let i = 0; i < 100; i++) session.getCalculation();
  expect(evaluations).toBe(1);
  expect(session.apply({ Np: 2000 }).kind).toBe("accepted");
  expect(evaluations).toBe(2);
  expect(session.apply({ Np: 2000 }).kind).toBe("accepted");
  expect(evaluations).toBe(2);
  expect(session.startNewRun({ Np: 2000 }).kind).toBe("accepted");
  expect(evaluations).toBe(3);
  unsubscribe();
});

test("malformed-response: invalid prepared settings and illegal result data fail with a typed contract error", () => {
  for (const configuration of [
    { ...options(), initialParameters: { ...DEFAULT_BM02_INPUTS, T: 0 } },
    {
      ...options(),
      results: () => [
        {
          quantityId: "numberDensity",
          unit: "m-3",
          semanticKind: "particle-number-density",
          ownerId: "bm02.session",
          status: "value" as const,
          value: Number.NaN,
        },
      ],
    },
  ]) {
    try {
      createCalculationSession(configuration);
      throw new Error("Invalid initial owner data must not be published.");
    } catch (error) {
      expect(error).toBeInstanceOf(CalculationContractError);
      expect((error as CalculationContractError).code).toBe("malformed-response");
    }
  }
  expect(() =>
    createCalculationSession({
      ...options(),
      evaluate: () => ({ values: new Float64Array([1]) }),
      results: () => [],
    }),
  ).toThrow("mutable numeric buffer");
});

test("an evaluator failure keeps the last accepted calculation and reports an execution outcome", () => {
  const session = createCalculationSession(
    options((parameters: Bm02Inputs) => {
      if (parameters.Np === 2000) throw new Error("Injected evaluator failure");
      return computeBm02Snapshot(parameters);
    }),
  );
  const before = session.getSnapshot().accepted;
  const calculation = session.getCalculation();
  const response = session.apply({ Np: 2000 });
  expect(response.kind).toBe("outcome");
  expect(session.getSnapshot().outcome).toMatchObject({ outcome: "malformed-response" });
  expect(session.getSnapshot().pending).toBe(false);
  expect(session.getSnapshot().accepted).toBe(before);
  expect(session.getCalculation()).toBe(calculation);
  expect(session.acceptedParameters().Np).toBe(1000);
  expect(session.getSnapshot().requested?.parameters.Np).toBe(2000);
});

test("measurement recovery after a failed setup publishes results for its exact accepted parameters", () => {
  const session = createCalculationSession({
    experimentId: "lq-02",
    instanceId: "failed-setup-recovery",
    initialParameters: DEFAULT_LQ02_INPUTS,
    parameterClasses: LQ02_CLASSES,
    outputs: { meanResonatorEnergy: LQ02_OUTPUTS.meanResonatorEnergy },
    validate: validateLq02Parameters,
    evaluate: (parameters) => {
      if (parameters.T === 900) throw new Error("Injected failed temperature calculation");
      return computeLq02Snapshot(parameters);
    },
    results: (snapshot) => [
      {
        quantityId: "meanResonatorEnergy",
        unit: LQ02_OUTPUTS.meanResonatorEnergy.unit,
        semanticKind: LQ02_OUTPUTS.meanResonatorEnergy.semanticKind,
        ownerId: LQ02_OUTPUTS.meanResonatorEnergy.ownerId,
        status: "value" as const,
        value:
          snapshot.meanResonatorEnergy.status === "value"
            ? snapshot.meanResonatorEnergy.value
            : Number.NaN,
      },
    ],
  });
  const initial = session.getSnapshot().accepted;
  expect(session.apply({ T: 900 }).kind).toBe("outcome");
  expect(session.getSnapshot().accepted).toBe(initial);
  expect(session.getSnapshot().requested?.parameters.T).toBe(900);
  // An unchanged request is still different from the accepted calculation. It must really retry.
  expect(session.apply({ T: 900 }).kind).toBe("outcome");
  expect(session.getSnapshot().accepted).toBe(initial);
  const probeFrequency = DEFAULT_LQ02_INPUTS.probeFrequency / 2;
  expect(session.apply({ probeFrequency }).kind).toBe("accepted");
  const parameters = { ...DEFAULT_LQ02_INPUTS, probeFrequency };
  expect(session.acceptedParameters()).toEqual(parameters);
  expect(session.getSnapshot().requested?.parameters).toEqual(parameters);
  expect(session.getCalculation()).toEqual(computeLq02Snapshot(parameters));
  const energy = session
    .getSnapshot()
    .accepted?.outputs.find((output) => output.quantityId === "meanResonatorEnergy");
  expect(energy?.status).toBe("value");
  if (energy?.status !== "value") throw new Error("The recovered energy must be accepted.");
  const expected = computeLq02Snapshot(parameters).meanResonatorEnergy;
  if (expected.status !== "value") throw new Error("The independent energy must be finite.");
  expect(energy.value).toBe(expected.value);
  expect(session.getSnapshot().accepted?.revisions.measurement).toBe(1);
});

test("an exact retry after a transient evaluator failure computes the requested setup instead of reusing old data", () => {
  let attempts = 0;
  const session = createCalculationSession(
    options((parameters) => {
      if (parameters.Np === 2000 && ++attempts === 1)
        throw new Error("Injected transient evaluator failure");
      return computeBm02Snapshot(parameters);
    }),
  );
  const original = session.getCalculation();
  expect(session.apply({ Np: 2000 }).kind).toBe("outcome");
  expect(session.getCalculation()).toBe(original);
  expect(session.apply({ Np: 2000 }).kind).toBe("accepted");
  expect(attempts).toBe(2);
  const expected = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, Np: 2000 });
  expect(session.getCalculation()).toEqual(expected);
  expect(session.acceptedParameters().Np).toBe(2000);
  expect(session.getSnapshot().accepted?.outputs).toEqual([expected.numberDensity]);
});

test("a reentrant real laboratory calculation supersedes all remaining command classes of its caller", () => {
  const session = createLq02Session("reentrant-mode-allocation");
  let entered = false;
  let nestedKind = "";
  const unsubscribe = session.subscribe(() => {
    if (entered || !session.getSnapshot().pending) return;
    entered = true;
    nestedKind = session.apply({ T: 3000 }).kind;
  });
  const outer = session.apply({ nuCutoff: 2e14, probeFrequency: 3e13 });
  unsubscribe();
  expect(nestedKind).toBe("accepted");
  expect(outer.kind).toBe("outcome");
  if (outer.kind !== "outcome") throw new Error("The earlier request must be superseded.");
  expect(outer.outcome.outcome).toBe("superseded");
  const parameters = { ...DEFAULT_LQ02_INPUTS, T: 3000 };
  expect(session.acceptedParameters()).toEqual(parameters);
  expect(session.getCalculation()).toEqual(computeLq02Snapshot(parameters));
  expect(session.getSnapshot().pending).toBe(false);
  expect(session.getSnapshot().accepted?.revisions.measurement).toBe(0);
});
