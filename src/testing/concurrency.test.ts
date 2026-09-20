import { describe, expect, test } from "bun:test";
import {
  HeavyLaboratoryManager,
  type ReplayableLabState,
} from "../experiments/lifecycle/concurrency.ts";
import { HeavyFixtureLaboratory } from "./runtime-fixtures/heavyFixture.ts";

describe("Heavy laboratory concurrency limits and LRU suspension", () => {
  test("exceeding limit suspends least recently used laboratory", () => {
    const manager = new HeavyLaboratoryManager(2);

    const suspendedLogs: string[] = [];
    const resumedLogs: string[] = [];

    const lab1 = new HeavyFixtureLaboratory({ id: "lab-1" });
    const lab2 = new HeavyFixtureLaboratory({ id: "lab-2" });
    const lab3 = new HeavyFixtureLaboratory({ id: "lab-3" });

    lab1.mount();
    lab2.mount();
    lab3.mount();

    // Register lab-1 at t=0
    manager.register(
      lab1.id,
      () => lab1.serializeState(),
      (state) => suspendedLogs.push(state.laboratoryId),
      (state) => resumedLogs.push(state.laboratoryId),
    );
    expect(manager.activeCount).toBe(1);
    expect(manager.suspendedCount).toBe(0);

    // Register lab-2
    manager.register(
      lab2.id,
      () => lab2.serializeState(),
      (state) => suspendedLogs.push(state.laboratoryId),
      (state) => resumedLogs.push(state.laboratoryId),
    );
    expect(manager.activeCount).toBe(2);
    expect(manager.suspendedCount).toBe(0);

    // Register lab-3 (limit is 2 -> lab-1 was oldest -> lab-1 is suspended)
    manager.register(
      lab3.id,
      () => lab3.serializeState(),
      (state) => suspendedLogs.push(state.laboratoryId),
      (state) => resumedLogs.push(state.laboratoryId),
    );
    expect(manager.activeCount).toBe(2);
    expect(manager.suspendedCount).toBe(1);
    expect(suspendedLogs).toEqual(["lab-1"]);

    // Touch lab-1 -> brings it back, displacing lab-2 (since lab-2 is now LRU)
    manager.touch("lab-1");
    expect(manager.activeCount).toBe(2);
    expect(manager.suspendedCount).toBe(1);
    expect(resumedLogs).toEqual(["lab-1"]);
    expect(suspendedLogs).toEqual(["lab-1", "lab-2"]);

    lab1.unmount();
    lab2.unmount();
    lab3.unmount();
  });

  test("resumed laboratory achieves bitwise identical scientific digest to un-suspended reference run", () => {
    // 1. Run reference lab continuously for 20 steps
    const refLab = new HeavyFixtureLaboratory({
      id: "ref-run",
      seed: "42000000",
      particleCount: 50,
    });
    refLab.mount();
    refLab.step(20);
    const expectedFinalState = refLab.serializeState();
    refLab.unmount();

    // 2. Run test lab for 10 steps, suspend it via manager, then resume it and run 10 more steps
    const manager = new HeavyLaboratoryManager(1); // limit 1
    let savedStateHolder: ReplayableLabState | null = null;

    const testLab = new HeavyFixtureLaboratory({
      id: "test-run",
      seed: "42000000",
      particleCount: 50,
    });
    testLab.mount();

    manager.register(
      testLab.id,
      () => testLab.serializeState(),
      (state) => {
        savedStateHolder = state;
      },
      (_state) => {
        // Resumed
      },
    );

    testLab.step(10);
    const midState = testLab.serializeState();
    expect(midState.simulatedTime).toBeCloseTo(0.1, 5);

    // Introduce another lab to trigger suspension of testLab
    const otherLab = new HeavyFixtureLaboratory({
      id: "other-lab",
      seed: "999",
      particleCount: 10,
    });
    otherLab.mount();
    manager.register(
      otherLab.id,
      () => otherLab.serializeState(),
      () => {},
      () => {},
    );

    expect(manager.activeCount).toBe(1);
    expect(savedStateHolder).not.toBeNull();
    expect((savedStateHolder as unknown as ReplayableLabState).laboratoryId).toBe(testLab.id);

    // Resume testLab
    manager.touch(testLab.id);
    expect(manager.activeCount).toBe(1);

    // Continue the remaining 10 steps
    testLab.step(10);
    const actualFinalState = testLab.serializeState();

    // Scientific digest (incorporating simulatedTime, stepCount, and particle positions)
    // must equal the un-suspended reference run exactly!
    expect(actualFinalState.simulatedTime).toBe(expectedFinalState.simulatedTime);
    expect(actualFinalState.streamIndex).toBe(expectedFinalState.streamIndex);
    expect(actualFinalState.scientificDigest).toBe(
      expectedFinalState.scientificDigest.replace("ref-run", "test-run"),
    );

    testLab.unmount();
    otherLab.unmount();
  });
});
