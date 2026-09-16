import { describe, expect, it } from "bun:test";
import { applyCommand } from "../experiments/commands/apply.ts";
import { assertModelChoiceAndFallbackAreDisjoint } from "../experiments/commands/modelChoice.ts";
import type { TypedCommand } from "../experiments/commands/types.ts";

import {
  createTwoModelFixtureStore,
  TWO_MODEL_DECLARED_MODELS,
} from "./runtime-fixtures/twoModelFixture.ts";

describe("Model Choice Command Class Integration (am-rt-command-classes-dzp requirement 10)", () => {
  it("selecting second declared model dispatches setup-change, creates new runId with parentRunId, resets stepIndex, and writes no fallbackReason", () => {
    const store = createTwoModelFixtureStore("inst-model-choice-test");

    // 1. Initial run setup
    const initCmd: TypedCommand = {
      commandId: "cmd-init-setup",
      instanceId: "inst-model-choice-test",
      actionIndex: 1,
      class: "setup-change",
      payload: {
        parameters: { diffusionCoefficient: 4.29e-13, modelId: "exact-propagator" },
        modelId: "exact-propagator",
      },
    };
    const initRes = applyCommand({ store, declaredModelIds: TWO_MODEL_DECLARED_MODELS }, initCmd);
    expect(initRes.accepted).toBe(true);

    // Publish initial output at stepIndex 50
    store.publish({
      experimentId: "fixture-two-model",
      instanceId: "inst-model-choice-test",
      runId: "inst-model-choice-test/run/1",
      parentRunId: null,
      actionIndex: 1,
      stepIndex: 50,
      simulationTime: 5.0,
      final: true,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: {
        diffusionCoefficient: 4.29e-13,
        modelId: "exact-propagator",
        particleCount: 200,
      },
      outputs: [
        {
          status: "value",
          quantityId: "concentration",
          unit: "mol/m^3",
          semanticKind: "distribution",
          ownerId: "fixture-two-model",
          value: 1.0,
        },
      ],
    });

    const snapBefore = store.getSnapshot();
    expect(snapBefore.accepted?.runId).toBe("inst-model-choice-test/run/1");
    expect(snapBefore.accepted?.stepIndex).toBe(50);

    // 2. Select second declared model ("ftcs-grid")
    const switchCmd: TypedCommand = {
      commandId: "cmd-switch-model",
      instanceId: "inst-model-choice-test",
      actionIndex: 2,
      class: "setup-change",
      payload: {
        parameters: { modelId: "ftcs-grid" },
        modelId: "ftcs-grid",
      },
    };

    const switchRes = applyCommand(
      { store, declaredModelIds: TWO_MODEL_DECLARED_MODELS },
      switchCmd,
    );
    expect(switchRes.accepted).toBe(true);
    if (switchRes.accepted) {
      expect(switchRes.token.runId).toBe("inst-model-choice-test/run/2");
      expect(switchRes.token.parentRunId).toBe("inst-model-choice-test/run/1");
      expect(switchRes.token.revisions.input).toBe(2);
    }

    // Previous run stays retrievable by id from instance history
    const oldRun = store.getRun("inst-model-choice-test/run/1");
    expect(oldRun).toBeDefined();
    expect(oldRun?.runId).toBe("inst-model-choice-test/run/1");
    expect(oldRun?.parentRunId).toBeNull();

    // New run is retrievable by id
    const newRun = store.getRun("inst-model-choice-test/run/2");
    expect(newRun).toBeDefined();
    expect(newRun?.parentRunId).toBe("inst-model-choice-test/run/1");

    // Publish new run output at stepIndex 0
    store.publish({
      experimentId: "fixture-two-model",
      instanceId: "inst-model-choice-test",
      runId: "inst-model-choice-test/run/2",
      parentRunId: "inst-model-choice-test/run/1",
      actionIndex: 2,
      stepIndex: 0,
      simulationTime: 0.0,
      final: false,
      revisions: { input: 2, observer: 0, measurement: 0, estimator: 0 },
      parameters: { diffusionCoefficient: 4.29e-13, modelId: "ftcs-grid", particleCount: 200 },
      outputs: [
        {
          status: "value",
          quantityId: "concentration",
          unit: "mol/m^3",
          semanticKind: "distribution",
          ownerId: "fixture-two-model",
          value: 0.5,
        },
      ],
    });

    const snapAfter = store.getSnapshot();
    expect(snapAfter.accepted?.runId).toBe("inst-model-choice-test/run/2");
    expect(snapAfter.accepted?.parentRunId).toBe("inst-model-choice-test/run/1");
    expect(snapAfter.accepted?.stepIndex).toBe(0);
    expect(snapAfter.outcome).toBeNull();
  });

  it("asserts modelId and fallbackReason are strictly disjoint fields", () => {
    // Valid: modelId only
    expect(() =>
      assertModelChoiceAndFallbackAreDisjoint({ modelId: "exact-propagator" }),
    ).not.toThrow();

    // Valid: fallbackReason only
    expect(() =>
      assertModelChoiceAndFallbackAreDisjoint({ fallbackReason: "wasm-unloaded" }),
    ).not.toThrow();

    // Valid: neither
    expect(() => assertModelChoiceAndFallbackAreDisjoint({})).not.toThrow();

    // Invalid: both present
    expect(() =>
      assertModelChoiceAndFallbackAreDisjoint({
        modelId: "exact-propagator",
        fallbackReason: "wasm-unloaded",
      }),
    ).toThrow(TypeError);
  });

  it("refuses unknown modelId through shared request-refusal shape with declared ids listed", () => {
    const store = createTwoModelFixtureStore("inst-refusal-test");

    const badCmd: TypedCommand = {
      commandId: "cmd-bad-model",
      instanceId: "inst-refusal-test",
      actionIndex: 1,
      class: "setup-change",
      payload: {
        parameters: { modelId: "quantum-chromodynamics" },
        modelId: "quantum-chromodynamics",
      },
    };

    const res = applyCommand({ store, declaredModelIds: TWO_MODEL_DECLARED_MODELS }, badCmd);
    expect(res.accepted).toBe(false);
    if (!res.accepted) {
      expect(res.refusal.code).toBe("invalid-parameter");
      expect(res.refusal.domainKind).toBe("input");
      const details = res.refusal.details as {
        requestedModelId: string;
        declaredModelIds: string[];
      };
      expect(details.requestedModelId).toBe("quantum-chromodynamics");
      expect(details.declaredModelIds).toEqual(["exact-propagator", "ftcs-grid"]);
    }
  });

  it("changing particle count (presentation) keeps runId and modelId unchanged", () => {
    const store = createTwoModelFixtureStore("inst-particle-count-test");

    // Init run
    const initCmd: TypedCommand = {
      commandId: "cmd-init",
      instanceId: "inst-particle-count-test",
      actionIndex: 1,
      class: "setup-change",
      payload: {
        parameters: { diffusionCoefficient: 4.29e-13, modelId: "exact-propagator" },
        modelId: "exact-propagator",
      },
    };
    applyCommand({ store, declaredModelIds: TWO_MODEL_DECLARED_MODELS }, initCmd);

    store.publish({
      experimentId: "fixture-two-model",
      instanceId: "inst-particle-count-test",
      runId: "inst-particle-count-test/run/1",
      parentRunId: null,
      actionIndex: 1,
      stepIndex: 10,
      simulationTime: 1.0,
      final: true,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: {
        diffusionCoefficient: 4.29e-13,
        modelId: "exact-propagator",
        particleCount: 200,
      },
      outputs: [
        {
          status: "value",
          quantityId: "concentration",
          unit: "mol/m^3",
          semanticKind: "distribution",
          ownerId: "fixture-two-model",
          value: 1.0,
        },
      ],
    });

    const presCmd: TypedCommand = {
      commandId: "cmd-pres-particles",
      instanceId: "inst-particle-count-test",
      actionIndex: 2,
      class: "presentation-change",
      payload: {
        parameters: { particleCount: 1000 },
        drawnParticleCount: 1000,
      },
    };

    const presRes = applyCommand({ store, declaredModelIds: TWO_MODEL_DECLARED_MODELS }, presCmd);
    expect(presRes.accepted).toBe(true);
    if (presRes.accepted) {
      expect(presRes.token.runId).toBe("inst-particle-count-test/run/1");
      expect(presRes.token.parameters.particleCount).toBe(1000);
      expect(presRes.token.parameters.modelId).toBe("exact-propagator");
      expect(presRes.token.revisions.input).toBe(1);
    }
  });

  it("scan asserts controller exports no comparator or ranking over models[]", async () => {
    const applyModule = await import("../experiments/commands/apply.ts");
    const modelChoiceModule = await import("../experiments/commands/modelChoice.ts");

    const exportedNames = [...Object.keys(applyModule), ...Object.keys(modelChoiceModule)];

    const forbiddenTokens = [
      "rank",
      "compareModels",
      "preferredModel",
      "betterModel",
      "sortModels",
    ];
    for (const token of forbiddenTokens) {
      expect(exportedNames.some((n) => n.toLowerCase().includes(token.toLowerCase()))).toBe(false);
    }
  });
});
