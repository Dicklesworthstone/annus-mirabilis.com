import { describe, expect, it } from "bun:test";
import type { ControlTape } from "../experiments/tape/controlTape.ts";
import { decideLabRestore } from "../reader/stack/restoreLab.ts";
import type { LabReference } from "../reader/stack/stackStore.ts";

function createMockTape(overrides: Partial<ControlTape> = {}): ControlTape {
  return {
    version: 1,
    tapeId: "tape-bm01-1",
    experimentId: "bm-01",
    modelIdentity: "bm-01@v1",
    tickS: 0.01,
    initialConditions: { temperature: 300, viscosity: 0.001 },
    seed: 42,
    totalTicks: 100,
    events: [],
    checkpoints: [
      {
        tick: 50,
        state: { x: 1.2, y: 3.4 },
        digest: "checkpoint-digest-1",
        digestKind: "host",
        label: "Midway checkpoint",
      },
    ],
    ...overrides,
  };
}

function createMockLab(overrides: Partial<LabReference> = {}): LabReference {
  return {
    instanceId: "bm-01:inst-1",
    experimentId: "bm-01",
    modelIdentity: "bm-01@v1",
    runId: "run-1",
    checkpointDigest: "checkpoint-digest-1",
    compactTape: "serialized-compact-tape",
    ...overrides,
  };
}

describe("restoreLab.integration (am-read-return-stack-oxa)", () => {
  it("reuses already mounted instance without checking checkpoint", () => {
    const decision = decideLabRestore({
      mounted: true,
      lab: createMockLab(),
      tape: createMockTape(),
      currentExperimentId: "bm-01",
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 42,
    });

    expect(decision).toEqual({ action: "reuse" });
  });

  it("restores unmounted instance from valid matching checkpoint", () => {
    const tape = createMockTape();
    const lab = createMockLab();

    const decision = decideLabRestore({
      mounted: false,
      lab,
      tape,
      currentExperimentId: "bm-01",
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 42,
    });

    expect(decision.action).toBe("restore");
    if (decision.action === "restore") {
      expect(decision.checkpoint.digest).toBe("checkpoint-digest-1");
      expect(decision.checkpoint.tick).toBe(50);
    }
  });

  it("produces new-run when seed changed", () => {
    const tape = createMockTape({ seed: 42 });
    const lab = createMockLab();

    const decision = decideLabRestore({
      mounted: false,
      lab,
      tape,
      currentExperimentId: "bm-01",
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 99, // Changed seed
    });

    expect(decision.action).toBe("new-run");
    if (decision.action === "new-run") {
      expect(decision.reason).toContain("seed");
    }
  });

  it("produces new-run when experimentId or modelIdentity changed", () => {
    const tape = createMockTape({ experimentId: "bm-01", modelIdentity: "bm-01@v1" });
    const lab = createMockLab({ experimentId: "bm-01", modelIdentity: "bm-01@v1" });

    const decision = decideLabRestore({
      mounted: false,
      lab,
      tape,
      currentExperimentId: "bm-02", // Incompatible experiment
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 42,
    });

    expect(decision.action).toBe("new-run");
  });

  it("produces new-run when checkpoint digest is missing from tape", () => {
    const tape = createMockTape({ checkpoints: [] });
    const lab = createMockLab({ checkpointDigest: "checkpoint-digest-1" });

    const decision = decideLabRestore({
      mounted: false,
      lab,
      tape,
      currentExperimentId: "bm-01",
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 42,
    });

    expect(decision.action).toBe("new-run");
    if (decision.action === "new-run") {
      expect(decision.reason).toContain("no checkpoint");
    }
  });

  it("produces new-run when lab or tape is null", () => {
    const noLab = decideLabRestore({
      mounted: false,
      lab: null,
      tape: null,
      currentExperimentId: "bm-01",
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 42,
    });
    expect(noLab.action).toBe("new-run");

    const noTape = decideLabRestore({
      mounted: false,
      lab: createMockLab(),
      tape: null,
      currentExperimentId: "bm-01",
      currentModelIdentity: "bm-01@v1",
      expectedSeed: 42,
    });
    expect(noTape.action).toBe("new-run");
  });
});
