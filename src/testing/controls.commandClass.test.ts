import { describe, expect, test } from "bun:test";
import { applyCommand } from "../experiments/commands/apply.ts";
import type { TypedCommand } from "../experiments/commands/types.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { FIXTURE_PARAMETER_SPECS } from "./e2e/fixture-apps/controls-kit/index.ts";

describe("Parameter Controls Command Class Dispatch (am-inst-parameter-controls-cmj9, am-rt-command-classes-dzp)", () => {
  test("every fixture parameter declares a valid command class", () => {
    const validClasses = new Set([
      "setup-change",
      "physical-intervention",
      "observer-change",
      "measurement-change",
      "estimator-change",
      "presentation-change",
    ]);

    for (const spec of FIXTURE_PARAMETER_SPECS) {
      expect(validClasses.has(spec.commandClass)).toBe(true);
    }
  });

  test("dispatches typed commands through the real command controller to the store", () => {
    const store = createInstanceStore({
      experimentId: "controls-kit",
      instanceId: "inst-ck-1",
      initialParameters: {
        seed: "1905",
        T: 290.15,
        eta: 0.00135,
        a: 5e-7,
        h: 0.02,
        interval: 1.0,
        d: 1,
        D: 0.3158,
        statistic: 1,
      },
      parameterClasses: {
        seed: "input",
        T: "input",
        eta: "input",
        a: "input",
        h: "input",
        interval: "measurement",
        d: "measurement",
        D: "presentation",
        statistic: "estimator",
      },
      outputs: {
        tracerPositions: {
          statuses: ["value"],
          unit: "m",
          semanticKind: "distribution",
          ownerId: "ref",
        },
      },
    });

    // 1. Dispatch setup-change (e.g. changing Temperature T)
    const setupCmd: TypedCommand = {
      commandId: "cmd-1",
      instanceId: "inst-ck-1",
      actionIndex: 1,
      class: "setup-change",
      payload: {
        parameters: { T: 300.0 },
      },
    };

    const res1 = applyCommand({ store }, setupCmd);
    expect(res1.accepted).toBe(true);
    if (res1.accepted) {
      expect(res1.token.revisions.input).toBe(1);
      expect(res1.token.parameters.T).toBe(300.0);
    }

    // 2. Dispatch measurement-change (e.g. changing observation interval)
    const measCmd: TypedCommand = {
      commandId: "cmd-2",
      instanceId: "inst-ck-1",
      actionIndex: 2,
      class: "measurement-change",
      payload: {
        parameters: { interval: 2.0 },
        observationInterval: 2.0,
      },
    };

    const res2 = applyCommand({ store }, measCmd);
    expect(res2.accepted).toBe(true);
    if (res2.accepted) {
      expect(res2.token.revisions.measurement).toBe(1);
      expect(res2.token.revisions.input).toBe(1); // input revision stays fixed
      expect(res2.token.parameters.interval).toBe(2.0);
    }

    // 3. Dispatch estimator-change (e.g. changing statistic)
    const estCmd: TypedCommand = {
      commandId: "cmd-3",
      instanceId: "inst-ck-1",
      actionIndex: 3,
      class: "estimator-change",
      payload: {
        parameters: { statistic: 2 },
      },
    };

    const res3 = applyCommand({ store }, estCmd);
    expect(res3.accepted).toBe(true);
    if (res3.accepted) {
      expect(res3.token.revisions.estimator).toBe(1);
      expect(res3.token.parameters.statistic).toBe(2);
    }
  });
});
