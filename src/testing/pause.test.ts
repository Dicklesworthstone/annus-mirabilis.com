import { describe, expect, test } from "bun:test";
import { type PauseReason, VisibilityCoordinator } from "../experiments/lifecycle/visibility.ts";
import { HeavyFixtureLaboratory } from "./runtime-fixtures/heavyFixture.ts";

describe("Visibility, pagehide, and reduced-motion pausing", () => {
  test("document-hidden, off-screen, and pagehide pause stepping and record reason", () => {
    const pauseReasons: PauseReason[] = [];
    let resumeCount = 0;

    const coordinator = new VisibilityCoordinator({
      initialDocumentVisible: true,
      initialIntersecting: true,
      initialReducedMotion: false,
      onPauseRequested: (reason) => pauseReasons.push(reason),
      onResumeRequested: () => resumeCount++,
    });

    expect(coordinator.isPaused).toBe(false);
    expect(coordinator.pauseReason).toBeNull();

    // 1. Off-screen (IntersectionObserver)
    coordinator.setIntersection(false);
    expect(coordinator.isPaused).toBe(true);
    expect(coordinator.pauseReason).toBe("off-screen");
    expect(pauseReasons).toEqual(["off-screen"]);

    coordinator.setIntersection(true);
    expect(coordinator.isPaused).toBe(false);
    expect(resumeCount).toBe(1);

    // 2. Document hidden (tab switch)
    coordinator.setDocumentVisibility(false);
    expect(coordinator.isPaused).toBe(true);
    expect(coordinator.pauseReason).toBe("document-hidden");
    expect(pauseReasons).toEqual(["off-screen", "document-hidden"]);

    coordinator.setDocumentVisibility(true);
    expect(coordinator.isPaused).toBe(false);
    expect(resumeCount).toBe(2);

    // 3. Pagehide (navigation away)
    coordinator.setPageHide(true);
    expect(coordinator.isPaused).toBe(true);
    expect(coordinator.pauseReason).toBe("pagehide");

    coordinator.setPageHide(false);
    expect(coordinator.isPaused).toBe(false);
    expect(resumeCount).toBe(3);
  });

  test("reduced motion pauses autoplay while keeping manual stepping available", () => {
    const coordinator = new VisibilityCoordinator({
      initialDocumentVisible: true,
      initialIntersecting: true,
      initialReducedMotion: true,
    });

    expect(coordinator.isPaused).toBe(true);
    expect(coordinator.pauseReason).toBe("reduced-motion");
    // Under prefers-reduced-motion, manual stepping is permitted
    expect(coordinator.canStepManually).toBe(true);

    // If the lab is scrolled off-screen, manual stepping is also blocked
    coordinator.setIntersection(false);
    expect(coordinator.canStepManually).toBe(false);
  });

  test("paused laboratory preserves simulatedTime, streamIndex, and resumes exact same run", () => {
    const lab = new HeavyFixtureLaboratory({ id: "pause-lab", particleCount: 100 });
    lab.mount();

    // Step 5 times before pause
    lab.step(5);
    const beforeState = lab.serializeState();
    expect(beforeState.simulatedTime).toBeCloseTo(0.05, 5);
    const timeBefore = beforeState.simulatedTime;
    const streamIndexBefore = beforeState.streamIndex;

    // Simulate pause (e.g. tab hidden)
    const coordinator = new VisibilityCoordinator({ initialDocumentVisible: false });
    expect(coordinator.isPaused).toBe(true);

    // During pause, no steps happen, state remains preserved
    const pausedState = lab.serializeState();
    expect(pausedState.simulatedTime).toBe(timeBefore);
    expect(pausedState.streamIndex).toBe(streamIndexBefore);

    // Resume tab
    coordinator.setDocumentVisibility(true);
    expect(coordinator.isPaused).toBe(false);

    // Continue stepping 5 more times on the same run
    lab.step(5);
    const resumedState = lab.serializeState();
    expect(resumedState.simulatedTime).toBeCloseTo(0.1, 5);
    expect(resumedState.streamIndex).toBeGreaterThan(streamIndexBefore);
    expect(resumedState.runId).toBe(beforeState.runId);

    lab.unmount();
  });
});
