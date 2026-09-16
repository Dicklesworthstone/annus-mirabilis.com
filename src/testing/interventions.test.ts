/**
 * Interventions contract test suite (am-rt-command-classes-dzp).
 *
 * "forward intervention keeps runId; backdated intervention forks with parentRunId and
 * forkedAtSimulatedTime, leaving the parent's accepted history untouched."
 */
import { describe, expect, it } from "bun:test";
import { applyCommand } from "../experiments/commands/apply.ts";
import type { TypedCommand } from "../experiments/commands/types.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";

describe("Physical Interventions Contract (am-rt-command-classes-dzp)", () => {
  function createStore() {
    return createInstanceStore({
      experimentId: "inst-intervention-test",
      instanceId: "inst-intervention",
      initialParameters: { potentialBarrier: 0.0, temperature: 300 },
      parameterClasses: { potentialBarrier: "input", temperature: "input" },
      outputs: {
        flux: {
          statuses: ["value"],
          unit: "1/s",
          semanticKind: "scalar",
          ownerId: "inst-intervention-test",
        },
      },
    });
  }

  it("forward intervention keeps runId and advances simulation without forking", () => {
    const store = createStore();

    // 1. Initial setup
    const token1 = store.issue("setup-change", { potentialBarrier: 0.0 });
    store.publish({
      experimentId: "inst-intervention-test",
      instanceId: "inst-intervention",
      runId: token1.runId,
      parentRunId: null,
      actionIndex: 1,
      stepIndex: 10,
      simulationTime: 2.0,
      final: false,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { potentialBarrier: 0.0, temperature: 300 },
      outputs: [
        {
          status: "value",
          quantityId: "flux",
          unit: "1/s",
          semanticKind: "scalar",
          ownerId: "inst-intervention-test",
          value: 100.0,
        },
      ],
    });

    // 2. Forward physical intervention at t = 2.5 >= 2.0
    const cmd: TypedCommand = {
      commandId: "cmd-fwd-intervention",
      instanceId: "inst-intervention",
      actionIndex: 2,
      class: "physical-intervention",
      payload: {
        parameters: { potentialBarrier: 5.0 },
        atSimulatedTime: 2.5,
      },
    };

    const res = applyCommand({ store }, cmd);
    expect(res.accepted).toBe(true);
    if (res.accepted) {
      expect(res.token.runId).toBe(token1.runId);
      expect(res.token.revisions.input).toBe(2);
      expect(res.token.parameters.potentialBarrier).toBe(5.0);
    }
  });

  it("backdated intervention forks new run with parentRunId and forkedAtSimulatedTime", () => {
    const store = createStore();

    // 1. Initial setup and run to t = 5.0
    const token1 = store.issue("setup-change", { potentialBarrier: 0.0 });
    store.publish({
      experimentId: "inst-intervention-test",
      instanceId: "inst-intervention",
      runId: token1.runId,
      parentRunId: null,
      actionIndex: 1,
      stepIndex: 50,
      simulationTime: 5.0,
      final: true,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { potentialBarrier: 0.0, temperature: 300 },
      outputs: [
        {
          status: "value",
          quantityId: "flux",
          unit: "1/s",
          semanticKind: "scalar",
          ownerId: "inst-intervention-test",
          value: 100.0,
        },
      ],
    });

    // 2. Backdated intervention at t = 1.5 < 5.0

    const cmd: TypedCommand = {
      commandId: "cmd-backdated-intervention",
      instanceId: "inst-intervention",
      actionIndex: 2,
      class: "physical-intervention",
      payload: {
        parameters: { potentialBarrier: 10.0 },
        atSimulatedTime: 1.5,
      },
    };

    const res = applyCommand({ store }, cmd);
    expect(res.accepted).toBe(true);
    if (res.accepted) {
      expect(res.token.runId).not.toBe(token1.runId);
      expect(res.token.parentRunId).toBe(token1.runId);
      expect(res.token.revisions.input).toBe(2);
    }

    // Check recorded lineage in runs
    const forkedRun = store.getRun(res.accepted ? res.token.runId : "");
    expect(forkedRun).toBeDefined();
    expect(forkedRun?.parentRunId).toBe(token1.runId);
    expect(forkedRun?.forkedAtSimulatedTime).toBe(1.5);

    // Parent run record remains untouched
    const parentRun = store.getRun(token1.runId);
    expect(parentRun).toBeDefined();
    expect(parentRun?.runId).toBe(token1.runId);
    expect(parentRun?.forkedAtSimulatedTime).toBeNull();
  });
});
